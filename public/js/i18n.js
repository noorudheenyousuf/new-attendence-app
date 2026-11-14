// ==========================================
// REGISTERLY - Internationalization (i18n) Engine
// Supported Languages: English ('en'), Malayalam ('ml')
// ==========================================

const APP_TRANSLATIONS = {
  en: {
    // App Title & Brand
    app_name: "REGISTERLY",
    app_tagline: "School Attendance & Management",

    // Navigation Tabs
    nav_home: "Home",
    nav_attendance: "Attendance",
    nav_report: "Report",
    nav_profile: "Profile",

    // Header
    good_morning: "Good Morning",
    good_afternoon: "Good Afternoon",
    good_evening: "Good Evening",
    notice_board_title: "Notice Board & Notifications",

    // Dashboard
    stat_students: "STUDENTS",
    stat_faculty: "FACULTY",
    stat_classes: "CLASSES",
    stat_subjects: "SUBJECTS",
    quick_actions: "Quick Actions",
    take_attendance_btn: "Take Attendance",
    view_reports_btn: "View Reports",
    timetable_btn: "Timetable",
    calendar_events_btn: "Events & Calendar",

    // Attendance View
    attendance_title: "Attendance Register",
    select_class: "Select Class",
    select_subject: "Select Subject",
    mark_all_present: "Mark All Present",
    mark_all_absent: "Mark All Absent",
    present: "Present",
    absent: "Absent",
    late: "Late",
    leave: "Leave",
    half_day: "Half Day",
    submit_attendance: "Save Attendance",

    // Profile & Account Settings
    profile_title: "Profile",
    account_settings: "Account Settings",
    edit_profile: "Edit Profile",
    edit_profile_sub: "Update your name, contact details & photo",
    change_password: "Change Password",
    change_password_sub: "Update your account login password",
    notification_settings: "Notification Settings",
    notification_settings_sub: "Configure schedule & alert triggers",
    language_settings: "Language / ഭാഷ",
    language_settings_sub: "Choose application display language",
    theme_settings: "Theme Settings",
    theme_settings_sub: "Toggle Light & Dark display mode",
    audit_trail: "Audit Trail",
    activity_log: "Activity Log",
    activity_log_sub: "Live audit trail & attendance history",
    all_logs: "All",
    my_actions: "My Actions",
    sign_out: "Sign Out",

    // Language Modal
    select_language: "Select Language",
    select_language_sub: "Choose application display language",
    lang_en: "English",
    lang_en_sub: "Default System Language",
    lang_ml: "മലയാളം (Malayalam)",
    lang_ml_sub: "പ്രാദേശിക ഭാഷ",
    lang_changed_toast: "Language changed to English",

    // Common Buttons & Labels
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    update: "Update",
    search: "Search...",
    total: "Total",
    loading: "Loading...",
    success: "Success",
    error: "Error"
  },

  ml: {
    // App Title & Brand
    app_name: "REGISTERLY",
    app_tagline: "സ്കൂൾ ഹാജർ & മാനേജ്മെന്റ്",

    // Navigation Tabs
    nav_home: "ഹോം",
    nav_attendance: "ഹാജർ",
    nav_report: "റിപ്പോർട്ട്",
    nav_profile: "പ്രൊഫൈൽ",

    // Header
    good_morning: "സുപ്രഭാതം",
    good_afternoon: "ശുഭ ഉച്ചതിരിഞ്ഞ്",
    good_evening: "ശുഭ സായാഹ്നം",
    notice_board_title: "അറിയിപ്പ് ബോർഡും സന്ദേശങ്ങളും",

    // Dashboard
    stat_students: "വിദ്യാർത്ഥികൾ",
    stat_faculty: "അധ്യാപകർ",
    stat_classes: "ക്ലാസുകൾ",
    stat_subjects: "വിഷയങ്ങൾ",
    quick_actions: "ദ്രുത പ്രവർത്തനങ്ങൾ",
    take_attendance_btn: "ഹാജർ രേഖപ്പെടുത്തുക",
    view_reports_btn: "റിപ്പോർട്ടുകൾ കാണുക",
    timetable_btn: "ടൈംടേബിൾ",
    calendar_events_btn: "ഇവന്റുകൾ & കലണ്ടർ",

    // Attendance View
    attendance_title: "ഹാജർ രജിസ്റ്റർ",
    select_class: "ക്ലാസ് തിരഞ്ഞെടുക്കുക",
    select_subject: "വിഷയം തിരഞ്ഞെടുക്കുക",
    mark_all_present: "എല്ലാവരെയും ഹാജരാക്കുക",
    mark_all_absent: "എല്ലാവരെയും അഭാവമാക്കുക",
    present: "ഹാജർ",
    absent: "അഭാവം",
    late: "വൈകി",
    leave: "അവധി",
    half_day: "പകുതി ദിവസം",
    submit_attendance: "ഹാജർ സംരക്ഷിക്കുക",

    // Profile & Account Settings
    profile_title: "പ്രൊഫൈൽ",
    account_settings: "അക്കൗണ്ട് ക്രമീകരണങ്ങൾ",
    edit_profile: "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക",
    edit_profile_sub: "പേര്, വിവരങ്ങൾ, ഫോട്ടോ മാറ്റുക",
    change_password: "പാസ്‌വേഡ് മാറ്റുക",
    change_password_sub: "ലോഗിൻ പാസ്‌വേഡ് അപ്‌ഡേറ്റ് ചെയ്യുക",
    notification_settings: "അറിയിപ്പ് ക്രമീകരണങ്ങൾ",
    notification_settings_sub: "അലേർട്ട് & നോട്ടിഫിക്കേഷൻ ക്രമീകരിക്കുക",
    language_settings: "ഭാഷ (Language)",
    language_settings_sub: "ആപ്പ് പ്രദർശന ഭാഷ തിരഞ്ഞെടുക്കുക",
    theme_settings: "തീം ക്രമീകരണങ്ങൾ",
    theme_settings_sub: "ലൈറ്റ് / ഡാർക്ക് മോഡ് മാറ്റുക",
    audit_trail: "ഓഡിറ്റ് വിവരങ്ങൾ",
    activity_log: "പ്രവർത്തന രേഖ",
    activity_log_sub: "ഹാജർ ചരിത്രവും പ്രവർത്തനങ്ങളും",
    all_logs: "എല്ലാം",
    my_actions: "എന്റെ പ്രവർത്തനങ്ങൾ",
    sign_out: "സൈൻ ഔട്ട്",

    // Language Modal
    select_language: "ഭാഷ തിരഞ്ഞെടുക്കുക",
    select_language_sub: "ആപ്പ് പ്രദർശന ഭാഷ തിരഞ്ഞെടുക്കുക",
    lang_en: "English",
    lang_en_sub: "സ്ഥിരസ്ഥിതി സിസ്റ്റം ഭാഷ",
    lang_ml: "മലയാളം (Malayalam)",
    lang_ml_sub: "പ്രാദേശിക ഭാഷ",
    lang_changed_toast: "ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി",

    // Common Buttons & Labels
    save: "സംരക്ഷിക്കുക",
    cancel: "റദ്ദാക്കുക",
    confirm: "സ്ഥിരീകരിക്കുക",
    close: "അടയ്ക്കുക",
    delete: "ഇല്ലാതാക്കുക",
    edit: "തിരുത്തുക",
    update: "അപ്‌ഡേറ്റ്",
    search: "തിരയുക...",
    total: "ആകെ",
    loading: "ലഭ്യമാക്കുന്നു...",
    success: "വിജയകരം",
    error: "തകരാർ സംഭവിച്ചു"
  }
};

