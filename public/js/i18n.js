// ==========================================
// REGISTERLY - Comprehensive Internationalization (i18n) Engine
// Supported Languages: English ('en'), Malayalam ('ml')
// ==========================================

const APP_TRANSLATIONS = {
  en: {
    // App Brand & Navigation
    app_name: "REGISTERLY",
    app_tagline: "School Attendance & Management",
    nav_home: "Home",
    nav_attendance: "Attendance",
    nav_report: "Report",
    nav_profile: "Profile",

    // Header & Greeting
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

    // Common Controls
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
    error: "Error",

    // Academic & Quick Tools
    quick_tools: "Quick Tools",
    timetable: "Timetable",
    my_schedule: "My Schedule",
    messages: "Messages",
    teacher_notice: "Teacher Notice",
    print_reports: "Print Reports",
    students_data: "Students & Data",
    profile_logs: "Profile Logs",
    my_activity_log: "My Activity Log",

    // Placeholders
    placeholder_select_class_subject: "Select Class & Subject",
    placeholder_att_desc: "Choose a class and subject from the filters above to load the student roster and take attendance.",
    placeholder_rep_desc: "Choose a class and subject from the filters above to generate full attendance analytics and sheets.",
    placeholder_choose_badge: "Choose class & subject above"
  },

  ml: {
    // App Brand & Navigation
    app_name: "REGISTERLY",
    app_tagline: "സ്കൂൾ ഹാജർ & മാനേജ്മെന്റ്",
    nav_home: "ഹോം",
    nav_attendance: "ഹാജർ",
    nav_report: "റിപ്പോർട്ട്",
    nav_profile: "പ്രൊഫൈൽ",

    // Header & Greeting
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
    change_password_sub: "ലോഗിൻ പാസ്‌വേഡ് മാറ്റുക",
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

    // Common Controls
    save: "സംരക്ഷിക്കുക",
    cancel: "റദ്ദാക്കുക",
    confirm: "സ്ഥിരീകരിക്കുക",
    close: "അടയ്ക്കുക",
    delete: "ഇല്ലാതാക്കുക",
    edit: "തിരുത്തുക",
    update: "അപ്‌ഡേറ്റ് ചെയ്യുക",
    search: "തിരയുക...",
    total: "ആകെ",
    loading: "ലഭ്യമാക്കുന്നു...",
    success: "വിജയകരം",
    error: "തകരാർ സംഭവിച്ചു",

    // Academic & Quick Tools
    quick_tools: "ദ്രുത ടൂളുകൾ",
    timetable: "ടൈംടേബിൾ",
    my_schedule: "എന്റെ ഷെഡ്യൂൾ",
    messages: "സന്ദേശങ്ങൾ",
    teacher_notice: "അധ്യാപക നോട്ടീസ്",
    print_reports: "റിപ്പോർട്ടുകൾ പ്രിന്റ് ചെയ്യുക",
    students_data: "വിദ്യാർത്ഥികളും വിവരങ്ങളും",
    profile_logs: "പ്രൊഫൈൽ ലോഗുകൾ",
    my_activity_log: "എന്റെ ലോഗുകൾ",

    // Placeholders
    placeholder_select_class_subject: "ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",
    placeholder_att_desc: "വിദ്യാർത്ഥികളുടെ പട്ടിക ലഭ്യമാക്കാനും ഹാജർ രേഖപ്പെടുത്താനും മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.",
    placeholder_rep_desc: "സമ്പൂർണ്ണ ഹാജർ വിശകലനങ്ങളും ഷീറ്റുകളും തയ്യാറാക്കാൻ മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.",
    placeholder_choose_badge: "മുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക"
  }
};

