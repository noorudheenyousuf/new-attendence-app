// ============================================================================
// REGISTERLY — Academic Year Transition, Student Promotion Wizard,
// Alumni & TC Directory, Year-End Export & Offline JSON Archive Viewer
// ============================================================================

(function () {
  'use strict';

  const PromoState = {
    overview: null,
    scope: 'public',
    mode: 'class', // 'class' | 'whole-school'
    rollOrderMode: 'rank', // 'rank' | 'previous' | 'alpha'
    selectedClass: '',
    classMappings: {},
    overrides: {}, // { [studentRef]: { action, targetClass, tcNumber, reason } }
    previewData: null,
    step: 'select', // 'select' | 'confirm'
    toAcademicYear: '',
    clearRanksAfterPromotion: true,
    updateAcademicYear: true,

    // Directory state
    dirType: 'alumni', // 'alumni' | 'tc'
    dirYear: 'all',
    dirClass: 'all',
    dirSearch: '',
    dirStudents: [],
    dirMeta: { alumniCount: 0, tcCount: 0, years: [], lastClasses: [] },

    // Offline JSON Archive Viewer state
    archiveData: null,
    archiveClassFilter: 'all',
    archiveStatusFilter: 'active',
    archiveSearch: ''
  };

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isAdminUser() {
    return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin';
  }

  function notify(msg, isError = false) {
    if (typeof showToast === 'function') {
      showToast(msg, isError);
    } else {
      alert(msg);
    }
  }

  async function confirmDialog({ title, badge, message, isDanger = false }) {
    if (typeof showCustomConfirm === 'function') {
      return showCustomConfirm({ title, badge, message, isDanger });
    }
    return window.confirm(`${title}\n\n${message}`);
  }

  function getCurrentAcademicYearLabel() {
    if (typeof appSettings !== 'undefined' && appSettings) {
      return appSettings.currentAcademicYear || appSettings.academicYear || '2026-27';
    }
    return '2026-27';
  }

  function ensureModalRoot() {
    let root = document.getElementById('promotion-modals-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'promotion-modals-root';
      root.className = 'no-print';
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModalById(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // ==========================================================================
  // 1. ADMIN PANEL SYNC (Current Academic Year, Backup Gate & Recent Batches)
  // ==========================================================================
  async function syncAdminPromotionCard() {
    const yearInput = document.getElementById('admin-input-academic-year');
    const yearBadge = document.getElementById('admin-academic-year-badge');
    const backupStatusEl = document.getElementById('admin-year-backup-status');
    const cleanupBtn = document.getElementById('btn-safe-cleanup-year');
    const recentContainer = document.getElementById('admin-recent-promotion-batches');

    const yr = getCurrentAcademicYearLabel();
    if (yearInput && !yearInput.value) yearInput.value = yr;
    if (yearBadge) yearBadge.textContent = yr;

    if (!isAdminUser()) return;

    try {
      const res = await API.getPromotionOverview('public');
      if (!res.success || !res.data) return;
      PromoState.overview = res.data;

      if (yearInput) yearInput.value = res.data.currentAcademicYear;
      if (yearBadge) yearBadge.textContent = res.data.currentAcademicYear;

      const dashYr = document.getElementById('dashboard-academic-year');
      if (dashYr) dashYr.textContent = `Academic Year ${res.data.currentAcademicYear}`;

      // Backup status & Safe Cleanup Gate
      const hasBackup = Boolean(res.data.lastYearBackupAt);
      if (backupStatusEl) {
        if (hasBackup) {
          const dt = new Date(res.data.lastYearBackupAt).toLocaleString();
          backupStatusEl.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400 font-bold">✓ Backup Ready (${esc(res.data.lastYearBackupYear || res.data.currentAcademicYear)})</span> · ${esc(dt)} · ${res.data.attendanceCount} attendance logs`;
        } else {
          backupStatusEl.innerHTML = `<span class="text-amber-600 dark:text-amber-400 font-bold">⚠ Download Full Year JSON Archive first to unlock Safe Cleanup</span> · ${res.data.attendanceCount} attendance logs`;
        }
      }

      if (cleanupBtn) {
        cleanupBtn.disabled = !hasBackup;
        cleanupBtn.classList.toggle('opacity-50', !hasBackup);
        cleanupBtn.classList.toggle('cursor-not-allowed', !hasBackup);
      }

      // Directory counts badge
      const dirBadge = document.getElementById('admin-directory-counts-badge');
      if (dirBadge && res.data.directoryCounts) {
        dirBadge.textContent = `${res.data.directoryCounts.alumni} Alumni · ${res.data.directoryCounts.tc} TC`;
      }

      // Recent batches for 1-Click Undo
      if (recentContainer) {
        const batches = res.data.recentBatches || [];
        if (batches.length === 0) {
          recentContainer.innerHTML = `<div class="text-[11px] text-[var(--text-sub)] italic">No recent promotion batches.</div>`;
        } else {
          recentContainer.innerHTML = batches.map(b => `
            <div class="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)]">
              <div class="min-w-0">
                <div class="text-xs font-bold text-[var(--text-main)] truncate">
                  ${b.mode === 'reorder' ? '🏆 Roll Reorder' : `🎓 ${esc(b.fromAcademicYear)} → ${esc(b.toAcademicYear)}`}
                </div>
                <div class="text-[10px] text-[var(--text-sub)] truncate">
                  ${b.summary ? `${b.summary.promoted || 0} Promoted · ${b.summary.retained || 0} Retained · ${b.summary.graduated || 0} Alumni · ${b.summary.tc || 0} TC` : ''}
                </div>
              </div>
              <button type="button" onclick="undoPromotionBatch('${esc(b._id)}')" class="touch-btn flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-[11px] transition">
                ↩ Undo
              </button>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('[Promotion Overview]', err.message);
    }
  }

  async function saveAcademicYearSetting() {
    const input = document.getElementById('admin-input-academic-year');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      notify('Please enter an academic year (e.g. 2026-27)', true);
      return;
    }
    try {
      const res = await API.updateAdminSettings({ currentAcademicYear: val });
      if (res.success) {
        if (typeof appSettings !== 'undefined' && appSettings) {
          appSettings.currentAcademicYear = val;
        }
        const dashYr = document.getElementById('dashboard-academic-year');
        if (dashYr) dashYr.textContent = `Academic Year ${val}`;
        notify(`Academic Year updated to ${val}`);
        syncAdminPromotionCard();
      }
    } catch (err) {
      notify(err.message || 'Failed to update academic year', true);
    }
  }

  // ==========================================================================
  // 2. ACADEMIC YEAR QUICK SHEET (Tapped from Dashboard #dashboard-academic-year)
  // ==========================================================================
  function openAcademicYearQuickModal() {
    const root = ensureModalRoot();
    closeModalById('modal-academic-year-quick');
    const yr = getCurrentAcademicYearLabel();
    const admin = isAdminUser();

    const html = `
      <div id="modal-academic-year-quick" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onclick="if(event.target===this) closePromotionModal('modal-academic-year-quick')">
        <div class="bg-[var(--card-bg)] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-[var(--border-color)] space-y-4">
          <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Active Session</span>
              <h3 class="text-base font-black text-[var(--text-main)]">Academic Year ${esc(yr)}</h3>
            </div>
            <button type="button" onclick="closePromotionModal('modal-academic-year-quick')" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-sub)] font-bold flex items-center justify-center">✕</button>
          </div>

          <div class="space-y-2.5">
            <button type="button" onclick="closePromotionModal('modal-academic-year-quick'); openOfflineArchiveViewer();" class="touch-btn w-full p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between gap-3 text-left transition">
              <div class="min-w-0">
                <div class="text-xs font-black text-amber-800 dark:text-amber-300">📂 Open Archive JSON (Read-Only)</div>
                <div class="text-[11px] text-[var(--text-sub)]">View & print past year records offline with zero DB load</div>
              </div>
              <span class="text-amber-600 font-black">→</span>
            </button>

            <button type="button" onclick="closePromotionModal('modal-academic-year-quick'); openAlumniDirectoryModal();" class="touch-btn w-full p-3.5 rounded-2xl bg-[var(--bg-page)] hover:bg-[#245b70]/10 border border-[var(--border-color)] flex items-center justify-between gap-3 text-left transition">
              <div class="min-w-0">
                <div class="text-xs font-black text-[var(--text-main)]">🎓 Alumni & TC Directory</div>
                <div class="text-[11px] text-[var(--text-sub)]">Search graduated & transferred students, print profiles</div>
              </div>
              <span class="text-[#245b70] dark:text-cyan-400 font-black">→</span>
            </button>

            ${admin ? `
              <button type="button" onclick="closePromotionModal('modal-academic-year-quick'); openPromotionWizard();" class="touch-btn w-full p-3.5 rounded-2xl bg-[#245b70] hover:bg-[#1a4454] text-white flex items-center justify-between gap-3 text-left transition shadow-sm">
                <div class="min-w-0">
                  <div class="text-xs font-black">🚀 Student Promotion Wizard</div>
                  <div class="text-[11px] text-white/80">Promote classes, auto-assign roll numbers by Rank & Undo</div>
                </div>
                <span class="font-black">→</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    root.insertAdjacentHTML('beforeend', html);
  }

  // ==========================================================================
  // 3. 4-STEP MOBILE-FIRST PROMOTION WIZARD
  // ==========================================================================
  async function openPromotionWizard(scope = 'public') {
    if (scope !== 'private' && !isAdminUser()) {
      notify('Admin privileges required for institution promotion.', true);
      return;
    }

    PromoState.scope = scope;
    PromoState.step = 'select';
    PromoState.mode = 'class';
    PromoState.rollOrderMode = 'rank';
    PromoState.overrides = {};
    PromoState.previewData = null;

    const root = ensureModalRoot();
    closeModalById('modal-promotion-wizard');

    root.insertAdjacentHTML('beforeend', `
      <div id="modal-promotion-wizard" class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
        <div class="bg-[var(--card-bg)] w-full max-w-2xl h-[92vh] sm:h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-color)] flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-sm sm:text-base font-black text-[var(--text-main)] truncate">Student Promotion Wizard</h3>
                <span id="promo-year-pill" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">Loading...</span>
              </div>
              <p class="text-[10px] text-[var(--text-sub)]">Smart 3-Tier Rank Roll Numbers · 1-Click Undo Safe</p>
            </div>
            <button type="button" onclick="closePromotionModal('modal-promotion-wizard')" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-sub)] font-bold flex items-center justify-center flex-shrink-0">✕</button>
          </div>

          <!-- Body -->
          <div id="promo-wizard-body" class="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
            <div class="py-12 text-center text-xs text-[var(--text-sub)] font-bold">Loading classes & students...</div>
          </div>

          <!-- Fixed Sticky Footer -->
          <div id="promo-wizard-footer" class="promo-sticky-footer px-4 py-3 border-t border-[var(--border-color)] bg-[var(--card-bg)] flex items-center justify-between gap-2 flex-shrink-0">
            <div id="promo-footer-counts" class="text-[11px] font-bold text-[var(--text-sub)] truncate">Ready</div>
            <div id="promo-footer-actions" class="flex items-center gap-2 flex-shrink-0"></div>
          </div>
        </div>
      </div>
    `);

    try {
      const res = await API.getPromotionOverview(scope);
      if (!res.success) throw new Error(res.message || 'Failed to load overview');
      PromoState.overview = res.data;
      PromoState.toAcademicYear = res.data.suggestedNextYear;

      const mappings = {};
      for (const c of (res.data.classes || [])) {
        mappings[c.name] = c.suggestedTarget;
      }
      PromoState.classMappings = mappings;

      const firstWithStudents = (res.data.classes || []).find(c => c.studentCount > 0) || (res.data.classes || [])[0];
      PromoState.selectedClass = firstWithStudents ? firstWithStudents.name : '';

      const pill = document.getElementById('promo-year-pill');
      if (pill) pill.textContent = `${res.data.currentAcademicYear} → ${res.data.suggestedNextYear}`;

      await refreshPromotionPreview();
    } catch (err) {
      const body = document.getElementById('promo-wizard-body');
      if (body) body.innerHTML = `<div class="p-4 rounded-2xl bg-rose-500/10 text-rose-600 text-xs font-bold">${esc(err.message)}</div>`;
    }
  }

  async function refreshPromotionPreview() {
    const ov = PromoState.overview;
    if (!ov) return;

    const sourceClasses = PromoState.mode === 'whole-school'
      ? (ov.classes || []).map(c => c.name)
      : (PromoState.selectedClass ? [PromoState.selectedClass] : []);

    if (sourceClasses.length === 0) {
      PromoState.previewData = { items: [], byTargetClass: {}, summary: { total: 0, promoted: 0, retained: 0, graduated: 0, tc: 0 } };
      renderPromotionWizard();
      return;
    }

    try {
      const res = await API.previewPromotion({
        scope: PromoState.scope,
        mode: PromoState.mode,
        sourceClasses,
        classMappings: PromoState.classMappings,
        rollOrderMode: PromoState.rollOrderMode,
        overrides: PromoState.overrides
      });
      if (res.success) {
        PromoState.previewData = res.data;
      }
    } catch (err) {
      notify(err.message || 'Preview failed', true);
    }

    renderPromotionWizard();
  }

  function renderPromotionWizard() {
    const body = document.getElementById('promo-wizard-body');
    const countsEl = document.getElementById('promo-footer-counts');
    const actionsEl = document.getElementById('promo-footer-actions');
    if (!body || !PromoState.overview) return;

    const ov = PromoState.overview;
    const classes = ov.classes || [];
    const preview = PromoState.previewData || { items: [], byTargetClass: {}, summary: { total: 0, promoted: 0, retained: 0, graduated: 0, tc: 0 } };
    const sum = preview.summary || { total: 0, promoted: 0, retained: 0, graduated: 0, tc: 0 };

    if (PromoState.step === 'confirm') {
      renderPromotionConfirmStep(body, countsEl, actionsEl, ov, preview, sum);
      return;
    }

    // Step 1: Select & Review
    const isWhole = PromoState.mode === 'whole-school';
    const selectedClsObj = classes.find(c => c.name === PromoState.selectedClass);
    const destTarget = PromoState.classMappings[PromoState.selectedClass] || '__ALUMNI__';
    const isLastOrAlumni = destTarget === '__ALUMNI__';

    const classOptionsHtml = classes.map(c =>
      `<option value="${esc(c.name)}" ${c.name === PromoState.selectedClass ? 'selected' : ''}>${esc(c.name)} (${c.studentCount} students${c.rankedCount ? ` · ${c.rankedCount} ranked` : ''})</option>`
    ).join('');

    const targetOptionsFor = (selectedVal) => {
      const opts = classes.map(c =>
        `<option value="${esc(c.name)}" ${c.name === selectedVal ? 'selected' : ''}>→ ${esc(c.name)}</option>`
      ).join('');
      return opts + `<option value="__ALUMNI__" ${selectedVal === '__ALUMNI__' ? 'selected' : ''}>🎓 Graduate (Alumni)</option>`;
    };

    // Student review cards (Class-wise mode)
    let cardsHtml = '';
    if (!isWhole) {
      const items = preview.items || [];
      if (items.length === 0) {
        cardsHtml = `<div class="p-6 text-center rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-xs text-[var(--text-sub)] font-bold">No active students in this class.</div>`;
      } else {
        cardsHtml = items.map(st => {
          const sid = String(st.studentRef);
          const ovEntry = PromoState.overrides[sid] || {};
          const act = st.action;
          const primaryAction = isLastOrAlumni ? 'graduate' : 'promote';
          const primaryLabel = isLastOrAlumni ? 'Graduate' : 'Promote';
          const rollArrow = (act === 'graduate' || act === 'tc')
            ? `<span class="text-[11px] font-bold text-amber-600 dark:text-amber-400">Roll #${esc(st.currentRoll)} → ${act === 'graduate' ? '🎓 Alumni' : '📄 TC / Left'}</span>`
            : `<span class="text-[11px] font-bold text-teal-700 dark:text-teal-300">Roll #${esc(st.currentRoll)} → New #${esc(st.newRoll)}</span> <span class="text-[10px] text-[var(--text-sub)]">(${esc(st.newClass)})</span>`;

          return `
            <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2">
              <!-- Row 1: Name + Rank Badge -->
              <div class="flex items-center justify-between gap-2">
                <div class="font-extrabold text-xs text-[var(--text-main)] truncate">${esc(st.name)}</div>
                ${st.parsedRank !== null
                  ? `<span class="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">🏆 Rank ${st.parsedRank}</span>`
                  : `<span class="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[var(--text-sub)]">ID ${esc(st.studentId)}</span>`
                }
              </div>

              <!-- Row 2: Live Roll Preview -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>${rollArrow}</div>
                <span class="text-[10px] text-[var(--text-sub)]">${esc(st.rollOrderReason || '')}</span>
              </div>

              <!-- Row 3: 3-Button Segmented Pill -->
              <div class="promo-seg-pill grid grid-cols-3 gap-1 p-1 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <button type="button" onclick="setStudentPromotionAction('${esc(sid)}', '${primaryAction}')" class="py-1.5 rounded-lg text-[11px] font-bold transition ${act === primaryAction ? 'bg-[#245b70] text-white shadow-xs' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'}">
                  ${primaryLabel}
                </button>
                <button type="button" onclick="setStudentPromotionAction('${esc(sid)}', 'retain')" class="py-1.5 rounded-lg text-[11px] font-bold transition ${act === 'retain' ? 'bg-amber-500 text-white shadow-xs' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'}">
                  Retain
                </button>
                <button type="button" onclick="setStudentPromotionAction('${esc(sid)}', 'tc')" class="py-1.5 rounded-lg text-[11px] font-bold transition ${act === 'tc' ? 'bg-rose-600 text-white shadow-xs' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'}">
                  TC
                </button>
              </div>

              ${act === 'tc' ? `
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <input type="text" placeholder="TC Number (optional)" value="${esc(ovEntry.tcNumber || '')}" oninput="setStudentTcField('${esc(sid)}', 'tcNumber', this.value)" class="touch-input bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-[11px] text-[var(--text-main)]">
                  <input type="text" placeholder="Reason (optional)" value="${esc(ovEntry.reason || '')}" oninput="setStudentTcField('${esc(sid)}', 'reason', this.value)" class="touch-input bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-[11px] text-[var(--text-main)]">
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    } else {
      // Whole-School Mapping Cards
      cardsHtml = `
        <div class="space-y-2">
          <div class="text-[11px] font-black text-[#245b70] dark:text-cyan-400 uppercase tracking-wide">Auto Class Mapping (by Class Order)</div>
          ${classes.map(c => {
            const mapped = PromoState.classMappings[c.name] || '__ALUMNI__';
            return `
              <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="text-xs font-extrabold text-[var(--text-main)] truncate">${esc(c.name)}</div>
                  <div class="text-[10px] text-[var(--text-sub)]">${c.studentCount} students · ${c.rankedCount} ranked</div>
                </div>
                <select onchange="setWholeSchoolMapping('${esc(c.name)}', this.value)" class="touch-input bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)] max-w-[52%]">
                  ${targetOptionsFor(mapped)}
                </select>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <!-- 2-Tab Segmented Switch -->
      <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)]">
        <button type="button" onclick="setPromotionMode('class')" class="py-2 rounded-xl text-xs font-black transition ${!isWhole ? 'bg-[#245b70] text-white shadow-sm' : 'text-[var(--text-sub)]'}">
          Class-wise
        </button>
        <button type="button" onclick="setPromotionMode('whole-school')" class="py-2 rounded-xl text-xs font-black transition ${isWhole ? 'bg-[#245b70] text-white shadow-sm' : 'text-[var(--text-sub)]'}">
          Whole School
        </button>
      </div>

      <!-- Controls Card -->
      <div class="p-3.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2.5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label class="block text-[10px] font-bold text-[var(--text-sub)] mb-1">Next Academic Year</label>
            <input type="text" value="${esc(PromoState.toAcademicYear)}" onchange="setPromotionNextYear(this.value)" class="touch-input w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)]" placeholder="2027-28">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-[var(--text-sub)] mb-1">New Roll Number Order</label>
            <select onchange="setPromotionRollMode(this.value)" class="touch-input w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)]">
              <option value="rank" ${PromoState.rollOrderMode === 'rank' ? 'selected' : ''}>🏆 By Rank (Smart Auto)</option>
              <option value="previous" ${PromoState.rollOrderMode === 'previous' ? 'selected' : ''}>Keep Previous Roll</option>
              <option value="alpha" ${PromoState.rollOrderMode === 'alpha' ? 'selected' : ''}>Alphabetical (A–Z)</option>
            </select>
          </div>
        </div>

        ${!isWhole ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <label class="block text-[10px] font-bold text-[var(--text-sub)] mb-1">Source Class</label>
              <select onchange="setPromotionSourceClass(this.value)" class="touch-input w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)]">
                ${classOptionsHtml}
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-[var(--text-sub)] mb-1">Promote To</label>
              <select onchange="setWholeSchoolMapping('${esc(PromoState.selectedClass)}', this.value)" class="touch-input w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--text-main)]">
                ${targetOptionsFor(destTarget)}
              </select>
            </div>
          </div>
          ${selectedClsObj ? `
            <div class="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span class="text-[10px] text-[var(--text-sub)]">
                ${selectedClsObj.rankedCount > 0
                  ? `🏆 ${selectedClsObj.rankedCount} ranked · ${selectedClsObj.unrankedCount} unranked`
                  : `ℹ️ No ranks entered — will preserve Roll #1..N automatically`}
              </span>
              <button type="button" onclick="reorderCurrentClassRollsByRank()" class="text-[10px] font-black text-[#245b70] dark:text-cyan-400 hover:underline">
                🏆 Re-order Existing Rolls by Rank Only
              </button>
            </div>
          ` : ''}
        ` : ''}

        <div class="flex items-center gap-4 flex-wrap pt-1 text-[11px] text-[var(--text-main)]">
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" ${PromoState.clearRanksAfterPromotion ? 'checked' : ''} onchange="togglePromoClearRanks(this.checked)" class="rounded">
            <span>Clear old ranks after promotion</span>
          </label>
          <label class="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" ${PromoState.updateAcademicYear ? 'checked' : ''} onchange="togglePromoUpdateYear(this.checked)" class="rounded">
            <span>Switch active year to ${esc(PromoState.toAcademicYear)}</span>
          </label>
        </div>
      </div>

      <!-- Student Cards / Class Mappings -->
      <div class="space-y-2.5">
        ${cardsHtml}
      </div>
    `;

    // Sticky Footer
    const parts = [];
    if (sum.promoted > 0) parts.push(`${sum.promoted} Promote`);
    if (sum.graduated > 0) parts.push(`${sum.graduated} Graduate`);
    if (sum.retained > 0) parts.push(`${sum.retained} Retain`);
    if (sum.tc > 0) parts.push(`${sum.tc} TC`);
    if (countsEl) countsEl.textContent = parts.length ? parts.join(' · ') : '0 students selected';

    if (actionsEl) {
      actionsEl.innerHTML = `
        <button type="button" onclick="goToPromotionConfirmStep()" ${sum.total === 0 ? 'disabled' : ''} class="touch-btn px-4 py-2 rounded-xl bg-[#245b70] hover:bg-[#1a4454] text-white font-black text-xs shadow-sm transition ${sum.total === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
          Preview & Confirm →
        </button>
      `;
    }
  }

  function renderPromotionConfirmStep(body, countsEl, actionsEl, ov, preview, sum) {
    const groups = Object.values(preview.byTargetClass || {});
    const exitItems = (preview.items || []).filter(i => i.action === 'graduate' || i.action === 'tc');

    body.innerHTML = `
      <div class="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/25 space-y-1.5">
        <div class="text-xs font-black text-teal-800 dark:text-teal-300">Confirm Promotion Summary (${esc(ov.currentAcademicYear)} → ${esc(PromoState.toAcademicYear)})</div>
        <div class="text-[11px] text-[var(--text-main)] font-semibold">
          Total: <b>${sum.total}</b> · Promote: <b>${sum.promoted}</b> · Retain: <b>${sum.retained}</b> · Graduate: <b>${sum.graduated}</b> · TC: <b>${sum.tc}</b>
        </div>
        <div class="text-[10px] text-[var(--text-sub)]">A full undo snapshot will be saved automatically so you can revert with 1 click anytime.</div>
      </div>

      ${groups.map(g => `
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-black text-[var(--text-main)]">Destination: ${esc(g.className)}</div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#245b70]/15 text-[#245b70] dark:text-cyan-300">${g.count} students · ${esc(g.appliedMode)}</span>
          </div>
          <div class="divide-y divide-[var(--border-color)] max-h-48 overflow-y-auto">
            ${g.students.map(s => `
              <div class="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                <div class="min-w-0 truncate">
                  <span class="font-bold text-[var(--text-main)]">${esc(s.name)}</span>
                  ${s.parsedRank !== null ? `<span class="ml-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">🏆R${s.parsedRank}</span>` : ''}
                  ${s.action === 'retain' ? `<span class="ml-1 text-[10px] text-amber-600 font-bold">(Retained)</span>` : ''}
                </div>
                <span class="flex-shrink-0 font-bold text-teal-700 dark:text-teal-300">#${esc(s.currentRoll)} → #${esc(s.newRoll)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}

      ${exitItems.length > 0 ? `
        <div class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div class="text-xs font-black text-amber-800 dark:text-amber-300">Moving to Alumni & TC Directory (${exitItems.length})</div>
          <div class="divide-y divide-amber-500/20 max-h-40 overflow-y-auto">
            ${exitItems.map(s => `
              <div class="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span class="font-bold text-[var(--text-main)] truncate">${esc(s.name)} (${esc(s.currentClass)})</span>
                <span class="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${s.action === 'graduate' ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}">
                  ${s.action === 'graduate' ? '🎓 Alumni' : `📄 TC${s.tcNumber ? ` #${esc(s.tcNumber)}` : ''}`}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    if (countsEl) countsEl.textContent = `Ready to update ${sum.total} students`;
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button type="button" onclick="backToPromotionSelectStep()" class="touch-btn px-3 py-2 rounded-xl bg-[var(--bg-page)] border border-[var(--border-color)] text-[var(--text-main)] font-bold text-xs">
          ← Back
        </button>
        <button type="button" id="btn-confirm-execute-promo" onclick="executePromotionNow()" class="touch-btn px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition">
          ✓ Confirm & Promote
        </button>
      `;
    }
  }

  async function executePromotionNow() {
    const btn = document.getElementById('btn-confirm-execute-promo');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Promoting...';
    }
    try {
      const ov = PromoState.overview;
      const sourceClasses = PromoState.mode === 'whole-school'
        ? (ov.classes || []).map(c => c.name)
        : [PromoState.selectedClass];

      const res = await API.executePromotion({
        scope: PromoState.scope,
        mode: PromoState.mode,
        fromAcademicYear: ov.currentAcademicYear,
        toAcademicYear: PromoState.toAcademicYear,
        updateAcademicYear: PromoState.updateAcademicYear,
        clearRanksAfterPromotion: PromoState.clearRanksAfterPromotion,
        sourceClasses,
        classMappings: PromoState.classMappings,
        rollOrderMode: PromoState.rollOrderMode,
        overrides: PromoState.overrides
      });

      if (res.success) {
        if (res.data && res.data.currentAcademicYear && typeof appSettings !== 'undefined' && appSettings) {
          appSettings.currentAcademicYear = res.data.currentAcademicYear;
        }
        notify(res.message || 'Promotion completed!');
        closeModalById('modal-promotion-wizard');
        await syncAdminPromotionCard();
        if (typeof updateWelcomeGreeting === 'function') updateWelcomeGreeting();
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      notify(err.message || 'Promotion failed', true);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Confirm & Promote';
      }
    }
  }

  async function undoPromotionBatch(batchId) {
    const ok = await confirmDialog({
      title: 'Undo Student Promotion',
      badge: '1-Click Undo',
      message: 'This will restore all students in this batch back to their previous class, roll number, rank, and active status. Continue?',
      isDanger: true
    });
    if (!ok) return;

    try {
      const res = await API.undoPromotion(batchId);
      if (res.success) {
        notify(res.message || 'Promotion undone successfully!');
        await syncAdminPromotionCard();
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      notify(err.message || 'Undo failed', true);
    }
  }

  async function reorderCurrentClassRollsByRank() {
    if (!PromoState.selectedClass) return;
    const ok = await confirmDialog({
      title: `Re-order Rolls: ${PromoState.selectedClass}`,
      badge: 'Rank Roll Order',
      message: `Assign sequential Roll Numbers (#1..N) in "${PromoState.selectedClass}" based on Rank (with smart fallback for unranked students)?`
    });
    if (!ok) return;

    try {
      const res = await API.reorderClassRolls({
        scope: PromoState.scope,
        className: PromoState.selectedClass,
        rollOrderMode: PromoState.rollOrderMode || 'rank'
      });
      if (res.success) {
        notify(res.message || 'Roll numbers updated!');
        await refreshPromotionPreview();
        syncAdminPromotionCard();
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      notify(err.message || 'Reorder failed', true);
    }
  }

  // ==========================================================================
  // 4. ALUMNI & TC DIRECTORY MODAL
  // ==========================================================================
  async function openAlumniDirectoryModal(initialType = 'alumni') {
    PromoState.dirType = initialType;
    PromoState.dirYear = 'all';
    PromoState.dirClass = 'all';
    PromoState.dirSearch = '';

    const root = ensureModalRoot();
    closeModalById('modal-alumni-directory');

    root.insertAdjacentHTML('beforeend', `
      <div id="modal-alumni-directory" class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
        <div class="bg-[var(--card-bg)] w-full max-w-2xl h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-color)] flex-shrink-0">
            <div>
              <h3 class="text-sm sm:text-base font-black text-[var(--text-main)]">🎓 Alumni & TC Directory</h3>
              <p class="text-[10px] text-[var(--text-sub)]">Graduated & transferred students separated from active classes</p>
            </div>
            <button type="button" onclick="closePromotionModal('modal-alumni-directory')" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[var(--text-sub)] font-bold flex items-center justify-center">✕</button>
          </div>

          <div class="p-3.5 sm:p-4 space-y-3 border-b border-[var(--border-color)] flex-shrink-0">
            <!-- Segmented Tabs -->
            <div class="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)]">
              <button type="button" id="dir-tab-alumni" onclick="switchDirectoryTab('alumni')" class="py-2 rounded-xl text-xs font-black transition">🎓 Alumni</button>
              <button type="button" id="dir-tab-tc" onclick="switchDirectoryTab('tc')" class="py-2 rounded-xl text-xs font-black transition">📄 TC / Left</button>
            </div>

            <!-- Filters -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select id="dir-filter-year" onchange="handleDirectoryFilterChange()" class="touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)]">
                <option value="all">All Years</option>
              </select>
              <select id="dir-filter-class" onchange="handleDirectoryFilterChange()" class="touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)]">
                <option value="all">All Classes</option>
              </select>
              <input type="text" id="dir-filter-search" oninput="handleDirectoryFilterChange()" placeholder="Search name, TC..." class="col-span-2 sm:col-span-1 touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)]">
            </div>
          </div>

          <div id="dir-students-list" class="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
            <div class="py-10 text-center text-xs text-[var(--text-sub)] font-bold">Loading directory...</div>
          </div>
        </div>
      </div>
    `);

    await loadAlumniDirectory();
  }

  async function loadAlumniDirectory() {
    const listEl = document.getElementById('dir-students-list');
    const tabAlumni = document.getElementById('dir-tab-alumni');
    const tabTc = document.getElementById('dir-tab-tc');

    if (tabAlumni && tabTc) {
      const isAl = PromoState.dirType === 'alumni';
      tabAlumni.className = `py-2 rounded-xl text-xs font-black transition ${isAl ? 'bg-[#245b70] text-white shadow-sm' : 'text-[var(--text-sub)]'}`;
      tabTc.className = `py-2 rounded-xl text-xs font-black transition ${!isAl ? 'bg-rose-600 text-white shadow-sm' : 'text-[var(--text-sub)]'}`;
    }

    try {
      const res = await API.getPromotionDirectory({
        type: PromoState.dirType,
        year: PromoState.dirYear,
        lastClass: PromoState.dirClass,
        search: PromoState.dirSearch
      });
      if (!res.success) throw new Error(res.message);

      PromoState.dirStudents = res.data || [];
      PromoState.dirMeta = res.meta || { alumniCount: 0, tcCount: 0, years: [], lastClasses: [] };

      if (tabAlumni) tabAlumni.textContent = `🎓 Alumni (${PromoState.dirMeta.alumniCount})`;
      if (tabTc) tabTc.textContent = `📄 TC / Left (${PromoState.dirMeta.tcCount})`;

      const yearSel = document.getElementById('dir-filter-year');
      if (yearSel && yearSel.options.length <= 1) {
        (PromoState.dirMeta.years || []).forEach(y => {
          yearSel.insertAdjacentHTML('beforeend', `<option value="${esc(y)}">${esc(y)}</option>`);
        });
      }
      const clsSel = document.getElementById('dir-filter-class');
      if (clsSel && clsSel.options.length <= 1) {
        (PromoState.dirMeta.lastClasses || []).forEach(c => {
          clsSel.insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c)}</option>`);
        });
      }

      if (!listEl) return;
      if (PromoState.dirStudents.length === 0) {
        listEl.innerHTML = `<div class="py-12 text-center text-xs text-[var(--text-sub)] font-bold">No ${PromoState.dirType === 'tc' ? 'TC / Left' : 'Alumni'} records found.</div>`;
        return;
      }

      const admin = isAdminUser();
      listEl.innerHTML = PromoState.dirStudents.map((s, idx) => {
        const ex = s.exitInfo || {};
        return `
          <div class="p-3.5 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] space-y-2.5">
            <div class="flex items-start justify-between gap-2.5">
              <div class="min-w-0">
                <div class="text-xs font-black text-[var(--text-main)] truncate">${esc(s.name)}</div>
                <div class="text-[11px] text-[var(--text-sub)]">
                  ID: ${esc(s.studentId)} · Last Class: <b>${esc(ex.lastClass || s.class)}</b> (Roll #${esc(ex.lastRoll || s.roll)})
                </div>
                ${ex.tcNumber ? `<div class="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">TC No: ${esc(ex.tcNumber)}${ex.reason ? ` · ${esc(ex.reason)}` : ''}</div>` : ''}
                ${s.familyDetails && s.familyDetails.fatherName ? `<div class="text-[10px] text-[var(--text-sub)] mt-0.5">Father: ${esc(s.familyDetails.fatherName)} ${s.familyDetails.fatherMobile ? `(${esc(s.familyDetails.fatherMobile)})` : ''}</div>` : ''}
              </div>
              <span class="flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
                ${esc(ex.exitYear || 'Archived')}
              </span>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <button type="button" onclick="printStandaloneStudentProfile(PromoState_getDirStudent(${idx}))" class="touch-btn flex-1 py-1.5 px-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-main)] font-bold text-[11px] hover:bg-[#245b70]/10 transition">
                🖨 Print Profile
              </button>
              ${admin ? `
                <button type="button" onclick="handleReadmitStudent('${esc(s._id)}', '${esc(s.name)}', '${esc(ex.lastClass || s.class)}')" class="touch-btn flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition">
                  ↩ Re-admit
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="p-4 text-xs text-rose-600 font-bold">${esc(err.message)}</div>`;
    }
  }

  async function handleReadmitStudent(id, name, defaultClass) {
    const targetClass = window.prompt(`Re-admit "${name}" into which Class?`, defaultClass || '');
    if (!targetClass || !targetClass.trim()) return;

    try {
      const res = await API.readmitStudent(id, { targetClass: targetClass.trim() });
      if (res.success) {
        notify(res.message || `${name} re-admitted!`);
        await loadAlumniDirectory();
        syncAdminPromotionCard();
        if (typeof loadInitialData === 'function') loadInitialData();
      }
    } catch (err) {
      notify(err.message || 'Re-admit failed', true);
    }
  }

  // ==========================================================================
  // 5. YEAR-END ARCHIVE DOWNLOADS (JSON + 3 UTF-8 BOM CSVs) & SAFE CLEANUP
  // ==========================================================================
  async function downloadAuthenticatedFile(endpoint, fallbackFilename) {
    try {
      const token = API.getToken();
      const res = await fetch(`/api${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        let msg = 'Download failed';
        try { const errJson = await res.json(); msg = errJson.message || msg; } catch (_) {}
        throw new Error(msg);
      }
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/i);
      const filename = match ? match[1] : fallbackFilename;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return filename;
    } catch (err) {
      notify(err.message || 'Export failed', true);
      return null;
    }
  }

  async function downloadYearEndJsonArchive() {
    notify('Preparing Full Year JSON Archive...');
    const yr = getCurrentAcademicYearLabel();
    const filename = await downloadAuthenticatedFile(`/backup/year-archive?year=${encodeURIComponent(yr)}`, `REGISTERLY_Archive_${yr}.json`);
    if (filename) {
      notify(`Downloaded ${filename}! Safe Cleanup is now unlocked.`);
      await syncAdminPromotionCard();
    }
  }

  async function downloadYearCsvPack(type) {
    const labels = { students: 'Students', attendance: 'Attendance Summary', alumni: 'Alumni & TC' };
    notify(`Exporting ${labels[type] || type} CSV (Excel UTF-8)...`);
    const yr = getCurrentAcademicYearLabel();
    const filename = await downloadAuthenticatedFile(`/backup/year-csv?type=${encodeURIComponent(type)}`, `REGISTERLY_${type}_${yr}.csv`);
    if (filename) {
      notify(`Downloaded ${filename}`);
    }
  }

  async function triggerSafeYearCleanup() {
    const ok = await confirmDialog({
      title: 'Safe Cleanup — Free Database Space',
      badge: 'Render Free Tier Optimizer',
      message: 'This will purge old Attendance session logs to keep MongoDB & Render fast. Students, Classes, Teachers, and Alumni/TC Directory will remain 100% untouched. Make sure you saved your downloaded Year-End JSON Archive safely!',
      isDanger: true
    });
    if (!ok) return;

    try {
      const res = await API.cleanupYearAttendance({});
      if (res.success) {
        notify(res.message || 'Safe cleanup completed!');
        await syncAdminPromotionCard();
      }
    } catch (err) {
      notify(err.message || 'Cleanup failed', true);
    }
  }

  // ==========================================================================
  // 6. BUILT-IN OFFLINE JSON ARCHIVE VIEWER (100% Client-Side, Read-Only)
  // ==========================================================================
  function openOfflineArchiveViewer() {
    const root = ensureModalRoot();
    closeModalById('modal-offline-archive-viewer');

    root.insertAdjacentHTML('beforeend', `
      <div id="modal-offline-archive-viewer" class="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-3">
        <div class="bg-[var(--card-bg)] w-full max-w-2xl h-[92vh] sm:h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden">
          <!-- Amber Read-Only Archive Banner -->
          <div class="archive-readonly-banner px-4 py-2.5 flex items-center justify-between gap-2 flex-shrink-0">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-sm">📂</span>
              <div class="min-w-0">
                <div class="text-xs font-black truncate" id="archive-viewer-title">Offline JSON Archive Viewer (Read-Only)</div>
                <div class="text-[10px] opacity-90 truncate" id="archive-viewer-subtitle">Zero Server/DB load — opens directly from your device</div>
              </div>
            </div>
            <button type="button" onclick="closePromotionModal('modal-offline-archive-viewer')" class="w-8 h-8 rounded-full bg-black/15 hover:bg-black/25 font-bold flex items-center justify-center flex-shrink-0">✕</button>
          </div>

          <div id="archive-viewer-body" class="flex-1 overflow-y-auto p-4 space-y-4">
            ${PromoState.archiveData ? '' : renderArchiveUploadPromptHtml()}
          </div>
        </div>
      </div>
    `);

    if (PromoState.archiveData) {
      renderOfflineArchiveContents();
    }
  }

  function renderArchiveUploadPromptHtml() {
    return `
      <div class="py-10 px-4 text-center space-y-4">
        <div class="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl">📂</div>
        <div class="space-y-1">
          <h4 class="text-sm font-black text-[var(--text-main)]">Open a Past Academic Year Archive</h4>
          <p class="text-xs text-[var(--text-sub)] max-w-sm mx-auto">
            Select any <code>REGISTERLY_Archive_*.json</code> file from your computer or library. View attendance %, ranks, and print student profiles without uploading to the database.
          </p>
        </div>
        <label class="touch-btn inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#245b70] hover:bg-[#1a4454] text-white font-black text-xs cursor-pointer shadow-md transition">
          <input type="file" accept=".json" class="hidden" onchange="handleArchiveJsonFileSelected(event)">
          <span>Choose Archive .JSON File</span>
        </label>
      </div>
    `;
  }

  function handleArchiveJsonFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.students)) {
          throw new Error('Invalid REGISTERLY archive JSON file (missing students list).');
        }
        PromoState.archiveData = parsed;
        PromoState.archiveClassFilter = 'all';
        PromoState.archiveStatusFilter = 'all';
        PromoState.archiveSearch = '';
        renderOfflineArchiveContents();
        notify(`Loaded archive: ${parsed.academicYear || file.name}`);
      } catch (err) {
        notify(err.message || 'Could not parse JSON archive', true);
      }
    };
    reader.readAsText(file);
  }

  function renderOfflineArchiveContents() {
    const data = PromoState.archiveData;
    const body = document.getElementById('archive-viewer-body');
    const titleEl = document.getElementById('archive-viewer-title');
    const subEl = document.getElementById('archive-viewer-subtitle');
    if (!data || !body) return;

    const yr = data.academicYear || (data.settings && data.settings.currentAcademicYear) || 'Archived Year';
    if (titleEl) titleEl.textContent = `ARCHIVE VIEW (READ-ONLY) · ${yr}`;
    if (subEl) subEl.textContent = `${data.schoolName || data.appName || 'REGISTERLY'} · Exported ${data.exportDate ? new Date(data.exportDate).toLocaleDateString() : ''}`;

    const allStudents = data.students || [];
    const classesList = Array.from(new Set(allStudents.map(s => s.class).filter(Boolean))).sort();

    const filtered = allStudents.filter(s => {
      if (PromoState.archiveClassFilter !== 'all' && s.class !== PromoState.archiveClassFilter) return false;
      const life = s.lifecycleStatus || 'active';
      if (PromoState.archiveStatusFilter !== 'all' && life !== PromoState.archiveStatusFilter) return false;
      if (PromoState.archiveSearch.trim()) {
        const q = PromoState.archiveSearch.trim().toLowerCase();
        const hay = `${s.name || ''} ${s.studentId || ''} ${s.class || ''} ${(s.familyDetails && s.familyDetails.fatherName) || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    body.innerHTML = `
      <!-- Summary Stats -->
      <div class="grid grid-cols-3 gap-2">
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-center">
          <div class="text-base font-black text-[var(--text-main)]">${allStudents.length}</div>
          <div class="text-[10px] font-bold text-[var(--text-sub)]">Students</div>
        </div>
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-center">
          <div class="text-base font-black text-[var(--text-main)]">${(data.classes || []).length}</div>
          <div class="text-[10px] font-bold text-[var(--text-sub)]">Classes</div>
        </div>
        <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] text-center">
          <div class="text-base font-black text-[var(--text-main)]">${(data.attendance || []).length}</div>
          <div class="text-[10px] font-bold text-[var(--text-sub)]">Att. Sessions</div>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 min-w-0">
          <select onchange="setArchiveFilter('class', this.value)" class="touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)]">
            <option value="all" ${PromoState.archiveClassFilter === 'all' ? 'selected' : ''}>All Classes</option>
            ${classesList.map(c => `<option value="${esc(c)}" ${PromoState.archiveClassFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
          <select onchange="setArchiveFilter('status', this.value)" class="touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--text-main)]">
            <option value="all" ${PromoState.archiveStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
            <option value="active" ${PromoState.archiveStatusFilter === 'active' ? 'selected' : ''}>Active</option>
            <option value="alumni" ${PromoState.archiveStatusFilter === 'alumni' ? 'selected' : ''}>Alumni</option>
            <option value="tc" ${PromoState.archiveStatusFilter === 'tc' ? 'selected' : ''}>TC / Left</option>
          </select>
          <input type="text" value="${esc(PromoState.archiveSearch)}" oninput="setArchiveFilter('search', this.value)" placeholder="Search student..." class="col-span-2 sm:col-span-1 touch-input bg-[var(--bg-page)] border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)]">
        </div>
        <label class="touch-btn px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-[11px] cursor-pointer">
          <input type="file" accept=".json" class="hidden" onchange="handleArchiveJsonFileSelected(event)">
          Load Another
        </label>
      </div>

      <!-- Archived Students List -->
      <div class="space-y-2">
        <div class="text-[10px] font-bold text-[var(--text-sub)]">Showing ${filtered.length} of ${allStudents.length} archived students</div>
        ${filtered.slice(0, 150).map((s, idx) => {
          const attPct = s.attendancePercentage !== null && s.attendancePercentage !== undefined ? `${s.attendancePercentage}%` : '—';
          const rank = s.academicStatus && s.academicStatus.rank ? s.academicStatus.rank : '';
          return `
            <div class="p-3 rounded-2xl bg-[var(--bg-page)] border border-[var(--border-color)] flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-xs font-extrabold text-[var(--text-main)] truncate">
                  ${esc(s.name)}
                  ${rank ? `<span class="ml-1 text-[10px] text-amber-600 dark:text-amber-400">🏆 ${esc(rank)}</span>` : ''}
                </div>
                <div class="text-[10px] text-[var(--text-sub)]">
                  ${esc(s.class)} · Roll #${esc(s.roll)} · ID: ${esc(s.studentId)} · Attendance: <b>${esc(attPct)}</b>
                </div>
              </div>
              <button type="button" onclick="printArchivedStudentByIndex(${idx})" class="touch-btn flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[11px] font-bold text-[var(--text-main)] hover:bg-[#245b70]/10">
                🖨 Print
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Store filtered list for print button
    PromoState._lastFilteredArchive = filtered;
  }

  function printStandaloneStudentProfile(student, archiveYearLabel = '') {
    if (!student) return;
    const fam = student.familyDetails || {};
    const per = student.personalDetails || {};
    const addr = student.address || {};
    const acad = student.academicStatus || {};
    const ex = student.exitInfo || {};
    const hist = Array.isArray(student.academicHistory) ? student.academicHistory : [];
    const schoolName = (typeof appSettings !== 'undefined' && appSettings && appSettings.schoolName)
      ? appSettings.schoolName
      : 'REGISTERLY Institution';

    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) {
      notify('Please allow pop-ups to print student profile.', true);
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Student Profile - ${esc(student.name)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 24px; line-height: 1.5; }
          .header { border-bottom: 2px solid #245b70; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          .badge { background: #e6f4f1; color: #115e59; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 20px; margin-bottom: 16px; }
          .field label { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; }
          .field div { font-size: 13px; font-weight: 600; }
          h3 { font-size: 13px; text-transform: uppercase; color: #245b70; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 18px 0 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
          th { background: #f8fafc; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size:18px;font-weight:900;color:#245b70;">${esc(schoolName)}</div>
            <div style="font-size:12px;color:#475569;">Student Academic Record ${archiveYearLabel ? `(${esc(archiveYearLabel)} Archive)` : ''}</div>
          </div>
          <span class="badge">${esc((student.lifecycleStatus || 'active').toUpperCase())}</span>
        </div>

        <div class="grid">
          <div class="field"><label>Full Name</label><div>${esc(student.name)}</div></div>
          <div class="field"><label>Student ID</label><div>${esc(student.studentId)}</div></div>
          <div class="field"><label>Class & Roll</label><div>${esc(ex.lastClass || student.class)} · Roll #${esc(ex.lastRoll || student.roll)}</div></div>
          <div class="field"><label>Rank / Attendance</label><div>${esc(acad.rank || '—')} ${student.attendancePercentage != null ? `(${student.attendancePercentage}%)` : ''}</div></div>
          <div class="field"><label>DOB / Gender / Blood</label><div>${esc(per.dob || '—')} · ${esc(per.gender || '—')} · ${esc(per.bloodGroup || '—')}</div></div>
          <div class="field"><label>Admission No</label><div>${esc(acad.admissionNo || '—')}</div></div>
          <div class="field"><label>Father Name & Mobile</label><div>${esc(fam.fatherName || '—')} ${fam.fatherMobile ? `(${esc(fam.fatherMobile)})` : ''}</div></div>
          <div class="field"><label>Mother Name</label><div>${esc(fam.motherName || '—')}</div></div>
          <div class="field"><label>Address</label><div>${esc([addr.fullAddress, addr.place, addr.district, addr.pinCode].filter(Boolean).join(', ') || '—')}</div></div>
          ${ex.exitYear ? `<div class="field"><label>Exit Details</label><div>Year: ${esc(ex.exitYear)} ${ex.tcNumber ? `· TC: ${esc(ex.tcNumber)}` : ''} ${ex.reason ? `· ${esc(ex.reason)}` : ''}</div></div>` : ''}
        </div>

        ${hist.length > 0 ? `
          <h3>Academic History</h3>
          <table>
            <thead><tr><th>Year</th><th>Class</th><th>Roll</th><th>Rank</th><th>Attendance</th><th>Status</th></tr></thead>
            <tbody>
              ${hist.map(h => `
                <tr>
                  <td>${esc(h.academicYear)}</td>
                  <td>${esc(h.className)}</td>
                  <td>#${esc(h.roll)}</td>
                  <td>${esc(h.rank || '—')}</td>
                  <td>${h.attendancePercentage != null ? `${h.attendancePercentage}% (${h.attendancePresent}/${h.attendanceSessions})` : '—'}</td>
                  <td>${esc(h.action)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <div style="margin-top:24px;text-align:right;">
          <button onclick="window.print()" style="padding:8px 16px;background:#245b70;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;">Print Profile</button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  // ==========================================================================
  // 7. GLOBAL HANDLERS EXPOSED TO WINDOW
  // ==========================================================================
  window.closePromotionModal = closeModalById;
  window.syncAdminPromotionCard = syncAdminPromotionCard;
  window.saveAcademicYearSetting = saveAcademicYearSetting;
  window.openAcademicYearQuickModal = openAcademicYearQuickModal;
  window.openPromotionWizard = openPromotionWizard;
  window.undoPromotionBatch = undoPromotionBatch;
  window.reorderCurrentClassRollsByRank = reorderCurrentClassRollsByRank;
  window.openAlumniDirectoryModal = openAlumniDirectoryModal;
  window.handleReadmitStudent = handleReadmitStudent;
  window.downloadYearEndJsonArchive = downloadYearEndJsonArchive;
  window.downloadYearCsvPack = downloadYearCsvPack;
  window.triggerSafeYearCleanup = triggerSafeYearCleanup;
  window.openOfflineArchiveViewer = openOfflineArchiveViewer;
  window.handleArchiveJsonFileSelected = handleArchiveJsonFileSelected;
  window.printStandaloneStudentProfile = printStandaloneStudentProfile;

  window.setPromotionMode = function (mode) {
    PromoState.mode = mode === 'whole-school' ? 'whole-school' : 'class';
    PromoState.step = 'select';
    refreshPromotionPreview();
  };

  window.setPromotionRollMode = function (mode) {
    PromoState.rollOrderMode = mode;
    refreshPromotionPreview();
  };

  window.setPromotionSourceClass = function (clsName) {
    PromoState.selectedClass = clsName;
    refreshPromotionPreview();
  };

  window.setWholeSchoolMapping = function (sourceClass, targetClass) {
    PromoState.classMappings[sourceClass] = targetClass;
    refreshPromotionPreview();
  };

  window.setPromotionNextYear = function (yr) {
    PromoState.toAcademicYear = String(yr || '').trim();
    const pill = document.getElementById('promo-year-pill');
    if (pill && PromoState.overview) {
      pill.textContent = `${PromoState.overview.currentAcademicYear} → ${PromoState.toAcademicYear}`;
    }
  };

  window.togglePromoClearRanks = function (checked) {
    PromoState.clearRanksAfterPromotion = Boolean(checked);
  };

  window.togglePromoUpdateYear = function (checked) {
    PromoState.updateAcademicYear = Boolean(checked);
  };

  window.setStudentPromotionAction = function (studentRef, action) {
    PromoState.overrides[studentRef] = {
      ...(PromoState.overrides[studentRef] || {}),
      action
    };
    refreshPromotionPreview();
  };

  window.setStudentTcField = function (studentRef, field, value) {
    PromoState.overrides[studentRef] = {
      ...(PromoState.overrides[studentRef] || {}),
      action: 'tc',
      [field]: value
    };
  };

  window.goToPromotionConfirmStep = function () {
    PromoState.step = 'confirm';
    renderPromotionWizard();
  };

  window.backToPromotionSelectStep = function () {
    PromoState.step = 'select';
    renderPromotionWizard();
  };

  window.executePromotionNow = executePromotionNow;

  window.switchDirectoryTab = function (type) {
    PromoState.dirType = type === 'tc' ? 'tc' : 'alumni';
    loadAlumniDirectory();
  };

  window.handleDirectoryFilterChange = function () {
    const y = document.getElementById('dir-filter-year');
    const c = document.getElementById('dir-filter-class');
    const s = document.getElementById('dir-filter-search');
    PromoState.dirYear = y ? y.value : 'all';
    PromoState.dirClass = c ? c.value : 'all';
    PromoState.dirSearch = s ? s.value : '';
    loadAlumniDirectory();
  };

  window.PromoState_getDirStudent = function (idx) {
    return PromoState.dirStudents[idx] || null;
  };

  window.setArchiveFilter = function (kind, val) {
    if (kind === 'class') PromoState.archiveClassFilter = val;
    else if (kind === 'status') PromoState.archiveStatusFilter = val;
    else if (kind === 'search') PromoState.archiveSearch = val;
    renderOfflineArchiveContents();
  };

  window.printArchivedStudentByIndex = function (idx) {
    const list = PromoState._lastFilteredArchive || [];
    const st = list[idx];
    const yr = PromoState.archiveData ? PromoState.archiveData.academicYear : '';
    if (st) printStandaloneStudentProfile(st, yr);
  };
})();