let currentAppLanguage = 'en';

function getAppLanguage() {
  try {
    const saved = localStorage.getItem('app_language');
    if (saved && (saved === 'en' || saved === 'ml')) {
      return saved;
    }
  } catch (_) {}
  return 'en';
}

function t(key, fallback = '') {
  const langDict = APP_TRANSLATIONS[currentAppLanguage] || APP_TRANSLATIONS['en'];
  if (langDict && langDict[key] !== undefined) {
    return langDict[key];
  }
  const fallbackDict = APP_TRANSLATIONS['en'];
  if (fallbackDict && fallbackDict[key] !== undefined) {
    return fallbackDict[key];
  }
  return fallback || key;
}

function applyTranslations(lang) {
  if (lang !== 'en' && lang !== 'ml') lang = 'en';
  currentAppLanguage = lang;
  try {
    localStorage.setItem('app_language', lang);
  } catch (_) {}

  document.documentElement.lang = lang;
  if (lang === 'ml') {
    document.documentElement.classList.add('font-malayalam');
  } else {
    document.documentElement.classList.remove('font-malayalam');
  }

  // Update all DOM elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && (APP_TRANSLATIONS[lang]?.[key] !== undefined || APP_TRANSLATIONS['en']?.[key] !== undefined)) {
      el.textContent = t(key);
    }
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
    }
  });

  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key));
    }
  });

  // Update badge in Profile -> Account Settings
  const badge = document.getElementById('current-language-badge');
  if (badge) {
    badge.textContent = lang === 'ml' ? 'മലയാളം' : 'English';
  }

  // Update modal active indicators if modal exists
  updateLanguageModalUI(lang);
}

function updateLanguageModalUI(lang) {
  const cardEn = document.getElementById('lang-card-en');
  const cardMl = document.getElementById('lang-card-ml');
  const checkEn = document.getElementById('lang-check-en');
  const checkMl = document.getElementById('lang-check-ml');

  if (cardEn && checkEn && cardMl && checkMl) {
    if (lang === 'ml') {
      // EN inactive
      cardEn.className = "touch-btn w-full p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--bg-page)]/50 flex items-center justify-between transition active:scale-98 group text-left";
      checkEn.className = "w-6 h-6 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center text-transparent text-xs";
      checkEn.innerHTML = "";

      // ML active
      cardMl.className = "touch-btn w-full p-3.5 rounded-2xl border-2 border-violet-500 bg-violet-500/10 flex items-center justify-between transition active:scale-98 group text-left shadow-xs";
      checkMl.className = "w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-xs shadow-xs";
      checkMl.innerHTML = "✓";
    } else {
      // EN active
      cardEn.className = "touch-btn w-full p-3.5 rounded-2xl border-2 border-violet-500 bg-violet-500/10 flex items-center justify-between transition active:scale-98 group text-left shadow-xs";
      checkEn.className = "w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-xs shadow-xs";
      checkEn.innerHTML = "✓";

      // ML inactive
      cardMl.className = "touch-btn w-full p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--bg-page)]/50 flex items-center justify-between transition active:scale-98 group text-left";
      checkMl.className = "w-6 h-6 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center text-transparent text-xs";
      checkMl.innerHTML = "";
    }
  }
}

function initI18n() {
  const lang = getAppLanguage();
  applyTranslations(lang);
}

// Automatically init as early as possible
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
}
