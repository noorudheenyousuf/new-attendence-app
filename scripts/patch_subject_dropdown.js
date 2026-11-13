// Master patch: subject dropdown approach
// 1. index.html — replace checkbox grids with <select> dropdowns
// 2. app.js — 5 targeted changes
// 3. subjectRoutes.js — simplify backend

const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..');
const HTML_FILE = path.join(BASE, 'public/index.html');
const APP_FILE  = path.join(BASE, 'public/js/app.js');
const SRV_FILE  = path.join(BASE, 'server/routes/subjectRoutes.js');

function nl(s, hasCRLF) { return hasCRLF ? s.replace(/\n/g, '\r\n') : s; }

// ─── 1. HTML PATCHES ─────────────────────────────────────────────────────────
let html = fs.readFileSync(HTML_FILE, 'utf8');
const htmlCRLF = html.includes('\r\n');
function hnl(s) { return nl(s, htmlCRLF); }

// 1a. Add Subject modal — replace checkbox grid with <select>
const OLD_ADD_GRID = hnl(`        <div>
          <label class="block text-xs font-bold text-[var(--text-main)] mb-1">
            Assign to Classes
            <span class="text-[var(--text-sub)] font-normal">(optional — pick one or many)</span>
          </label>
          <div id="add-sub-class-checkboxes"
               class="max-h-36 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] p-2 grid grid-cols-2 gap-1">
            <span class="col-span-2 text-xs text-[var(--text-sub)] py-1 italic">No classes available. Add classes first.</span>
          </div>
        </div>`);

const NEW_ADD_SEL = hnl(`        <div>
          <label class="block text-xs font-bold text-[var(--text-main)] mb-1">
            Assign to Class
            <span class="text-[var(--text-sub)] font-normal">(optional — one class per entry)</span>
          </label>
          <select id="add-sub-class-select"
                  class="touch-input w-full bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-4 text-sm font-bold text-[var(--text-main)]">
            <option value="">— No class (optional) —</option>
          </select>
        </div>`);

if (html.includes(OLD_ADD_GRID)) {
  html = html.replace(OLD_ADD_GRID, NEW_ADD_SEL);
  console.log('✅ HTML 1a: Add Subject modal → <select> dropdown');
} else {
  // Try without exact whitespace — find and replace by ID
  const idx = html.indexOf('add-sub-class-checkboxes');
  console.error('❌ HTML 1a: exact match failed; add-sub-class-checkboxes at index:', idx);
}

// 1b. Edit Subject modal — replace checkbox grid with <select>
const OLD_EDIT_GRID = hnl(`        <div>
          <label class="block text-xs font-bold text-[var(--text-main)] mb-1">
            Assign to Classes
            <span class="text-[var(--text-sub)] font-normal">(optional — pick one or many)</span>
          </label>
          <div id="edit-sub-class-checkboxes"
               class="max-h-36 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-page)] p-2 grid grid-cols-2 gap-1">
            <span class="col-span-2 text-xs text-[var(--text-sub)] py-1 italic">No classes available.</span>
          </div>
        </div>`);

const NEW_EDIT_SEL = hnl(`        <div>
          <label class="block text-xs font-bold text-[var(--text-main)] mb-1">
            Assign to Class
            <span class="text-[var(--text-sub)] font-normal">(optional — one class per entry)</span>
          </label>
          <select id="edit-sub-class-select"
                  class="touch-input w-full bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-4 text-sm font-bold text-[var(--text-main)]">
            <option value="">— No class —</option>
          </select>
        </div>`);

if (html.includes(OLD_EDIT_GRID)) {
  html = html.replace(OLD_EDIT_GRID, NEW_EDIT_SEL);
  console.log('✅ HTML 1b: Edit Subject modal → <select> dropdown');
} else {
  const idx = html.indexOf('edit-sub-class-checkboxes');
  console.error('❌ HTML 1b: exact match failed; edit-sub-class-checkboxes at index:', idx);
}

fs.writeFileSync(HTML_FILE, html, 'utf8');
console.log('✅ index.html saved\n');

// ─── 2. APP.JS PATCHES ───────────────────────────────────────────────────────
let app = fs.readFileSync(APP_FILE, 'utf8');
const appCRLF = app.includes('\r\n');
function anl(s) { return nl(s, appCRLF); }

