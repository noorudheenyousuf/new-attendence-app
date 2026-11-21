const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');
const AppSettings = require('../models/AppSettings');
const Enrollment = require('../models/Enrollment');
const PromotionBatch = require('../models/PromotionBatch');
const ActivityLog = require('../models/ActivityLog');
const authMiddleware = require('../middleware/auth');
const staffMiddleware = require('../middleware/staff');
const { caseInsensitiveRegex } = require('../utils/caseHelper');
const { parseRank, computeNextAcademicYear, assignRollNumbers } = require('../utils/promotionHelper');

router.use(authMiddleware, staffMiddleware);

function resolveScope(req, bodyOrQuery = {}) {
  const scope = bodyOrQuery.scope === 'private' ? 'private' : 'public';
  const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
  const isAdmin = Boolean(req.user && req.user.role === 'admin');
  return { scope, isPrivate: scope === 'private', userEmail, isAdmin };
}

function requirePromotionAccess(req, res, scopeInfo) {
  if (!scopeInfo.isPrivate && !scopeInfo.isAdmin) {
    res.status(403).json({ success: false, message: 'Admin privileges required for institution promotion.' });
    return false;
  }
  if (scopeInfo.isPrivate && !scopeInfo.userEmail) {
    res.status(403).json({ success: false, message: 'Valid user email required for private workspace.' });
    return false;
  }
  return true;
}

function buildScopeFilter(scopeInfo) {
  if (scopeInfo.isPrivate) {
    return { isPrivate: true, ownerEmail: scopeInfo.userEmail };
  }
  return { isPrivate: { $ne: true } };
}

async function computeAttendanceMap(studentsList, scopeInfo) {
  const statsMap = new Map();
  if (!Array.isArray(studentsList) || studentsList.length === 0) return statsMap;

  const attFilter = buildScopeFilter(scopeInfo);
  const allAttendance = await Attendance.find(attFilter, 'records').lean();

  const idSet = new Set(studentsList.map(s => String(s.studentId)));
  for (const id of idSet) {
    statsMap.set(id, { sessions: 0, present: 0, absent: 0, leave: 0, percentage: null });
  }

  for (const att of allAttendance) {
    if (!Array.isArray(att.records)) continue;
    for (const rec of att.records) {
      const sid = String(rec.studentId);
      const entry = statsMap.get(sid);
      if (!entry) continue;
      entry.sessions++;
      if (rec.status === 'P') entry.present++;
      else if (rec.status === 'A') entry.absent++;
      else if (rec.status === 'L') entry.leave++;
    }
  }

  for (const [, entry] of statsMap.entries()) {
    entry.percentage = entry.sessions > 0
      ? Number(((entry.present / entry.sessions) * 100).toFixed(1))
      : null;
  }
  return statsMap;
}

/**
 * Shared computation for Preview & Execute so both produce identical results.
 */