// Comprehensive Deep Phrase Dictionary for full automatic UI translation to Malayalam
const APP_PHRASES_ML = {
  // Navigation & Shell
  "Home": "ഹോം",
  "Attendance": "ഹാജർ",
  "Report": "റിപ്പോർട്ട്",
  "Profile": "പ്രൊഫൈൽ",
  "Go to Profile": "പ്രൊഫൈലിലേക്ക് പോകുക",
  "Notice Board & Notifications": "അറിയിപ്പ് ബോർഡും സന്ദേശങ്ങളും",
  "Search students, classes, subjects...": "വിദ്യാർത്ഥികൾ, ക്ലാസുകൾ, വിഷയങ്ങൾ എന്നിവ തിരയുക...",
  "One-Click PWA Install Button": "ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക",

  // Dashboard - Greetings & KPIs
  "Academic Year": "അധ്യയന വർഷം",
  "Academic Year 2026/27": "അധ്യയന വർഷം 2026/27",
  "TODAY": "ഇന്ന്",
  "Today": "ഇന്ന്",
  "Assalamu Alaikum,": "അസ്സലാമു അലൈക്കും,",
  "Ustadh": "ഉസ്താദ്",
  "Ready for today's classes? Your teaching portal is live.": "ഇന്നത്തെ ക്ലാസുകൾക്ക് തയ്യാറാണോ? അധ്യാപന പോർട്ടൽ സജീവമാണ്.",
  "Today's Status": "ഇന്നത്തെ സ്ഥിതി",
  "Your live class & schedule status": "തത്സമയ ക്ലാസും ഷെഡ്യൂൾ വിവരങ്ങളും",
  "Live Schedule": "തത്സമയ ഷെഡ്യൂൾ",
  "Live In": "ഇപ്പോൾ നടക്കുന്നത്",
  "Next Subject": "അടുത്ത വിഷയം",
  "Checking schedule...": "ഷെഡ്യൂൾ പരിശോധിക്കുന്നു...",
  "Checking upcoming...": "അടുത്തത് പരിശോധിക്കുന്നു...",
  "Today's Classes": "ഇന്നത്തെ ക്ലാസുകൾ",
  "Marked Today": "ഇന്ന് രേഖപ്പെടുത്തിയത്",
  "Click to view today's schedule and attendance status": "ഇന്നത്തെ ഷെഡ്യൂളും ഹാജർ സ്ഥിതിയും കാണാൻ ക്ലിക്ക് ചെയ്യുക",
  "Click to view today's marked attendance sessions": "ഇന്ന് എടുത്ത ഹാജർ സെഷനുകൾ കാണാൻ ക്ലിക്ക് ചെയ്യുക",

  // Quick Attendance Card
  "Quick Attendance": "പെട്ടെന്നുള്ള ഹാജർ",
  "Select class & subject to start session": "ഹാജർ എടുക്കാൻ ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",
  "Class": "ക്ലാസ്",
  "Subject": "വിഷയം",
  "-- Select Class --": "-- ക്ലാസ് തിരഞ്ഞെടുക്കുക --",
  "-- Select Subject --": "-- വിഷയം തിരഞ്ഞെടുക്കുക --",
  "-- Select Class Teacher --": "-- ക്ലാസ് അധ്യാപകനെ തിരഞ്ഞെടുക്കുക --",
  "Start Attendance": "ഹാജർ ആരംഭിക്കുക",

  // Campus Overview & School Management
  "CAMPUS OVERVIEW": "ക്യാമ്പസ് വിവരങ്ങൾ",
  "Live Sync • Today": "തത്സമയ വിവരങ്ങൾ • ഇന്ന്",
  "STUDENTS": "വിദ്യാർത്ഥികൾ",
  "FACULTY": "അധ്യാപകർ",
  "CLASSES": "ക്ലാസുകൾ",
  "SUBJECTS": "വിഷയങ്ങൾ",
  "Total Students": "ആകെ വിദ്യാർത്ഥികൾ",
  "Total Teachers": "ആകെ അധ്യാപകർ",
  "Total Classes": "ആകെ ക്ലാസുകൾ",
  "Total Subjects": "ആകെ വിഷയങ്ങൾ",
  "100% Active": "100% സജീവം",
  "0 Marked": "0 രേഖപ്പെടുത്തി",
  "0 In": "0 ഹാജർ",
  "0 Out": "0 അഭാവം",
  "School Management": "സ്കൂൾ മാനേജ്മെന്റ്",
  "Manage your school's resources": "സ്കൂൾ സംവിധാനങ്ങൾ കൈകാര്യം ചെയ്യുക",
  "Classes": "ക്ലാസുകൾ",
  "Add & organize classes": "ക്ലാസുകൾ ചേർക്കുക, ക്രമീകരിക്കുക",
  "Subjects": "വിഷയങ്ങൾ",
  "Curriculum & courses": "പാഠ്യപദ്ധതിയും വിഷയങ്ങളും",
  "Students": "വിദ്യാർത്ഥികൾ",
  "Roster & enrollment": "വിദ്യാർത്ഥി പട്ടികയും പ്രവേശനവും",
  "Teachers": "അധ്യാപകർ",
  "Faculty & timetables": "ഫാക്കൽറ്റിയും ടൈംടേബിളും",
  "Personal Workspace": "വ്യക്തിഗത വർക്ക്‌സ്‌പെയ്‌സ്",
  "Your private corner • Classes, Subjects & Students": "നിങ്ങളുടെ സ്വകാര്യ ഇടം • ക്ലാസുകൾ, വിഷയങ്ങൾ, വിദ്യാർത്ഥികൾ",
  "Your private corner": "നിങ്ങളുടെ സ്വകാര്യ ഇടം",

  // Attendance Register View
  "Attendance Corner": "ഹാജർ കോർണർ",
  "Daily student attendance roster": "ദൈനംദിന വിദ്യാർത്ഥി ഹാജർ രജിസ്റ്റർ",
  "Daily Roster": "ദൈനംദിന രജിസ്റ്റർ",
  "Previous Day": "മുൻപത്തെ ദിവസം",
  "Next Day": "അടുത്ത ദിവസം",
  "Click to pick a date": "തീയതി തിരഞ്ഞെടുക്കുക",
  "TOTAL": "ആകെ",
  "PRESENT": "ഹാജർ",
  "ABSENT": "അഭാവം",
  "LEAVE": "അവധി",
  "LATE": "വൈകി",
  "HALF DAY": "പകുതി ദിവസം",
  "Students Roster": "വിദ്യാർത്ഥികളുടെ പട്ടിക",
  "All Present": "എല്ലാവരും ഹാജർ",
  "All Absent": "എല്ലാവരും അഭാവം",
  "Clear All": "എല്ലാം മായ്ക്കുക",
  "Save Attendance": "ഹാജർ സംരക്ഷിക്കുക",
  "Delete recorded attendance": "രേഖപ്പെടുത്തിയ ഹാജർ ഇല്ലാതാക്കുക",
  "Mark Leave": "അവധി രേഖപ്പെടുത്തുക",
  "Mark Present": "ഹാജർ രേഖപ്പെടുത്തുക",
  "Mark Absent": "അഭാവം രേഖപ്പെടുത്തുക",

  // Reports View
  "Class Report": "ക്ലാസ് റിപ്പോർട്ട്",
  "Attendance summaries & printable sheets": "ഹാജർ വിവരങ്ങളും പ്രിന്റബിൾ ഷീറ്റുകളും",
  "Print Sheet": "ഷീറ്റ് പ്രിന്റ് ചെയ്യുക",
  "Class Attendance Sheet": "ക്ലാസ് ഹാജർ പട്ടിക",
  "Detailed session logs & status": "വിശദമായ സെഷൻ വിവരങ്ങളും സ്ഥിതിയും",
  "Year": "വർഷം",
  "Month": "മാസം",
  "All Years": "എല്ലാ വർഷങ്ങളും",
  "All Months": "എല്ലാ മാസങ്ങളും",
  "Roll": "റോൾ",
  "Roll No": "റോൾ നമ്പർ",
  "Student Name": "വിദ്യാർത്ഥിയുടെ പേര്",
  "Sessions": "സെഷനുകൾ",
  "Percent": "ശതമാനം",
  "Status": "സ്ഥിതി",
  "Action": "പ്രവർത്തനം",
  "Class Avg": "ക്ലാസ് ശരാശരി",
  "Class Avg:": "ക്ലാസ് ശരാശരി:",
  "Print Reports": "റിപ്പോർട്ടുകൾ പ്രിന്റ് ചെയ്യുക",
  "Students & Data": "വിദ്യാർത്ഥികളും വിവരങ്ങളും",

  // Classes, Subjects, Students & Teachers Page Headers & Actions
  "Add Class": "ക്ലാസ് ചേർക്കുക",
  "Edit Class": "ക്ലാസ് എഡിറ്റ് ചെയ്യുക",
  "Delete Class": "ക്ലാസ് നീക്കം ചെയ്യുക",
  "Class Name": "ക്ലാസിന്റെ പേര്",
  "Class Teacher": "ക്ലാസ് അധ്യാപകൻ",
  "Save Class": "ക്ലാസ് സംരക്ഷിക്കുക",
  "Save Changes": "മാറ്റങ്ങൾ സംരക്ഷിക്കുക",
  "Add Subject": "വിഷയം ചേർക്കുക",
  "Edit Subject": "വിഷയം എഡിറ്റ് ചെയ്യുക",
  "Subject Name": "വിഷയത്തിന്റെ പേര്",
  "Subject Code": "വിഷയ കോഡ്",
  "Subject Teacher": "വിഷയ അധ്യാപകൻ",
  "Assign to Class": "ക്ലാസിലേക്ക് ചേർക്കുക",
  "— No class (optional) —": "— ക്ലാസ് ഇല്ല (ഐച്ഛികം) —",
  "— No class —": "— ക്ലാസ് ഇല്ല —",
  "Save Subject": "വിഷയം സംരക്ഷിക്കുക",
  "Add Student": "വിദ്യാർത്ഥിയെ ചേർക്കുക",
  "Edit Student": "വിദ്യാർത്ഥിയെ എഡിറ്റ് ചെയ്യുക",
  "Delete Student": "വിദ്യാർത്ഥിയെ നീക്കം ചെയ്യുക",
  "Student Directory": "വിദ്യാർത്ഥി പട്ടിക",
  "Search students...": "വിദ്യാർത്ഥികളെ തിരയുക...",
  "All Classes": "എല്ലാ ക്ലാസുകളും",
  "Roll: 1 → 9": "റോൾ നമ്പർ: 1 → 9",
  "Roll: 9 → 1": "റോൾ നമ്പർ: 9 → 1",
  "Name: A → Z": "പേര്: A → Z",
  "Name: Z → A": "പേര്: Z → A",
  "ID: 1 → 9": "ഐഡി: 1 → 9",
  "ID: 9 → 1": "ഐഡി: 9 → 1",
  "Sort Students": "വിദ്യാർത്ഥികളെ അടുക്കുക",
  "Add Teacher": "അധ്യാപകനെ ചേർക്കുക",
  "Edit Teacher": "അധ്യാപകനെ എഡിറ്റ് ചെയ്യുക",
  "Search teachers by name, email, class or subject...": "പേര്, ഇമെയിൽ, ക്ലാസ് അല്ലെങ്കിൽ വിഷയം ഉപയോഗിച്ച് തിരയുക...",
  "Enroll Student": "വിദ്യാർത്ഥിയെ പ്രവേശിപ്പിക്കുക",
  "Enroll": "പ്രവേശിപ്പിക്കുക",
  "Full Name": "പൂർണ്ണമായ പേര്",
  "Roll Number": "റോൾ നമ്പർ",
  "Gender": "ലിംഗം",
  "Male": "ആൺകുട്ടി",
  "Female": "പെൺകുട്ടി",
  "Parent Phone": "രക്ഷിതാവിന്റെ ഫോൺ",
  "Parent Email": "രക്ഷിതാവിന്റെ ഇമെയിൽ",
  "Admission Date": "പ്രവേശന തീയതി",

  // Profile & Settings
  "Profile Photograph": "പ്രൊഫൈൽ ഫോട്ടോ",
  "Click to Edit Profile": "പ്രൊഫൈൽ മാറ്റാൻ ക്ലിക്ക് ചെയ്യുക",
  "Account Active": "അക്കൗണ്ട് സജീവമാണ്",
  "Account Settings": "അക്കൗണ്ട് ക്രമീകരണങ്ങൾ",
  "Edit Profile": "പ്രൊഫൈൽ എഡിറ്റ് ചെയ്യുക",
  "Update your name, contact details & photo": "പേര്, ഫോൺ, ഫോട്ടോ മാറ്റുക",
  "Change Password": "പാസ്‌വേഡ് മാറ്റുക",
  "Update your account login password": "ലോഗിൻ പാസ്‌വേഡ് മാറ്റുക",
  "Notification Settings": "അറിയിപ്പ് ക്രമീകരണങ്ങൾ",
  "Configure schedule & alert triggers": "അലേർട്ട് & ഷെഡ്യൂൾ ക്രമീകരണങ്ങൾ",
  "Language": "ഭാഷ",
  "Language / ഭാഷ": "ഭാഷ (Language)",
  "Choose application display language": "ആപ്പ് പ്രദർശന ഭാഷ തിരഞ്ഞെടുക്കുക",
  "Theme Settings": "തീം ക്രമീകരണങ്ങൾ",
  "Toggle Light & Dark display mode": "ലൈറ്റ് / ഡാർക്ക് മോഡ് മാറ്റുക",
  "Audit Trail": "ഓഡിറ്റ് രേഖ",
  "Activity Log": "പ്രവർത്തന രേഖ",
  "Live audit trail & attendance history": "ഹാജർ ചരിത്രവും പ്രവർത്തനങ്ങളും",
  "All": "എല്ലാം",
  "My Actions": "എന്റെ പ്രവർത്തനങ്ങൾ",
  "Install REGISTERLY App": "REGISTERLY ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക",
  "Use standalone on your home screen or desktop": "ഹോം സ്ക്രീനിലോ ഡെസ്ക്ടോപ്പിലോ എളുപ്പത്തിൽ ഉപയോഗിക്കുക",
  "Install": "ഇൻസ്റ്റാൾ ചെയ്യുക",
  "Sign Out": "സൈൻ ഔട്ട്",
  "Sign out of your account": "അക്കൗണ്ടിൽ നിന്ന് പുറത്തുകടക്കുക",
  "Profile Logs": "പ്രൊഫൈൽ ലോഗുകൾ",
  "My Activity Log": "എന്റെ ലോഗുകൾ",
  "View your personal attendance and session logs": "നിങ്ങളുടെ ഹാജറും സെഷൻ വിവരങ്ങളും കാണുക",
  "Assigned Classes": "നിങ്ങൾക്ക് നൽകിയ ക്ലാസുകൾ",
  "Assigned Subjects": "നിങ്ങൾക്ക് നൽകിയ വിഷയങ്ങൾ",
  "Class Teacher Of": "ക്ലാസ് അധ്യാപകൻ",
  "Quick Tools": "ദ്രുത ടൂളുകൾ",
  "Timetable": "ടൈംടേബിൾ",
  "My Schedule": "എന്റെ ഷെഡ്യൂൾ",
  "Messages": "സന്ദേശങ്ങൾ",
  "Teacher Notice": "അധ്യാപക നോട്ടീസ്",
  "Open your personal timetable schedule": "നിങ്ങളുടെ വ്യക്തിഗത ടൈംടേബിൾ ഷെഡ്യൂൾ തുറക്കുക",
  "Open teacher notifications & chat": "അധ്യാപക നോട്ടീസുകളും ചാറ്റും തുറക്കുക",
  "Print students data & export attendance report": "വിദ്യാർത്ഥി വിവരങ്ങളും ഹാജർ റിപ്പോർട്ടും പ്രിന്റ് ചെയ്യുക",

  // Second Divs / Placeholders in Attendance & Report
  "Select Class & Subject": "ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",
  "Select Class &amp; Subject": "ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",
  "Choose a class and subject from the filters above to load the student roster and take attendance.": "വിദ്യാർത്ഥികളുടെ പട്ടിക ലഭ്യമാക്കാനും ഹാജർ രേഖപ്പെടുത്താനും മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.",
  "Choose a class and subject from the filters above to generate full attendance analytics and sheets.": "സമ്പൂർണ്ണ ഹാജർ വിശകലനങ്ങളും ഷീറ്റുകളും തയ്യാറാക്കാൻ മുകളിലുള്ള ഫിൽട്ടറുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക.",
  "Choose class & subject above": "മുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",
  "Choose class &amp; subject above": "മുകളിൽ നിന്ന് ക്ലാസും വിഷയവും തിരഞ്ഞെടുക്കുക",

  // Modals & Popups
  "Select Language": "ഭാഷ തിരഞ്ഞെടുക്കുക",
  "Default System Language": "സ്ഥിരസ്ഥിതി സിസ്റ്റം ഭാഷ",
  "Current Password": "നിലവിലെ പാസ്‌വേഡ്",
  "New Password": "പുതിയ പാസ്‌വേഡ്",
  "Confirm New Password": "പുതിയ പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക",
  "Update Password": "പാസ്‌വേഡ് മാറ്റുക",
  "6:00 AM Morning Schedule Alert": "രാവിലെ 6:00 മണിയുടെ അലേർട്ട്",
  "Summary notification for today's classes": "ഇന്നത്തെ ക്ലാസുകളുടെ സംഗ്രഹം",
  "5-Minute Pre-Class Reminder": "ക്ലാസിന് 5 മിനിറ്റ് മുൻപുള്ള ഓർമ്മപ്പെടുത്തൽ",
  "Alert before each scheduled period": "ഓരോ പീരിയഡിനും മുൻപ് അറിയിപ്പ് നൽകുക",
  "Device Vibration Alert": "ഫോൺ വൈബ്രേഷൻ അലേർട്ട്",
  "Vibrate phone when notifications arrive": "അറിയിപ്പുകൾ വരുമ്പോൾ ഫോൺ വൈബ്രേറ്റ് ചെയ്യുക",

  // Admin Panel
  "Admin Control Center": "അഡ്മിൻ കൺട്രോൾ സെന്റർ",
  "Super Admin": "സൂപ്പർ അഡ്മിൻ",
  "Institution identity, permissions, notices, data & backup controls": "സ്ഥാപനത്തിന്റെ വിവരങ്ങൾ, അനുമതികൾ, നോട്ടീസുകൾ, ബാക്കപ്പ്",
  "App Icon & Photo": "ആപ്പ് ഐക്കണും ഫോട്ടോയും",
  "Upload Photo": "ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക",
  "Reset": "റീസെറ്റ്",
  "App & School Identity": "ആപ്പും സ്കൂൾ വിവരങ്ങളും",
  "App Name": "ആപ്പിന്റെ പേര്",
  "School Name": "സ്കൂളിന്റെ പേര്",
  "Save Names & Branding": "വിവരങ്ങൾ സംരക്ഷിക്കുക",
  "Access & Permissions": "പ്രവേശനവും അനുമതികളും",

  // Notice Board / Messages
  "Notice Board": "അറിയിപ്പ് ബോർഡ്",
  "Messages": "സന്ദേശങ്ങൾ",
  "Post Message": "സന്ദേശം പോസ്റ്റ് ചെയ്യുക",
  "Send Notice": "അറിയിപ്പ് അയക്കുക",
  "Broadcast": "പൊതു അറിയിപ്പ്",

  // Timetable
  "Weekly Schedule": "പ്രതിവാര ഷെഡ്യൂൾ",
  "Day": "ദിവസം",
  "Period": "പീരിയഡ്",
  "Room": "റൂം",
  "Monday": "തിങ്കൾ",
  "Tuesday": "ചൊവ്വ",
  "Wednesday": "ബുധൻ",
  "Thursday": "വ്യാഴം",
  "Friday": "വെള്ളി",
  "Saturday": "ശനി",
  "Sunday": "ഞായർ",

  // Months
  "January": "ജനുവരി",
  "February": "ഫെബ്രുവരി",
  "March": "മാർച്ച്",
  "April": "ഏപ്രിൽ",
  "May": "മെയ്",
  "June": "ജൂൺ",
  "July": "ജൂലൈ",
  "August": "ഓഗസ്റ്റ്",
  "September": "സെപ്റ്റംബർ",
  "October": "ഒക്ടോബർ",
  "November": "നവംബർ",
  "December": "ഡിസംബർ",

  // Common Button Actions & Placeholders
  "Save": "സംരക്ഷിക്കുക",
  "Cancel": "റദ്ദാക്കുക",
  "Close": "അടയ്ക്കുക",
  "Done": "പൂർത്തിയായി",
  "Confirm": "സ്ഥിരീകരിക്കുക",
  "Delete": "ഇല്ലാതാക്കുക",
  "Edit": "തിരുത്തുക",
  "Update": "അപ്‌ഡേറ്റ് ചെയ്യുക",
  "Back": "തിരികെ",
  "Search...": "തിരയുക...",
  "Search": "തിരയുക",
  "Total:": "ആകെ:",
  "Total": "ആകെ",
  "optional": "ഐച്ഛികം",
  "(optional)": "(ഐച്ഛികം)",

  // Common Toasts & System Feedback
  "Language changed to English": "ഭാഷ English ആക്കി മാറ്റി",
  "Language changed to Malayalam": "ഭാഷ മലയാളത്തിലേക്ക് മാറ്റി",
  "Dark Mode Activated": "ഡാർക്ക് മോഡ് സജീവമാക്കി",
  "Light Mode Activated": "ലൈറ്റ് മോഡ് സജീവമാക്കി",
  "Attendance saved successfully": "ഹാജർ വിജയകരമായി രേഖപ്പെടുത്തി",
  "Attendance deleted successfully": "ഹാജർ വിവരങ്ങൾ നീക്കം ചെയ്തു",
  "Attendance deleted": "ഹാജർ നീക്കം ചെയ്തു",
  "Class saved successfully": "ക്ലാസ് വിജയകരമായി ചേർത്തു",
  "Class updated successfully": "ക്ലാസ് മാറ്റങ്ങൾ സംരക്ഷിച്ചു",
  "Class deleted successfully": "ക്ലാസ് നീക്കം ചെയ്തു",
  "Subject saved successfully": "വിഷയം വിജയകരമായി ചേർത്തു",
  "Subject updated successfully": "വിഷയം മാറ്റങ്ങൾ സംരക്ഷിച്ചു",
  "Subject deleted successfully": "വിഷയം നീക്കം ചെയ്തു",
  "Student enrolled successfully": "വിദ്യാർത്ഥിയെ വിജയകരമായി ചേർത്തു",
  "Student updated successfully": "വിദ്യാർത്ഥിയുടെ വിവരങ്ങൾ സംരക്ഷിച്ചു",
  "Student deleted successfully": "വിദ്യാർത്ഥിയെ നീക്കം ചെയ്തു",
  "Profile updated successfully": "പ്രൊഫൈൽ വിവരങ്ങൾ പുതുക്കി",
  "Password changed successfully": "പാസ്‌വേഡ് വിജയകരമായി മാറ്റി",
  "Signed out successfully": "വിജയകരമായി സൈൻ ഔട്ട് ചെയ്തു",
  "Please fill in all required fields": "ആവശ്യമായ വിവരങ്ങൾ നൽകുക",
  "Failed to save attendance": "ഹാജർ സംരക്ഷിക്കാൻ സാധിച്ചില്ല"
};