// 2a. openSubjectModal — replace renderTeacherClassCheckboxes with select population
const OLD_OPEN_SUB_MODAL = anl("  renderTeacherClassCheckboxes('add-sub-class-checkboxes', []);\r\n  document.getElementById('modal-add-subject').classList.remove('hidden');");
const NEW_OPEN_SUB_MODAL = anl("  const _addSubSel = document.getElementById('add-sub-class-select');\r\n  if (_addSubSel) {\r\n    _addSubSel.innerHTML = '<option value=\"\">\\u2014 No class (optional) \\u2014</option>'\r\n      + (classesList || []).filter(c => !c.isPrivate)\r\n          .map(c => `<option value=\"${escapeHtml(c.name)}\">${escapeHtml(c.name)}</option>`).join('');\r\n  }\r\n  document.getElementById('modal-add-subject').classList.remove('hidden');");

if (app.includes(OLD_OPEN_SUB_MODAL)) {
  app = app.replace(OLD_OPEN_SUB_MODAL, NEW_OPEN_SUB_MODAL);
  console.log('✅ APP 2a: openSubjectModal → populates <select>');
} else {
  console.error('❌ APP 2a: not found — checking...');
  const idx = app.indexOf("add-sub-class-checkboxes");
  if (idx >= 0) console.log('  Found add-sub-class-checkboxes at:', idx, JSON.stringify(app.slice(idx-5, idx+80)));
}

// 2b. handleSaveSubject — read from select instead of checkboxes
const OLD_SAVE_SUBJECT = anl("  const assignedClasses = getSelectedTeacherCheckboxes('add-sub-class-checkboxes');");
const NEW_SAVE_SUBJECT = anl("  const _cls = document.getElementById('add-sub-class-select') ? document.getElementById('add-sub-class-select').value : '';\r\n  const assignedClasses = _cls ? [_cls] : [];");

if (app.includes(OLD_SAVE_SUBJECT)) {
  app = app.replace(OLD_SAVE_SUBJECT, NEW_SAVE_SUBJECT);
  console.log('✅ APP 2b: handleSaveSubject → reads from <select>');
} else {
  console.error('❌ APP 2b: not found');
}

// 2c. openEditSubjectModal — replace sibling-collection logic with simple select population
// Find the block: siblingClasses + renderTeacherClassCheckboxes('edit-sub-class-checkboxes'...)
const OLD_EDIT_SIBLING = anl("  // Pre-check ALL classes this subject family is currently assigned to.\r\n  // A subject named \"Maths\" may exist as multiple sibling docs (one per class).\r\n  // We collect assignedClasses from ALL sibling docs with the same name.\r\n  const siblingClasses = (subjectsList || [])\r\n    .filter(s => s.name.trim().toLowerCase() === name.trim().toLowerCase() && !s.isPrivate)\r\n    .flatMap(s => s.assignedClasses || []);\r\n  renderTeacherClassCheckboxes('edit-sub-class-checkboxes', siblingClasses);");

const NEW_EDIT_DROPDOWN = anl("  // Find this exact subject doc and pre-select its single class\r\n  const _editSubDoc = (subjectsList || []).find(s => String(s._id) === String(id));\r\n  const _editCurClass = (_editSubDoc && _editSubDoc.assignedClasses && _editSubDoc.assignedClasses[0]) || '';\r\n  const _editSubSel = document.getElementById('edit-sub-class-select');\r\n  if (_editSubSel) {\r\n    _editSubSel.innerHTML = '<option value=\"\">\\u2014 No class \\u2014</option>'\r\n      + (classesList || []).filter(c => !c.isPrivate)\r\n          .map(c => `<option value=\"${escapeHtml(c.name)}\" ${c.name === _editCurClass ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');\r\n  }");

if (app.includes(OLD_EDIT_SIBLING)) {
  app = app.replace(OLD_EDIT_SIBLING, NEW_EDIT_DROPDOWN);
  console.log('✅ APP 2c: openEditSubjectModal → simple dropdown, no sibling scan');
} else {
  console.error('❌ APP 2c: sibling block not found');
  const idx = app.indexOf('siblingClasses');
  if (idx >= 0) console.log('  siblingClasses at:', idx, JSON.stringify(app.slice(idx, idx+200)));
}

// 2d. handleUpdateSubject — read from select
const OLD_UPDATE_SUBJECT = anl("  const assignedClasses = getSelectedTeacherCheckboxes('edit-sub-class-checkboxes');");
const NEW_UPDATE_SUBJECT = anl("  const _editCls = document.getElementById('edit-sub-class-select') ? document.getElementById('edit-sub-class-select').value : '';\r\n  const assignedClasses = _editCls ? [_editCls] : [];");

if (app.includes(OLD_UPDATE_SUBJECT)) {
  app = app.replace(OLD_UPDATE_SUBJECT, NEW_UPDATE_SUBJECT);
  console.log('✅ APP 2d: handleUpdateSubject → reads from <select>');
} else {
  console.error('❌ APP 2d: not found');
}

