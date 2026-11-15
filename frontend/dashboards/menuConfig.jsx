export const ROLE_MENUS = {
  Owner: [
    {
      section: 'Overview',
      items: [
        { id: 'overview', label: 'Dashboard' },
        { id: 'reports', label: 'Reports & Analytics' },
      ],
    },
    {
      section: 'Academy Management',
      items: [
        { id: 'users-all', label: 'User Management' },
        { id: 'users-students', label: 'Student Records' },
        { id: 'users-instructors', label: 'Instructor Management' },
        { id: 'users-parents', label: 'Parent Management' },
        { id: 'academic-structure', label: 'Academic Management' },
        { id: 'courses-manage', label: 'Course Management' },
        { id: 'taxonomy', label: 'Subjects & Categories' },
        { id: 'timetables', label: 'Timetables & Scheduling' },
        { id: 'attendance', label: 'Attendance Tracking' },
        { id: 'grades', label: 'Grades & Report Cards' },
        { id: 'resources', label: 'E-Learning Resources' },
      ],
    },
    {
      section: 'Finance & Payments',
      items: [
        { id: 'finance-fees', label: 'Fees & Payments' },
        { id: 'finance-invoices', label: 'Invoices & Receipts' },
        { id: 'finance-transactions', label: 'Revenue & Transactions' },
        { id: 'finance-reports', label: 'Financial Reports' },
      ],
    },
    {
      section: 'Communication',
      items: [
        { id: 'comm-parent', label: 'Parent Communication' },
        { id: 'comm-messages', label: 'Messages' },
        { id: 'comm-announcements', label: 'Announcements' },
        { id: 'comm-notifications', label: 'Notifications' },
        { id: 'comm-support', label: 'Support & Feedback' },
      ],
    },
    {
      section: 'Platform Management',
      items: [
        { id: 'platform-roles', label: 'Roles & Permissions' },
        { id: 'platform-settings', label: 'System Settings' },
        { id: 'platform-profile', label: 'Academy Profile' },
        { id: 'platform-integrations', label: 'Integrations' },
        { id: 'platform-audit', label: 'Audit Logs' },
      ],
    },
    {
      section: 'My Account',
      items: [
        { id: 'account-profile', label: 'My Profile' },
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'account-password', label: 'Change Password' },
        { id: 'account-logout', label: 'Logout' },
      ],
    },
  ],

  Admin: [
    {
      section: 'Overview',
      items: [
        { id: 'overview', label: 'Dashboard' },
        { id: 'reports', label: 'Reports & Analytics' },
      ],
    },
    {
      section: 'User Management',
      items: [
        { id: 'users-all', label: 'All Users' },
        { id: 'users-students', label: 'Student Management' },
        { id: 'users-instructors', label: 'Instructor Management' },
        { id: 'users-parents', label: 'Parent Management' },
        { id: 'platform-roles', label: 'User Roles' },
        { id: 'platform-permissions', label: 'User Permissions' },
      ],
    },
    {
      section: 'Academic Management',
      items: [
        { id: 'users-students', label: 'Student Records', key: 'student-records' },
        { id: 'courses-manage', label: 'Course Management' },
        { id: 'taxonomy', label: 'Subjects & Categories' },
        { id: 'academic-structure', label: 'Classes & Sections' },
        { id: 'academic-years', label: 'Academic Years' },
        { id: 'academic-semesters', label: 'Semesters & Terms' },
        { id: 'timetables', label: 'Timetables & Scheduling' },
        { id: 'attendance', label: 'Attendance Tracking' },
        { id: 'grades', label: 'Grades & Report Cards' },
        { id: 'assignments', label: 'Examinations & Assessments' },
        { id: 'resources', label: 'E-Learning Resources' },
        { id: 'certificates', label: 'Certificates' },
      ],
    },
    {
      section: 'Enrollment Management',
      items: [
        { id: 'enrollments', label: 'Course Enrollment' },
        { id: 'users-students', label: 'Student Registration', key: 'student-reg' },
        { id: 'enrollment-requests', label: 'Enrollment Requests' },
        { id: 'academic-structure', label: 'Class Assignments', key: 'class-assign' },
      ],
    },
    {
      section: 'Finance & Payments',
      items: [
        { id: 'finance-fees', label: 'Fees & Payments' },
        { id: 'finance-invoices', label: 'Invoices & Receipts' },
        { id: 'finance-transactions', label: 'Payment History' },
        { id: 'finance-outstanding', label: 'Outstanding Balances' },
      ],
    },
    {
      section: 'Communication',
      items: [
        { id: 'comm-parent', label: 'Parent Communication' },
        { id: 'comm-messages', label: 'Messages' },
        { id: 'comm-announcements', label: 'Announcements' },
        { id: 'comm-notifications', label: 'Notifications' },
        { id: 'comm-support', label: 'Support & Feedback' },
      ],
    },
    {
      section: 'My Account',
      items: [
        { id: 'account-profile', label: 'My Profile' },
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'account-password', label: 'Change Password' },
        { id: 'account-logout', label: 'Logout' },
      ],
    },
  ],

  Instructor: [
    {
      section: 'Overview',
      items: [{ id: 'overview', label: 'Dashboard' }],
    },
    {
      section: 'Course Management',
      items: [
        { id: 'courses-manage', label: 'My Courses' },
        { id: 'courses-create', label: 'Create New Course' },
        { id: 'resources', label: 'Course Materials' },
        { id: 'resources', label: 'E-Learning Resources', key: 'inst-res' },
        { id: 'comm-announcements', label: 'Course Announcements' },
      ],
    },
    {
      section: 'Class Management',
      items: [
        { id: 'academic-structure', label: 'My Classes' },
        { id: 'users-students', label: 'My Students' },
        { id: 'users-students', label: 'Student Records', key: 'inst-records' },
        { id: 'timetables', label: 'Timetables & Scheduling' },
        { id: 'attendance', label: 'Attendance Tracking' },
        { id: 'live-classes', label: 'Live Classes' },
      ],
    },
    {
      section: 'Assignments & Assessments',
      items: [
        { id: 'assignments', label: 'Create & Manage Assignments' },
        { id: 'quizzes', label: 'Quizzes & Exams' },
        { id: 'question-bank', label: 'Question Bank' },
        { id: 'submissions', label: 'Submissions & Grading' },
        { id: 'grades', label: 'Grades & Report Cards' },
      ],
    },
    {
      section: 'Student Performance',
      items: [
        { id: 'reports', label: 'Student Progress & Reports' },
      ],
    },
    {
      section: 'Communication',
      items: [
        { id: 'comm-parent', label: 'Parent Communication' },
        { id: 'comm-messages', label: 'Student Messages' },
        { id: 'comm-forums', label: 'Discussion Forums' },
        { id: 'comm-announcements', label: 'Class Announcements', key: 'class-ann' },
        { id: 'comm-notifications', label: 'Notifications' },
      ],
    },
    {
      section: 'Earnings & Payments',
      items: [
        { id: 'instructor-earnings', label: 'My Earnings & History' },
      ],
    },
    {
      section: 'My Account',
      items: [
        { id: 'account-profile', label: 'My Profile' },
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'account-password', label: 'Change Password' },
        { id: 'account-logout', label: 'Logout' },
      ],
    },
  ],

  Student: [
    {
      section: 'Overview',
      items: [{ id: 'overview', label: 'Dashboard' }],
    },
    {
      section: 'My Learning',
      items: [
        { id: 'student-courses', label: 'My Courses' },
        { id: 'explore-courses', label: 'Explore Courses' },
        { id: 'continue-learning', label: 'Continue Learning' },
        { id: 'resources', label: 'Course Materials & Resources' },
        { id: 'live-classes', label: 'Live Classes' },
        { id: 'timetables', label: 'My Learning Schedule' },
      ],
    },
    {
      section: 'Academic Activities',
      items: [
        { id: 'timetables', label: 'My Timetable', key: 'st-tt' },
        { id: 'attendance', label: 'My Attendance' },
        { id: 'assignments', label: 'My Assignments' },
        { id: 'quizzes', label: 'Quizzes & Exams' },
        { id: 'grades', label: 'Exam Results & Report Cards' },
        { id: 'certificates', label: 'My Certificates' },
      ],
    },
    {
      section: 'Communication',
      items: [
        { id: 'comm-messages', label: 'Messages' },
        { id: 'comm-parent', label: 'Parent Communication' },
        { id: 'comm-forums', label: 'Discussion Forums' },
        { id: 'comm-announcements', label: 'Announcements' },
        { id: 'comm-notifications', label: 'Notifications' },
      ],
    },
    {
      section: 'Fees & Payments',
      items: [
        { id: 'finance-my-fees', label: 'My Fees & Make Payment' },
        { id: 'finance-my-history', label: 'Payment History & Invoices' },
      ],
    },
    {
      section: 'My Account',
      items: [
        { id: 'account-profile', label: 'My Profile' },
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'account-password', label: 'Change Password' },
        { id: 'account-logout', label: 'Logout' },
      ],
    },
  ],

  Parent: [
    {
      section: 'Overview',
      items: [{ id: 'overview', label: 'Dashboard' }],
    },
    {
      section: 'My Children',
      items: [
        { id: 'parent-children', label: 'All My Children' },
        { id: 'parent-profiles', label: 'Child Profiles & Academic Info' },
        { id: 'parent-switch', label: 'Switch Child' },
      ],
    },
    {
      section: 'Academic Monitoring',
      items: [
        { id: 'parent-courses', label: 'Enrolled Courses & Progress' },
        { id: 'timetables', label: 'Timetables & Scheduling' },
        { id: 'attendance', label: 'Attendance Tracking' },
        { id: 'grades', label: 'Grades, Results & Report Cards' },
        { id: 'assignments', label: 'Assignments & Exams' },
        { id: 'certificates', label: 'Certificates & Achievements' },
        { id: 'resources', label: 'E-Learning Resources' },
      ],
    },
    {
      section: 'Fees & Payments',
      items: [
        { id: 'finance-my-fees', label: "Child's Fees & Make Payment" },
        { id: 'finance-my-history', label: 'Payment History & Invoices' },
      ],
    },
    {
      section: 'Parent Communication',
      items: [
        { id: 'comm-messages', label: 'Messages to Instructors & Admin' },
        { id: 'comm-announcements', label: 'Academy Announcements' },
        { id: 'comm-notifications', label: 'Notifications' },
      ],
    },
    {
      section: 'My Account',
      items: [
        { id: 'account-profile', label: 'My Profile' },
        { id: 'parent-link-manage', label: 'Linked Children' },
        { id: 'account-settings', label: 'Account Settings' },
        { id: 'account-password', label: 'Change Password' },
        { id: 'account-logout', label: 'Logout' },
      ],
    },
  ],
};
