import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  KeyRound,
  Lock,
  Play,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  apiRequest,
  exportRowsToCsv,
  formatEtb,
  triggerZoomJoin,
  ZOOM_MEETING_ID,
  ZOOM_MEETING_URL,
  ZOOM_PASSCODE,
} from '../utils/api.jsx';
import {
  ConfirmModal,
  IconActionButton,
  LoadingRows,
  ModalFrame,
  PasswordInput,
  SectionHeader,
  StatGrid,
  StatusIndicator,
} from '../components/UiPrimitives.jsx';

function LiveZoomOverviewCard({ sessions, showNotice, onNavigateLive }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 card-hover-lift">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-700" />
            <span>Upcoming Live Online Classes (Zoom)</span>
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Credentials — <strong className="font-mono text-slate-900">Meeting ID: {ZOOM_MEETING_ID}</strong> ·{' '}
            <strong className="font-mono text-slate-900">Passcode: {ZOOM_PASSCODE}</strong>
          </p>
        </div>
        {onNavigateLive && (
          <button onClick={onNavigateLive} className="text-xs font-semibold text-blue-700 hover:underline">
            All Live Classes &rarr;
          </button>
        )}
      </div>
      <div className="divide-y divide-slate-100">
        {sessions.slice(0, 3).map((lc) => (
          <div key={lc.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-slate-900">{lc.title}</p>
              <p className="text-xs text-slate-500">
                {lc.course_title || 'General'} · {lc.scheduled_at} · {lc.instructor_name}
              </p>
            </div>
            <a
              href={ZOOM_MEETING_URL}
              onClick={(e) => {
                e.preventDefault();
                triggerZoomJoin(lc.id, showNotice);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Join Meeting</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewPanel({ onNavigateMenu, onOpenCourse, onOpenPro, activeChildId, setActiveChildId, showNotice }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [studentCourses, setStudentCourses] = useState([]);
  const [viewProReq, setViewProReq] = useState(null);

  async function loadOverview() {
    const q = user.role === 'Parent' && activeChildId ? `?childId=${activeChildId}` : '';
    try {
      const d = await apiRequest(`/api/dashboard/overview${q}`);
      setData(d);
    } catch {
      // ignore
    }
    if (user.role === 'Student') {
      apiRequest('/api/courses?limit=6').then((d) => setStudentCourses(d.courses || [])).catch(() => {});
    }
  }

  useEffect(() => {
    loadOverview();
  }, [user.role, activeChildId]);

  async function reviewProRequest(id, status) {
    try {
      const res = await apiRequest(`/api/finance/ezana-pro/requests/${id}`, {
        method: 'PATCH',
        body: { status },
      });
      if (showNotice) showNotice(res.message);
      loadOverview();
    } catch (err) {
      if (showNotice) showNotice(err.message, 'error');
    }
  }

  if (!data) return <LoadingRows count={5} />;

  if (data.role === 'Owner' || data.role === 'Admin') {
    const k = data.kpis;
    const pendingPro = data.pendingProRequests || [];
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader
          title={`${data.role} Dashboard`}
          subtitle="Real-time overview of enrollments, academic performance, attendance, and revenue."
          actions={
            <button onClick={() => onNavigateMenu('courses-manage')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors">
              Manage Courses
            </button>
          }
        />
        <StatGrid
          items={[
            { label: 'Students / Instructors / Parents', value: `${k.students} / ${k.instructors} / ${k.parents}`, hint: `${k.admins} Administrators` },
            { label: 'Courses & Enrollments', value: `${k.courses} / ${k.enrollments}`, hint: `${k.pendingRequests} enrollment · ${k.pendingProRequestsCount || 0} Pro pending` },
            { label: 'Verified Revenue', value: formatEtb(k.totalRevenueEtb), hint: `Outstanding: ${formatEtb(k.outstandingEtb)}` },
            { label: 'Attendance & Avg Grade', value: `${k.attendanceRate}% / ${k.avgGradePercent}%`, hint: 'Academy-wide metrics' },
          ]}
        />

        <LiveZoomOverviewCard
          sessions={data.upcomingLive}
          showNotice={showNotice}
          onNavigateLive={() => onNavigateMenu('live-classes')}
        />

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 card-hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">Pending Ezana Pro Upgrade Requests</h3>
              <p className="text-xs text-slate-500">Verify Ye-Buna checkout payments and approve requests to unlock full courses for students.</p>
            </div>
            <span className="text-xs font-semibold text-amber-700 tabular-nums">{pendingPro.length} Pending</span>
          </div>
          {pendingPro.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No pending Ezana Pro requests awaiting approval.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingPro.map((req) => (
                <div key={req.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {req.student_name} <span className="text-xs font-normal text-slate-500">({req.student_email})</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Course: <strong>{req.course_title}</strong> · {formatEtb(req.amount_etb)} · {req.payment_method || 'Ye-Buna'}
                      {req.payment_reference && <span className="ml-2 font-mono text-slate-500">{req.payment_reference}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusIndicator status={req.status} />
                    <IconActionButton icon={Eye} label="Read Pro request details" variant="info" onClick={() => setViewProReq(req)} />
                    <IconActionButton icon={Check} label="Approve Pro upgrade" variant="success" onClick={() => reviewProRequest(req.id, 'Approved')} />
                    <IconActionButton icon={X} label="Reject Pro upgrade" variant="danger" onClick={() => reviewProRequest(req.id, 'Rejected')} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">Enrollment by Category</h3>
            <div className="space-y-3">
              {(data.categoryBreakdown || []).map((c) => {
                const maxVal = Math.max(...(data.categoryBreakdown || []).map((x) => Number(x.enrollment_count) || 1), 1);
                const pct = Math.round(((Number(c.enrollment_count) || 0) / maxVal) * 100);
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-800">{c.name} ({c.course_count} courses)</span>
                      <span className="font-mono tabular-nums text-slate-600">{c.enrollment_count} enrollments</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-700 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 6)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-base font-semibold text-slate-900">Recent Platform Activity</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {(data.recentActivity || []).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-900">{a.action}</span>
                    <span className="ml-2 text-slate-500">by {a.actor_name || a.actor_role}</span>
                  </div>
                  <span className="font-mono text-slate-400 tabular-nums">{a.created_at?.slice(0, 16)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ModalFrame open={Boolean(viewProReq)} onClose={() => setViewProReq(null)} title="Ezana Pro Request Detail" maxWidth="max-w-md">
          {viewProReq && (
            <div className="space-y-2 text-sm">
              <p><strong>Student:</strong> {viewProReq.student_name} ({viewProReq.student_email})</p>
              <p><strong>Course:</strong> {viewProReq.course_title}</p>
              <p><strong>Amount:</strong> {formatEtb(viewProReq.amount_etb)}</p>
              <p><strong>Method &amp; Ref:</strong> {viewProReq.payment_method || 'Ye-Buna'} · {viewProReq.payment_reference || 'Pending'}</p>
              <StatusIndicator status={viewProReq.status} />
            </div>
          )}
        </ModalFrame>
      </div>
    );
  }

  if (data.role === 'Instructor') {
    const k = data.kpis;
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader
          title={`Welcome, ${user.first_name} ${user.last_name}`}
          subtitle="Manage your assigned courses, live sessions, student submissions, and YouTube imports."
          actions={
            <button onClick={() => onNavigateMenu('courses-manage')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">
              Create / Import Course
            </button>
          }
        />
        <StatGrid
          items={[
            { label: 'Assigned Courses', value: k.assignedCourses },
            { label: 'Enrolled Students', value: k.enrolledStudents },
            { label: 'Pending Submissions', value: k.pendingSubmissions },
            { label: 'Total Earnings', value: formatEtb(k.totalEarningsEtb) },
          ]}
        />
        <LiveZoomOverviewCard
          sessions={data.upcomingLive}
          showNotice={showNotice}
          onNavigateLive={() => onNavigateMenu('live-classes')}
        />
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">My Assigned Courses</h3>
          <div className="divide-y divide-slate-100 text-sm">
            {(data.assignedCourses || []).map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between">
                <div>
                  <button onClick={() => onOpenCourse(c.id)} className="font-semibold text-slate-900 hover:text-blue-700">{c.title}</button>
                  <p className="text-xs text-slate-500">{c.level} · {c.source_type}</p>
                </div>
                <StatusIndicator status={c.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.role === 'Student') {
    const k = data.kpis;
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader
          title={`Welcome back, ${user.first_name}`}
          subtitle="Access your enrolled courses, watch up to 5 free lessons per course, and track your grades."
          actions={
            <button onClick={() => onNavigateMenu('student-courses')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">
              My Courses &amp; Videos
            </button>
          }
        />
        <StatGrid
          items={[
            { label: 'Enrolled Courses', value: k.enrolledCourses },
            { label: 'Completed Courses', value: k.completedCourses },
            { label: 'Average Grade', value: `${k.avgGradePercent}%` },
            { label: 'Outstanding Fees', value: formatEtb(k.outstandingFeesEtb) },
          ]}
        />

        <LiveZoomOverviewCard
          sessions={data.upcomingLive}
          showNotice={showNotice}
          onNavigateLive={() => onNavigateMenu('timetables')}
        />

        {/* Direct 5-free-videos preview under courses in dashboard */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">Your Course Tutorials (First 5 Free Per Course)</h3>
            <button onClick={() => onNavigateMenu('student-courses')} className="text-xs font-semibold text-blue-700 hover:underline">
              Open All Courses &rarr;
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentCourses.slice(0, 3).map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-4 space-y-2.5 card-hover-lift">
                <p className="text-xs text-slate-500">{c.category_name} · {c.level}</p>
                <h4 className="font-display text-base font-semibold text-slate-900 line-clamp-1">{c.title}</h4>
                <p className="text-xs text-slate-600 tabular-nums">
                  {c.has_pro_access
                    ? `All ${c.lesson_count} videos unlocked`
                    : c.pro_request_status === 'Pending'
                      ? 'Ezana Pro request pending Owner/Admin approval'
                      : `5 free videos · ${Math.max(c.lesson_count - 5, 0)} locked (Ezana Pro ETB 218)`}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => onOpenCourse(c.id)} className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                    {c.has_pro_access ? 'Open Full Course' : 'Watch Free Lessons'}
                  </button>
                  {!c.has_pro_access && (
                    <button onClick={() => onOpenPro(c)} className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                      {c.pro_request_status === 'Pending' ? 'Pending Approval' : 'Pro ETB 218'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Parent Overview
  const children = data.children || [];
  const cs = data.childSummary;
  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title={`Parent Portal — ${user.first_name} ${user.last_name}`}
        subtitle="Monitor linked children's attendance, grades, assignments, and tuition balances."
      />
      {children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {children.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChildId(ch.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                (activeChildId || children[0]?.id) === ch.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {ch.first_name} {ch.last_name} ({ch.student_code})
            </button>
          ))}
        </div>
      )}
      {cs && (
        <>
          <StatGrid
            items={[
              { label: 'Enrolled Courses', value: cs.enrolledCourses.length },
              { label: 'Attendance Rate', value: `${cs.attendanceRate}%` },
              { label: 'Average Grade', value: `${cs.avgGradePercent}%` },
              { label: 'Outstanding Fees', value: formatEtb(cs.outstandingFeesEtb) },
            ]}
          />
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-base font-semibold">Selected Child Course Progress</h3>
            {cs.enrolledCourses.map((ec) => {
              const pct = ec.total_lessons > 0 ? Math.round((ec.completed_lessons / ec.total_lessons) * 100) : 0;
              return (
                <div key={ec.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-900">{ec.title}</span>
                    <span className="font-mono text-xs tabular-nums">{ec.completed_lessons}/{ec.total_lessons} lessons ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-700 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function StudentCoursesDashboardPanel({ onOpenCourse, onOpenPro }) {
  const [courses, setCourses] = useState([]);
  const [detailsMap, setDetailsMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/api/courses?limit=50')
      .then(async (d) => {
        const list = d.courses || [];
        setCourses(list);
        const entries = await Promise.all(
          list.map((c) => apiRequest(`/api/courses/${c.id}`).then((res) => [c.id, res.lessons || []]).catch(() => [c.id, []]))
        );
        setDetailsMap(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingRows count={5} />;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="My Courses & Tutorial Videos"
        subtitle="Watch up to five free tutorial videos under each course. Remaining videos require Ezana Pro (ETB 218 per course)."
      />
      <div className="space-y-6">
        {courses.map((course) => {
          const lessons = detailsMap[course.id] || [];
          const freeLessons = lessons.slice(0, 5);
          const lockedLessons = lessons.slice(5);
          return (
            <div key={course.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-500">{course.category_name} · {course.level} · {course.instructor_name}</p>
                  <h3 className="font-display text-lg font-bold text-slate-900 mt-0.5">{course.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onOpenCourse(course.id)} className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                    Open Course Player
                  </button>
                  {!course.has_pro_access && (
                    <button onClick={() => onOpenPro(course)} className="px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 rounded-lg">
                      {course.pro_request_status === 'Pending' ? 'Ezana Pro · Pending Approval' : 'Upgrade Ezana Pro · ETB 218'}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  Free Tutorial Videos ({freeLessons.length} of 5 available free)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {freeLessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => onOpenCourse(course.id)}
                      className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-600 bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs text-blue-700 font-medium mb-1">
                        <span className="inline-flex items-center gap-1"><Play className="w-3 h-3" /> Free</span>
                        <span className="tabular-nums text-slate-500">{l.duration_label}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-900 line-clamp-2">{l.title}</p>
                    </button>
                  ))}
                </div>
              </div>

              {lockedLessons.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    {course.has_pro_access ? 'Unlocked Pro Lessons' : `Locked Tutorial Videos (${lockedLessons.length} — Upgrade to Ezana Pro ETB 218)`}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {lockedLessons.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => (l.is_locked ? onOpenPro(course, l.title) : onOpenCourse(course.id))}
                        className={`text-left p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                          l.is_locked ? 'bg-slate-50 border-slate-200 text-slate-500 hover:border-amber-400' : 'bg-emerald-50/40 border-emerald-200 text-slate-900'
                        }`}
                      >
                        {l.is_locked ? <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" /> : <Play className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        <span className="truncate">{l.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UsersManagementPanel({ showNotice, roleFilter = '' }) {
  const { user } = useAuth();
  const canCreate = ['Owner', 'Admin'].includes(user.role);
  const [users, setUsers] = useState([]);
  const [links, setLinks] = useState([]);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLink, setDeleteLink] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', role: roleFilter || 'Student', phone: '', qualifications: '', expertise: '' });
  const [linkForm, setLinkForm] = useState({ parent_id: '', student_id: '', relationship: 'Guardian' });

  async function load() {
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    if (search) params.set('search', search);
    const [uRes, lRes] = await Promise.all([
      apiRequest(`/api/dashboard/users?${params.toString()}`),
      apiRequest('/api/dashboard/parent-links'),
    ]);
    setUsers(uRes.users || []);
    setLinks(lRes.links || []);
  }
  useEffect(() => {
    load();
  }, [roleFilter, search]);

  async function createUser(e) {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      const res = await apiRequest('/api/dashboard/users', { method: 'POST', body: payload });
      showNotice(res.message);
      setCreateOpen(false);
      setForm({ first_name: '', last_name: '', email: '', password: '', role: roleFilter || 'Student', phone: '', qualifications: '', expertise: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function saveEditUser(e) {
    e.preventDefault();
    try {
      const payload = { ...editUser };
      if (!payload.password) delete payload.password;
      const res = await apiRequest(`/api/dashboard/users/${editUser.id}`, { method: 'PUT', body: payload });
      showNotice(res.message);
      setEditUser(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function toggleStatus(u) {
    try {
      const nextStatus = u.status === 'Active' ? 'Suspended' : 'Active';
      await apiRequest(`/api/dashboard/users/${u.id}`, { method: 'PUT', body: { status: nextStatus } });
      showNotice(`User status set to ${nextStatus}.`);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function createLink(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/dashboard/parent-links', { method: 'POST', body: linkForm });
      showNotice('Parent linked to student.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title={roleFilter ? `${roleFilter} Management` : 'User & Account Management'}
        subtitle="Manage user profiles, roles, account statuses, and parent-student links."
        actions={
          <div className="flex items-center gap-2">
            <IconActionButton icon={Download} label="Export users CSV" onClick={() => exportRowsToCsv('ezana-users.csv', users)} />
            {canCreate && (
              <IconActionButton icon={Plus} label="Create user account" variant="primary" onClick={() => setCreateOpen(true)} />
            )}
          </div>
        }
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, or student code..."
        className="w-full sm:w-80 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Details</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">CRUD Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const canEditRow = canCreate && !(user.role === 'Admin' && u.role === 'Owner');
              return (
                <tr key={u.id}>
                  <td className="py-3 px-4 font-medium text-slate-900">{u.first_name} {u.last_name}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{u.email}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-slate-800">{u.role}</td>
                  <td className="py-3 px-4 text-xs text-slate-500">{u.student_code || u.expertise || u.phone || '—'}</td>
                  <td className="py-3 px-4"><StatusIndicator status={u.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconActionButton icon={Eye} label="Read user profile" variant="info" onClick={() => setViewUser(u)} />
                      {canEditRow && (
                        <>
                          <IconActionButton icon={Edit3} label="Edit user account" onClick={() => setEditUser({ ...u, password: '' })} />
                          {u.id !== user.id && (
                            <IconActionButton
                              icon={u.status === 'Active' ? UserX : UserCheck}
                              label={u.status === 'Active' ? 'Suspend user' : 'Activate user'}
                              variant={u.status === 'Active' ? 'neutral' : 'success'}
                              onClick={() => toggleStatus(u)}
                            />
                          )}
                        </>
                      )}
                      {user.role === 'Owner' && u.id !== user.id && (
                        <IconActionButton icon={Trash2} label="Delete user account" variant="danger" onClick={() => setDeleteTarget(u)} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canCreate && (roleFilter === 'Parent' || roleFilter === '') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-base font-semibold">Parent–Student Account Links</h3>
          <form onSubmit={createLink} className="flex flex-wrap gap-3 items-center">
            <select required value={linkForm.parent_id} onChange={(e) => setLinkForm({ ...linkForm, parent_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Parent</option>
              {users.filter((u) => u.role === 'Parent').map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
            <select required value={linkForm.student_id} onChange={(e) => setLinkForm({ ...linkForm, student_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Student</option>
              {users.filter((u) => u.role === 'Student').map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            <input placeholder="Relationship" value={linkForm.relationship} onChange={(e) => setLinkForm({ ...linkForm, relationship: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <IconActionButton icon={Plus} label="Link parent & student" type="submit" variant="primary" />
          </form>
          <div className="divide-y divide-slate-100 text-sm">
            {links.map((l) => (
              <div key={l.id} className="py-2.5 flex items-center justify-between gap-2">
                <span><strong>{l.parent_name}</strong> &harr; <strong>{l.student_name}</strong> ({l.relationship})</span>
                <div className="flex items-center gap-1.5">
                  <StatusIndicator status={l.status} />
                  {l.status === 'Pending' && (
                    <IconActionButton
                      icon={Check}
                      label="Approve parent link"
                      variant="success"
                      onClick={async () => {
                        await apiRequest(`/api/dashboard/parent-links/${l.id}`, { method: 'PATCH', body: { status: 'Approved' } });
                        showNotice('Parent link approved.');
                        load();
                      }}
                    />
                  )}
                  <IconActionButton icon={Trash2} label="Delete parent link" variant="danger" onClick={() => setDeleteLink(l)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalFrame open={createOpen} onClose={() => setCreateOpen(false)} title="Create User Account">
        <form onSubmit={createUser} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <input required type="email" placeholder="Email Address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              {user.role === 'Owner' && <option>Owner</option>}
              <option>Admin</option>
              <option>Instructor</option>
              <option>Student</option>
              <option>Parent</option>
            </select>
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password (optional — defaults to Ezana@2027!)</label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Leave blank for Ezana@2027!"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button type="submit" className="w-full py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">Create Account</button>
        </form>
      </ModalFrame>

      <ModalFrame open={Boolean(viewUser)} onClose={() => setViewUser(null)} title="User Account Profile" maxWidth="max-w-md">
        {viewUser && (
          <div className="space-y-2 text-sm">
            <p className="font-display text-lg font-bold text-slate-900">{viewUser.first_name} {viewUser.last_name}</p>
            <p className="text-slate-600">{viewUser.email}</p>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div><span className="text-slate-500 block">Role</span><strong>{viewUser.role}</strong></div>
              <div><span className="text-slate-500 block">Status</span><StatusIndicator status={viewUser.status} /></div>
              <div><span className="text-slate-500 block">Phone</span><strong>{viewUser.phone || '—'}</strong></div>
              <div><span className="text-slate-500 block">Student Code</span><strong>{viewUser.student_code || '—'}</strong></div>
            </div>
            {viewUser.qualifications && <p className="text-xs text-slate-600"><strong>Qualifications:</strong> {viewUser.qualifications}</p>}
            {viewUser.expertise && <p className="text-xs text-slate-600"><strong>Expertise:</strong> {viewUser.expertise}</p>}
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editUser)} onClose={() => setEditUser(null)} title="Edit User Account" maxWidth="max-w-lg">
        {editUser && (
          <form onSubmit={saveEditUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input required value={editUser.first_name} onChange={(e) => setEditUser({ ...editUser, first_name: e.target.value })} placeholder="First Name" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input required value={editUser.last_name} onChange={(e) => setEditUser({ ...editUser, last_name: e.target.value })} placeholder="Last Name" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                {user.role === 'Owner' && <option>Owner</option>}
                <option>Admin</option>
                <option>Instructor</option>
                <option>Student</option>
                <option>Parent</option>
              </select>
              <select value={editUser.status} onChange={(e) => setEditUser({ ...editUser, status: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Phone" value={editUser.phone || ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input placeholder="Expertise" value={editUser.expertise || ''} onChange={(e) => setEditUser({ ...editUser, expertise: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reset Password (optional, min 8 chars)</label>
              <PasswordInput
                value={editUser.password || ''}
                onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                placeholder="Leave blank to keep existing password"
                className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete User"
        message={`Permanently delete account for ${deleteTarget?.first_name} ${deleteTarget?.last_name}?`}
        danger
        onConfirm={async () => {
          await apiRequest(`/api/dashboard/users/${deleteTarget.id}`, { method: 'DELETE' });
          setDeleteTarget(null);
          showNotice('User deleted.');
          load();
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteLink)}
        title="Remove Parent–Student Link"
        message={`Remove link between ${deleteLink?.parent_name} and ${deleteLink?.student_name}?`}
        danger
        onConfirm={async () => {
          await apiRequest(`/api/dashboard/parent-links/${deleteLink.id}`, { method: 'DELETE' });
          setDeleteLink(null);
          showNotice('Parent-student link deleted.');
          load();
        }}
        onCancel={() => setDeleteLink(null)}
      />
    </div>
  );
}

export function PlatformGovernancePanel({ showNotice, tab = 'roles' }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [settings, setSettings] = useState({});
  const [integrations, setIntegrations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ytForm, setYtForm] = useState({ label: 'Primary YouTube Key', apiKey: '', defaultChannelId: '' });
  const [viewRole, setViewRole] = useState(null);
  const [editRole, setEditRole] = useState(null);
  const [viewIntegration, setViewIntegration] = useState(null);
  const [deleteIntegration, setDeleteIntegration] = useState(null);

  async function load() {
    if (tab === 'roles') {
      const r = await apiRequest('/api/dashboard/roles');
      setRoles(r.roles || []);
    } else if (tab === 'settings' || tab === 'profile') {
      const s = await apiRequest('/api/dashboard/settings');
      setSettings(s.settings || {});
    } else if (tab === 'integrations') {
      const i = await apiRequest('/api/youtube/integrations');
      setIntegrations(i.integrations || []);
    } else if (tab === 'audit') {
      const l = await apiRequest('/api/dashboard/audit-logs');
      setAuditLogs(l.logs || []);
    }
  }
  useEffect(() => {
    load();
  }, [tab]);

  async function saveRoleEdit(e) {
    e.preventDefault();
    if (!editRole) return;
    try {
      const permissions = editRole.permissionsText.split(',').map((p) => p.trim()).filter(Boolean);
      await apiRequest(`/api/dashboard/roles/${editRole.id}`, {
        method: 'PUT',
        body: { description: editRole.description, permissions },
      });
      showNotice('Role permissions updated.');
      setEditRole(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    await apiRequest('/api/dashboard/settings', { method: 'PUT', body: settings });
    showNotice('Platform settings saved.');
  }

  async function saveYtKey(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/youtube/integrations', { method: 'POST', body: ytForm });
      showNotice('YouTube API credential encrypted and saved.');
      setYtForm({ label: 'Primary YouTube Key', apiKey: '', defaultChannelId: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  if (tab === 'roles') {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader title="Roles & RBAC Permissions" subtitle="Backend-enforced permissions across Owner, Admin, Instructor, Student, and Parent." />
        <div className="space-y-4">
          {roles.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 card-hover-lift">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-700" />
                  <h3 className="font-display text-base font-bold text-slate-900">{r.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">{r.permissions.length} permissions</span>
                  <IconActionButton icon={Eye} label="Read role permissions" variant="info" onClick={() => setViewRole(r)} />
                  {user.role === 'Owner' && (
                    <IconActionButton
                      icon={Edit3}
                      label="Update role permissions"
                      onClick={() => setEditRole({ ...r, permissionsText: r.permissions.join(', ') })}
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">{r.description}</p>
              <p className="mt-3 text-xs font-mono text-slate-700 leading-relaxed">{r.permissions.join(' · ')}</p>
            </div>
          ))}
        </div>

        <ModalFrame open={Boolean(viewRole)} onClose={() => setViewRole(null)} title={viewRole ? `Role: ${viewRole.name}` : ''} maxWidth="max-w-md">
          {viewRole && (
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">{viewRole.description}</p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 space-y-1">
                {viewRole.permissions.map((p) => <div key={p}>{p}</div>)}
              </div>
            </div>
          )}
        </ModalFrame>

        <ModalFrame open={Boolean(editRole)} onClose={() => setEditRole(null)} title={editRole ? `Edit Permissions: ${editRole.name}` : ''} maxWidth="max-w-lg">
          {editRole && (
            <form onSubmit={saveRoleEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input value={editRole.description || ''} onChange={(e) => setEditRole({ ...editRole, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Permissions (comma-separated)</label>
                <textarea rows={4} value={editRole.permissionsText} onChange={(e) => setEditRole({ ...editRole, permissionsText: e.target.value })} className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditRole(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Role</button>
              </div>
            </form>
          )}
        </ModalFrame>
      </div>
    );
  }

  if (tab === 'integrations') {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader title="Integrations & API Credentials" subtitle="Encrypted YouTube Data API v3 credentials and active payment gateways." />
        <form onSubmit={saveYtKey} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-blue-700" />Add Encrypted YouTube Data API v3 Key</h3>
            <IconActionButton icon={Plus} label="Encrypt & save YouTube credential" type="submit" variant="primary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required placeholder="Credential Label" value={ytForm.label} onChange={(e) => setYtForm({ ...ytForm, label: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <PasswordInput
              required
              value={ytForm.apiKey}
              onChange={(e) => setYtForm({ ...ytForm, apiKey: e.target.value })}
              placeholder="YouTube API Key (AIza...)"
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
            <input placeholder="Default Channel ID (optional)" value={ytForm.defaultChannelId} onChange={(e) => setYtForm({ ...ytForm, defaultChannelId: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {integrations.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between gap-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{i.label}</p>
                <p className="text-xs font-mono text-slate-500">{i.masked_key} · Channel: {i.default_channel_id || 'Any'}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator status={i.status} />
                <IconActionButton icon={Eye} label="Read integration credential" variant="info" onClick={() => setViewIntegration(i)} />
                <IconActionButton icon={Trash2} label="Delete integration credential" variant="danger" onClick={() => setDeleteIntegration(i)} />
              </div>
            </div>
          ))}
        </div>

        <ModalFrame open={Boolean(viewIntegration)} onClose={() => setViewIntegration(null)} title={viewIntegration?.label || 'Integration'} maxWidth="max-w-md">
          {viewIntegration && (
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs text-slate-600">Masked Key: {viewIntegration.masked_key}</p>
              <p className="font-mono text-xs text-slate-600">Default Channel: {viewIntegration.default_channel_id || 'Any'}</p>
              <StatusIndicator status={viewIntegration.status} />
            </div>
          )}
        </ModalFrame>

        <ConfirmModal
          open={Boolean(deleteIntegration)}
          title="Delete API Integration"
          message={`Remove "${deleteIntegration?.label}"?`}
          danger
          onConfirm={async () => {
            await apiRequest(`/api/youtube/integrations/${deleteIntegration.id}`, { method: 'DELETE' });
            setDeleteIntegration(null);
            showNotice('Integration removed.');
            load();
          }}
          onCancel={() => setDeleteIntegration(null)}
        />
      </div>
    );
  }

  if (tab === 'audit') {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader title="Audit Logs" subtitle="Immutable security and administrative event trail." />
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-4 font-mono tabular-nums">{l.created_at}</td>
                  <td className="py-2.5 px-4">{l.actor_name || l.actor_role}</td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{l.action}</td>
                  <td className="py-2.5 px-4">{l.entity_type} #{l.entity_id}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 max-w-xs truncate">{l.details_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title={tab === 'profile' ? 'Academy Profile' : 'System Settings'} subtitle="Configure institutional branding, currency (ETB 218), and course workflows." />
      <form onSubmit={saveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Academy Name</label>
            <input value={settings.academy_name || ''} onChange={(e) => setSettings({ ...settings, academy_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Contact Email</label>
            <input value={settings.academy_email || ''} onChange={(e) => setSettings({ ...settings, academy_email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ezana Pro Price (ETB)</label>
            <input value={settings.ezana_pro_price_etb || '218'} onChange={(e) => setSettings({ ...settings, ezana_pro_price_etb: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Free Tutorial Video Limit</label>
            <input value={settings.free_lesson_limit || '5'} onChange={(e) => setSettings({ ...settings, free_lesson_limit: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Campus Address</label>
          <input value={settings.academy_address || ''} onChange={(e) => setSettings({ ...settings, academy_address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="reqApp"
            checked={settings.require_course_approval === 'true'}
            onChange={(e) => setSettings({ ...settings, require_course_approval: e.target.checked ? 'true' : 'false' })}
          />
          <label htmlFor="reqApp" className="text-sm text-slate-700">Require Owner/Admin approval before Instructors publish courses</label>
        </div>
        {user.role === 'Owner' && (
          <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Settings</button>
        )}
      </form>
    </div>
  );
}

export function ReportsPanel() {
  const [type, setType] = useState('academic');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    apiRequest(`/api/dashboard/reports?type=${type}`).then((d) => setRows(d.rows || [])).catch(() => {});
  }, [type]);

  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Reports & Analytics"
        subtitle="Generate academic, financial, attendance, and enrollment reports with Excel/CSV and PDF print export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white">
              <option value="academic">Academic Grades Report</option>
              <option value="financial">Financial Transactions Report</option>
              <option value="attendance">Attendance Report</option>
              <option value="enrollment">Enrollment Report</option>
            </select>
            <button onClick={() => exportRowsToCsv(`ezana-${type}-report.csv`, rows)} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel/CSV</span>
            </button>
            <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-lg">
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              {cols.map((c) => <th key={c} className="py-3 px-4 capitalize">{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => <td key={c} className="py-2.5 px-4">{String(r[c] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MyChildrenPanel({ showNotice, activeChildId, setActiveChildId }) {
  const [children, setChildren] = useState([]);
  const [links, setLinks] = useState([]);
  const [reqCode, setReqCode] = useState('');
  const [relationship, setRelationship] = useState('Mother');
  const [viewChild, setViewChild] = useState(null);

  async function load() {
    const [ov, lk] = await Promise.all([apiRequest('/api/dashboard/overview'), apiRequest('/api/dashboard/parent-links')]);
    setChildren(ov.children || []);
    setLinks(lk.links || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function submitLinkReq(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/dashboard/parent-links', {
        method: 'POST',
        body: { student_code: reqCode, relationship },
      });
      showNotice(res.message);
      setReqCode('');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="Linked Children & Child Profiles" subtitle="Select an officially linked child to switch all academic and fee views." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((c) => {
          const isActive = (activeChildId || children[0]?.id) === c.id;
          return (
            <div key={c.id} className={`bg-white border rounded-xl p-5 space-y-2 card-hover-lift ${isActive ? 'border-blue-600' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900">{c.first_name} {c.last_name}</h3>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-blue-700">{c.student_code}</span>
                  <IconActionButton icon={Eye} label="Read child profile" variant="info" onClick={() => setViewChild(c)} />
                </div>
              </div>
              <p className="text-xs text-slate-600">Class: {c.class_name || 'Cohort 2027'} · Relationship: {c.relationship}</p>
              <p className="text-xs text-slate-500">{c.email}</p>
              <button
                onClick={() => {
                  setActiveChildId(c.id);
                  showNotice(`Switched dashboard to ${c.first_name} ${c.last_name}.`);
                }}
                className={`mt-2 px-4 py-2 text-xs font-semibold rounded-lg ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
              >
                {isActive ? 'Currently Selected Child' : 'Switch to Child'}
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={submitLinkReq} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 max-w-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Request Additional Child Link</h3>
          <IconActionButton icon={Plus} label="Submit child link request" type="submit" variant="primary" />
        </div>
        <div className="flex flex-wrap gap-3">
          <input required placeholder="Student ID Code (e.g. EZN-2027-0104)" value={reqCode} onChange={(e) => setReqCode(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
          <input placeholder="Relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} className="w-36 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>
        {links.length > 0 && (
          <div className="pt-2 space-y-1 text-xs">
            {links.map((l) => (
              <div key={l.id} className="flex justify-between text-slate-600">
                <span>{l.student_name} ({l.student_code})</span>
                <StatusIndicator status={l.status} />
              </div>
            ))}
          </div>
        )}
      </form>

      <ModalFrame open={Boolean(viewChild)} onClose={() => setViewChild(null)} title="Linked Child Profile" maxWidth="max-w-md">
        {viewChild && (
          <div className="space-y-2 text-sm">
            <p className="font-display text-lg font-bold">{viewChild.first_name} {viewChild.last_name}</p>
            <p className="font-mono text-xs text-blue-700">{viewChild.student_code}</p>
            <p className="text-slate-600">Email: {viewChild.email}</p>
            <p className="text-slate-600">Relationship: {viewChild.relationship}</p>
            <p className="text-slate-600">Cohort: {viewChild.class_name || 'Cohort 2027'}</p>
          </div>
        )}
      </ModalFrame>
    </div>
  );
}

export function MyAccountPanel({ showNotice, tab = 'profile' }) {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone: user.phone || '',
    bio: user.bio || '',
    qualifications: user.qualifications || '',
    expertise: user.expertise || '',
    timezone: user.timezone || 'Africa/Addis_Ababa',
    language: user.language || 'English',
    notify_email: Boolean(user.notify_email),
  });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  async function saveProfile(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/profile', { method: 'PUT', body: form });
      await refreshUser();
      showNotice('Profile & preferences saved.');
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/auth/change-password', { method: 'POST', body: pwForm });
      showNotice(res.message);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  if (tab === 'password') {
    return (
      <div className="space-y-6 animate-fade-up">
        <SectionHeader title="Change Password" subtitle="Update your account password securely." />
        <form onSubmit={changePassword} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
            <PasswordInput
              required
              autoComplete="current-password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">New Password (min 8 chars)</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">Update Password</button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title={tab === 'settings' ? 'Account Settings' : 'My Profile'} subtitle={`Role: ${user.role} · ${user.email}`} />
      <form onSubmit={saveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Timezone</label>
            <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option>Africa/Addis_Ababa</option>
              <option>UTC</option>
              <option>Europe/London</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Bio</label>
          <textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.notify_email} onChange={(e) => setForm({ ...form, notify_email: e.target.checked })} />
          <span>Receive academic &amp; payment email notifications</span>
        </label>
        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
      </form>
    </div>
  );
}