// 2e. renderSubjectsList filter — fix the duplicate bug (Condition A only)
const OLD_FILTER = anl("    const classSubs = subjectsList.filter(s => {\r\n      const inAssignedClasses = Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName));\r\n      const inClassSubjects = Array.isArray(cls.assignedSubjects) && cls.assignedSubjects.some(as => isClassEqual(as, s.name));\r\n      return inAssignedClasses || inClassSubjects;\r\n    });");

const NEW_FILTER = anl("    const classSubs = subjectsList.filter(s =>\r\n      Array.isArray(s.assignedClasses) && s.assignedClasses.some(ac => isClassEqual(ac, clsName))\r\n    );");

if (app.includes(OLD_FILTER)) {
  app = app.replace(OLD_FILTER, NEW_FILTER);
  console.log('✅ APP 2e: renderSubjectsList → Condition A only (no duplicate)');
} else {
  console.error('❌ APP 2e: filter block not found');
  const idx = app.indexOf('inAssignedClasses');
  if (idx >= 0) console.log('  Context:', JSON.stringify(app.slice(idx-20, idx+200)));
}

fs.writeFileSync(APP_FILE, app, 'utf8');
console.log('✅ app.js saved\n');

// ─── 3. SUBJECT ROUTES PATCHES ───────────────────────────────────────────────
let srv = fs.readFileSync(SRV_FILE, 'utf8');

// 3a. Remove ensureSubjectsPerClass call in GET route
const OLD_ENSURE_CALL = "    await ensureSubjectsPerClass();\n";
if (srv.includes(OLD_ENSURE_CALL)) {
  srv = srv.replace(OLD_ENSURE_CALL, "");
  console.log('✅ SRV 3a: Removed ensureSubjectsPerClass() call from GET');
} else {
  console.error('❌ SRV 3a: ensureSubjectsPerClass call not found in GET');
}

// 3b. Remove the ensureSubjectsPerClass function itself
const OLD_ENSURE_FN = `// Helper to ensure subjects assigned to multiple classes are split into individual records
async function ensureSubjectsPerClass() {
  try {
    const multiSubjects = await Subject.find({
      $expr: { $gt: [{ $size: { $ifNull: ["$assignedClasses", []] } }, 1] }
    });

    for (const sub of multiSubjects) {
      const classes = sub.assignedClasses || [];
      if (classes.length <= 1) continue;

      const firstClass = classes[0];
      const otherClasses = classes.slice(1);

      // Keep original document for the first class
      sub.assignedClasses = [firstClass];
      await sub.save();

      // Create a separate document with its own unique _id for each other class
      for (const cls of otherClasses) {
        const query = sub.isPrivate
          ? { name: sub.name, assignedClasses: cls, isPrivate: true, ownerEmail: sub.ownerEmail }
          : { name: sub.name, assignedClasses: cls, isPrivate: { $ne: true } };
        const existing = await Subject.findOne(query);
        if (!existing) {
          await Subject.create({
            name: sub.name,
            subjectCode: sub.subjectCode,
            teacher: sub.teacher,
            assignedClasses: [cls],
            order: sub.order || 0,
            isPrivate: Boolean(sub.isPrivate),
            ownerEmail: sub.isPrivate ? sub.ownerEmail : '',
            ownerId: sub.isPrivate ? sub.ownerId : null,
            ownerName: sub.isPrivate ? sub.ownerName : ''
          });
        }
      }
    }
  } catch (err) {
    console.error('[Subject Split Error]:', err);
  }
}\n\n`;

if (srv.includes(OLD_ENSURE_FN)) {
  srv = srv.replace(OLD_ENSURE_FN, '');
  console.log('✅ SRV 3b: Removed ensureSubjectsPerClass() function');
} else {
  console.error('❌ SRV 3b: ensureSubjectsPerClass function body not found exactly');
  console.log('  Trying partial match...');
  const idx = srv.indexOf('async function ensureSubjectsPerClass');
  if (idx >= 0) console.log('  Found at index', idx);
}