let currentAppLanguage = 'en';
let i18nObserver = null;

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

function tPhrase(phrase) {
  if (currentAppLanguage !== 'ml' || !phrase) return phrase;
  const trimmed = String(phrase).trim();
  if (APP_PHRASES_ML[trimmed]) {
    return APP_PHRASES_ML[trimmed];
  }
  return phrase;
}

// TreeWalker: Walks text nodes in DOM to translate static text elements cleanly
function walkAndTranslateDOM(rootNode, lang) {
  if (!rootNode) return;

  const walker = document.createTreeWalker(
    rootNode,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
        if (parentTag === 'script' || parentTag === 'style' || parentTag === 'svg' || parentTag === 'path') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  for (const node of textNodes) {
    const raw = node.nodeValue;
    const trimmed = raw.trim();

    if (lang === 'ml') {
      if (APP_PHRASES_ML[trimmed]) {
        if (!node._origText) {
          node._origText = raw;
        }
        const leading = raw.match(/^\s*/)[0];
        const trailing = raw.match(/\s*$/)[0];
        node.nodeValue = leading + APP_PHRASES_ML[trimmed] + trailing;
      }
    } else {
      if (node._origText) {
        node.nodeValue = node._origText;
        delete node._origText;
      }
    }
  }

  // Handle placeholders
  rootNode.querySelectorAll?.('input[placeholder], textarea[placeholder]').forEach(el => {
    const ph = el.getAttribute('placeholder');
    if (!ph) return;
    if (lang === 'ml') {
      if (!el.dataset.i18nOrigPlaceholder) el.dataset.i18nOrigPlaceholder = ph;
      const translated = APP_PHRASES_ML[ph.trim()];
      if (translated) el.setAttribute('placeholder', translated);
    } else {
      if (el.dataset.i18nOrigPlaceholder) {
        el.setAttribute('placeholder', el.dataset.i18nOrigPlaceholder);
        delete el.dataset.i18nOrigPlaceholder;
      }
    }
  });

  // Handle titles
  rootNode.querySelectorAll?.('[title]').forEach(el => {
    const title = el.getAttribute('title');
    if (!title) return;
    if (lang === 'ml') {
      if (!el.dataset.i18nOrigTitle) el.dataset.i18nOrigTitle = title;
      const translated = APP_PHRASES_ML[title.trim()];
      if (translated) el.setAttribute('title', translated);
    } else {
      if (el.dataset.i18nOrigTitle) {
        el.setAttribute('title', el.dataset.i18nOrigTitle);
        delete el.dataset.i18nOrigTitle;
      }
    }
  });
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

  // 1. Update elements with explicit data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key && (APP_TRANSLATIONS[lang]?.[key] !== undefined || APP_TRANSLATIONS['en']?.[key] !== undefined)) {
      el.textContent = t(key);
    }
  });

  // 2. Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key));
    }
  });

  // 3. Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key));
    }
  });

  // 4. Translate full DOM text nodes & instructions
  if (document.body) {
    walkAndTranslateDOM(document.body, lang);
  }

  // 5. Update badge in Profile -> Account Settings
  const badge = document.getElementById('current-language-badge');
  if (badge) {
    badge.textContent = lang === 'ml' ? 'മലയാളം' : 'English';
  }

  // 6. Update modal active indicators
  updateLanguageModalUI(lang);
}

