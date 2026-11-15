import React, { useEffect, useState } from 'react';
import { Bell, ChevronRight, Globe, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../utils/api.jsx';
import { ROLE_MENUS } from './menuConfig.jsx';
import { CourseManagementPanel, TaxonomyPanel } from './CourseManagementPanel.jsx';
import {
  AcademicStructurePanel,
  AssignmentsQuizzesPanel,
  AttendancePanel,
  EnrollmentsPanel,
  GradesCertificatesPanel,
  ResourcesPanel,
  TimetablesPanel,
} from './AcademicPanels.jsx';
import { CommunicationPanel, FinancePanel } from './FinanceAndCommPanels.jsx';
import {
  MyAccountPanel,
  MyChildrenPanel,
  OverviewPanel,
  PlatformGovernancePanel,
  ReportsPanel,
  StudentCoursesDashboardPanel,
  UsersManagementPanel,
} from './GovernanceAndAccountPanels.jsx';
import CoursesCatalogPage from '../pages/CoursesCatalogPage.jsx';

export default function DashboardShell({ onNavigate, onOpenCourse, onOpenPro, showNotice }) {
  const { user, logout } = useAuth();
  const menuGroups = ROLE_MENUS[user?.role] || [];
  const [activeMenuId, setActiveMenuId] = useState('overview');
  const [activeItemKey, setActiveItemKey] = useState('overview');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const [childrenList, setChildrenList] = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

  async function refreshNotifications() {
    try {
      const n = await apiRequest('/api/communication/notifications');
      setUnreadCount(n.unreadCount || 0);
      setRecentNotifs((n.notifications || []).slice(0, 5));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setActiveMenuId('overview');
    setActiveItemKey('overview');
    refreshNotifications();
    if (user?.role === 'Parent') {
      apiRequest('/api/dashboard/overview')
        .then((d) => {
          const list = d.children || [];
          setChildrenList(list);
          if (list.length > 0) {
            setActiveChildId((prev) => prev || list[0].id);
          }
        })
        .catch(() => {});
    } else {
      setChildrenList([]);
      setActiveChildId(null);
    }
  }, [user?.id, user?.role]);

  if (!user) return null;

  function findActiveLabel() {
    for (const group of menuGroups) {
      for (const item of group.items) {
        if ((item.key || item.id) === activeItemKey || item.id === activeMenuId) {
          return { section: group.section, label: item.label };
        }
      }
    }
    return { section: 'Overview', label: 'Dashboard' };
  }

  function handleMenuSelect(item) {
    setMobileDrawerOpen(false);
    if (item.id === 'account-logout') {
      logout();
      onNavigate('login');
      showNotice('Signed out successfully.');
      return;
    }
    setActiveMenuId(item.id);
    setActiveItemKey(item.key || item.id);
  }

  function handleNavigateMenu(menuId) {
    setActiveMenuId(menuId);
    setActiveItemKey(menuId);
  }

  function renderContent() {
    switch (activeMenuId) {
      case 'overview':
        return (
          <OverviewPanel
            onNavigateMenu={handleNavigateMenu}
            onOpenCourse={onOpenCourse}
            onOpenPro={onOpenPro}
            activeChildId={activeChildId}
            setActiveChildId={setActiveChildId}
            showNotice={showNotice}
          />
        );
      case 'reports':
        return <ReportsPanel />;
      case 'users-all':
        return <UsersManagementPanel showNotice={showNotice} roleFilter="" />;
      case 'users-students':
        return <UsersManagementPanel showNotice={showNotice} roleFilter="Student" />;
      case 'users-instructors':
        return <UsersManagementPanel showNotice={showNotice} roleFilter="Instructor" />;
      case 'users-parents':
        return <UsersManagementPanel showNotice={showNotice} roleFilter="Parent" />;
      case 'academic-structure':
      case 'academic-years':
      case 'academic-semesters':
        return <AcademicStructurePanel showNotice={showNotice} />;
      case 'courses-manage':
        return (
          <CourseManagementPanel
            key="courses-manage"
            showNotice={showNotice}
            onOpenCourse={onOpenCourse}
          />
        );
      case 'courses-create':
        return (
          <CourseManagementPanel
            key="courses-create"
            showNotice={showNotice}
            onOpenCourse={onOpenCourse}
            initialAction="create"
          />
        );
      case 'taxonomy':
        return <TaxonomyPanel showNotice={showNotice} />;
      case 'timetables':
      case 'live-classes':
        return <TimetablesPanel showNotice={showNotice} activeChildId={activeChildId} />;
      case 'attendance':
        return <AttendancePanel showNotice={showNotice} activeChildId={activeChildId} />;
      case 'grades':
        return <GradesCertificatesPanel showNotice={showNotice} activeChildId={activeChildId} mode="grades" />;
      case 'certificates':
        return <GradesCertificatesPanel showNotice={showNotice} activeChildId={activeChildId} mode="certificates" />;
      case 'resources':
        return <ResourcesPanel showNotice={showNotice} />;
      case 'enrollments':
      case 'enrollment-requests':
        return <EnrollmentsPanel showNotice={showNotice} />;
      case 'assignments':
      case 'quizzes':
      case 'question-bank':
      case 'submissions':
        return <AssignmentsQuizzesPanel showNotice={showNotice} activeChildId={activeChildId} />;
      case 'finance-fees':
      case 'finance-invoices':
      case 'finance-transactions':
      case 'finance-outstanding':
      case 'finance-reports':
      case 'finance-my-fees':
      case 'finance-my-history':
      case 'instructor-earnings':
        return <FinancePanel showNotice={showNotice} activeChildId={activeChildId} section={activeMenuId} />;
      case 'comm-parent':
      case 'comm-messages':
        return <CommunicationPanel showNotice={showNotice} defaultTab="messages" />;
      case 'comm-announcements':
        return <CommunicationPanel showNotice={showNotice} defaultTab="announcements" />;
      case 'comm-forums':
        return <CommunicationPanel showNotice={showNotice} defaultTab="forums" />;
      case 'comm-notifications':
        return <CommunicationPanel showNotice={showNotice} defaultTab="notifications" />;
      case 'comm-support':
        return <CommunicationPanel showNotice={showNotice} defaultTab="support" />;
      case 'platform-roles':
      case 'platform-permissions':
        return <PlatformGovernancePanel showNotice={showNotice} tab="roles" />;
      case 'platform-settings':
        return <PlatformGovernancePanel showNotice={showNotice} tab="settings" />;
      case 'platform-profile':
        return <PlatformGovernancePanel showNotice={showNotice} tab="profile" />;
      case 'platform-integrations':
        return <PlatformGovernancePanel showNotice={showNotice} tab="integrations" />;
      case 'platform-audit':
        return <PlatformGovernancePanel showNotice={showNotice} tab="audit" />;
      case 'student-courses':
      case 'continue-learning':
      case 'parent-courses':
        return <StudentCoursesDashboardPanel onOpenCourse={onOpenCourse} onOpenPro={onOpenPro} />;
      case 'explore-courses':
        return <CoursesCatalogPage onOpenCourse={onOpenCourse} onOpenPro={onOpenPro} />;
      case 'parent-children':
      case 'parent-profiles':
      case 'parent-switch':
      case 'parent-link-manage':
        return (
          <MyChildrenPanel
            showNotice={showNotice}
            activeChildId={activeChildId}
            setActiveChildId={setActiveChildId}
          />
        );
      case 'account-profile':
        return <MyAccountPanel showNotice={showNotice} tab="profile" />;
      case 'account-settings':
        return <MyAccountPanel showNotice={showNotice} tab="settings" />;
      case 'account-password':
        return <MyAccountPanel showNotice={showNotice} tab="password" />;
      default:
        return (
          <OverviewPanel
            onNavigateMenu={handleNavigateMenu}
            onOpenCourse={onOpenCourse}
            onOpenPro={onOpenPro}
            activeChildId={activeChildId}
            setActiveChildId={setActiveChildId}
            showNotice={showNotice}
          />
        );
    }
  }

  const crumb = findActiveLabel();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
        <button
          onClick={() => onNavigate('home')}
          className="font-display text-lg font-bold tracking-tight text-white text-left whitespace-nowrap"
        >
          Ezana Academy
        </button>
        <button
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close navigation drawer"
          className="lg:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
        <p className="text-sm font-semibold text-white truncate">
          {user.first_name} {user.last_name}
        </p>
        <p className="text-xs text-slate-400 truncate">
          {user.role} Portal · {user.email}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {menuGroups.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const itemKey = item.key || item.id;
                const isActive = activeItemKey === itemKey && item.id !== 'account-logout';
                return (
                  <button
                    key={itemKey}
                    onClick={() => handleMenuSelect(item)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-700 text-white font-medium'
                        : item.id === 'account-logout'
                        ? 'text-red-300 hover:bg-slate-800 hover:text-red-200'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop 260px Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-r border-slate-200 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileDrawerOpen(false)} />
          <aside className="relative w-[260px] max-w-[85vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 truncate">
              <span className="font-medium text-slate-700">{user.role}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{crumb.section}</span>
              <ChevronRight className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{crumb.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {user.role === 'Parent' && childrenList.length > 0 && (
              <select
                aria-label="Switch active child"
                value={activeChildId || ''}
                onChange={(e) => {
                  const cid = Number(e.target.value);
                  setActiveChildId(cid);
                  const found = childrenList.find((c) => c.id === cid);
                  if (found) showNotice(`Switched child view to ${found.first_name} ${found.last_name}.`);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              >
                {childrenList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Child: {ch.first_name} {ch.last_name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  refreshNotifications();
                }}
                aria-label="Notifications"
                title="Notifications"
                className="relative p-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="animate-scale-in absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Recent Notifications</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        handleNavigateMenu('comm-notifications');
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {recentNotifs.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">No notifications yet.</p>
                    ) : (
                      recentNotifs.map((n) => (
                        <div key={n.id} className={`p-3 text-xs ${n.is_read ? 'opacity-70' : 'bg-blue-50/40'}`}>
                          <p className="font-semibold text-slate-900">{n.title}</p>
                          <p className="text-slate-600 mt-0.5 line-clamp-2">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('courses')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
            <button
              onClick={() => {
                logout();
                onNavigate('login');
                showNotice('Signed out successfully.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{renderContent()}</main>
      </div>
    </div>
  );
}