// 3c. Simplify POST — remove the multi-class branch (if classesArray.length > 1)
// Replace the entire multi-class block with simple single-entry logic
const OLD_POST_MULTI = `    if (classesArray.length > 1) {
      const createdSubjects = [];
      for (const cls of classesArray) {
        const s = await Subject.create({
          name: cleanName,
          subjectCode: finalCode,
          teacher: teacher ? teacher.trim() : (isPrivateBool ? userName : ''),
          assignedClasses: [cls],
          isPrivate: isPrivateBool,
          ownerEmail: isPrivateBool ? userEmail : '',
          ownerId: isPrivateBool ? req.user._id : null,
          ownerName: isPrivateBool ? userName : ''
        });
        createdSubjects.push(s);
        const classQuery = isPrivateBool
          ? { name: cls, isPrivate: true, ownerEmail: userEmail }
          : { name: cls };
        await Class.updateOne(classQuery, { $addToSet: { assignedSubjects: cleanName } });
      }

      await ActivityLog.create({
        action: \`\${isPrivateBool ? 'Private Subject Added' : 'Subject Added'}: \${cleanName}\`,
        details: \`Code: \${finalCode} • Split across \${classesArray.length} classes: \${classesArray.join(', ')}\`,
        performedBy: userName,
        role: userRole,
        entityType: 'subject',
        entityId: createdSubjects[0]._id.toString(),
        canUndo: true,
        previousState: null,
        isPrivate: isPrivateBool,
        ownerEmail: isPrivateBool ? userEmail : ''
      });

      return res.status(201).json({ success: true, data: createdSubjects[0], created: createdSubjects });
    }

    // Single class or unassigned`;

const NEW_POST_SIMPLE = `    // Single class or unassigned (dropdown enforces max one class)`;

if (srv.includes(OLD_POST_MULTI)) {
  srv = srv.replace(OLD_POST_MULTI, NEW_POST_SIMPLE);
  console.log('✅ SRV 3c: Removed multi-class POST branch');
} else {
  console.error('❌ SRV 3c: multi-class POST branch not found exactly');
}

// 3d. Simplify PUT — replace entire sibling logic with single-doc update
const OLD_PUT_SIBLING = `    // New class list requested (may be empty = unassigned)
    const newClasses = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean)
      : (assignedClasses
          ? assignedClasses.split(',').map(s => s.trim()).filter(Boolean)
          : oldSubject.assignedClasses || []);

    // --- Find ALL sibling docs (same name, same privacy scope) ---
    const siblingQuery = oldSubject.isPrivate
      ? { name: caseInsensitiveRegex(oldSubject.name), isPrivate: true, ownerEmail: oldSubject.ownerEmail }
      : { name: caseInsensitiveRegex(oldSubject.name), $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] };
    const allSiblings = await Subject.find(siblingQuery);
    const existingClasses = allSiblings.flatMap(s => s.assignedClasses || []);

    // Classes to remove (were assigned before, not in new list)
    const toRemove = existingClasses.filter(c => !newClasses.some(nc => nc.toLowerCase() === c.toLowerCase()));
    // Classes to add (in new list but no sibling doc yet)
    const toAdd = newClasses.filter(nc => !existingClasses.some(ec => ec.toLowerCase() === nc.toLowerCase()));

    // 1. Delete sibling docs for removed classes & pull from Class.assignedSubjects
    for (const cls of toRemove) {
      const delQuery = oldSubject.isPrivate
        ? { name: caseInsensitiveRegex(oldSubject.name), assignedClasses: cls, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: caseInsensitiveRegex(oldSubject.name), assignedClasses: cls, $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] };
      await Subject.deleteMany(delQuery);
      // Remove from Class.assignedSubjects only if no other sibling covers this class
      const stillExists = await Subject.findOne({ ...delQuery });
      if (!stillExists) {
        const classQ = oldSubject.isPrivate
          ? { name: cls, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
          : { name: cls };
        await Class.updateOne(classQ, { $pull: { assignedSubjects: oldSubject.name } });
        // Also pull updated name in case it changed
        if (updatedName !== oldSubject.name) {
          await Class.updateOne(classQ, { $pull: { assignedSubjects: updatedName } });
        }
      }
    }

    // 2. Update ALL remaining sibling docs with new name/code/teacher
    await Subject.updateMany(
      siblingQuery,
      { name: updatedName, subjectCode: updatedCode, teacher: updatedTeacher }
    );

    // Also update Class.assignedSubjects if name changed
    if (updatedName !== oldSubject.name) {
      for (const cls of existingClasses.filter(c => !toRemove.includes(c))) {
        const classQ = oldSubject.isPrivate
          ? { name: cls, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
          : { name: cls };
        await Class.updateOne(classQ, {
          $pull: { assignedSubjects: oldSubject.name }
        });
        await Class.updateOne(classQ, {
          $addToSet: { assignedSubjects: updatedName }
        });
      }
    }

    // 3. Create new sibling docs for newly added classes
    for (const cls of toAdd) {
      const existsCheck = oldSubject.isPrivate
        ? { name: updatedName, assignedClasses: cls, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: updatedName, assignedClasses: cls, $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] };
      const alreadyExists = await Subject.findOne(existsCheck);
      if (!alreadyExists) {
        await Subject.create({
          name: updatedName,
          subjectCode: updatedCode,
          teacher: updatedTeacher,
          assignedClasses: [cls],
          isPrivate: Boolean(oldSubject.isPrivate),
          ownerEmail: oldSubject.isPrivate ? oldSubject.ownerEmail : '',
          ownerId: oldSubject.isPrivate ? oldSubject.ownerId : null,
          ownerName: oldSubject.isPrivate ? oldSubject.ownerName : ''
        });
      }
      const classQ = oldSubject.isPrivate
        ? { name: cls, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: cls };
      await Class.updateOne(classQ, { $addToSet: { assignedSubjects: updatedName } });
    }

    // 4. If nothing left (unassigned), update this one doc with empty assignedClasses
    if (newClasses.length === 0) {
      await Subject.findByIdAndUpdate(req.params.id, {
        name: updatedName, subjectCode: updatedCode, teacher: updatedTeacher, assignedClasses: []
      });
    }

    const finalDoc = await Subject.findById(req.params.id);`;