function updateLanguageModalUI(lang) {
  const cardEn = document.getElementById('lang-card-en');
  const cardMl = document.getElementById('lang-card-ml');
  const checkEn = document.getElementById('lang-check-en');
  const checkMl = document.getElementById('lang-check-ml');

  if (cardEn && checkEn && cardMl && checkMl) {
    if (lang === 'ml') {
      cardEn.className = "touch-btn w-full p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--bg-page)]/50 flex items-center justify-between transition active:scale-98 group text-left";
      checkEn.className = "w-6 h-6 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center text-transparent text-xs";
      checkEn.innerHTML = "";

      cardMl.className = "touch-btn w-full p-3.5 rounded-2xl border-2 border-violet-500 bg-violet-500/10 flex items-center justify-between transition active:scale-98 group text-left shadow-xs";
      checkMl.className = "w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-xs shadow-xs";
      checkMl.innerHTML = "✓";
    } else {
      cardEn.className = "touch-btn w-full p-3.5 rounded-2xl border-2 border-violet-500 bg-violet-500/10 flex items-center justify-between transition active:scale-98 group text-left shadow-xs";
      checkEn.className = "w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-xs shadow-xs";
      checkEn.innerHTML = "✓";

      cardMl.className = "touch-btn w-full p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--bg-page)]/50 flex items-center justify-between transition active:scale-98 group text-left";
      checkMl.className = "w-6 h-6 rounded-full border-2 border-[var(--border-color)] flex items-center justify-center text-transparent text-xs";
      checkMl.innerHTML = "";
    }
  }
}

// Observer to re-apply translations when dynamic content is inserted
function setupI18nObserver() {
  if (i18nObserver || typeof MutationObserver === 'undefined') return;

  let timeout = null;
  i18nObserver = new MutationObserver(() => {
    if (currentAppLanguage === 'ml') {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        walkAndTranslateDOM(document.body, 'ml');
      }, 100);
    }
  });

  const main = (typeof document.querySelector === 'function') ? (document.querySelector('main') || document.body) : document.body;
  if (main && typeof i18nObserver.observe === 'function') {
    i18nObserver.observe(main, { childList: true, subtree: true });
  }
}

function initI18n() {
  const lang = getAppLanguage();
  applyTranslations(lang);
  setupI18nObserver();
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
}
