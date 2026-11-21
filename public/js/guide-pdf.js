/* ============================================================================
   REGISTERLY — COMPLETE A-TO-Z BILINGUAL PDF GUIDE GENERATOR (EN & ML)
   Generates a magazine-grade 10-page A4 PDF with inline SVG icons, structured
   cards, tables, workflows, and crisp Noto Sans Malayalam / Inter typography.
   ============================================================================ */
(function () {
  let _isGeneratingGuidePdf = false;

  // ---------- 1. Dynamic CDN Loader (Lazy-loaded on first click) ----------
  function loadScriptOnce(urls, checkFn) {
    return new Promise((resolve, reject) => {
      if (checkFn()) return resolve();
      let idx = 0;
      function tryNext() {
        if (idx >= urls.length) {
          return reject(new Error('Failed to load PDF library from CDN'));
        }
        const src = urls[idx++];
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => (checkFn() ? resolve() : tryNext());
        s.onerror = () => tryNext();
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  async function ensurePdfLibraries() {
    await Promise.all([
      loadScriptOnce(
        [
          'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
          'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
        ],
        () => typeof window.html2canvas === 'function'
      ),
      loadScriptOnce(
        [
          'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
          'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
        ],
        () => !!(window.jspdf && window.jspdf.jsPDF)
      )
    ]);
  }

  // ---------- 2. Crisp Inline SVG Icon Library (Explicit width/height) ----------
  function svg(paths, color = '#245b70', size = 18, strokeWidth = 2.1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0;">${paths}</svg>`;
  }

  const ICONS = {
    book: (c, s) => svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', c, s),
    home: (c, s) => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', c, s),
    checkSquare: (c, s) => svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', c, s),
    barChart: (c, s) => svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>', c, s),
    user: (c, s) => svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', c, s),
    users: (c, s) => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', c, s),
    layers: (c, s) => svg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>', c, s),
    calendar: (c, s) => svg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', c, s),
    bell: (c, s) => svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', c, s),
    clock: (c, s) => svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', c, s),
    shield: (c, s) => svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', c, s),
    lock: (c, s) => svg('<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', c, s),
    message: (c, s) => svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', c, s),
    link: (c, s) => svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', c, s),
    printer: (c, s) => svg('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>', c, s),
    fileText: (c, s) => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', c, s),
    zap: (c, s) => svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', c, s),
    award: (c, s) => svg('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>', c, s),
    gradCap: (c, s) => svg('<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>', c, s),
    settings: (c, s) => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', c, s),
    camera: (c, s) => svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', c, s),
    download: (c, s) => svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', c, s),
    globe: (c, s) => svg('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', c, s),
    star: (c, s) => svg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', c, s),
    database: (c, s) => svg('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>', c, s),
    sparkles: (c, s) => svg('<path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>', c, s),
    check: (c, s) => svg('<polyline points="20 6 9 17 4 12"/>', c, s, 2.8)
  };

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- 3. Shared Layout Helpers for A4 Pages ----------
  function pageShell(pageNum, totalPages, chapterBadge, chapterTitle, bodyHtml, meta) {
    const isMl = meta.lang === 'ml';
    const pageLabel = isMl ? `പേജ് ${pageNum} / ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
    return `
      <div class="gpdf-page">
        <div class="gpdf-topbar">
          <div class="gpdf-topbar-left">
            <div class="gpdf-brand-dot">${ICONS.book('#ffffff', 13)}</div>
            <div>
              <div class="gpdf-topbar-app">${esc(meta.appName)}</div>
              ${meta.schoolName ? `<div class="gpdf-topbar-school">${esc(meta.schoolName)}</div>` : ''}
            </div>
          </div>
          <div class="gpdf-chapter-pill">${esc(chapterBadge)}</div>
        </div>
        <div class="gpdf-page-body">
          <div class="gpdf-ch-header">
            <h2 class="gpdf-ch-title">${chapterTitle}</h2>
            <div class="gpdf-ch-line"></div>
          </div>
          ${bodyHtml}
        </div>
        <div class="gpdf-footer">
          <span>${esc(meta.appName)} • ${isMl ? 'സമ്പൂർണ്ണ ആപ്പ് ഗൈഡ് (A–Z)' : 'Complete A–Z User Manual & Feature Guide'}</span>
          <span class="gpdf-page-num">${pageLabel}</span>
        </div>
      </div>
    `;
  }

  function card(iconHtml, title, accentBg, accentBorder, titleColor, innerHtml) {
    return `
      <div class="gpdf-card" style="background:${accentBg};border-color:${accentBorder};">
        <div class="gpdf-card-head">
          <div class="gpdf-icon-box" style="background:${accentBorder};">${iconHtml}</div>
          <div class="gpdf-card-title" style="color:${titleColor};">${title}</div>
        </div>
        <div class="gpdf-card-content">${innerHtml}</div>
      </div>
    `;
  }

  function stepList(items, color = '#245b70') {
    return `<div class="gpdf-steps">${items
      .map(
        (text, i) => `
      <div class="gpdf-step">
        <span class="gpdf-step-num" style="background:${color};">${i + 1}</span>
        <div class="gpdf-step-txt">${text}</div>
      </div>`
      )
      .join('')}</div>`;
  }

  function bulletList(items, dotColor = '#0d9488') {
    return `<div class="gpdf-bullets">${items
      .map(
        (text) => `
      <div class="gpdf-bullet">
        <span class="gpdf-bullet-dot" style="background:${dotColor};"></span>
        <div class="gpdf-bullet-txt">${text}</div>
      </div>`
      )
      .join('')}</div>`;
  }

  function tipBox(title, body, variant = 'amber') {
    const styles =
      variant === 'emerald'
        ? { bg: '#ecfdf5', border: '#a7f3d0', title: '#065f46', icon: '#059669' }
        : variant === 'sky'
        ? { bg: '#f0f9ff', border: '#bae6fd', title: '#075985', icon: '#0284c7' }
        : { bg: '#fffbeb', border: '#fde68a', title: '#92400e', icon: '#d97706' };
    return `
      <div class="gpdf-tip" style="background:${styles.bg};border-color:${styles.border};">
        <div class="gpdf-tip-icon">${ICONS.star(styles.icon, 16)}</div>
        <div>
          <div class="gpdf-tip-title" style="color:${styles.title};">${title}</div>
          <div class="gpdf-tip-body">${body}</div>
        </div>
      </div>
    `;
  }

  // ---------- 4. ENGLISH 10-PAGE COMPLETE A-TO-Z CONTENT ----------
  function buildEnglishPages(meta) {
    const total = 10;
    const pages = [];

    // PAGE 1: COVER + OVERVIEW + TOC
    pages.push(`
      <div class="gpdf-page gpdf-cover-page">
        <div class="gpdf-cover-hero">
          <div class="gpdf-cover-badge">${ICONS.sparkles('#67e8f9', 14)}<span>OFFICIAL A–Z USER MANUAL & FEATURE GUIDE</span></div>
          <div class="gpdf-cover-brand-row">
            <div class="gpdf-cover-logo">${ICONS.book('#ffffff', 30)}</div>
            <div>
              <h1 class="gpdf-cover-title">${esc(meta.appName)}</h1>
              <div class="gpdf-cover-sub">${meta.schoolName ? esc(meta.schoolName) + ' • ' : ''}Smart School Attendance & Academic Management PWA</div>
            </div>
          </div>
          <p class="gpdf-cover-desc">
            A complete, end-to-end guide explaining every feature, portal, workflow, automated notification, report, and administrative tool built into ${esc(meta.appName)} — designed for Teachers, Class Teachers, School Admins, and Students.
          </p>
        </div>

        <div class="gpdf-cover-body">
          <div class="gpdf-section-label">WHY ${esc(meta.appName)}? — KEY INSTITUTIONAL BENEFITS</div>
          <div class="gpdf-grid-3">
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#e0f2fe;">${ICONS.zap('#0284c7', 17)}</div>
              <div class="gpdf-benefit-t">5-Second Attendance</div>
              <div class="gpdf-benefit-d">One-tap Mark All Present & instant Dashboard timetable shortcuts eliminate paper registers.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#dcfce7;">${ICONS.barChart('#16a34a', 17)}</div>
              <div class="gpdf-benefit-t">Zero-Error Analytics</div>
              <div class="gpdf-benefit-d">Automatic monthly, yearly & All-Subjects percentage sheets with A4 print and Excel/CSV exports.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#fef3c7;">${ICONS.bell('#d97706', 17)}</div>
              <div class="gpdf-benefit-t">Smart 6 AM Alerts</div>
              <div class="gpdf-benefit-d">Automated morning schedule bubbles & pre-class reminders synced strictly to your teacher email.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#f3e8ff;">${ICONS.gradCap('#7c3aed', 17)}</div>
              <div class="gpdf-benefit-t">Dedicated Student Portal</div>
              <div class="gpdf-benefit-d">Students check attendance calendars, timetables, notices, digital ID cards & apply for leave.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#fce7f3;">${ICONS.lock('#db2777', 17)}</div>
              <div class="gpdf-benefit-t">Private Workspace</div>
              <div class="gpdf-benefit-d">Teachers get a 100% private space for personal tuition batches, custom subjects & records.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#ccfbf1;">${ICONS.globe('#0d9488', 17)}</div>
              <div class="gpdf-benefit-t">Bilingual & Installable</div>
              <div class="gpdf-benefit-d">Instant English / Malayalam switching, Light/Dark themes & 1-click Android/Desktop PWA install.</div>
            </div>
          </div>

          <div class="gpdf-section-label" style="margin-top:16px;">COMPLETE A–Z TABLE OF CONTENTS</div>
          <div class="gpdf-toc-grid">
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">02</span><span>App Architecture, Portals, Roles & Onboarding</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">03</span><span>Home Dashboard, Live Status & PWA Install</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">04</span><span>Classes, Subjects & Teachers Management</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">05</span><span>Student Directory, Profiles & Photo Tools</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">06</span><span>Daily Attendance System (P / A / L & Fast Mode)</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">07</span><span>Reports, Analytics, Printing & Excel/CSV Exports</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">08</span><span>Timetable Builder & Automated Notifications</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">09</span><span>Notice Board, Personal Workspace & Outcomers</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">10</span><span>Student Portal, Year Promotion & Admin Panel</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">PRO</span><span>Best Practices, Shortcuts & Office Workflows</span></div>
          </div>
        </div>

        <div class="gpdf-footer">
          <span>${esc(meta.appName)} • Generated ${esc(meta.dateStr)}</span>
          <span class="gpdf-page-num">Page 1 of ${total}</span>
        </div>
      </div>
    `);

    // PAGE 2: ARCHITECTURE, PORTALS, ROLES & GETTING STARTED
    pages.push(
      pageShell(
        2,
        total,
        'CHAPTER 01',
        'App Architecture, Portals, Roles & Getting Started',
        `
        ${card(
          ICONS.layers('#0369a1', 16),
          'Primary Bottom Navigation Structure (4 Core Tabs)',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.home('#0284c7', 15)}<span>1. Home (Dashboard)</span></div>
              <div class="gpdf-mini-txt">Live teaching hub: Today's active class, Next subject, KPI stat counters, Academic Year switcher, and Quick Shortcuts to all modules.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.checkSquare('#059669', 15)}<span>2. Attendance</span></div>
              <div class="gpdf-mini-txt">Daily roll-call screen: select Class, Subject & Date to mark Present (P), Absent (A), or Leave (L), plus one-tap Mark All Present.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.barChart('#4f46e5', 15)}<span>3. Report</span></div>
              <div class="gpdf-mini-txt">Complete attendance analytics: filter by Month, Year, All Months, single Subject or All Subjects, with A4 Print Sheet & CSV exports.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.user('#d97706', 15)}<span>4. Profile & Settings</span></div>
              <div class="gpdf-mini-txt">Your teacher profile, Class Teacher badge, Print Reports hub, Admin Panel, Notice Board, Personal Workspace, Language & Dark Mode.</div>
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.shield('#1e4d5f', 16),
          'Two Strictly Separated Portals & Link Architecture',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <table class="gpdf-table">
            <thead>
              <tr><th>Portal / Link</th><th>Audience</th><th>What Loads & Security Separation</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Teacher Portal</b><br><code>/?portal=teacher</code></td>
                <td>Admin, Class Teachers & Subject Teachers</td>
                <td>Full school management dashboard, attendance, reports, timetable, staff chat, onboarding Language Picker, App Guide modal, and 6 AM Timetable notifications.</td>
              </tr>
              <tr>
                <td><b>Student Portal</b><br><code>/?portal=student</code></td>
                <td>Students & Parents</td>
                <td>Clean 5-tab student dashboard (Home, Attendance Calendar, Classes, Updates/Leave, Digital ID). Teacher onboarding modals & timetable popups are strictly disabled here.</td>
              </tr>
              <tr>
                <td><b>Student Submission</b><br><code>/submit-details.html</code></td>
                <td>New / Unregistered Students</td>
                <td>Public self-registration form where students submit personal details & photo directly into the teacher's Outcomers Inbox for approval.</td>
              </tr>
            </tbody>
          </table>
          `
        )}

        ${card(
          ICONS.users('#6d28d9', 16),
          'User Roles, Login & First-Time Onboarding Flow',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">Authentication & Roles</div>
              ${bulletList([
                '<b>Google Sign-In & Email/Password:</b> Teachers and students can sign in with one click via Google or register using email & password.',
                '<b>Automatic First Admin:</b> The very first staff account registered in the system automatically receives full <b>Admin</b> privileges.',
                '<b>Class Teacher Role:</b> Assigned in profile/teacher settings; displays a golden <b>CLASS TEACHER</b> badge and grants class-level oversight.',
                '<b>Role Protection:</b> Student accounts attempting to open the Teacher link are automatically redirected safely to the Student Portal.'
              ], '#7c3aed')}
            </div>
            <div>
              <div class="gpdf-subhead">Teacher Onboarding Sequence</div>
              ${stepList([
                '<b>Step 1 — Choose Language:</b> Pick English or മലയാളം on first launch (changeable anytime in Profile).',
                '<b>Step 2 — Quick App Guide:</b> Interactive visual guide with instant EN/ML toggle and this "Guide More" A–Z PDF download.',
                '<b>Step 3 — Morning Timetable Check:</b> Automatically shows today\'s scheduled classes if linked to your email.',
                '<b>Step 4 — Live Dashboard:</b> Opens your live teaching portal ready for today\'s sessions.'
              ], '#6d28d9')}
            </div>
          </div>
          `
        )}
        `,
        meta
      )
    );

    // PAGE 3: HOME DASHBOARD & LIVE TEACHING EXPERIENCE
    pages.push(
      pageShell(
        3,
        total,
        'CHAPTER 02',
        'Home Dashboard, Live Status & PWA Installation',
        `
        ${card(
          ICONS.clock('#0f766e', 16),
          "Today's Live Status Card (Real-Time Class Tracker)",
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <p class="gpdf-p">Sitting right at the top of the Home Dashboard, the gradient <b>Today's Status</b> card continuously tracks your real-time schedule against the current clock:</p>
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>LIVE IN (Current Period):</b> Automatically detects the class & subject you are currently teaching right now based on your timetable.',
              '<b>NEXT SUBJECT:</b> Displays your upcoming period, class name, and exact start time so you are always prepared.'
            ], '#0d9488')}
            ${bulletList([
              '<b>Today\'s Schedule Modal:</b> Tap to view all your classes scheduled for today with green/pending attendance indicators. Tap any slot to jump straight to attendance!',
              '<b>Today\'s Marked Sessions Modal:</b> Tap to review every attendance session already saved today, with Present/Absent/Leave counts.'
            ], '#0d9488')}
          </div>
          `
        )}

        ${card(
          ICONS.home('#1d4ed8', 16),
          'Dashboard Cards, Academic Year Switcher & Quick Shortcuts',
          '#eff6ff',
          '#bfdbfe',
          '#1e3a8a',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">Top Header & Greetings Bar</div>
              ${bulletList([
                '<b>Academic Year Pill:</b> Tap the top pill (e.g. <i>Academic Year 2026-27</i>) to switch academic years or browse archived past years in read-only mode.',
                '<b>Header Quick Icons:</b> Notice Board bell (with live red unread badge), Info <b>(i)</b> App Guide button, optional Language/Theme toggles, and Profile avatar.',
                '<b>Live Day Badge:</b> Shows today\'s weekday with an active pulse indicator.'
              ], '#2563eb')}
            </div>
            <div>
              <div class="gpdf-subhead">Live KPI Counters & Shortcut Grid</div>
              ${bulletList([
                '<b>4 KPI Stat Cards:</b> Instant counts of Total Classes, Total Subjects, Total Students, and Total Teachers — each clickable to open its directory.',
                '<b>Quick Action Shortcuts:</b> Direct 1-tap tiles for <b>Classes</b>, <b>Subjects</b>, <b>Students</b>, <b>Teachers</b>, <b>Timetable</b>, <b>Personal Workspace</b>, <b>Outcomers</b>, and <b>Portal Links</b>.',
                '<b>Dynamic Branding:</b> Displays your institution\'s custom App Name, School Name, and Logo configured in the Admin Panel.'
              ], '#2563eb')}
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.download('#b45309', 16),
          'One-Click PWA Installation (Android, iOS & Desktop App)',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          <p class="gpdf-p">${esc(meta.appName)} is a full <b>Progressive Web App (PWA)</b> that installs directly onto phones and computers with zero Play Store / App Store download required:</p>
          ${stepList([
            '<b>One-Click Install Button:</b> On Chrome, Edge, or Android, tap the golden <b>"Install"</b> button in the top header bar to add the app directly to your Home Screen.',
            '<b>Native App Feel:</b> Launches full-screen with your school\'s custom icon, animated splash screen, pinned bottom navigation, and smooth haptic feedback.',
            '<b>Offline Resilience:</b> A built-in Service Worker caches core assets and handles background notification actions (Snooze / OK) cleanly.'
          ], '#d97706')}
          `
        )}

        ${tipBox(
          'PRO TIP: Fastest Way to Start Your School Day',
          'Open the app in the morning → tap any class inside <b>Today\'s Status / Today\'s Schedule</b> → the Attendance screen opens pre-selected with that exact Class, Subject, and Date. Tap <b>Mark All Present</b>, mark only the absentees, and hit <b>Save</b>!',
          'emerald'
        )}
        `,
        meta
      )
    );

    // PAGE 4: CLASSES, SUBJECTS & TEACHERS MANAGEMENT
    pages.push(
      pageShell(
        4,
        total,
        'CHAPTER 03',
        'Classes, Subjects & Teachers Management',
        `
        ${card(
          ICONS.layers('#0369a1', 16),
          '1. Managing Classes (Dynamic Academic Levels)',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          ${stepList([
            'Open <b>Classes</b> from the Home Dashboard stat card or shortcut grid.',
            'Tap <b>"+ Add Class"</b>, enter the class name (e.g., <i>Class 10-A</i>, <i>Plus One</i>, <i>Plus Two</i>, <i>BA / BSc Degree</i>), and tap <b>Save</b>.',
            '<b>Smart Academic Fields:</b> The app automatically adapts student fields based on class level — supporting <b>Stream</b> (Science/Commerce/Humanities) for Plus One & Plus Two, <b>Degree Year</b> (1st/2nd/3rd Year) for UG classes, and standard fields for grades 5–10.',
            'Use the <b>Edit</b> or <b>Delete</b> icons on any class card (controlled by Admin edit permissions) to update class names anytime.'
          ], '#0284c7')}
          `
        )}

        ${card(
          ICONS.book('#0f766e', 16),
          '2. Managing Subjects & Teacher-Class Mapping',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          ${stepList([
            'Open <b>Subjects</b> from the Home Dashboard.',
            'Tap <b>"+ Add Subject"</b>, enter the subject name (e.g., <i>Arabic</i>, <i>Fiqh</i>, <i>Mathematics</i>, <i>English</i>).',
            'Select the <b>Class</b> it belongs to and assign the responsible <b>Teacher</b> from the dropdown list, then tap <b>Save</b>.',
            'Filter subjects by class to keep large institutions neatly organized. Each subject automatically links into Attendance, Reports, and Timetable slots.'
          ], '#0d9488')}
          `
        )}

        ${card(
          ICONS.users('#6d28d9', 16),
          '3. Faculty Directory, Class Teacher Role & Activity Logs',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">Adding & Linking Teachers</div>
              ${bulletList([
                '<b>Add Faculty Profile:</b> Go to <b>Teachers</b> → tap <b>+ Add Teacher</b> → enter Full Name, Email, Phone, Photo, and optional <b>Class Teacher</b> assignment.',
                '<b>Google Email Sync:</b> Matching a teacher\'s Google/Login email automatically connects their profile, timetable alerts, and activity logs.',
                '<b>Class Teacher Badge:</b> Assigned Class Teachers receive a highlighted badge on their profile and directory card.'
              ], '#7c3aed')}
            </div>
            <div>
              <div class="gpdf-subhead">Teacher Activity Log & Exports</div>
              ${bulletList([
                '<b>Full Session History:</b> Tap any teacher to open their dedicated <b>Teacher Log</b> page showing every attendance session they have taken.',
                '<b>Year & Class Filters:</b> Filter any teacher\'s work history by Academic Year or specific Class.',
                '<b>Direct Print & CSV Export:</b> One-click <b>Print Report</b> or <b>Export CSV</b> directly from the Teacher Log header for administrative audits.'
              ], '#7c3aed')}
            </div>
          </div>
          `
        )}

        ${tipBox(
          'ADMIN CONTROL: Teachers Tab Visibility',
          'Admins can toggle whether regular teachers can see the Teachers directory or edit/delete shared records directly from the <b>Admin Panel</b> settings.',
          'sky'
        )}
        `,
        meta
      )
    );

    // PAGE 5: STUDENT DIRECTORY, PROFILES & PHOTO TOOLS
    pages.push(
      pageShell(
        5,
        total,
        'CHAPTER 04',
        'Student Directory, Profiles & High-Quality Photo Tools',
        `
        ${card(
          ICONS.users('#059669', 16),
          'Adding & Organizing Students',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          ${stepList([
            'Open <b>Students</b> from the Home Dashboard and tap <b>"+ Add Student"</b>.',
            'Enter core academic details: <b>Full Name</b>, <b>Roll Number</b>, <b>Admission Number</b>, <b>Class</b> (plus Stream or Degree Year if applicable).',
            'Add comprehensive personal & guardian details: <b>Father/Guardian Name</b>, <b>Phone / WhatsApp Numbers</b>, <b>Date of Birth</b>, <b>Blood Group</b>, <b>Address</b>, and <b>Student Email</b> (for Student Portal linking).',
            'Upload a <b>Student Photo</b> directly from camera or gallery (automatically optimized & stored securely).',
            'Use the top <b>Class Filter</b> and instant <b>Search Bar</b> (by name, roll number, or admission number) to locate any student in milliseconds.'
          ], '#059669')}
          `
        )}

        ${card(
          ICONS.camera('#0284c7', 16),
          'Rich Student Profile Modal & Photo Viewer',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">Tap Any Student Photo or Card</div>
              ${bulletList([
                '<b>Complete Biodata View:</b> Opens a clean modal displaying photo, Roll No, Admission No, Class, Guardian details, Blood Group, and clickable contact numbers.',
                '<b>Enlarge & HD Download:</b> Tap the student\'s photo inside the profile to open the full-screen <b>Enlarged Photo Viewer</b> with a 1-click <b>Download HD Photo</b> button.',
                '<b>Quick Edit & Transfer:</b> Update student information or change class assignment directly from the profile.'
              ], '#0284c7')}
            </div>
            <div>
              <div class="gpdf-subhead">Individual Logs & A4 Profile Sheet</div>
              ${bulletList([
                '<b>Individual Attendance Log:</b> View that student\'s complete attendance history across all subjects, including total sessions, Present, Absent, Leave, and overall percentage.',
                '<b>Printable A4 Student Profile:</b> Generate a formal, clean A4 student biodata sheet with photo, school header, and attendance summary ready for office files or parent meetings.'
              ], '#0284c7')}
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.fileText('#d97706', 16),
          'Office-Ready Student Data Management',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          ${bulletList([
            '<b>Batch Class Statistics:</b> While adding students, a live counter shows total enrolled students in the selected class so roll numbers never duplicate.',
            '<b>Self-Submitted Students (Outcomers):</b> Instead of typing 100+ student records manually, share the <b>Student Submission Link</b> (<code>/submit-details.html</code>) so students enter their own details & photo for 1-click teacher approval!',
            '<b>Excel / Spreadsheet Export:</b> Export entire class or whole-school student directories to Excel/CSV anytime from <b>Profile → Print Reports</b>.'
          ], '#d97706')}
          `
        )}
        `,
        meta
      )
    );

    // PAGE 6: DAILY ATTENDANCE MARKING SYSTEM
    pages.push(
      pageShell(
        6,
        total,
        'CHAPTER 05',
        'Daily Attendance System — Fast, Accurate & Flexible',
        `
        ${card(
          ICONS.checkSquare('#059669', 16),
          'Step-by-Step Attendance Marking Workflow',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          ${stepList([
            'Tap the <b>Attendance</b> tab in the bottom navigation bar (or jump directly from a class card in <b>Today\'s Schedule</b> on the Home Dashboard).',
            'Select the <b>Class</b>, <b>Subject</b>, and <b>Date</b> (defaults automatically to today\'s date). The student roster loads immediately with Roll Numbers and Photos.',
            'Tap <b>"Mark All Present"</b> at the top to mark the entire class Present in 1 second, then tap only the students who are Absent or on Leave.',
            'Verify the live summary counters (Total / Present / Absent / Leave) and tap <b>"Save Attendance"</b>.'
          ], '#059669')}
          `
        )}

        ${card(
          ICONS.zap('#1e4d5f', 16),
          'Attendance Status Codes & Color Guide',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <div class="gpdf-status-grid">
            <div class="gpdf-status-card" style="background:#ecfdf5;border-color:#6ee7b7;">
              <span class="gpdf-badge-lg" style="background:#059669;">P</span>
              <div>
                <div class="gpdf-status-t" style="color:#065f46;">Present (ഹാജർ)</div>
                <div class="gpdf-status-d">Student attended the class session. Counted positively toward attendance percentage.</div>
              </div>
            </div>
            <div class="gpdf-status-card" style="background:#fff1f2;border-color:#fda4af;">
              <span class="gpdf-badge-lg" style="background:#e11d48;">A</span>
              <div>
                <div class="gpdf-status-t" style="color:#9f1239;">Absent (ഹാജരില്ല)</div>
                <div class="gpdf-status-d">Student missed the session without approved leave. Highlighted in red in reports & alerts.</div>
              </div>
            </div>
            <div class="gpdf-status-card" style="background:#fffbeb;border-color:#fcd34d;">
              <span class="gpdf-badge-lg" style="background:#d97706;">L</span>
              <div>
                <div class="gpdf-status-t" style="color:#92400e;">Leave (അവധി)</div>
                <div class="gpdf-status-d">Approved leave or absence with valid reason / parent intimation. Tracked separately from unexcused absences.</div>
              </div>
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.settings('#4f46e5', 16),
          'Editing, Updating & Deleting Saved Sessions',
          '#eef2ff',
          '#c7d2fe',
          '#312e81',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">Smart Duplicate Detection</div>
              ${bulletList([
                'If attendance was already marked for the chosen Class + Subject + Date, the app automatically loads the saved record so you never accidentally create duplicate sessions.',
                'The button automatically switches from <b>Save</b> to <b>Update</b>, letting you correct any late arrivals or status mistakes effortlessly.'
              ], '#4f46e5')}
            </div>
            <div>
              <div class="gpdf-subhead">Deleting & Audit Trail</div>
              ${bulletList([
                'Need to remove an entry marked on the wrong date? Tap <b>Delete Session</b> (with a safe confirmation prompt).',
                'Every Save, Update, and Delete is recorded in the <b>Teacher Activity Log</b> and <b>System Audit Log</b> with timestamp and teacher name.'
              ], '#4f46e5')}
            </div>
          </div>
          `
        )}

        ${tipBox(
          'INSTANT STUDENT PORTAL SYNC',
          'The moment a teacher taps <b>Save</b> or <b>Update</b>, every student\'s attendance calendar and percentage inside the <b>Student Portal</b> updates in real time.',
          'sky'
        )}
        `,
        meta
      )
    );

    // PAGE 7: REPORTS, ANALYTICS & OFFICE EXPORTS
    pages.push(
      pageShell(
        7,
        total,
        'CHAPTER 06',
        'Reports, Analytics, Printing & Office Excel/CSV Exports',
        `
        ${card(
          ICONS.barChart('#4f46e5', 16),
          'Consolidated Attendance Analytics (Report Tab)',
          '#eef2ff',
          '#c7d2fe',
          '#312e81',
          `
          ${stepList([
            'Open the <b>Report</b> tab from the bottom navigation bar.',
            'Choose your <b>Class</b> and <b>Subject</b> — select <b>"All Subjects"</b> for a complete class-wide consolidated register across every subject.',
            'Select the <b>Year</b> and <b>Period</b>: choose a specific Month (Jan–Dec), <b>"All Months"</b> for the full academic year, or a custom date window.',
            'View each student\'s <b>Total Sessions</b>, <b>Present</b>, <b>Absent</b>, <b>Leave</b>, and color-coded <b>Attendance Percentage (%)</b>.'
          ], '#4f46e5')}
          `
        )}

        ${card(
          ICONS.printer('#0f766e', 16),
          'Print Reports & Office Export Center (Profile → Print Reports)',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <p class="gpdf-p">Access all institutional print and spreadsheet exports from one unified menu inside <b>Profile → Print Reports (Students & Data)</b>:</p>
          <table class="gpdf-table">
            <thead>
              <tr><th>Export Type</th><th>Formats</th><th>Best Used For</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Class Attendance Sheet</b></td>
                <td>A4 Print / PDF / CSV</td>
                <td>Monthly or yearly official class registers, notice board display, and principal review.</td>
              </tr>
              <tr>
                <td><b>Students Data Export</b></td>
                <td>Excel / CSV / Print</td>
                <td>Office admission registers, parent phone lists, scholarship/exam forms, and ID card printing.</td>
              </tr>
              <tr>
                <td><b>Individual Student Attendance</b></td>
                <td>A4 Print / PDF</td>
                <td>Parent-teacher meetings (PTA), shortage of attendance notices, and progress reports.</td>
              </tr>
              <tr>
                <td><b>Individual Student Biodata</b></td>
                <td>A4 Profile Sheet</td>
                <td>Official student file folder with HD photo, guardian contact, and full academic profile.</td>
              </tr>
              <tr>
                <td><b>Teacher Activity Export</b></td>
                <td>Print / CSV</td>
                <td>Monthly faculty workload verification, periods taken per class, and administrative audits.</td>
              </tr>
            </tbody>
          </table>
          `
        )}

        ${tipBox(
          'PRO TIP: Effortless Office Register Work',
          'You can customize which columns to include before exporting <b>Students Data</b> (e.g., Roll No, Name, Admission No, Phone, Blood Group, Address) so your Excel sheet matches your school office format immediately.',
          'emerald'
        )}
        `,
        meta
      )
    );

    // PAGE 8: TIMETABLE & SMART AUTOMATED NOTIFICATIONS
    pages.push(
      pageShell(
        8,
        total,
        'CHAPTER 07',
        'Weekly Timetable & Smart Automated Notifications',
        `
        ${card(
          ICONS.calendar('#0284c7', 16),
          'Weekly Day-Wise Timetable Builder',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          ${stepList([
            'Open <b>Timetable</b> from the Home Dashboard or Profile menu.',
            'Select a weekday (Monday–Sunday) and tap <b>"+ Add Slot"</b>.',
            'Choose <b>Class</b>, <b>Subject</b>, assigned <b>Teacher</b>, <b>Start Time</b>, and <b>End Time</b>, then tap <b>Save</b>.',
            '<b>Automatic Conflict Detection:</b> If the same class or same teacher is already booked at an overlapping time, the app immediately alerts you with a <b>Timetable Conflict Modal</b> to prevent double-booking!'
          ], '#0284c7')}
          `
        )}

        ${card(
          ICONS.bell('#b45309', 16),
          'Automated Teacher Notification System (Teacher Portal Only)',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          <div class="gpdf-grid-2">
            <div class="gpdf-mini-box" style="border-color:#fcd34d;">
              <div class="gpdf-mini-head">${ICONS.clock('#d97706', 15)}<span>6:00 AM Morning Timetable Bubble</span></div>
              <div class="gpdf-mini-txt">
                Every morning from 6:00 AM, teachers receive a sleek pop-up summary listing all their classes scheduled for today — matched <b>strictly to their linked Email ID</b>. Supports <b>Snooze</b> and <b>OK</b> actions (including directly from OS push notifications).
              </div>
            </div>
            <div class="gpdf-mini-box" style="border-color:#fcd34d;">
              <div class="gpdf-mini-head">${ICONS.zap('#ea580c', 15)}<span>Pre-Class Live Reminder Card</span></div>
              <div class="gpdf-mini-txt">
                Automatically slides in at the top of the screen right before each scheduled period begins, showing the Class, Subject, and time — with a 1-tap button to open Attendance immediately.
              </div>
            </div>
          </div>
          <div style="margin-top:8px;">
            ${bulletList([
              '<b>Unassigned Timetable Warning:</b> Gently notifies teachers if their email has no timetable slots assigned yet, with a quick link to set them up.',
              '<b>Notification Preferences Modal:</b> Toggle browser push notifications, sound/vibration alerts, and reminder preferences from Profile → Notification Settings.',
              '<b>Zero Noise for Students:</b> All morning timetable popups, language prompts, and guide modals are strictly restricted to the <b>Teacher Portal</b> and never interrupt students.'
            ], '#d97706')}
          </div>
          `
        )}

        ${tipBox(
          'IMPORTANT: Link Your Teacher Email for 6 AM Alerts',
          'Make sure the email address on your Teacher profile matches your login email so the 6:00 AM Timetable Notification and Live Dashboard automatically recognize all your assigned periods.',
          'amber'
        )}
        `,
        meta
      )
    );

    // PAGE 9: COMMUNICATION, PERSONAL WORKSPACE & OUTCOMERS
    pages.push(
      pageShell(
        9,
        total,
        'CHAPTER 08',
        'Notice Board, Personal Workspace & Self-Submission Links',
        `
        ${card(
          ICONS.message('#0284c7', 16),
          '1. Staff Notice Board, Messaging & Announcements',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>Teacher-to-Teacher Chat & Notices:</b> Tap the top-header Bell icon to post circulars, schedule changes, or staff messages.',
              '<b>Live Unread Badge:</b> Automatically polls every 60 seconds and displays a jumping red badge count whenever new messages arrive.'
            ], '#0284c7')}
            ${bulletList([
              '<b>Edit & Delete Controls:</b> Long-press or tap any of your own messages to edit typos or remove outdated notices cleanly.',
              '<b>School Announcements & Events:</b> Publish official notices and upcoming school calendar events visible to both staff and students.'
            ], '#0284c7')}
          </div>
          `
        )}

        ${card(
          ICONS.lock('#db2777', 16),
          '2. Personal Workspace (100% Private Teacher Space)',
          '#fdf2f8',
          '#fbcfe8',
          '#831843',
          `
          <p class="gpdf-p">Need to manage private tuition batches, mentoring groups, or personal classes separate from the main school register? <b>Personal Workspace</b> gives every teacher their own private sandbox:</p>
          ${bulletList([
            '<b>Complete Privacy:</b> Classes, subjects, students, and attendance saved inside Personal Workspace are visible <b>only to you</b> — never mixed with main school data.',
            '<b>Full Dynamic Features:</b> Supports Plus One / Plus Two Streams, UG Degree Years, grades 5–10, student photos, and full profile cards.',
            '<b>Yearly Attendance Insights:</b> Tap any private student\'s photo to instantly inspect their total sessions, Present/Absent counts, and attendance percentage.'
          ], '#db2777')}
          `
        )}

        ${card(
          ICONS.link('#059669', 16),
          '3. Shareable Portal Links & Outcomers (Self-Registration) Inbox',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">One-Tap Link Sharing (Copy / WhatsApp)</div>
              ${bulletList([
                'Open <b>Portal Links</b> to copy or share direct links via WhatsApp for:',
                '• <b>Teacher Portal Link</b> (<code>/?portal=teacher</code>)',
                '• <b>Student Portal Link</b> (<code>/?portal=student</code>)',
                '• <b>Public Student Details Form</b> (<code>/submit-details.html</code>)'
              ], '#059669')}
            </div>
            <div>
              <div class="gpdf-subhead">Outcomers Review & Approval</div>
              ${bulletList([
                'Students submit their name, photo, class, parent phone, blood group & address via the public form.',
                'Submissions land in the teacher\'s <b>Outcomers</b> tab.',
                'Review details, assign Roll Number & Class, and tap <b>Approve & Enroll</b> to move them straight into the official Students Directory!'
              ], '#059669')}
            </div>
          </div>
          `
        )}
        `,
        meta
      )
    );

    // PAGE 10: STUDENT PORTAL, PROMOTION, ADMIN PANEL & SUMMARY
    pages.push(
      pageShell(
        10,
        total,
        'CHAPTER 09',
        'Student Portal, Year Promotion & Admin Control Panel',
        `
        ${card(
          ICONS.gradCap('#0f766e', 16),
          '1. Dedicated Student Portal (5-Tab Experience)',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>Home:</b> Personalized greeting, live attendance summary cards, today\'s classes & quick actions.',
              '<b>Attendance Calendar:</b> Interactive monthly calendar showing Present/Absent/Leave dots + subject-wise percentage breakdown.',
              '<b>Classes & Timetable:</b> Full weekly timetable and subject/teacher details.'
            ], '#0d9488')}
            ${bulletList([
              '<b>Updates & Leave Requests:</b> View school notices/events and submit digital <b>Leave Requests</b> with reason & date range.',
              '<b>Profile & Digital ID Card:</b> View personal biodata and printable Digital Student ID Card.',
              '<b>Teacher Preview Mode:</b> Teachers can preview the Student Portal and return with 1 click via the top banner.'
            ], '#0d9488')}
          </div>
          `
        )}

        ${card(
          ICONS.award('#7c3aed', 16),
          '2. Academic Year Promotion, Archives & Alumni Directory',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          ${bulletList([
            '<b>Bulk Year-End Promotion:</b> At the end of an academic year, promote an entire class to the next grade (e.g., Class 9 → Class 10) or graduate final-year students to <b>Alumni</b> in one step.',
            '<b>Safe Rollback / Undo:</b> Every promotion is saved as a tracked <b>Promotion Batch</b> that Admins can safely review or undo if needed.',
            '<b>Past Year Archives & Alumni Directory:</b> Browse historical attendance records and print archived student profiles anytime without cluttering the active academic year.'
          ], '#7c3aed')}
          `
        )}

        ${card(
          ICONS.database('#1e4d5f', 16),
          '3. Admin Panel, Backups, Security & Customization',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>School Branding:</b> Customize App Name, School Name, and upload your official School Logo (automatically updates header, manifest, and device icon).',
              '<b>Permissions & Accounts:</b> Manage teacher accounts, Class Teacher roles, Edit/Delete permissions, and header button preferences.'
            ], '#245b70')}
            ${bulletList([
              '<b>Full Backup & Restore:</b> Download complete JSON database backups and restore safely whenever needed.',
              '<b>Bilingual & Theme Controls:</b> Instant <b>English / മലയാളം</b> language toggle, <b>Light / Dark Mode</b>, Password Change, and full <b>Activity Audit Logs</b>.'
            ], '#245b70')}
          </div>
          `
        )}

        ${tipBox(
          'NEED THIS GUIDE AGAIN ANYTIME?',
          'Tap the <b>Info (i)</b> icon in the top header of the Teacher Portal to reopen the Quick Guide, switch between <b>English</b> and <b>മലയാളം</b>, or download this complete A–Z PDF again in either language!',
          'emerald'
        )}
        `,
        meta
      )
    );

    return pages;
  }

  // ---------- 5. MALAYALAM 10-PAGE COMPLETE A-TO-Z CONTENT ----------
  function buildMalayalamPages(meta) {
    const total = 10;
    const pages = [];

    // PAGE 1: COVER + OVERVIEW + TOC (ML)
    pages.push(`
      <div class="gpdf-page gpdf-cover-page">
        <div class="gpdf-cover-hero">
          <div class="gpdf-cover-badge">${ICONS.sparkles('#67e8f9', 14)}<span>സമ്പൂർണ്ണ ആപ്പ് ഗൈഡ് & ഫീച്ചർ മാനുവൽ (A–Z)</span></div>
          <div class="gpdf-cover-brand-row">
            <div class="gpdf-cover-logo">${ICONS.book('#ffffff', 30)}</div>
            <div>
              <h1 class="gpdf-cover-title">${esc(meta.appName)}</h1>
              <div class="gpdf-cover-sub">${meta.schoolName ? esc(meta.schoolName) + ' • ' : ''}സ്മാർട്ട് സ്കൂൾ അറ്റൻഡൻസ് & മാനേജ്‌മെന്റ് ആപ്പ്</div>
            </div>
          </div>
          <p class="gpdf-cover-desc">
            ${esc(meta.appName)} ആപ്പിലെ എല്ലാ സൗകര്യങ്ങളും, ടാബുകളും, ഹാജർ രേഖപ്പെടുത്തുന്ന രീതിയും, ടൈംടേബിൾ നോട്ടിഫിക്കേഷനുകളും, റിപ്പോർട്ടുകളും, സ്റ്റുഡന്റ് പോർട്ടലും, അഡ്മിൻ ക്രമീകരണങ്ങളും A മുതൽ Z വരെ ലളിതമായി വിശദീകരിക്കുന്ന സമ്പൂർണ്ണ മാർഗ്ഗരേഖ.
          </p>
        </div>

        <div class="gpdf-cover-body">
          <div class="gpdf-section-label">ഈ ആപ്പ് കൊണ്ടുള്ള പ്രധാന ഉപകാരങ്ങൾ</div>
          <div class="gpdf-grid-3">
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#e0f2fe;">${ICONS.zap('#0284c7', 17)}</div>
              <div class="gpdf-benefit-t">5 സെക്കൻഡിൽ ഹാജർ</div>
              <div class="gpdf-benefit-d">ഒരൊറ്റ ക്ലിക്കിൽ 'Mark All Present' വഴിയും ഡാഷ്‌ബോർഡ് ടൈംടേബിൾ വഴിയും അതിവേഗം ഹാജർ എടുക്കാം.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#dcfce7;">${ICONS.barChart('#16a34a', 17)}</div>
              <div class="gpdf-benefit-t">കൃത്യമായ റിപ്പോർട്ടുകൾ</div>
              <div class="gpdf-benefit-d">മാസ/വാർഷിക ഹാജർ ശതമാനം, All Subjects റിപ്പോർട്ട്, A4 പ്രിന്റ്, Excel/CSV ഡൗൺലോഡ് സൗകര്യം.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#fef3c7;">${ICONS.bell('#d97706', 17)}</div>
              <div class="gpdf-benefit-t">രാവിലെ 6 മണി അലേർട്ട്</div>
              <div class="gpdf-benefit-d">അധ്യാപകരുടെ ഇമെയിലുമായി ബന്ധിപ്പിച്ച ടൈംടേബിൾ നോട്ടിഫിക്കേഷനും ക്ലാസിന് മുമ്പുള്ള ഓർമ്മപ്പെടുത്തലും.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#f3e8ff;">${ICONS.gradCap('#7c3aed', 17)}</div>
              <div class="gpdf-benefit-t">സ്റ്റുഡന്റ് പോർട്ടൽ</div>
              <div class="gpdf-benefit-d">കുട്ടികൾക്ക് സ്വന്തം ഹാജർ കലണ്ടർ, ടൈംടേബിൾ, നോട്ടീസുകൾ, ലീവ് അപേക്ഷ, ഡിജിറ്റൽ ഐഡി എന്നിവ കാണാം.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#fce7f3;">${ICONS.lock('#db2777', 17)}</div>
              <div class="gpdf-benefit-t">പേഴ്സണൽ വർക്ക്സ്പേസ്</div>
              <div class="gpdf-benefit-d">അധ്യാപകർക്ക് സ്വകാര്യ ട്യൂഷൻ/ക്ലാസുകളും കുട്ടികളെയും മറ്റാർക്കും കാണാത്ത രീതിയിൽ സൂക്ഷിക്കാം.</div>
            </div>
            <div class="gpdf-benefit">
              <div class="gpdf-benefit-ic" style="background:#ccfbf1;">${ICONS.globe('#0d9488', 17)}</div>
              <div class="gpdf-benefit-t">മലയാളം & ഇംഗ്ലീഷ്</div>
              <div class="gpdf-benefit-d">മലയാളം/ഇംഗ്ലീഷ് ഭാഷാ മാറ്റം, ലൈറ്റ്/ഡാർക്ക് മോഡ്, ഫോണിലേക്ക് ഒറ്റ ക്ലിക്കിൽ PWA ഇൻസ്റ്റാൾ സൗകര്യം.</div>
            </div>
          </div>

          <div class="gpdf-section-label" style="margin-top:14px;">ഉള്ളടക്കം (A–Z അധ്യായ സൂചിക)</div>
          <div class="gpdf-toc-grid">
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">02</span><span>ആപ്പിന്റെ ഘടന, പോർട്ടലുകൾ, റോളുകൾ & തുടക്കം</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">03</span><span>ഹോം ഡാഷ്‌ബോർഡ്, ലൈവ് സ്റ്റാറ്റസ് & PWA ഇൻസ്റ്റാൾ</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">04</span><span>ക്ലാസ്, വിഷയം & അധ്യാപക മാനേജ്‌മെന്റ്</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">05</span><span>കുട്ടികളുടെ ഡയറക്ടറി, പ്രൊഫൈൽ & ഫോട്ടോ ടൂളുകൾ</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">06</span><span>ദൈനംദിന ഹാജർ രേഖപ്പെടുത്തൽ (P / A / L)</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">07</span><span>റിപ്പോർട്ടുകൾ, പ്രിന്റിംഗ് & Excel/CSV എക്സ്പോർട്ട്</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">08</span><span>ടൈംടേബിൾ & സ്മാർട്ട് നോട്ടിഫിക്കേഷനുകൾ</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">09</span><span>നോട്ടീസ് ബോർഡ്, പേഴ്സണൽ വർക്ക്സ്പേസ് & ഔട്ട്കമേഴ്സ്</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">10</span><span>സ്റ്റുഡന്റ് പോർട്ടൽ, പ്രൊമോഷൻ & അഡ്മിൻ പാനൽ</span></div>
            <div class="gpdf-toc-item"><span class="gpdf-toc-p">PRO</span><span>ഓഫീസ് വർക്കുകൾക്കുള്ള പ്രധാന ടിപ്പുകളും ഷോർട്ട്കട്ടുകളും</span></div>
          </div>
        </div>

        <div class="gpdf-footer">
          <span>${esc(meta.appName)} • തയ്യാറാക്കിയ തീയതി: ${esc(meta.dateStr)}</span>
          <span class="gpdf-page-num">പേജ് 1 / ${total}</span>
        </div>
      </div>
    `);

    // PAGE 2: ARCHITECTURE, PORTALS, ROLES & ONBOARDING (ML)
    pages.push(
      pageShell(
        2,
        total,
        'അധ്യായം 01',
        'ആപ്പിന്റെ ഘടന, പോർട്ടലുകൾ, റോളുകൾ & പ്രവേശനം',
        `
        ${card(
          ICONS.layers('#0369a1', 16),
          'ആപ്പിലെ 4 പ്രധാന ടാബുകൾ (താഴെയുള്ള നാവിഗേഷൻ)',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.home('#0284c7', 15)}<span>1. ഹോം (Home)</span></div>
              <div class="gpdf-mini-txt">ലൈവ് ഡാഷ്‌ബോർഡ്: ഇപ്പോഴത്തെ ക്ലാസ്, അടുത്ത വിഷയം, ആകെ കണക്കുകൾ, അക്കാദമിക് വർഷം, എല്ലാ വിഭാഗങ്ങളിലേക്കുമുള്ള ഷോർട്ട്കട്ടുകൾ.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.checkSquare('#059669', 15)}<span>2. ഹാജർ (Attendance)</span></div>
              <div class="gpdf-mini-txt">ക്ലാസ്, വിഷയം, തീയതി തിരഞ്ഞെടുത്ത് Present (P), Absent (A), Leave (L) രേഖപ്പെടുത്താനുള്ള പേജ്. 'Mark All Present' സൗകര്യം.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.barChart('#4f46e5', 15)}<span>3. റിപ്പോർട്ട് (Report)</span></div>
              <div class="gpdf-mini-txt">മാസ/വാർഷിക ഹാജർ ശതമാനം, 'All Subjects' സംയോജിത റിപ്പോർട്ട്, A4 പ്രിന്റ് ഷീറ്റ്, CSV ഡൗൺലോഡ് എന്നിവ.</div>
            </div>
            <div class="gpdf-mini-box">
              <div class="gpdf-mini-head">${ICONS.user('#d97706', 15)}<span>4. പ്രൊഫൈൽ (Profile)</span></div>
              <div class="gpdf-mini-txt">അധ്യാപക പ്രൊഫൈൽ, ക്ലാസ് ടീച്ചർ ബാഡ്ജ്, പ്രിന്റ് റിപ്പോർട്ടുകൾ, അഡ്മിൻ പാനൽ, നോട്ടീസ് ബോർഡ്, ഭാഷ & ഡാർക്ക് മോഡ്.</div>
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.shield('#1e4d5f', 16),
          'ടീച്ചേഴ്സ് ലിങ്കും സ്റ്റുഡന്റ്സ് ലിങ്കും (പൂർണ്ണമായ വേർതിരിവ്)',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <table class="gpdf-table">
            <thead>
              <tr><th>പോർട്ടൽ / ലിങ്ക്</th><th>ഉപയോക്താക്കൾ</th><th>പ്രത്യേകതകളും സുരക്ഷയും</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>ടീച്ചർ പോർട്ടൽ</b><br><code>/?portal=teacher</code></td>
                <td>അഡ്മിൻ, ക്ലാസ് ടീച്ചർ, സബ്ജക്ട് ടീച്ചർ</td>
                <td>പൂർണ്ണ ഡാഷ്‌ബോർഡ്, ഹാജർ, റിപ്പോർട്ടുകൾ, ടൈംടേബിൾ, ഭാഷാ തിരഞ്ഞെടുപ്പ്, ആപ്പ് ഗൈഡ് മോഡൽ, രാവിലെ 6 മണി ടൈംടേബിൾ നോട്ടിഫിക്കേഷനുകൾ.</td>
              </tr>
              <tr>
                <td><b>സ്റ്റുഡന്റ് പോർട്ടൽ</b><br><code>/?portal=student</code></td>
                <td>വിദ്യാർത്ഥികൾ & രക്ഷിതാക്കൾ</td>
                <td>വിദ്യാർത്ഥികൾക്കായുള്ള 5 ടാബുകൾ മാത്രം (ഹോം, ഹാജർ കലണ്ടർ, ക്ലാസുകൾ, അപ്‌ഡേറ്റുകൾ, ഡിജിറ്റൽ ഐഡി). ടീച്ചേഴ്സിന്റെ ഗൈഡോ ടൈംടേബിൾ പോപ്പ്-അപ്പുകളോ ഇവിടെ കാണിക്കില്ല.</td>
              </tr>
              <tr>
                <td><b>വിവരങ്ങൾ സമർപ്പിക്കാൻ</b><br><code>/submit-details.html</code></td>
                <td>പുതിയ വിദ്യാർത്ഥികൾ</td>
                <td>വിദ്യാർത്ഥികൾക്ക് സ്വന്തമായി വിവരങ്ങളും ഫോട്ടോയും സമർപ്പിക്കാനുള്ള പൊതു ലിങ്ക്. ഇവ ടീച്ചറുടെ 'Outcomers' ഇൻബോക്സിൽ എത്തും.</td>
              </tr>
            </tbody>
          </table>
          `
        )}

        ${card(
          ICONS.users('#6d28d9', 16),
          'ലോഗിൻ, റോളുകൾ & ആദ്യമായി ആപ്പ് തുറക്കുമ്പോൾ',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">ലോഗിനും അധികാരങ്ങളും</div>
              ${bulletList([
                '<b>Google Sign-In / ഇമെയിൽ ലോഗിൻ:</b> ഒറ്റ ക്ലിക്കിൽ ഗൂഗിൾ അക്കൗണ്ട് വഴിയോ ഇമെയിൽ-പാസ്‌വേഡ് വഴിയോ പ്രവേശിക്കാം.',
                '<b>ആദ്യ അക്കൗണ്ട് അഡ്മിൻ:</b> ആപ്പിൽ ആദ്യം രജിസ്റ്റർ ചെയ്യുന്ന അധ്യാപക അക്കൗണ്ടിന് സ്വയമേവ പൂർണ്ണ <b>Admin</b> അധികാരം ലഭിക്കും.',
                '<b>ക്ലാസ് ടീച്ചർ ബാഡ്ജ്:</b> ഒരു ക്ലാസിന്റെ ചുമതലയുള്ള അധ്യാപകന് പ്രൊഫൈലിൽ പ്രത്യേക സ്വർണ്ണ ബാഡ്ജ് തെളിയും.'
              ], '#7c3aed')}
            </div>
            <div>
              <div class="gpdf-subhead">ടീച്ചേഴ്സ് ആപ്പ് തുറക്കുമ്പോൾ കാണുന്ന ക്രമം</div>
              ${stepList([
                '<b>ഘട്ടം 1 — ഭാഷ തിരഞ്ഞെടുക്കുക:</b> മലയാളം അല്ലെങ്കിൽ English തിരഞ്ഞെടുക്കാം.',
                '<b>ഘട്ടം 2 — ആപ്പ് ഗൈഡ് മോഡൽ:</b> പ്രധാന നിർദ്ദേശങ്ങളും ഈ "Guide More" സമ്പൂർണ്ണ PDF ഡൗൺലോഡ് ബട്ടണും.',
                '<b>ഘട്ടം 3 — ടൈംടേബിൾ അലേർട്ട്:</b> ഇന്നത്തെ ക്ലാസുകൾ നോട്ടിഫിക്കേഷനായി കാണിക്കും.',
                '<b>ഘട്ടം 4 — ഹോം ഡാഷ്‌ബോർഡ്:</b> ഇന്നത്തെ ക്ലാസുകൾക്കായി പോർട്ടൽ സജ്ജമാകും.'
              ], '#6d28d9')}
            </div>
          </div>
          `
        )}
        `,
        meta
      )
    );

    // PAGE 3: HOME DASHBOARD & PWA (ML)
    pages.push(
      pageShell(
        3,
        total,
        'അധ്യായം 02',
        'ഹോം ഡാഷ്‌ബോർഡ്, ലൈവ് സ്റ്റാറ്റസ് & PWA ഇൻസ്റ്റാൾ',
        `
        ${card(
          ICONS.clock('#0f766e', 16),
          "ഇന്നത്തെ ലൈവ് സ്റ്റാറ്റസ് കാർഡ് (Today's Status)",
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <p class="gpdf-p">ഹോം പേജിന്റെ മുകളിലുള്ള <b>Today's Status</b> കാർഡ് നിങ്ങളുടെ ടൈംടേബിളും ഇപ്പോഴത്തെ സമയവും തത്സമയം പരിശോധിക്കുന്നു:</p>
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>LIVE IN (ഇപ്പോഴത്തെ ക്ലാസ്):</b> ഈ സമയത്ത് നിങ്ങൾക്ക് ഏത് ക്ലാസിൽ ഏത് വിഷയമാണുള്ളതെന്ന് തത്സമയം കാണിക്കും.',
              '<b>NEXT SUBJECT (അടുത്ത വിഷയം):</b> അടുത്തതായി എടുക്കേണ്ട വിഷയവും ക്ലാസും സമയവും മുൻകൂട്ടി കാണാം.'
            ], '#0d9488')}
            ${bulletList([
              '<b>ഇന്നത്തെ ഷെഡ്യൂൾ (Today\'s Schedule):</b> ക്ലിക്ക് ചെയ്താൽ ഇന്നത്തെ മുഴുവൻ ക്ലാസുകളും കാണാം. ഏതെങ്കിലും ക്ലാസിൽ തൊട്ടാൽ നേരെ ഹാജർ പേജിലെത്തും!',
              '<b>രേഖപ്പെടുത്തിയ ഹാജർ (Today\'s Marked):</b> ഇന്ന് ഇതുവരെ ഹാജർ എടുത്ത ക്ലാസുകളുടെ പട്ടികയും ഹാജർ/അസാന്നിധ്യ കണക്കുകളും കാണാം.'
            ], '#0d9488')}
          </div>
          `
        )}

        ${card(
          ICONS.home('#1d4ed8', 16),
          'ഡാഷ്‌ബോർഡ് കാർഡുകൾ, അക്കാദമിക് വർഷം & ഷോർട്ട്കട്ടുകൾ',
          '#eff6ff',
          '#bfdbfe',
          '#1e3a8a',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">മുകളിലെ ഹെഡറും ഗ്രീറ്റിംഗ് കാർഡും</div>
              ${bulletList([
                '<b>അക്കാദമിക് വർഷം സ്വിച്ചർ:</b> <i>Academic Year 2026-27</i> ബട്ടണിൽ ക്ലിക്ക് ചെയ്ത് മുൻ വർഷങ്ങളിലെ ആർക്കൈവ് (Archive) വിവരങ്ങൾ കാണാം.',
                '<b>ഹെഡർ ഐക്കണുകൾ:</b> നോട്ടീസ് ബോർഡ് ബെൽ (വായിക്കാത്ത സന്ദേശങ്ങളുടെ ചുവന്ന ബാഡ്ജ്), <b>Info (i)</b> ഗൈഡ് ബട്ടൺ, ഭാഷ/തീം ബട്ടണുകൾ, പ്രൊഫൈൽ ഫോട്ടോ.'
              ], '#2563eb')}
            </div>
            <div>
              <div class="gpdf-subhead">കണക്കുകളും വേഗത്തിലുള്ള ഷോർട്ട്കട്ടുകളും</div>
              ${bulletList([
                '<b>4 സ്റ്റാറ്റ് കാർഡുകൾ:</b> ആകെ ക്ലാസുകൾ, വിഷയങ്ങൾ, വിദ്യാർത്ഥികൾ, അധ്യാപകർ എന്നിവയുടെ തത്സമയ എണ്ണം.',
                '<b>ക്വിക്ക് ഷോർട്ട്കട്ടുകൾ:</b> Classes, Subjects, Students, Teachers, Timetable, Personal Workspace, Outcomers, Portal Links എന്നിവയിലേക്ക് ഒറ്റ ക്ലിക്കിൽ എത്താം.'
              ], '#2563eb')}
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.download('#b45309', 16),
          'ഒറ്റ ക്ലിക്കിൽ ഫോണിലേക്ക് ഇൻസ്റ്റാൾ ചെയ്യാം (PWA App)',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          <p class="gpdf-p">${esc(meta.appName)} ഒരു ആധുനിക <b>Progressive Web App (PWA)</b> ആണ്. പ്ലേ സ്റ്റോറിൽ നിന്നോ ആപ്പ് സ്റ്റോറിൽ നിന്നോ ഡൗൺലോഡ് ചെയ്യാതെ തന്നെ ഫോണിൽ ആപ്പ് ആയി ഉപയോഗിക്കാം:</p>
          ${stepList([
            '<b>Install ബട്ടൺ:</b> Chrome / Edge / Android ഫോണിൽ ഹെഡറിലുള്ള മഞ്ഞ <b>"Install"</b> ബട്ടൺ അമർത്തിയാൽ ഹോം സ്ക്രീനിൽ ആപ്പ് ഐക്കൺ വരും.',
            '<b>നേറ്റീവ് ആപ്പ് അനുഭവം:</b> സ്കൂളിന്റെ സ്വന്തം ലോഗോയും പേരും സഹിതം ഫുൾ-സ്ക്രീനായി വേഗത്തിൽ പ്രവർത്തിക്കും.',
            '<b>ഓഫ്‌ലൈൻ സപ്പോർട്ട്:</b> ബിൽറ്റ്-ഇൻ Service Worker വേഗത്തിലുള്ള ലോഡിംഗും നോട്ടിഫിക്കേഷൻ ആക്ഷനുകളും (Snooze / OK) ഉറപ്പാക്കുന്നു.'
          ], '#d97706')}
          `
        )}

        ${tipBox(
          'പ്രോ ടിപ്പ്: ഏറ്റവും വേഗത്തിൽ ഹാജർ എടുക്കാൻ',
          'രാവിലെ ആപ്പ് തുറന്ന് ഡാഷ്‌ബോർഡിലെ <b>Today\'s Schedule</b> കാർഡിൽ നിങ്ങളുടെ ക്ലാസിൽ ക്ലിക്ക് ചെയ്യുക — ക്ലാസും വിഷയവും തീയതിയും തനിയെ തിരഞ്ഞെടുത്ത ഹാജർ പേജ് തുറക്കും. <b>Mark All Present</b> അമർത്തി ഹാജരില്ലാത്തവരെ മാത്രം മാറ്റിയാൽ മതി!',
          'emerald'
        )}
        `,
        meta
      )
    );

    // PAGE 4: CLASSES, SUBJECTS & TEACHERS (ML)
    pages.push(
      pageShell(
        4,
        total,
        'അധ്യായം 03',
        'ക്ലാസ്, വിഷയം & അധ്യാപക മാനേജ്‌മെന്റ്',
        `
        ${card(
          ICONS.layers('#0369a1', 16),
          '1. ക്ലാസുകൾ ചേർക്കാനും നിയന്ത്രിക്കാനും',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          ${stepList([
            'ഹോം പേജിലെ <b>Classes</b> കാർഡിൽ ക്ലിക്ക് ചെയ്യുക.',
            '<b>"+ Add Class"</b> അമർത്തി ക്ലാസിന്റെ പേര് നൽകുക (ഉദാ: <i>Class 10-A</i>, <i>Plus One</i>, <i>Plus Two</i>, <i>Degree</i>) എന്നിട്ട് <b>Save</b> ചെയ്യുക.',
            '<b>സ്മാർട്ട് ക്ലാസ് ഫീൽഡുകൾ:</b> പ്ലസ് വൺ/പ്ലസ് ടു ക്ലാസുകൾക്ക് <b>Stream</b> (Science/Commerce/Humanities), ഡിഗ്രി ക്ലാസുകൾക്ക് <b>Year</b> (1st/2nd/3rd Year), 5–10 ക്ലാസുകൾക്ക് സാധാരണ വിവരങ്ങൾ എന്നിവ ആപ്പ് സ്വയമേവ സജ്ജമാക്കും.',
            'ക്ലാസുകളുടെ പേര് മാറ്റാൻ <b>Edit</b>, ഒഴിവാക്കാൻ <b>Delete</b> ബട്ടണുകൾ ഉപയോഗിക്കാം.'
          ], '#0284c7')}
          `
        )}

        ${card(
          ICONS.book('#0f766e', 16),
          '2. വിഷയങ്ങൾ ചേർക്കാനും അധ്യാപകരെ നിശ്ചയിക്കാനും',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          ${stepList([
            'ഹോം പേജിലെ <b>Subjects</b> കാർഡിൽ ക്ലിക്ക് ചെയ്യുക.',
            '<b>"+ Add Subject"</b> അമർത്തി വിഷയത്തിന്റെ പേര് നൽകുക (ഉദാ: <i>അറബിക്</i>, <i>ഫിഖ്ഹ്</i>, <i>കണക്ക്</i>, <i>ഇംഗ്ലീഷ്</i>).',
            'ആ വിഷയം ഏത് <b>ക്ലാസിലേതാണെന്നും</b> ഏത് <b>അധ്യാപകനാണ്</b> പഠിപ്പിക്കുന്നതെന്നും തിരഞ്ഞെടുത്ത് <b>Save</b> ചെയ്യുക.',
            'ഓരോ ക്ലാസിനും പ്രത്യേകം ഫിൽട്ടർ ചെയ്ത് വിഷയങ്ങൾ കാണാം. ഇവ ഹാജർ, റിപ്പോർട്ട്, ടൈംടേബിൾ എന്നിവയിൽ തനിയെ ലഭ്യമാകും.'
          ], '#0d9488')}
          `
        )}

        ${card(
          ICONS.users('#6d28d9', 16),
          '3. അധ്യാപക ഡയറക്ടറി & ആക്റ്റിവിറ്റി ലോഗുകൾ',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">അധ്യാപകരെ ചേർക്കാൻ</div>
              ${bulletList([
                '<b>+ Add Teacher:</b> അധ്യാപകന്റെ പേര്, ഇമെയിൽ, ഫോൺ നമ്പർ, ഫോട്ടോ, <b>Class Teacher</b> ചുമതല എന്നിവ ചേർക്കാം.',
                '<b>Google Email ലിങ്കിംഗ്:</b> അധ്യാപകന്റെ ലോഗിൻ ഇമെയിൽ നൽകിയാൽ അവരുടെ പ്രൊഫൈലും ടൈംടേബിൾ അലേർട്ടുകളും തനിയെ ബന്ധിപ്പിക്കപ്പെടും.',
                '<b>ക്ലാസ് ടീച്ചർ ബാഡ്ജ്:</b> ക്ലാസ് ടീച്ചറായി നിശ്ചയിച്ചവർക്ക് പ്രൊഫൈലിൽ പ്രത്യേക ബാഡ്ജ് തെളിയും.'
              ], '#7c3aed')}
            </div>
            <div>
              <div class="gpdf-subhead">ടീച്ചർ ആക്റ്റിവിറ്റി ലോഗ്</div>
              ${bulletList([
                '<b>സെഷൻ ഹിസ്റ്ററി:</b> ഏതൊരു അധ്യാപകന്റെയും പേരിൽ ക്ലിക്ക് ചെയ്താൽ അവർ എടുത്ത എല്ലാ ഹാജർ സെഷനുകളും തീയതി ക്രമത്തിൽ കാണാം.',
                '<b>വർഷം & ക്ലാസ് ഫിൽട്ടർ:</b> അക്കാദമിക് വർഷമോ ക്ലാസോ അനുസരിച്ച് സെഷനുകൾ വേർതിരിക്കാം.',
                '<b>പ്രിന്റ് & CSV:</b> ടീച്ചർ ലോഗ് പേജിൽ നിന്ന് നേരിട്ട് പ്രിന്റ് എടുക്കാനോ CSV എക്സ്പോർട്ട് ചെയ്യാനോ സാധിക്കും.'
              ], '#7c3aed')}
            </div>
          </div>
          `
        )}

        ${tipBox(
          'അഡ്മിൻ നിയന്ത്രണം',
          'മറ്റ് അധ്യാപകർക്ക് Teachers ടാബ് കാണണോ വേണ്ടയോ എന്നും, എഡിറ്റ്/ഡിലീറ്റ് അധികാരങ്ങൾ ആർക്കൊക്കെ വേണമെന്നും <b>Admin Panel</b> വഴി അഡ്മിന് നിയന്ത്രിക്കാം.',
          'sky'
        )}
        `,
        meta
      )
    );

    // PAGE 5: STUDENT DIRECTORY & PHOTO TOOLS (ML)
    pages.push(
      pageShell(
        5,
        total,
        'അധ്യായം 04',
        'വിദ്യാർത്ഥികളുടെ ഡയറക്ടറി, പ്രൊഫൈൽ & ഫോട്ടോ സൗകര്യങ്ങൾ',
        `
        ${card(
          ICONS.users('#059669', 16),
          'കുട്ടികളെ ചേർക്കാനും തിരയാനും',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          ${stepList([
            'ഹോം പേജിലെ <b>Students</b> കാർഡിൽ ക്ലിക്ക് ചെയ്ത് <b>"+ Add Student"</b> അമർത്തുക.',
            'അക്കാദമിക് വിവരങ്ങൾ നൽകുക: <b>പേര്</b>, <b>റോൾ നമ്പർ</b>, <b>അഡ്മിഷൻ നമ്പർ</b>, <b>ക്ലാസ്</b> (ആവശ്യമെങ്കിൽ Stream / Degree Year).',
            'വ്യക്തിഗത വിവരങ്ങൾ: <b>രക്ഷിതാവിന്റെ പേര്</b>, <b>ഫോൺ / വാട്സ്ആപ്പ് നമ്പർ</b>, <b>ജനനത്തീയതി</b>, <b>രക്തഗ്രൂപ്പ്</b>, <b>വിലാസം</b>, <b>സ്റ്റുഡന്റ് ഇമെയിൽ</b> (സ്റ്റുഡന്റ് പോർട്ടൽ ലിങ്കിനായി).',
            'കുട്ടിയുടെ <b>ഫോട്ടോ</b> അപ്‌ലോഡ് ചെയ്ത് Save ചെയ്യുക.',
            'മുകളിലെ <b>Class Filter</b>, <b>Search Bar</b> (പേര്/റോൾ നമ്പർ/അഡ്മിഷൻ നമ്പർ) എന്നിവ വഴി നിമിഷനേരം കൊണ്ട് ഏത് കുട്ടിയെയും കണ്ടെത്താം.'
          ], '#059669')}
          `
        )}

        ${card(
          ICONS.camera('#0284c7', 16),
          'സമ്പൂർണ്ണ സ്റ്റുഡന്റ് പ്രൊഫൈലും HD ഫോട്ടോ വ്യൂവറും',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">കുട്ടിയുടെ ഫോട്ടോയിൽ ക്ലിക്ക് ചെയ്താൽ</div>
              ${bulletList([
                '<b>മുഴുവൻ വിവരങ്ങൾ:</b> ഫോട്ടോ, റോൾ നമ്പർ, അഡ്മിഷൻ നമ്പർ, രക്ഷിതാവിന്റെ ഫോൺ, വിലാസം, രക്തഗ്രൂപ്പ് എന്നിവ ഒരൊറ്റ കാർഡിൽ കാണാം.',
                '<b>വലുതാക്കി കാണാനും ഡൗൺലോഡ് ചെയ്യാനും:</b> പ്രൊഫൈലിലെ ഫോട്ടോയിൽ വീണ്ടും തൊട്ടാൽ ഫുൾ-സ്ക്രീൻ <b>HD Photo Viewer</b> തുറക്കും; ഉയർന്ന ക്വാളിറ്റിയിൽ ഫോട്ടോ ഡൗൺലോഡ് ചെയ്യാം.',
                '<b>വേഗത്തിലുള്ള തിരുത്തൽ:</b> കുട്ടിയുടെ വിവരങ്ങളോ ക്ലാസോ എപ്പോൾ വേണമെങ്കിലും എഡിറ്റ് ചെയ്യാം.'
              ], '#0284c7')}
            </div>
            <div>
              <div class="gpdf-subhead">വ്യക്തിഗത ഹാജർ ലോഗും A4 പ്രൊഫൈലും</div>
              ${bulletList([
                '<b>സ്റ്റുഡന്റ് അറ്റൻഡൻസ് ലോഗ്:</b> ആ കുട്ടി പങ്കെടുത്ത ആകെ ക്ലാസുകൾ, ഹാജർ, അസാന്നിധ്യം, അവധി, ആകെ ശതമാനം എന്നിവ വിഷയം തിരിച്ച് കാണാം.',
                '<b>A4 പ്രിന്റ് പ്രൊഫൈൽ:</b> സ്കൂൾ ഹെഡറും ഫോട്ടോയും മുഴുവൻ ബയോഡാറ്റയും അടങ്ങിയ മനോഹരമായ <b>A4 പ്രൊഫൈൽ ഷീറ്റ്</b> പ്രിന്റ് എടുക്കാം.'
              ], '#0284c7')}
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.fileText('#d97706', 16),
          'ഓഫീസ് ജോലികൾ എളുപ്പമാക്കുന്ന ഫീച്ചറുകൾ',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          ${bulletList([
            '<b>തത്സമയ എണ്ണം:</b> പുതിയ കുട്ടിയെ ചേർക്കുമ്പോൾ തന്നെ ആ ക്ലാസിലെ ആകെ കുട്ടികളുടെ എണ്ണം കാണാം — റോൾ നമ്പർ തെറ്റാതിരിക്കാൻ ഇത് സഹായിക്കും.',
            '<b>സ്വയം രജിസ്ട്രേഷൻ (Outcomers):</b> നൂറുകണക്കിന് കുട്ടികളുടെ വിവരങ്ങൾ ടൈപ്പ് ചെയ്യുന്നതിന് പകരം <code>/submit-details.html</code> ലിങ്ക് വാട്സ്ആപ്പ് ഗ്രൂപ്പിൽ ഷെയർ ചെയ്താൽ കുട്ടികൾ തന്നെ വിവരങ്ങൾ അപ്‌ലോഡ് ചെയ്യും; അധ്യാപകർക്ക് ഒറ്റ ക്ലിക്കിൽ Approve ചെയ്യാം!',
            '<b>Excel / CSV ഡൗൺലോഡ്:</b> പ്രൊഫൈൽ പേജിലെ <b>Print Reports</b> വഴി എല്ലാ കുട്ടികളുടെയും ഡാറ്റ എക്സൽ ഫോർമാറ്റിൽ ഡൗൺലോഡ് ചെയ്യാം.'
          ], '#d97706')}
          `
        )}
        `,
        meta
      )
    );

    // PAGE 6: DAILY ATTENDANCE SYSTEM (ML)
    pages.push(
      pageShell(
        6,
        total,
        'അധ്യായം 05',
        'ദൈനംദിന ഹാജർ രേഖപ്പെടുത്തൽ — വേഗവും കൃത്യതയും',
        `
        ${card(
          ICONS.checkSquare('#059669', 16),
          'ഹാജർ രേഖപ്പെടുത്താനുള്ള ഘട്ടങ്ങൾ',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          ${stepList([
            'താഴെയുള്ള <b>ഹാജർ (Attendance)</b> ടാബിൽ ക്ലിക്ക് ചെയ്യുക (അല്ലെങ്കിൽ ഡാഷ്‌ബോർഡിലെ <b>Today\'s Schedule</b> ക്ലാസ് കാർഡിൽ തൊടുക).',
            '<b>ക്ലാസ്</b>, <b>വിഷയം</b>, <b>തീയതി</b> (തനിയെ ഇന്നത്തെ തീയതി വരും) തിരഞ്ഞെടുക്കുമ്പോൾ കുട്ടികളുടെ ഫോട്ടോയും റോൾ നമ്പറും അടങ്ങിയ ലിസ്റ്റ് തെളിയും.',
            'മുകളിലുള്ള <b>"Mark All Present"</b> അമർത്തിയാൽ ഒരൊറ്റ ക്ലിക്കിൽ മുഴുവൻ കുട്ടികളും Present ആകും — തുടർന്ന് ഹാജരില്ലാത്തവരെയോ അവധിയുള്ളവരെയോ മാത്രം മാറ്റുക.',
            'താഴെ കാണുന്ന ആകെ എണ്ണം (Present / Absent / Leave) പരിശോധിച്ച് <b>"Save Attendance"</b> അമർത്തുക.'
          ], '#059669')}
          `
        )}

        ${card(
          ICONS.zap('#1e4d5f', 16),
          'ഹാജർ സ്റ്റാറ്റസ് കോഡുകൾ (P / A / L)',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <div class="gpdf-status-grid">
            <div class="gpdf-status-card" style="background:#ecfdf5;border-color:#6ee7b7;">
              <span class="gpdf-badge-lg" style="background:#059669;">P</span>
              <div>
                <div class="gpdf-status-t" style="color:#065f46;">Present (ഹാജർ)</div>
                <div class="gpdf-status-d">കുട്ടി ക്ലാസിൽ ഹാജരാണ്. ഹാജർ ശതമാനത്തിൽ പോസിറ്റീവായി കണക്കാക്കും.</div>
              </div>
            </div>
            <div class="gpdf-status-card" style="background:#fff1f2;border-color:#fda4af;">
              <span class="gpdf-badge-lg" style="background:#e11d48;">A</span>
              <div>
                <div class="gpdf-status-t" style="color:#9f1239;">Absent (ഹാജരില്ല)</div>
                <div class="gpdf-status-d">അനുമതിയില്ലാതെ ക്ലാസിൽ ഹാജരാകാത്തവർ. റിപ്പോർട്ടുകളിൽ ചുവപ്പ് നിറത്തിൽ വേറിട്ടു കാണിക്കും.</div>
              </div>
            </div>
            <div class="gpdf-status-card" style="background:#fffbeb;border-color:#fcd34d;">
              <span class="gpdf-badge-lg" style="background:#d97706;">L</span>
              <div>
                <div class="gpdf-status-t" style="color:#92400e;">Leave (അവധി)</div>
                <div class="gpdf-status-d">അനുമതിയോടെയോ കൃത്യമായ കാരണത്തോടെയോ അവധിയെടുത്തവർ. അസാന്നിധ്യത്തിൽ നിന്ന് വേറിട്ട് രേഖപ്പെടുത്തും.</div>
              </div>
            </div>
          </div>
          `
        )}

        ${card(
          ICONS.settings('#4f46e5', 16),
          'തിരുത്താനും (Update) ഒഴിവാക്കാനും (Delete) ഉള്ള സൗകര്യം',
          '#eef2ff',
          '#c7d2fe',
          '#312e81',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">ഡ്യൂപ്ലിക്കേറ്റ് തടയൽ & Update</div>
              ${bulletList([
                'ഒരേ ക്ലാസിനും വിഷയത്തിനും തീയതിക്കും നേരത്തെ ഹാജർ എടുത്തിട്ടുണ്ടെങ്കിൽ, ആ പഴയ ഡാറ്റ ആപ്പ് തനിയെ ലോഡ് ചെയ്യും.',
                'ബട്ടൺ സ്വയമേവ <b>Update</b> ആയി മാറും — വൈകി എത്തിയ കുട്ടികളുടെ സ്റ്റാറ്റസ് എളുപ്പത്തിൽ തിരുത്തി സേവ് ചെയ്യാം.'
              ], '#4f46e5')}
            </div>
            <div>
              <div class="gpdf-subhead">Delete & ഓഡിറ്റ് രേഖ</div>
              ${bulletList([
                'തെറ്റായ തീയതിയിലോ ക്ലാസിലോ എടുത്ത ഹാജർ ഒഴിവാക്കാൻ <b>Delete Session</b> ബട്ടൺ ഉപയോഗിക്കാം.',
                'ഓരോ Save, Update, Delete പ്രവർത്തനവും സമയവും അധ്യാപകന്റെ പേരും സഹിതം <b>Activity Log</b>-ൽ സൂക്ഷിക്കും.'
              ], '#4f46e5')}
            </div>
          </div>
          `
        )}

        ${tipBox(
          'സ്റ്റുഡന്റ് പോർട്ടലിൽ തത്സമയ അപ്‌ഡേറ്റ്',
          'അധ്യാപകൻ ഹാജർ Save ചെയ്ത നിമിഷം തന്നെ വിദ്യാർത്ഥിയുടെ <b>Student Portal</b> കലണ്ടറിലും ഹാജർ ശതമാനത്തിലും മാറ്റം തത്സമയം പ്രതിഫലിക്കും.',
          'sky'
        )}
        `,
        meta
      )
    );

    // PAGE 7: REPORTS & EXPORTS (ML)
    pages.push(
      pageShell(
        7,
        total,
        'അധ്യായം 06',
        'റിപ്പോർട്ടുകൾ, വിശകലനം & ഓഫീസ് Excel/CSV എക്സ്പോർട്ട്',
        `
        ${card(
          ICONS.barChart('#4f46e5', 16),
          'സമഗ്ര ഹാജർ റിപ്പോർട്ട് (Report ടാബ്)',
          '#eef2ff',
          '#c7d2fe',
          '#312e81',
          `
          ${stepList([
            'താഴെയുള്ള <b>റിപ്പോർട്ട് (Report)</b> ടാബിൽ ക്ലിക്ക് ചെയ്യുക.',
            '<b>ക്ലാസ്</b>, <b>വിഷയം</b> എന്നിവ തിരഞ്ഞെടുക്കുക — ക്ലാസിന്റെ മൊത്തത്തിലുള്ള റിപ്പോർട്ടിന് <b>"All Subjects"</b> തിരഞ്ഞെടുക്കാം.',
            '<b>വർഷം</b> (Year), <b>കാലയളവ്</b> (ഏതെങ്കിലും മാസം അല്ലെങ്കിൽ വർഷം മുഴുവനായുള്ള <b>"All Months"</b>) എന്നിവ തിരഞ്ഞെടുക്കുക.',
            'ഓരോ കുട്ടിയുടെയും ആകെ സെഷനുകൾ, ഹാജർ (P), അസാന്നിധ്യം (A), അവധി (L), <b>ഹാജർ ശതമാനം (%)</b> എന്നിവ വ്യക്തമായി കാണാം.'
          ], '#4f46e5')}
          `
        )}

        ${card(
          ICONS.printer('#0f766e', 16),
          'പ്രിന്റ് & ഓഫീസ് എക്സ്പോർട്ട് സെന്റർ (Profile → Print Reports)',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <p class="gpdf-p">പ്രൊഫൈൽ പേജിലെ <b>Print Reports (Students & Data)</b> വഴി എല്ലാ ഓഫീസ് രേഖകളും ഒരൊറ്റ സ്ഥലത്ത് നിന്ന് ഡൗൺലോഡ് ചെയ്യാം:</p>
          <table class="gpdf-table">
            <thead>
              <tr><th>റിപ്പോർട്ട് വിഭാഗം</th><th>ഫോർമാറ്റുകൾ</th><th>പ്രധാന ഉപയോഗം</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>ക്ലാസ് ഹാജർ ഷീറ്റ്</b></td>
                <td>A4 പ്രിന്റ് / PDF / CSV</td>
                <td>മാസ/വാർഷിക ഹാജർ രജിസ്റ്റർ, നോട്ടീസ് ബോർഡ്, പ്രിൻസിപ്പാൾ പരിശോധന.</td>
              </tr>
              <tr>
                <td><b>Students Data എക്സ്പോർട്ട്</b></td>
                <td>Excel / CSV / പ്രിന്റ്</td>
                <td>ഓഫീസ് അഡ്മിഷൻ രജിസ്റ്റർ, രക്ഷിതാക്കളുടെ ഫോൺ ലിസ്റ്റ്, പരീക്ഷാ ഫോമുകൾ, ഐഡി കാർഡ്.</td>
              </tr>
              <tr>
                <td><b>വ്യക്തിഗത ഹാജർ റിപ്പോർട്ട്</b></td>
                <td>A4 പ്രിന്റ് / PDF</td>
                <td>PTA മീറ്റിംഗുകൾ, ഹാജർ കുറവുള്ള കുട്ടികൾക്കുള്ള നോട്ടീസ്, പ്രോഗ്രസ് റിപ്പോർട്ട്.</td>
              </tr>
              <tr>
                <td><b>വ്യക്തിഗത സ്റ്റുഡന്റ് ബയോഡാറ്റ</b></td>
                <td>A4 പ്രൊഫൈൽ ഷീറ്റ്</td>
                <td>ഫോട്ടോയും രക്ഷിതാവിന്റെ വിവരങ്ങളും അടങ്ങിയ ഔദ്യോഗിക ഓഫീസ് ഫയൽ ഷീറ്റ്.</td>
              </tr>
              <tr>
                <td><b>ടീച്ചർ ആക്റ്റിവിറ്റി റിപ്പോർട്ട്</b></td>
                <td>പ്രിന്റ് / CSV</td>
                <td>അധ്യാപകർ എടുത്ത ആകെ ക്ലാസുകളുടെയും സെഷനുകളുടെയും പ്രതിമാസ കണക്ക്.</td>
              </tr>
            </tbody>
          </table>
          `
        )}

        ${tipBox(
          'പ്രോ ടിപ്പ്: ഓഫീസ് രജിസ്റ്റർ ജോലികൾ നിമിഷങ്ങൾക്കുള്ളിൽ',
          '<b>Students Data</b> എക്സ്പോർട്ട് ചെയ്യുന്നതിന് മുമ്പ് നിങ്ങൾക്ക് ആവശ്യമുള്ള കോളങ്ങൾ മാത്രം (പേര്, റോൾ നമ്പർ, ഫോൺ, രക്തഗ്രൂപ്പ്, വിലാസം മുതലായവ) തിരഞ്ഞെടുത്ത് കൃത്യമായ Excel ഫയൽ ഉണ്ടാക്കിയെടുക്കാം.',
          'emerald'
        )}
        `,
        meta
      )
    );

    // PAGE 8: TIMETABLE & NOTIFICATIONS (ML)
    pages.push(
      pageShell(
        8,
        total,
        'അധ്യായം 07',
        'ടൈംടേബിൾ & സ്മാർട്ട് ഓട്ടോമാറ്റിക് നോട്ടിഫിക്കേഷനുകൾ',
        `
        ${card(
          ICONS.calendar('#0284c7', 16),
          'ആഴ്ചതോറുമുള്ള ടൈംടേബിൾ നിർമ്മാണം',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          ${stepList([
            'ഹോം ഡാഷ്‌ബോർഡിൽ നിന്നോ പ്രൊഫൈൽ പേജിൽ നിന്നോ <b>Timetable</b> തുറക്കുക.',
            'ദിവസം (തിങ്കൾ–ഞായർ) തിരഞ്ഞെടുത്ത് <b>"+ Add Slot"</b> അമർത്തുക.',
            '<b>ക്ലാസ്</b>, <b>വിഷയം</b>, <b>അധ്യാപകൻ</b>, <b>തുടങ്ങുന്ന സമയം</b>, <b>അവസാനിക്കുന്ന സമയം</b> എന്നിവ നൽകി Save ചെയ്യുക.',
            '<b>ടൈംടേബിൾ കോൺഫ്ലിക്റ്റ് മുന്നറിയിപ്പ്:</b> ഒരേ സമയത്ത് ഒരേ ക്ലാസിനോ ഒരേ അധ്യാപകനോ രണ്ട് പിരീഡുകൾ വന്നാൽ ആപ്പ് തനിയെ <b>Conflict Alert</b> കാണിച്ച് തെറ്റ് തടയും!'
          ], '#0284c7')}
          `
        )}

        ${card(
          ICONS.bell('#b45309', 16),
          'അധ്യാപകർക്കുള്ള സ്മാർട്ട് നോട്ടിഫിക്കേഷനുകൾ (ടീച്ചർ പോർട്ടലിൽ മാത്രം)',
          '#fffbeb',
          '#fde68a',
          '#92400e',
          `
          <div class="gpdf-grid-2">
            <div class="gpdf-mini-box" style="border-color:#fcd34d;">
              <div class="gpdf-mini-head">${ICONS.clock('#d97706', 15)}<span>രാവിലെ 6:00 മണി ടൈംടേബിൾ അലേർട്ട്</span></div>
              <div class="gpdf-mini-txt">
                എല്ലാ ദിവസവും രാവിലെ 6:00 മണി മുതൽ, നിങ്ങളുടെ <b>ഇമെയിൽ ഐഡിയുമായി ബന്ധിപ്പിച്ച</b> ഇന്നത്തെ മുഴുവൻ ക്ലാസുകളും മനോഹരമായ ബബിൾ നോട്ടിഫിക്കേഷനായി തെളിയും. <b>Snooze</b> അല്ലെങ്കിൽ <b>OK</b> അമർത്താം.
              </div>
            </div>
            <div class="gpdf-mini-box" style="border-color:#fcd34d;">
              <div class="gpdf-mini-head">${ICONS.zap('#ea580c', 15)}<span>ക്ലാസിന് മുമ്പുള്ള Pre-Class അലേർട്ട്</span></div>
              <div class="gpdf-mini-txt">
                നിങ്ങളുടെ അടുത്ത പിരീഡ് തുടങ്ങുന്നതിന് തൊട്ടുമുമ്പ് സ്ക്രീനിന് മുകളിൽ റിമൈൻഡർ കാർഡ് തെളിയും. അതിൽ ക്ലിക്ക് ചെയ്താൽ നേരെ ആ ക്ലാസിന്റെ ഹാജർ പേജിലേക്ക് പോകാം.
              </div>
            </div>
          </div>
          <div style="margin-top:8px;">
            ${bulletList([
              '<b>ടൈംടേബിൾ സെറ്റ് ചെയ്യാത്ത മുന്നറിയിപ്പ്:</b> നിങ്ങളുടെ ഇമെയിലിൽ ടൈംടേബിൾ ചേർത്തിട്ടില്ലെങ്കിൽ അത് ഓർമ്മിപ്പിക്കുകയും സെറ്റ് ചെയ്യാനുള്ള ലിങ്ക് നൽകുകയും ചെയ്യും.',
              '<b>നോട്ടിഫിക്കേഷൻ സെറ്റിംഗ്സ്:</b> പ്രൊഫൈൽ → Notification Settings വഴി ബ്രൗസർ പുഷ് നോട്ടിഫിക്കേഷനുകൾ നിയന്ത്രിക്കാം.',
              '<b>സ്റ്റുഡന്റ് ലിങ്കിൽ ശല്യമില്ല:</b> ഈ നോട്ടിഫിക്കേഷനുകളും ഗൈഡും ഭാഷാ പോപ്പ്-അപ്പും ടീച്ചേഴ്സിന്റെ ലിങ്കിൽ മാത്രമേ വരൂ; സ്റ്റുഡന്റ് ലിങ്കിൽ ഒരിക്കലും വരില്ല.'
            ], '#d97706')}
          </div>
          `
        )}

        ${tipBox(
          'ശ്രദ്ധിക്കുക: 6:00 AM അലേർട്ട് കൃത്യമായി ലഭിക്കാൻ',
          'ടൈംടേബിൾ ചേർക്കുമ്പോൾ നിങ്ങളുടെ ലോഗിൻ <b>Email ID</b>-യുമായി ബന്ധിപ്പിച്ച ടീച്ചർ പ്രൊഫൈൽ തന്നെ തിരഞ്ഞെടുക്കുക; എന്നാൽ മാത്രമേ നിങ്ങളുടെ സ്വന്തം ക്ലാസുകൾ കൃത്യമായി നോട്ടിഫിക്കേഷനിൽ വരൂ.',
          'amber'
        )}
        `,
        meta
      )
    );

    // PAGE 9: COMMUNICATION, PERSONAL WORKSPACE & OUTCOMERS (ML)
    pages.push(
      pageShell(
        9,
        total,
        'അധ്യായം 08',
        'നോട്ടീസ് ബോർഡ്, പേഴ്സണൽ വർക്ക്സ്പേസ് & ഔട്ട്കമേഴ്സ്',
        `
        ${card(
          ICONS.message('#0284c7', 16),
          '1. അധ്യാപക നോട്ടീസ് ബോർഡ് & സന്ദേശങ്ങൾ',
          '#f0f9ff',
          '#bae6fd',
          '#0c4a6e',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>സ്റ്റാഫ് ചാറ്റ് & സർക്കുലറുകൾ:</b> മുകളിലെ ബെൽ (Bell) ഐക്കണിൽ തൊട്ടാൽ അധ്യാപകർക്ക് പരസ്പരം നോട്ടീസുകളും അറിയിപ്പുകളും കൈമാറാം.',
              '<b>വായിക്കാത്ത സന്ദേശ ബാഡ്ജ്:</b> ഓരോ 60 സെക്കൻഡിലും പുതിയ സന്ദേശങ്ങൾ പരിശോധിച്ച് ചുവന്ന എണ്ണം ഹെഡറിൽ കാണിക്കും.'
            ], '#0284c7')}
            ${bulletList([
              '<b>എഡിറ്റ് & ഡിലീറ്റ്:</b> നിങ്ങൾ അയച്ച സന്ദേശങ്ങൾ പിന്നീട് തിരുത്താനോ നീക്കം ചെയ്യാനോ സാധിക്കും.',
              '<b>സ്കൂൾ അറിയിപ്പുകളും പരിപാടികളും:</b> അധ്യാപകർക്കും വിദ്യാർത്ഥികൾക്കും ഒരുപോലെ കാണാവുന്ന പൊതു അറിയിപ്പുകളും ഇവന്റുകളും പ്രസിദ്ധീകരിക്കാം.'
            ], '#0284c7')}
          </div>
          `
        )}

        ${card(
          ICONS.lock('#db2777', 16),
          '2. പേഴ്സണൽ വർക്ക്സ്പേസ് (100% സ്വകാര്യ സ്പേസ്)',
          '#fdf2f8',
          '#fbcfe8',
          '#831843',
          `
          <p class="gpdf-p">സ്കൂളിലെ പൊതു രജിസ്റ്ററിൽ നിന്ന് വേറിട്ട് സ്വന്തം ട്യൂഷൻ ക്ലാസുകളോ പ്രത്യേക ബാച്ചുകളോ സൂക്ഷിക്കാൻ <b>Personal Workspace</b> ഉപയോഗിക്കാം:</p>
          ${bulletList([
            '<b>പൂർണ്ണ സ്വകാര്യത:</b> ഇവിടെ ചേർക്കുന്ന ക്ലാസുകളും വിഷയങ്ങളും കുട്ടികളും ഹാജരും <b>നിങ്ങൾക്ക് മാത്രമേ</b> കാണാൻ സാധിക്കൂ — മറ്റ് അധ്യാപകർക്കോ അഡ്മിനോ കാണില്ല.',
            '<b>മെയിൻ ആപ്പ് പോലെ തന്നെ:</b> പ്ലസ് വൺ/പ്ലസ് ടു സ്ട്രീം, ഡിഗ്രി ഇയർ, 5–10 ക്ലാസുകൾ, കുട്ടികളുടെ ഫോട്ടോ എന്നിവയെല്ലാം ഇവിടെയും പിന്തുണയ്ക്കുന്നു.',
            '<b>വാർഷിക ഹാജർ വിശകലനം:</b> സ്വകാര്യ കുട്ടികളുടെ ഫോട്ടോയിൽ ക്ലിക്ക് ചെയ്താൽ ആ വർഷത്തെ ആകെ സെഷനുകളും ഹാജർ ശതമാനവും കാണാം.'
          ], '#db2777')}
          `
        )}

        ${card(
          ICONS.link('#059669', 16),
          '3. ഷെയർ ചെയ്യാവുന്ന ലിങ്കുകളും ഔട്ട്കമേഴ്സ് (Outcomers) ഇൻബോക്സും',
          '#ecfdf5',
          '#a7f3d0',
          '#065f46',
          `
          <div class="gpdf-grid-2">
            <div>
              <div class="gpdf-subhead">ഒറ്റ ക്ലിക്കിൽ ലിങ്ക് ഷെയർ ചെയ്യാം</div>
              ${bulletList([
                '<b>Portal Links</b> വഴി കോപ്പി ചെയ്യാനോ വാട്സ്ആപ്പിൽ അയക്കാനോ സാധിക്കുന്ന ലിങ്കുകൾ:',
                '• <b>ടീച്ചർ പോർട്ടൽ:</b> <code>/?portal=teacher</code>',
                '• <b>സ്റ്റുഡന്റ് പോർട്ടൽ:</b> <code>/?portal=student</code>',
                '• <b>സ്റ്റുഡന്റ് ഫോം:</b> <code>/submit-details.html</code>'
              ], '#059669')}
            </div>
            <div>
              <div class="gpdf-subhead">ഔട്ട്കമേഴ്സ് പരിശോധന & അപ്രൂവൽ</div>
              ${bulletList([
                'വിദ്യാർത്ഥികൾ പൊതു ലിങ്ക് വഴി പേര്, ഫോട്ടോ, രക്ഷിതാവിന്റെ നമ്പർ, വിലാസം എന്നിവ സമർപ്പിക്കുന്നു.',
                'ഇവ ടീച്ചറുടെ <b>Outcomers</b> വിഭാഗത്തിൽ എത്തും.',
                'വിവരങ്ങൾ പരിശോധിച്ച് റോൾ നമ്പറും ക്ലാസും നൽകി <b>Approve & Enroll</b> അമർത്തിയാൽ കുട്ടി ഔദ്യോഗിക ലിസ്റ്റിൽ ചേരും!'
              ], '#059669')}
            </div>
          </div>
          `
        )}
        `,
        meta
      )
    );

    // PAGE 10: STUDENT PORTAL, PROMOTION, ADMIN PANEL (ML)
    pages.push(
      pageShell(
        10,
        total,
        'അധ്യായം 09',
        'സ്റ്റുഡന്റ് പോർട്ടൽ, വാർഷിക പ്രൊമോഷൻ & അഡ്മിൻ പാനൽ',
        `
        ${card(
          ICONS.gradCap('#0f766e', 16),
          '1. വിദ്യാർത്ഥികൾക്കുള്ള സ്റ്റുഡന്റ് പോർട്ടൽ (5 ടാബുകൾ)',
          '#f0fdfa',
          '#99f6e4',
          '#115e59',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>ഹോം:</b> സ്വന്തം ഹാജർ ശതമാനം, ഇന്നത്തെ ക്ലാസുകൾ, പ്രധാന അറിയിപ്പുകൾ.',
              '<b>ഹാജർ കലണ്ടർ:</b> മാസം തിരിച്ചുള്ള കളർ കലണ്ടറും ഓരോ വിഷയത്തിലെയും ഹാജർ ശതമാനവും.',
              '<b>ക്ലാസുകളും ടൈംടേബിളും:</b> ആഴ്ചയിലെ മുഴുവൻ ടൈംടേബിളും വിഷയാധ്യാപകരുടെ വിവരങ്ങളും.'
            ], '#0d9488')}
            ${bulletList([
              '<b>അപ്‌ഡേറ്റുകളും ലീവ് അപേക്ഷയും:</b> സ്കൂൾ നോട്ടീസുകൾ വായിക്കാനും ഓൺലൈനായി <b>Leave Request</b> സമർപ്പിക്കാനും.',
              '<b>പ്രൊഫൈൽ & ഡിജിറ്റൽ ഐഡി:</b> സ്വന്തം ബയോഡാറ്റയും പ്രിന്റ് എടുക്കാവുന്ന ഡിജിറ്റൽ ഐഡി കാർഡും.',
              '<b>ടീച്ചർ പ്രിവ്യൂ മോഡ്:</b> അധ്യാപകർക്ക് സ്റ്റുഡന്റ് പോർട്ടൽ പരിശോധിക്കാനും ഒറ്റ ക്ലിക്കിൽ തിരികെ വരാനും സാധിക്കും.'
            ], '#0d9488')}
          </div>
          `
        )}

        ${card(
          ICONS.award('#7c3aed', 16),
          '2. അക്കാദമിക് വർഷ പ്രൊമോഷൻ, ആർക്കൈവ് & പൂർവ്വ വിദ്യാർത്ഥികൾ',
          '#f5f3ff',
          '#ddd6fe',
          '#4c1d95',
          `
          ${bulletList([
            '<b>ഒന്നിച്ചുള്ള ക്ലാസ് പ്രൊമോഷൻ:</b> അധ്യയന വർഷം അവസാനിക്കുമ്പോൾ ഒരു ക്ലാസിലെ മുഴുവൻ കുട്ടികളെയും അടുത്ത ക്ലാസിലേക്ക് (ഉദാ: 9 ➔ 10) മാറ്റാനും, അവസാന വർഷക്കാരെ <b>Alumni</b> ആക്കാനും ഒറ്റ ക്ലിക്കിൽ സാധിക്കും.',
            '<b>സുരക്ഷിതമായ Undo / Rollback:</b> പ്രൊമോഷനിൽ തെറ്റ് സംഭവിച്ചാൽ അത് തിരികെ മാറ്റാനുള്ള സുരക്ഷിത സംവിധാനം.',
            '<b>പഴയ വർഷ ആർക്കൈവ് & Alumni ഡയറക്ടറി:</b> കഴിഞ്ഞ വർഷങ്ങളിലെ ഹാജരും പൂർവ്വ വിദ്യാർത്ഥികളുടെ പ്രൊഫൈലുകളും എപ്പോൾ വേണമെങ്കിലും പരിശോധിച്ച് പ്രിന്റ് എടുക്കാം.'
          ], '#7c3aed')}
          `
        )}

        ${card(
          ICONS.database('#1e4d5f', 16),
          '3. അഡ്മിൻ പാനൽ, ബാക്കപ്പ് & ക്രമീകരണങ്ങൾ',
          '#f8fafc',
          '#cbd5e1',
          '#1e293b',
          `
          <div class="gpdf-grid-2">
            ${bulletList([
              '<b>സ്കൂൾ ബ്രാൻഡിംഗ്:</b> ആപ്പിന്റെ പേര്, സ്കൂളിന്റെ പേര്, ഔദ്യോഗിക ലോഗോ എന്നിവ ഇഷ്ടാനുസരണം മാറ്റാം.',
              '<b>അക്കൗണ്ട് & പെർമിഷൻ നിയന്ത്രണം:</b> അധ്യാപക അക്കൗണ്ടുകൾ, ക്ലാസ് ടീച്ചർ റോൾ, എഡിറ്റ്/ഡിലീറ്റ് അധികാരങ്ങൾ, ഹെഡർ ബട്ടണുകൾ എന്നിവ നിയന്ത്രിക്കാം.'
            ], '#245b70')}
            ${bulletList([
              '<b>സമ്പൂർണ്ണ ബാക്കപ്പ് & റീസ്റ്റോർ:</b> ഡാറ്റാബേസ് മുഴുവനായി സുരക്ഷിതമായി ബാക്കപ്പ് എടുക്കാനും ആവശ്യമുള്ളപ്പോൾ തിരികെ ലോഡ് ചെയ്യാനും സാധിക്കും.',
              '<b>ഭാഷ, തീം & സുരക്ഷ:</b> മലയാളം/ഇംഗ്ലീഷ് മാറ്റം, ലൈറ്റ്/ഡാർക്ക് മോഡ്, പാസ്‌വേഡ് മാറ്റൽ, സമ്പൂർണ്ണ <b>Activity Audit Logs</b>.'
            ], '#245b70')}
          </div>
          `
        )}

        ${tipBox(
          'ഈ ഗൈഡ് എപ്പോൾ വേണമെങ്കിലും വീണ്ടും എടുക്കാം!',
          'ടീച്ചർ പോർട്ടലിലെ മുകളിലെ ഹെഡറിലുള്ള <b>Info (i)</b> ബട്ടൺ അമർത്തിയാൽ ഗൈഡ് തുറക്കാനും, <b>English / മലയാളം</b> ഭാഷ മാറ്റി ഈ സമ്പൂർണ്ണ A–Z PDF വീണ്ടും ഡൗൺലോഡ് ചെയ്യാനും സാധിക്കും.',
          'emerald'
        )}
        `,
        meta
      )
    );

    return pages;
  }

  // ---------- 6. Scoped Magazine-Grade CSS for A4 PDF Rendering ----------
  function getPdfStyles(isMl) {
    const bodyFont = isMl
      ? "'Noto Sans Malayalam', 'Inter', system-ui, -apple-system, sans-serif"
      : "'Inter', 'Noto Sans Malayalam', system-ui, -apple-system, sans-serif";
    const baseSize = isMl ? '11.2px' : '11.4px';
    const baseLH = isMl ? '1.62' : '1.48';

    return `
      #registerly-guide-pdf-root,
      #registerly-guide-pdf-root * {
        box-sizing: border-box;
        font-family: ${bodyFont};
        -webkit-font-smoothing: antialiased;
      }
      #registerly-guide-pdf-root {
        position: fixed;
        left: -12000px;
        top: 0;
        width: 794px;
        background: #ffffff;
        color: #0f172a;
        z-index: -1;
      }
      .gpdf-page {
        width: 794px;
        height: 1123px;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow: hidden;
        position: relative;
        page-break-after: always;
      }
      /* Cover Page */
      .gpdf-cover-hero {
        background: linear-gradient(135deg, #163d4d 0%, #245b70 55%, #0f766e 100%);
        color: #ffffff;
        padding: 36px 40px 30px 40px;
        border-bottom: 5px solid #22d3ee;
      }
      .gpdf-cover-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(103, 232, 249, 0.45);
        color: #cffafe;
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.6px;
        margin-bottom: 18px;
      }
      .gpdf-cover-brand-row {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 14px;
      }
      .gpdf-cover-logo {
        width: 58px;
        height: 58px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.16);
        border: 1.5px solid rgba(255, 255, 255, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .gpdf-cover-title {
        margin: 0;
        font-size: 32px;
        font-weight: 900;
        letter-spacing: 1px;
        line-height: 1.15;
        color: #ffffff;
      }
      .gpdf-cover-sub {
        font-size: 13px;
        font-weight: 600;
        color: #a5f3fc;
        margin-top: 3px;
      }
      .gpdf-cover-desc {
        margin: 0;
        font-size: ${isMl ? '11.8px' : '12.2px'};
        line-height: ${baseLH};
        color: rgba(255, 255, 255, 0.92);
      }
      .gpdf-cover-body {
        flex: 1;
        padding: 22px 36px 14px 36px;
        display: flex;
        flex-direction: column;
      }
      .gpdf-section-label {
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.8px;
        color: #245b70;
        text-transform: uppercase;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .gpdf-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 11px;
      }
      .gpdf-benefit {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 12px;
      }
      .gpdf-benefit-ic {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8px;
      }
      .gpdf-benefit-t {
        font-size: 11.8px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 4px;
        line-height: 1.3;
      }
      .gpdf-benefit-d {
        font-size: ${isMl ? '10.2px' : '10.5px'};
        line-height: ${isMl ? '1.52' : '1.42'};
        color: #475569;
      }
      .gpdf-toc-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .gpdf-toc-item {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 8px 11px;
        font-size: ${isMl ? '10.8px' : '11px'};
        font-weight: 700;
        color: #1e293b;
        line-height: 1.35;
      }
      .gpdf-toc-p {
        min-width: 28px;
        height: 22px;
        border-radius: 6px;
        background: #245b70;
        color: #ffffff;
        font-size: 9.5px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      /* Standard Inner Pages */
      .gpdf-topbar {
        background: linear-gradient(90deg, #1b495b 0%, #245b70 100%);
        color: #ffffff;
        padding: 14px 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 3px solid #22d3ee;
        flex-shrink: 0;
      }
      .gpdf-topbar-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .gpdf-brand-dot {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .gpdf-topbar-app {
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.6px;
        line-height: 1.15;
      }
      .gpdf-topbar-school {
        font-size: 9.5px;
        color: #bae6fd;
        font-weight: 600;
      }
      .gpdf-chapter-pill {
        background: rgba(34, 211, 238, 0.2);
        border: 1px solid rgba(103, 232, 249, 0.45);
        color: #cffafe;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.6px;
      }
      .gpdf-page-body {
        flex: 1;
        padding: 20px 32px 14px 32px;
        display: flex;
        flex-direction: column;
        gap: 13px;
        overflow: hidden;
      }
      .gpdf-ch-header {
        margin-bottom: 2px;
      }
      .gpdf-ch-title {
        margin: 0 0 6px 0;
        font-size: ${isMl ? '17.5px' : '19px'};
        font-weight: 900;
        color: #0f172a;
        line-height: 1.3;
      }
      .gpdf-ch-line {
        width: 64px;
        height: 4px;
        border-radius: 999px;
        background: linear-gradient(90deg, #245b70, #14b8a6);
      }

      /* Cards & Components */
      .gpdf-card {
        border: 1.2px solid #e2e8f0;
        border-radius: 14px;
        padding: 13px 15px;
      }
      .gpdf-card-head {
        display: flex;
        align-items: center;
        gap: 9px;
        margin-bottom: 9px;
      }
      .gpdf-icon-box {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .gpdf-card-title {
        font-size: ${isMl ? '12.6px' : '13px'};
        font-weight: 800;
        line-height: 1.3;
      }
      .gpdf-card-content {
        font-size: ${baseSize};
        line-height: ${baseLH};
        color: #1e293b;
      }
      .gpdf-p {
        margin: 0 0 8px 0;
        font-size: ${baseSize};
        line-height: ${baseLH};
        color: #334155;
      }
      .gpdf-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .gpdf-mini-box {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 11px;
      }
      .gpdf-mini-head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: ${isMl ? '11.4px' : '11.8px'};
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 4px;
      }
      .gpdf-mini-txt {
        font-size: ${isMl ? '10.4px' : '10.7px'};
        line-height: ${isMl ? '1.54' : '1.44'};
        color: #475569;
      }
      .gpdf-subhead {
        font-size: ${isMl ? '11.2px' : '11.4px'};
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 6px;
      }

      /* Steps & Bullets */
      .gpdf-steps {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .gpdf-step {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .gpdf-step-num {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        color: #ffffff;
        font-size: 9.5px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .gpdf-step-txt {
        flex: 1;
        font-size: ${baseSize};
        line-height: ${baseLH};
        color: #1e293b;
      }
      .gpdf-bullets {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .gpdf-bullet {
        display: flex;
        align-items: flex-start;
        gap: 7px;
      }
      .gpdf-bullet-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        flex-shrink: 0;
        margin-top: 6px;
      }
      .gpdf-bullet-txt {
        flex: 1;
        font-size: ${isMl ? '10.7px' : '11px'};
        line-height: ${baseLH};
        color: #1e293b;
      }

      /* Tables */
      .gpdf-table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${isMl ? '10.4px' : '10.7px'};
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
      }
      .gpdf-table th {
        background: #245b70;
        color: #ffffff;
        text-align: left;
        padding: 7px 9px;
        font-weight: 800;
        font-size: ${isMl ? '10.3px' : '10.5px'};
      }
      .gpdf-table td {
        padding: 7px 9px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
        line-height: ${isMl ? '1.52' : '1.42'};
        color: #1e293b;
      }
      .gpdf-table tr:last-child td {
        border-bottom: none;
      }
      .gpdf-table code {
        background: #f1f5f9;
        color: #0f766e;
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 9.8px;
        font-weight: 700;
      }

      /* Status Cards (P / A / L) */
      .gpdf-status-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .gpdf-status-card {
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1.2px solid #e2e8f0;
        border-radius: 11px;
        padding: 9px 12px;
      }
      .gpdf-badge-lg {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        color: #ffffff;
        font-size: 16px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .gpdf-status-t {
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 2px;
      }
      .gpdf-status-d {
        font-size: ${isMl ? '10.5px' : '10.8px'};
        line-height: 1.45;
        color: #334155;
      }

      /* Pro Tip Box */
      .gpdf-tip {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        border: 1.2px solid #fde68a;
        border-radius: 12px;
        padding: 10px 13px;
      }
      .gpdf-tip-icon {
        margin-top: 1px;
        flex-shrink: 0;
      }
      .gpdf-tip-title {
        font-size: ${isMl ? '11.2px' : '11.5px'};
        font-weight: 800;
        margin-bottom: 2px;
      }
      .gpdf-tip-body {
        font-size: ${isMl ? '10.5px' : '10.8px'};
        line-height: ${isMl ? '1.54' : '1.45'};
        color: #334155;
      }

      /* Footer */
      .gpdf-footer {
        padding: 11px 32px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 9.8px;
        font-weight: 700;
        color: #64748b;
        flex-shrink: 0;
      }
      .gpdf-page-num {
        color: #245b70;
        font-weight: 800;
      }
    `;
  }

  // ---------- 7. Offline Fallback Print Window ----------
  function openFallbackPrintWindow(pagesHtml, styles, title) {
    const win = window.open('', '_blank');
    if (!win) {
      if (typeof showToast === 'function') showToast('Please allow popups to save the PDF');
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Malayalam:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; background: #e2e8f0; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px 0; }
    ${styles.replace('#registerly-guide-pdf-root {', '#registerly-guide-pdf-root { position: static; left: auto; z-index: 1; background: transparent;')}
    @media print {
      body { background: #ffffff; padding: 0; gap: 0; }
      .gpdf-page { box-shadow: none !important; margin: 0 !important; }
    }
  </style>
</head>
<body>
  <div id="registerly-guide-pdf-root">${pagesHtml}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  <\/script>
</body>
</html>`);
    win.document.close();
  }

  // ---------- 8. Main Export Function ----------
  window.downloadCompleteAppGuidePDF = async function () {
    if (_isGeneratingGuidePdf) return;
    _isGeneratingGuidePdf = true;

    // Respect the Guide modal's active language toggle
    const lang = window.currentGuideLanguage === 'ml' ? 'ml' : 'en';
    const isMl = lang === 'ml';

    const btn = document.getElementById('guide-more-pdf-btn');
    const labelEl = document.getElementById('guide-more-pdf-label');
    const badgeEl = document.getElementById('guide-more-pdf-badge');
    const iconEl = document.getElementById('guide-more-pdf-icon');

    const origLabel = labelEl ? labelEl.textContent : 'Guide More';
    const origBadge = badgeEl ? badgeEl.textContent : 'PDF';
    const origIconHtml = iconEl ? iconEl.outerHTML : '';

    function setBtnProgress(text, badgeText) {
      if (labelEl) labelEl.textContent = text;
      if (badgeEl) badgeEl.textContent = badgeText;
    }

    if (btn) {
      btn.disabled = true;
      btn.classList.add('opacity-80', 'cursor-wait');
    }
    if (iconEl) {
      iconEl.classList.add('animate-spin');
    }
    setBtnProgress(isMl ? 'തയ്യാറാക്കുന്നു...' : 'Preparing...', 'PDF');

    const appName =
      typeof appSettings !== 'undefined' && appSettings && appSettings.appName && appSettings.appName.trim()
        ? appSettings.appName.trim()
        : localStorage.getItem('registerly_app_name') || 'REGISTERLY';
    const schoolName =
      typeof appSettings !== 'undefined' && appSettings && appSettings.schoolName && appSettings.schoolName.trim()
        ? appSettings.schoolName.trim()
        : '';

    const today = new Date();
    const dateStr = today.toLocaleDateString(isMl ? 'ml-IN' : 'en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const meta = { lang, appName, schoolName, dateStr };
    const pages = isMl ? buildMalayalamPages(meta) : buildEnglishPages(meta);
    const pagesHtml = pages.join('');
    const styles = getPdfStyles(isMl);

    const safeBaseName = appName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'REGISTERLY';
    const fileName = `${safeBaseName}-Complete-Guide-${isMl ? 'Malayalam' : 'English'}.pdf`;

    let container = null;
    let styleTag = null;

    try {
      await ensurePdfLibraries();

      // Ensure fonts (Noto Sans Malayalam + Inter) are fully ready before capture
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 2500))
        ]);
      }

      styleTag = document.createElement('style');
      styleTag.id = 'registerly-guide-pdf-styles';
      styleTag.textContent = styles;
      document.head.appendChild(styleTag);

      container = document.createElement('div');
      container.id = 'registerly-guide-pdf-root';
      container.innerHTML = pagesHtml;
      document.body.appendChild(container);

      const pageNodes = container.querySelectorAll('.gpdf-page');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let i = 0; i < pageNodes.length; i++) {
        setBtnProgress(isMl ? 'PDF തയ്യാറാക്കുന്നു' : 'Creating PDF', `${i + 1}/${pageNodes.length}`);
        const canvas = await window.html2canvas(pageNodes[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          logging: false
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.94);
        if (i > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      pdf.save(fileName);

      if (typeof showToast === 'function') {
        showToast(
          isMl
            ? 'സമ്പൂർണ്ണ മലയാളം ആപ്പ് ഗൈഡ് PDF ഡൗൺലോഡ് ചെയ്തു!'
            : 'Complete English App Guide PDF downloaded!'
        );
      }
    } catch (err) {
      console.error('[Guide PDF Error]', err);
      // Graceful offline fallback: open print-ready A4 view
      openFallbackPrintWindow(pagesHtml, styles, fileName);
      if (typeof showToast === 'function') {
        showToast(
          isMl
            ? 'പ്രിന്റ്/സേവ് PDF വിൻഡോ തുറന്നു'
            : 'Opened print-ready PDF view'
        );
      }
    } finally {
      if (container && container.parentNode) container.parentNode.removeChild(container);
      if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-80', 'cursor-wait');
      }
      if (iconEl) {
        iconEl.classList.remove('animate-spin');
      }
      setBtnProgress(origLabel, origBadge);
      _isGeneratingGuidePdf = false;
    }
  };
})();