const NEW_PUT_SIMPLE = `    // Each subject doc represents one subject-class entry independently
    // Dropdown enforces max one class — just update this single doc
    const newClasses = Array.isArray(assignedClasses)
      ? assignedClasses.map(c => String(c).trim()).filter(Boolean).slice(0, 1)
      : (assignedClasses ? [String(assignedClasses).trim()].filter(Boolean) : []);

    const oldClass = (oldSubject.assignedClasses || [])[0] || '';
    const newClass = newClasses[0] || '';

    // Update Class.assignedSubjects: pull from old class, push to new class
    if (oldClass && oldClass !== newClass) {
      const oldClassQ = oldSubject.isPrivate
        ? { name: oldClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: oldClass };
      await Class.updateOne(oldClassQ, { $pull: { assignedSubjects: oldSubject.name } });
      if (updatedName !== oldSubject.name) {
        await Class.updateOne(oldClassQ, { $pull: { assignedSubjects: updatedName } });
      }
    }
    if (newClass) {
      const newClassQ = oldSubject.isPrivate
        ? { name: newClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: newClass };
      await Class.updateOne(newClassQ, { $addToSet: { assignedSubjects: updatedName } });
    }
    // If name changed, rename in old class's assignedSubjects
    if (updatedName !== oldSubject.name && oldClass && oldClass === newClass) {
      const classQ = oldSubject.isPrivate
        ? { name: oldClass, isPrivate: true, ownerEmail: oldSubject.ownerEmail }
        : { name: oldClass };
      await Class.updateOne(classQ, { $pull: { assignedSubjects: oldSubject.name } });
      await Class.updateOne(classQ, { $addToSet: { assignedSubjects: updatedName } });
    }

    // Update this single subject doc
    await Subject.findByIdAndUpdate(req.params.id, {
      name: updatedName, subjectCode: updatedCode,
      teacher: updatedTeacher, assignedClasses: newClasses
    });

    const finalDoc = await Subject.findById(req.params.id);`;

if (srv.includes(OLD_PUT_SIBLING)) {
  srv = srv.replace(OLD_PUT_SIBLING, NEW_PUT_SIMPLE);
  console.log('✅ SRV 3d: Simplified PUT — single-doc update, no sibling logic');
} else {
  console.error('❌ SRV 3d: PUT sibling block not found exactly');
  const idx = srv.indexOf('siblingQuery');
  if (idx >= 0) console.log('  siblingQuery found at:', idx);
}

// 3e. Remove the unused caseInsensitiveRegex import if ensureSubjectsPerClass was the main user
// Keep it since PUT still used it — actually after simplification it's not needed
// Let's check if caseInsensitiveRegex is still used after all patches
if (!srv.includes('caseInsensitiveRegex')) {
  srv = srv.replace("const { caseInsensitiveRegex } = require('../utils/caseHelper');\n", '');
  console.log('✅ SRV 3e: Removed unused caseInsensitiveRegex import');
} else {
  console.log('ℹ️  SRV 3e: caseInsensitiveRegex still referenced — keeping import');
}

// Remove module.exports.ensureSubjectsPerClass line at end if present
srv = srv.replace("\nmodule.exports.ensureSubjectsPerClass = ensureSubjectsPerClass;", '');

fs.writeFileSync(SRV_FILE, srv, 'utf8');
console.log('✅ subjectRoutes.js saved\n');

console.log('🎉 All patches complete!');