async function buildPromotionPlan({ scopeInfo, mode, sourceClasses, classMappings, rollOrderMode, overrides }) {
  const scopeFilter = buildScopeFilter(scopeInfo);
  const allClasses = await Class.find(scopeFilter).sort({ order: 1, name: 1 }).lean();

  // Build auto-mapping from Class.order
  const autoMap = {};
  for (let i = 0; i < allClasses.length; i++) {
    const cls = allClasses[i];
    const nextCls = allClasses[i + 1];
    autoMap[cls.name] = nextCls ? nextCls.name : '__ALUMNI__';
  }

  const effectiveMappings = { ...autoMap, ...(classMappings || {}) };

  const selectedClasses = mode === 'whole-school'
    ? allClasses.map(c => c.name)
    : (Array.isArray(sourceClasses) && sourceClasses.length > 0 ? sourceClasses : []);

  if (selectedClasses.length === 0) {
    return {
      items: [],
      byTargetClass: {},
      summary: { total: 0, promoted: 0, retained: 0, graduated: 0, tc: 0 },
      selectedClasses: []
    };
  }

  const classRegexes = selectedClasses.map(c => caseInsensitiveRegex(c));
  const activeStudents = await Student.find({
    ...scopeFilter,
    registrationStatus: { $ne: 'pending' },
    lifecycleStatus: { $nin: ['alumni', 'tc'] },
    class: { $in: classRegexes }
  }).sort({ class: 1, roll: 1 }).lean();

  // Normalize overrides into a lookup map by student _id
  const overrideMap = new Map();
  if (Array.isArray(overrides)) {
    for (const ov of overrides) {
      const key = String(ov.studentRef || ov._id || ov.id || '');
      if (key) overrideMap.set(key, ov);
    }
  } else if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      overrideMap.set(String(k), v);
    }
  }

  // Group active target students by destination class
  const targetGroups = new Map();
  const exitItems = [];

  for (const st of activeStudents) {
    const idStr = String(st._id);
    const ov = overrideMap.get(idStr) || {};
    const mappedTarget = effectiveMappings[st.class] !== undefined ? effectiveMappings[st.class] : '__ALUMNI__';

    let action = ov.action;
    if (!action) {
      action = mappedTarget === '__ALUMNI__' ? 'graduate' : 'promote';
    }

    const rawRank = (st.academicStatus && st.academicStatus.rank) ? String(st.academicStatus.rank).trim() : '';
    const parsedRank = parseRank(rawRank);

    if (action === 'graduate' || action === 'tc') {
      exitItems.push({
        studentRef: st._id,
        studentId: st.studentId,
        name: st.name,
        photoUrl: st.photoUrl || '',
        currentClass: st.class,
        currentRoll: st.roll,
        rank: rawRank,
        parsedRank,
        action,
        newClass: action === 'graduate' ? 'Alumni' : 'TC / Left',
        newRoll: null,
        newLifecycleStatus: action === 'graduate' ? 'alumni' : 'tc',
        rollOrderReason: action === 'graduate' ? 'Graduated' : 'TC',
        tcNumber: ov.tcNumber ? String(ov.tcNumber).trim() : '',
        reason: ov.reason ? String(ov.reason).trim() : ''
      });
    } else {
      const destClass = action === 'retain'
        ? st.class
        : (ov.targetClass && ov.targetClass !== '__ALUMNI__' ? ov.targetClass : (mappedTarget !== '__ALUMNI__' ? mappedTarget : st.class));

      if (!targetGroups.has(destClass)) {
        targetGroups.set(destClass, []);
      }
      targetGroups.get(destClass).push({
        studentRef: st._id,
        studentId: st.studentId,
        name: st.name,
        photoUrl: st.photoUrl || '',
        currentClass: st.class,
        currentRoll: st.roll,
        roll: st.roll,
        rank: rawRank,
        parsedRank,
        action,
        isRetained: action === 'retain',
        newClass: destClass,
        newLifecycleStatus: 'active'
      });
    }
  }

  const finalItems = [];
  const byTargetClass = {};

  for (const [destClass, group] of targetGroups.entries()) {
    const result = assignRollNumbers(group, rollOrderMode || 'rank');
    byTargetClass[destClass] = {
      className: destClass,
      count: result.students.length,
      hasAnyRank: result.hasAnyRank,
      appliedMode: result.appliedMode,
      students: result.students.map(s => ({
        studentRef: s.studentRef,
        studentId: s.studentId,
        name: s.name,
        photoUrl: s.photoUrl,
        currentClass: s.currentClass,
        currentRoll: s.currentRoll,
        rank: s.rank,
        parsedRank: s.parsedRank,
        action: s.action,
        newClass: destClass,
        newRoll: s.newRoll,
        newLifecycleStatus: 'active',
        rollOrderReason: s.rollOrderReason
      }))
    };
    finalItems.push(...byTargetClass[destClass].students);
  }

  finalItems.push(...exitItems);

  const summary = {
    total: finalItems.length,
    promoted: finalItems.filter(i => i.action === 'promote').length,
    retained: finalItems.filter(i => i.action === 'retain').length,
    graduated: finalItems.filter(i => i.action === 'graduate').length,
    tc: finalItems.filter(i => i.action === 'tc').length
  };

  return {
    items: finalItems,
    byTargetClass,
    summary,
    selectedClasses
  };
}

// @route   GET /api/promotion/overview
// @desc    Get academic year, class order auto-mapping, rank stats, recent batches, and directory counts
router.get('/overview', async (req, res) => {
  try {
    const scopeInfo = resolveScope(req, req.query);
    if (!requirePromotionAccess(req, res, scopeInfo)) return;

    const scopeFilter = buildScopeFilter(scopeInfo);

    let settings = await AppSettings.findOne().lean();
    const currentAcademicYear = (settings && settings.currentAcademicYear) ? settings.currentAcademicYear : '2026-27';
    const suggestedNextYear = computeNextAcademicYear(currentAcademicYear);

    const classes = await Class.find(scopeFilter).sort({ order: 1, name: 1 }).lean();
    const activeStudents = await Student.find({
      ...scopeFilter,
      registrationStatus: { $ne: 'pending' },
      lifecycleStatus: { $nin: ['alumni', 'tc'] }
    }, 'name class roll academicStatus.rank studentId photoUrl').lean();

    const classSummaries = classes.map((cls, idx) => {
      const clsStudents = activeStudents.filter(
        s => String(s.class || '').trim().toLowerCase() === String(cls.name || '').trim().toLowerCase()
      );
      let rankedCount = 0;
      for (const s of clsStudents) {
        if (parseRank(s.academicStatus && s.academicStatus.rank) !== null) {
          rankedCount++;
        }
      }
      const nextCls = classes[idx + 1];
      return {
        _id: cls._id,
        name: cls.name,
        order: cls.order || 0,
        studentCount: clsStudents.length,
        rankedCount,
        unrankedCount: clsStudents.length - rankedCount,
        suggestedTarget: nextCls ? nextCls.name : '__ALUMNI__',
        isLastClass: !nextCls
      };
    });

    const [alumniCount, tcCount, recentBatches, attendanceCount] = await Promise.all([
      Student.countDocuments({ ...scopeFilter, lifecycleStatus: 'alumni' }),
      Student.countDocuments({ ...scopeFilter, lifecycleStatus: 'tc' }),
      PromotionBatch.find({ ...scopeFilter, isUndone: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fromAcademicYear toAcademicYear mode rollOrderMode sourceClasses summary performedBy createdAt')
        .lean(),
      Attendance.countDocuments(scopeFilter)
    ]);

    res.json({
      success: true,
      data: {
        currentAcademicYear,
        suggestedNextYear,
        lastYearBackupAt: settings ? settings.lastYearBackupAt : null,
        lastYearBackupYear: settings ? (settings.lastYearBackupYear || '') : '',
        attendanceCount,
        classes: classSummaries,
        totalActiveStudents: activeStudents.length,
        directoryCounts: {
          alumni: alumniCount,
          tc: tcCount
        },
        recentBatches
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/promotion/preview
// @desc    Dry-run promotion preview (computes new class and 3-tier rank roll numbers without DB writes)
router.post('/preview', async (req, res) => {
  try {
    const scopeInfo = resolveScope(req, req.body);
    if (!requirePromotionAccess(req, res, scopeInfo)) return;

    const {
      mode = 'class',
      sourceClasses = [],
      classMappings = {},
      rollOrderMode = 'rank',
      overrides = {}
    } = req.body;

    const plan = await buildPromotionPlan({
      scopeInfo,
      mode,
      sourceClasses,
      classMappings,
      rollOrderMode,
      overrides
    });

    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/promotion/execute
// @desc    Execute Class-wise or Whole-School Bulk Promotion + save Enrollment & PromotionBatch (Undo)
router.post('/execute', async (req, res) => {
  try {
    const scopeInfo = resolveScope(req, req.body);
    if (!requirePromotionAccess(req, res, scopeInfo)) return;

    const {
      mode = 'class',
      fromAcademicYear,
      toAcademicYear,
      updateAcademicYear = true,
      clearRanksAfterPromotion = true,
      sourceClasses = [],
      classMappings = {},
      rollOrderMode = 'rank',
      overrides = {}
    } = req.body;

    let settings = await AppSettings.findOne();
    if (!settings) settings = await AppSettings.create({});

    const fromYear = (fromAcademicYear && String(fromAcademicYear).trim()) || settings.currentAcademicYear || '2026-27';
    const toYear = (toAcademicYear && String(toAcademicYear).trim()) || computeNextAcademicYear(fromYear);

    const plan = await buildPromotionPlan({
      scopeInfo,
      mode,
      sourceClasses,
      classMappings,
      rollOrderMode,
      overrides
    });

    if (plan.items.length === 0) {
      return res.status(400).json({ success: false, message: 'No active students found to promote.' });
    }

    const studentIds = plan.items.map(i => i.studentRef);
    const studentDocs = await Student.find({ _id: { $in: studentIds } });
    const studentDocMap = new Map(studentDocs.map(doc => [String(doc._id), doc]));

    const attendanceMap = await computeAttendanceMap(studentDocs, scopeInfo);
    const todayStr = new Date().toISOString().slice(0, 10);

    const snapshots = [];
    for (const item of plan.items) {
      const doc = studentDocMap.get(String(item.studentRef));
      if (!doc) continue;

      snapshots.push({
        studentRef: doc._id,
        studentId: doc.studentId,
        name: doc.name,
        previousClass: doc.class,
        previousRoll: doc.roll,
        previousLifecycleStatus: doc.lifecycleStatus || 'active',
        previousRank: (doc.academicStatus && doc.academicStatus.rank) ? String(doc.academicStatus.rank) : '',
        previousExitInfo: doc.exitInfo ? (doc.exitInfo.toObject ? doc.exitInfo.toObject() : { ...doc.exitInfo }) : null,
        previousHistoryLength: Array.isArray(doc.academicHistory) ? doc.academicHistory.length : 0,
        action: item.action,
        newClass: item.newClass,
        newRoll: item.newRoll,
        newLifecycleStatus: item.newLifecycleStatus
      });
    }

    const batch = await PromotionBatch.create({
      fromAcademicYear: fromYear,
      toAcademicYear: toYear,
      mode: mode === 'whole-school' ? 'whole-school' : 'class',
      rollOrderMode: ['rank', 'previous', 'alpha'].includes(rollOrderMode) ? rollOrderMode : 'rank',
      sourceClasses: plan.selectedClasses,
      summary: plan.summary,
      snapshots,
      performedBy: req.user.name || 'Admin',
      performedByEmail: scopeInfo.userEmail,
      isPrivate: scopeInfo.isPrivate,
      ownerEmail: scopeInfo.isPrivate ? scopeInfo.userEmail : ''
    });

    const enrollmentsToCreate = [];

    for (const item of plan.items) {
      const doc = studentDocMap.get(String(item.studentRef));
      if (!doc) continue;

      const attStats = attendanceMap.get(String(doc.studentId)) || {
        sessions: 0,
        present: 0,
        percentage: null
      };

      const oldClass = doc.class;
      const oldRoll = doc.roll;
      const oldRank = (doc.academicStatus && doc.academicStatus.rank) ? String(doc.academicStatus.rank) : '';

      if (!Array.isArray(doc.academicHistory)) doc.academicHistory = [];
      doc.academicHistory.push({
        academicYear: fromYear,
        className: oldClass,
        roll: oldRoll,
        rank: oldRank,
        attendancePercentage: attStats.percentage,
        attendanceSessions: attStats.sessions,
        attendancePresent: attStats.present,
        action: item.action
      });

      if (item.action === 'graduate') {
        doc.lifecycleStatus = 'alumni';
        doc.exitInfo = {
          exitYear: fromYear,
          lastClass: oldClass,
          lastRoll: oldRoll,
          tcNumber: '',
          exitDate: todayStr,
          reason: item.reason || 'Graduated'
        };
      } else if (item.action === 'tc') {
        doc.lifecycleStatus = 'tc';
        doc.exitInfo = {
          exitYear: fromYear,
          lastClass: oldClass,
          lastRoll: oldRoll,
          tcNumber: item.tcNumber || '',
          exitDate: todayStr,
          reason: item.reason || 'Transfer Certificate'
        };
      } else {
        doc.lifecycleStatus = 'active';
        doc.class = item.newClass;
        doc.roll = item.newRoll;
        if (clearRanksAfterPromotion && doc.academicStatus) {
          doc.academicStatus.rank = '';
        }

        enrollmentsToCreate.push({
          studentRef: doc._id,
          studentId: doc.studentId,
          academicYear: toYear,
          className: item.newClass,
          roll: item.newRoll,
          previousRoll: oldRoll,
          previousRank: oldRank,
          action: item.action === 'retain' ? 'retained' : 'promoted',
          promotionBatchId: batch._id,
          isPrivate: scopeInfo.isPrivate,
          ownerEmail: scopeInfo.isPrivate ? scopeInfo.userEmail : ''
        });
      }

      await doc.save();
    }

    if (enrollmentsToCreate.length > 0) {
      await Enrollment.insertMany(enrollmentsToCreate, { ordered: false });
    }

    if (!scopeInfo.isPrivate && updateAcademicYear) {
      settings.currentAcademicYear = toYear;
      settings.updatedAt = new Date();
      await settings.save();
    }

    await ActivityLog.create({
      action: `Student Promotion Completed (${fromYear} → ${toYear})`,
      details: `Promoted: ${plan.summary.promoted} • Retained: ${plan.summary.retained} • Graduated: ${plan.summary.graduated} • TC: ${plan.summary.tc} (${mode})`,
      performedBy: req.user.name || 'Admin',
      performedByEmail: scopeInfo.userEmail,
      role: req.user.role || 'admin',
      entityType: 'promotion',
      entityId: batch._id.toString(),
      canUndo: false,
      isPrivate: scopeInfo.isPrivate,
      ownerEmail: scopeInfo.isPrivate ? scopeInfo.userEmail : ''
    });

    res.json({
      success: true,
      message: `Promotion completed! ${plan.summary.promoted} promoted, ${plan.summary.retained} retained, ${plan.summary.graduated} graduated, ${plan.summary.tc} TC.`,
      data: {
        batchId: batch._id,
        fromAcademicYear: fromYear,
        toAcademicYear: toYear,
        summary: plan.summary,
        currentAcademicYear: settings.currentAcademicYear
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/promotion/undo/:batchId
// @desc    1-Click Undo of a PromotionBatch (restores previous class, roll, rank, lifecycleStatus, exitInfo, history)
router.post('/undo/:batchId', async (req, res) => {
  try {
    const batch = await PromotionBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Promotion batch not found' });
    }
    if (batch.isUndone) {
      return res.status(400).json({ success: false, message: 'This promotion batch has already been undone.' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    if (batch.isPrivate && !isAdmin && batch.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to undo this private batch.' });
    }
    if (!batch.isPrivate && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin privileges required to undo promotion.' });
    }

    let restoredCount = 0;
    for (const snap of batch.snapshots) {
      const student = await Student.findById(snap.studentRef);
      if (!student) continue;

      student.class = snap.previousClass;
      if (snap.previousRoll !== null && snap.previousRoll !== undefined) {
        student.roll = snap.previousRoll;
      }
      student.lifecycleStatus = snap.previousLifecycleStatus || 'active';
      if (!student.academicStatus) student.academicStatus = {};
      student.academicStatus.rank = snap.previousRank || '';
      if (snap.previousExitInfo) {
        student.exitInfo = snap.previousExitInfo;
      } else {
        student.exitInfo = { exitYear: '', lastClass: '', lastRoll: null, tcNumber: '', exitDate: '', reason: '' };
      }
      if (Array.isArray(student.academicHistory) && typeof snap.previousHistoryLength === 'number') {
        student.academicHistory = student.academicHistory.slice(0, snap.previousHistoryLength);
      }

      await student.save();
      restoredCount++;
    }

    await Enrollment.deleteMany({ promotionBatchId: batch._id });

    batch.isUndone = true;
    batch.undoneAt = new Date();
    batch.undoneBy = req.user.name || 'Admin';
    await batch.save();

    await ActivityLog.create({
      action: `Promotion Undone (${batch.fromAcademicYear} → ${batch.toAcademicYear})`,
      details: `Restored ${restoredCount} students to their previous class, roll number & status`,
      performedBy: req.user.name || 'Admin',
      performedByEmail: userEmail,
      role: req.user.role || 'admin',
      entityType: 'promotion',
      entityId: batch._id.toString(),
      canUndo: false,
      isPrivate: Boolean(batch.isPrivate),
      ownerEmail: batch.isPrivate ? batch.ownerEmail : ''
    });

    res.json({
      success: true,
      message: `Undo successful! ${restoredCount} students restored to their previous state.`,
      data: { restoredCount, batchId: batch._id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/promotion/reorder-rolls
// @desc    Re-order roll numbers in a class by Rank (or A-Z / Previous) even after promotion
router.post('/reorder-rolls', async (req, res) => {
  try {
    const scopeInfo = resolveScope(req, req.body);
    if (!requirePromotionAccess(req, res, scopeInfo)) return;

    const { className, rollOrderMode = 'rank' } = req.body;
    if (!className || !String(className).trim()) {
      return res.status(400).json({ success: false, message: 'Class name is required' });
    }

    const scopeFilter = buildScopeFilter(scopeInfo);
    const students = await Student.find({
      ...scopeFilter,
      registrationStatus: { $ne: 'pending' },
      lifecycleStatus: { $nin: ['alumni', 'tc'] },
      class: caseInsensitiveRegex(className)
    }).sort({ roll: 1 });

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: `No active students found in ${className}` });
    }

    const inputList = students.map(s => ({
      studentRef: s._id,
      studentId: s.studentId,
      name: s.name,
      roll: s.roll,
      rank: (s.academicStatus && s.academicStatus.rank) ? String(s.academicStatus.rank) : '',
      isRetained: false
    }));

    const result = assignRollNumbers(inputList, rollOrderMode);
    const settings = await AppSettings.findOne().lean();
    const currentYear = (settings && settings.currentAcademicYear) ? settings.currentAcademicYear : '2026-27';

    const studentMap = new Map(students.map(s => [String(s._id), s]));
    const snapshots = [];

    for (const item of result.students) {
      const doc = studentMap.get(String(item.studentRef));
      if (!doc) continue;
      snapshots.push({
        studentRef: doc._id,
        studentId: doc.studentId,
        name: doc.name,
        previousClass: doc.class,
        previousRoll: doc.roll,
        previousLifecycleStatus: doc.lifecycleStatus || 'active',
        previousRank: (doc.academicStatus && doc.academicStatus.rank) ? String(doc.academicStatus.rank) : '',
        previousExitInfo: doc.exitInfo ? (doc.exitInfo.toObject ? doc.exitInfo.toObject() : { ...doc.exitInfo }) : null,
        previousHistoryLength: Array.isArray(doc.academicHistory) ? doc.academicHistory.length : 0,
        action: 'retain',
        newClass: doc.class,
        newRoll: item.newRoll,
        newLifecycleStatus: 'active'
      });
      doc.roll = item.newRoll;
      await doc.save();
    }

    const batch = await PromotionBatch.create({
      fromAcademicYear: currentYear,
      toAcademicYear: currentYear,
      mode: 'reorder',
      rollOrderMode: ['rank', 'previous', 'alpha'].includes(rollOrderMode) ? rollOrderMode : 'rank',
      sourceClasses: [String(className).trim()],
      summary: { total: result.students.length, promoted: 0, retained: result.students.length, graduated: 0, tc: 0 },
      snapshots,
      performedBy: req.user.name || 'Admin',
      performedByEmail: scopeInfo.userEmail,
      isPrivate: scopeInfo.isPrivate,
      ownerEmail: scopeInfo.isPrivate ? scopeInfo.userEmail : ''
    });

    await ActivityLog.create({
      action: `Roll Numbers Re-ordered: ${className}`,
      details: `${result.students.length} students ordered by ${result.appliedMode}`,
      performedBy: req.user.name || 'Admin',
      performedByEmail: scopeInfo.userEmail,
      role: req.user.role || 'admin',
      entityType: 'promotion',
      entityId: batch._id.toString(),
      canUndo: false,
      isPrivate: scopeInfo.isPrivate,
      ownerEmail: scopeInfo.isPrivate ? scopeInfo.userEmail : ''
    });

    res.json({
      success: true,
      message: `Roll numbers for ${className} re-ordered (${result.appliedMode})!`,
      data: {
        batchId: batch._id,
        appliedMode: result.appliedMode,
        hasAnyRank: result.hasAnyRank,
        students: result.students
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/promotion/directory
// @desc    Alumni & TC Directory with filters (?type=alumni|tc|all&year=...&lastClass=...&search=...&scope=public|private)
router.get('/directory', async (req, res) => {
  try {
    const scopeInfo = resolveScope(req, req.query);
    const scopeFilter = buildScopeFilter(scopeInfo);
    const { type = 'alumni', year, lastClass, search } = req.query;

    const baseLifecycle = type === 'all'
      ? { $in: ['alumni', 'tc'] }
      : (type === 'tc' ? 'tc' : 'alumni');

    const query = {
      ...scopeFilter,
      lifecycleStatus: baseLifecycle
    };

    if (year && year !== 'all') {
      query['exitInfo.exitYear'] = String(year).trim();
    }
    if (lastClass && lastClass !== 'all') {
      query['exitInfo.lastClass'] = caseInsensitiveRegex(lastClass);
    }
    if (search && String(search).trim()) {
      const escaped = String(search).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [
        { name: rx },
        { 'exitInfo.lastClass': rx },
        { 'exitInfo.tcNumber': rx },
        { 'familyDetails.fatherName': rx },
        { 'familyDetails.fatherMobile': rx }
      ];
      const numVal = Number(search);
      if (!isNaN(numVal)) {
        query.$or.push({ studentId: numVal }, { 'exitInfo.lastRoll': numVal });
      }
    }

    const students = await Student.find(query).sort({ 'exitInfo.exitYear': -1, name: 1 }).lean();

    // Also fetch distinct years & lastClasses for filter dropdowns
    const allExited = await Student.find({
      ...scopeFilter,
      lifecycleStatus: { $in: ['alumni', 'tc'] }
    }, 'lifecycleStatus exitInfo.exitYear exitInfo.lastClass').lean();

    const yearsSet = new Set();
    const classesSet = new Set();
    let alumniCount = 0;
    let tcCount = 0;

    for (const s of allExited) {
      if (s.lifecycleStatus === 'alumni') alumniCount++;
      if (s.lifecycleStatus === 'tc') tcCount++;
      if (s.exitInfo && s.exitInfo.exitYear) yearsSet.add(s.exitInfo.exitYear);
      if (s.exitInfo && s.exitInfo.lastClass) classesSet.add(s.exitInfo.lastClass);
    }

    res.json({
      success: true,
      data: students,
      meta: {
        alumniCount,
        tcCount,
        years: Array.from(yearsSet).sort().reverse(),
        lastClasses: Array.from(classesSet).sort()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/promotion/readmit/:id
// @desc    Re-admit an Alumni or TC student back into an Active class
router.post('/readmit/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const userEmail = (req.user && req.user.email) ? req.user.email.toLowerCase().trim() : '';
    const isAdmin = Boolean(req.user && req.user.role === 'admin');
    if (student.isPrivate && !isAdmin && student.ownerEmail !== userEmail) {
      return res.status(403).json({ success: false, message: 'Access denied to re-admit this private student' });
    }
    if (!student.isPrivate && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin privileges required to re-admit student' });
    }

    const { targetClass, roll } = req.body;
    const assignedClass = (targetClass && String(targetClass).trim())
      || (student.exitInfo && student.exitInfo.lastClass)
      || student.class;

    let assignedRoll = roll !== undefined && roll !== null && String(roll).trim() !== '' ? Number(roll) : null;
    if (!assignedRoll || isNaN(assignedRoll)) {
      const classScope = student.isPrivate
        ? { isPrivate: true, ownerEmail: student.ownerEmail }
        : { isPrivate: { $ne: true } };
      const maxRollStudent = await Student.findOne({
        ...classScope,
        lifecycleStatus: { $nin: ['alumni', 'tc'] },
        class: caseInsensitiveRegex(assignedClass)
      }).sort({ roll: -1 }).select('roll').lean();
      assignedRoll = maxRollStudent && Number.isFinite(maxRollStudent.roll) ? maxRollStudent.roll + 1 : 1;
    }

    const prevStatus = student.lifecycleStatus;
    student.lifecycleStatus = 'active';
    student.class = assignedClass;
    student.roll = assignedRoll;
    await student.save();

    await ActivityLog.create({
      action: `Student Re-admitted: ${student.name}`,
      details: `Moved from ${prevStatus.toUpperCase()} back to ${assignedClass} (Roll #${assignedRoll})`,
      performedBy: req.user.name || 'Admin',
      performedByEmail: userEmail,
      role: req.user.role || 'admin',
      entityType: 'promotion',
      entityId: student._id.toString(),
      canUndo: false,
      isPrivate: Boolean(student.isPrivate),
      ownerEmail: student.isPrivate ? student.ownerEmail : ''
    });

    res.json({
      success: true,
      message: `${student.name} re-admitted to ${assignedClass} (Roll #${assignedRoll})!`,
      data: student
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
