import React, { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  Plus,
  Printer,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  apiRequest,
  formatEtb,
  triggerZoomJoin,
  ZOOM_MEETING_ID,
  ZOOM_MEETING_URL,
  ZOOM_PASSCODE,
} from '../utils/api.jsx';
import {
  ConfirmModal,
  EmptyState,
  IconActionButton,
  LoadingRows,
  ModalFrame,
  SectionHeader,
  StatGrid,
  StatusIndicator,
} from '../components/UiPrimitives.jsx';

export function AcademicStructurePanel({ showNotice }) {
  const { user } = useAuth();
  const isAdminOrOwner = ['Owner', 'Admin'].includes(user.role);
  const [data, setData] = useState({ academicYears: [], semesters: [], departments: [], classes: [] });
  const [yearForm, setYearForm] = useState({ name: '', start_date: '2026-09-01', end_date: '2027-06-30', status: 'Active' });
  const [semForm, setSemForm] = useState({ academic_year_id: '', name: '', start_date: '2026-09-01', end_date: '2027-01-30', status: 'Active' });
  const [classForm, setClassForm] = useState({ name: '', section: 'A', room: 'Hall C-102', capacity: 40 });
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const d = await apiRequest('/api/academic/structure');
    setData(d);
    if (!semForm.academic_year_id && d.academicYears?.length) {
      setSemForm((prev) => ({ ...prev, academic_year_id: String(d.academicYears[0].id) }));
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function addYear(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/years', { method: 'POST', body: yearForm });
      setYearForm({ name: '', start_date: '2026-09-01', end_date: '2027-06-30', status: 'Active' });
      showNotice('Academic year created.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function addSemester(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/semesters', { method: 'POST', body: semForm });
      setSemForm((prev) => ({ ...prev, name: '' }));
      showNotice('Semester created.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function addClass(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/classes', { method: 'POST', body: classForm });
      setClassForm({ name: '', section: 'A', room: 'Hall C-102', capacity: 40 });
      showNotice('Class created.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editItem) return;
    try {
      const endpoint =
        editItem.kind === 'year'
          ? `/api/academic/years/${editItem.id}`
          : editItem.kind === 'semester'
            ? `/api/academic/semesters/${editItem.id}`
            : `/api/academic/classes/${editItem.id}`;
      await apiRequest(endpoint, { method: 'PUT', body: editItem });
      showNotice('Updated successfully.');
      setEditItem(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const endpoint =
        deleteTarget.kind === 'year'
          ? `/api/academic/years/${deleteTarget.id}`
          : deleteTarget.kind === 'semester'
            ? `/api/academic/semesters/${deleteTarget.id}`
            : `/api/academic/classes/${deleteTarget.id}`;
      await apiRequest(endpoint, { method: 'DELETE' });
      showNotice('Record deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="Academic Structure & Classes" subtitle="Manage academic years, semesters, departments, and class cohorts." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
          <h3 className="font-display text-base font-semibold">Academic Years &amp; Semesters</h3>
          {isAdminOrOwner && (
            <form onSubmit={addYear} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
              <input required placeholder="2027-2028 Year" value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} className="sm:col-span-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg" />
              <input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
              <input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
              <div className="flex justify-end">
                <IconActionButton icon={Plus} label="Create academic year" type="submit" variant="primary" />
              </div>
            </form>
          )}
          <div className="divide-y divide-slate-100 text-sm">
            {data.academicYears.map((y) => (
              <div key={y.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{y.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{y.start_date} to {y.end_date}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusIndicator status={y.status} />
                  <IconActionButton icon={Eye} label="Read academic year" variant="info" onClick={() => setViewItem({ kind: 'Academic Year', title: y.name, meta: `${y.start_date} to ${y.end_date}`, status: y.status })} />
                  {isAdminOrOwner && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit academic year" onClick={() => setEditItem({ kind: 'year', ...y })} />
                      <IconActionButton icon={Trash2} label="Delete academic year" variant="danger" onClick={() => setDeleteTarget({ kind: 'year', id: y.id, label: y.name })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <h4 className="text-xs font-semibold text-slate-700">Semesters &amp; Terms</h4>
            {isAdminOrOwner && (
              <form onSubmit={addSemester} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                <select required value={semForm.academic_year_id} onChange={(e) => setSemForm({ ...semForm, academic_year_id: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white">
                  <option value="">Year</option>
                  {data.academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
                <input required placeholder="Semester Name" value={semForm.name} onChange={(e) => setSemForm({ ...semForm, name: e.target.value })} className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" />
                <input type="date" value={semForm.start_date} onChange={(e) => setSemForm({ ...semForm, start_date: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg" />
                <div className="flex justify-end">
                  <IconActionButton icon={Plus} label="Create semester" type="submit" variant="primary" />
                </div>
              </form>
            )}
            {data.semesters.map((s) => (
              <div key={s.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                <span>{s.name} ({s.academic_year_name})</span>
                <div className="flex items-center gap-1.5">
                  <StatusIndicator status={s.status} />
                  <IconActionButton icon={Eye} label="Read semester" variant="info" onClick={() => setViewItem({ kind: 'Semester', title: s.name, meta: `${s.academic_year_name} · ${s.start_date} to ${s.end_date}`, status: s.status })} />
                  {isAdminOrOwner && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit semester" onClick={() => setEditItem({ kind: 'semester', ...s })} />
                      <IconActionButton icon={Trash2} label="Delete semester" variant="danger" onClick={() => setDeleteTarget({ kind: 'semester', id: s.id, label: s.name })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
          <h3 className="font-display text-base font-semibold">Classes &amp; Sections</h3>
          {isAdminOrOwner && (
            <form onSubmit={addClass} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
              <input required placeholder="Cohort Name" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} className="sm:col-span-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg" />
              <input placeholder="Sec" value={classForm.section} onChange={(e) => setClassForm({ ...classForm, section: e.target.value })} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg" />
              <input placeholder="Room" value={classForm.room} onChange={(e) => setClassForm({ ...classForm, room: e.target.value })} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg" />
              <div className="flex justify-end">
                <IconActionButton icon={Plus} label="Create class" type="submit" variant="primary" />
              </div>
            </form>
          )}
          <div className="divide-y divide-slate-100 text-sm">
            {data.classes.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{c.name} · {c.section}</p>
                  <p className="text-xs text-slate-500">{c.room} · {c.instructor_name || 'Faculty'} · {c.student_count}/{c.capacity} enrolled</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconActionButton icon={Eye} label="Read class cohort" variant="info" onClick={() => setViewItem({ kind: 'Class Cohort', title: `${c.name} (Section ${c.section})`, meta: `Room: ${c.room} · Capacity: ${c.student_count}/${c.capacity}` })} />
                  {isAdminOrOwner && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit class" onClick={() => setEditItem({ kind: 'class', ...c })} />
                      <IconActionButton icon={Trash2} label="Delete class" variant="danger" onClick={() => setDeleteTarget({ kind: 'class', id: c.id, label: `${c.name} ${c.section}` })} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.title}` : ''} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{viewItem.meta}</p>
            {viewItem.status && <StatusIndicator status={viewItem.status} />}
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editItem)} onClose={() => setEditItem(null)} title="Update Academic Structure" maxWidth="max-w-md">
        {editItem && (
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
              <input required value={editItem.name || ''} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            {(editItem.kind === 'year' || editItem.kind === 'semester') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                    <input type="date" value={editItem.start_date || ''} onChange={(e) => setEditItem({ ...editItem, start_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                    <input type="date" value={editItem.end_date || ''} onChange={(e) => setEditItem({ ...editItem, end_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select value={editItem.status || 'Active'} onChange={(e) => setEditItem({ ...editItem, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    <option value="Active">Active</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </>
            )}
            {editItem.kind === 'class' && (
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Section" value={editItem.section || ''} onChange={(e) => setEditItem({ ...editItem, section: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                <input placeholder="Room" value={editItem.room || ''} onChange={(e) => setEditItem({ ...editItem, room: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                <input type="number" placeholder="Cap" value={editItem.capacity || 40} onChange={(e) => setEditItem({ ...editItem, capacity: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Record"
        message={`Permanently delete "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function TimetablesPanel({ showNotice, activeChildId }) {
  const { user } = useAuth();
  const canEdit = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const [timetables, setTimetables] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: '', course_id: '', day_of_week: 'Monday', start_time: '09:00', end_time: '10:30', room: 'Hall B-204', session_type: 'Lesson' });
  const [liveForm, setLiveForm] = useState({ title: '', course_id: '', scheduled_at: '2026-11-22 15:00', duration_minutes: 60 });
  const [viewItem, setViewItem] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);
  const [editLive, setEditLive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const q = activeChildId ? `?studentId=${activeChildId}` : '';
    const [tt, lc, cr] = await Promise.all([
      apiRequest(`/api/academic/timetables${q}`),
      apiRequest('/api/academic/live-classes'),
      apiRequest('/api/courses?limit=50'),
    ]);
    setTimetables(tt.timetables || []);
    setLiveClasses(lc.liveClasses || []);
    setCourses(cr.courses || []);
  }
  useEffect(() => {
    load();
  }, [activeChildId]);

  async function addSchedule(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/timetables', { method: 'POST', body: form });
      showNotice('Timetable session scheduled.');
      setForm({ ...form, title: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function updateSchedule(e) {
    e.preventDefault();
    try {
      await apiRequest(`/api/academic/timetables/${editSchedule.id}`, { method: 'PUT', body: editSchedule });
      showNotice('Timetable session updated.');
      setEditSchedule(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function addLiveClass(e) {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/academic/live-classes', { method: 'POST', body: liveForm });
      showNotice(res.message || `Live class scheduled. Meeting ID: ${ZOOM_MEETING_ID} | Passcode: ${ZOOM_PASSCODE}`);
      setLiveForm({ ...liveForm, title: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function updateLiveClass(e) {
    e.preventDefault();
    try {
      await apiRequest(`/api/academic/live-classes/${editLive.id}`, { method: 'PUT', body: editLive });
      showNotice('Live class updated.');
      setEditLive(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const endpoint =
        deleteTarget.kind === 'timetable'
          ? `/api/academic/timetables/${deleteTarget.id}`
          : `/api/academic/live-classes/${deleteTarget.id}`;
      await apiRequest(endpoint, { method: 'DELETE' });
      showNotice('Session deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  function copyCredentials() {
    const text = `Zoom URL: ${ZOOM_MEETING_URL}\nMeeting ID: ${ZOOM_MEETING_ID}\nPasscode: ${ZOOM_PASSCODE}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showNotice(`Copied Zoom credentials — Meeting ID: ${ZOOM_MEETING_ID} | Passcode: ${ZOOM_PASSCODE}`);
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="Timetables, Schedules & Live Classes" subtitle="Automatic scheduling conflict detection prevents double-booked rooms or instructors." />

      {canEdit && (
        <form onSubmit={addSchedule} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1">Session Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly Seminar" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Day</label>
            <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Start / End</label>
            <div className="flex gap-1">
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg" />
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Room</label>
            <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end">
            <IconActionButton icon={Plus} label="Schedule timetable session" type="submit" variant="primary" />
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Day &amp; Time</th>
              <th className="py-3 px-4">Session</th>
              <th className="py-3 px-4">Course</th>
              <th className="py-3 px-4">Instructor</th>
              <th className="py-3 px-4">Room</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-right">CRUD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {timetables.map((t) => {
              const rowCanEdit = ['Owner', 'Admin'].includes(user.role) || (user.role === 'Instructor' && t.instructor_id === user.id);
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{t.day_of_week} · {t.start_time}–{t.end_time}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">{t.title}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{t.course_title || 'General'}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{t.instructor_name || 'Faculty'}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{t.room}</td>
                  <td className="py-3 px-4 text-xs text-slate-700">{t.session_type}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconActionButton icon={Eye} label="Read timetable details" variant="info" onClick={() => setViewItem({ kind: 'Timetable Session', title: t.title, meta: `${t.day_of_week} ${t.start_time}–${t.end_time} · Room: ${t.room} · ${t.instructor_name || 'Faculty'}` })} />
                      {rowCanEdit && (
                        <>
                          <IconActionButton icon={Edit3} label="Edit timetable session" onClick={() => setEditSchedule({ ...t })} />
                          <IconActionButton icon={Trash2} label="Delete timetable session" variant="danger" onClick={() => setDeleteTarget({ kind: 'timetable', id: t.id, label: t.title })} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Live Classes with Mandatory Zoom Redirect & Credentials Notification */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Video className="w-4 h-4 text-blue-700" />
              <span>Live Online Classes (Zoom Room)</span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized users join via Zoom — <strong className="font-mono text-slate-900">Meeting ID: {ZOOM_MEETING_ID}</strong> ·{' '}
              <strong className="font-mono text-slate-900">Passcode: {ZOOM_PASSCODE}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={copyCredentials}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Meeting ID &amp; Passcode</span>
          </button>
        </div>

        {canEdit && (
          <form onSubmit={addLiveClass} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            <input required placeholder="Live Class Title" value={liveForm.title} onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={liveForm.course_id} onChange={(e) => setLiveForm({ ...liveForm, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input value={liveForm.scheduled_at} onChange={(e) => setLiveForm({ ...liveForm, scheduled_at: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end">
              <IconActionButton icon={Plus} label="Create live class" type="submit" variant="primary" />
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {liveClasses.map((lc) => {
            const rowCanEdit = ['Owner', 'Admin'].includes(user.role) || (user.role === 'Instructor' && lc.instructor_id === user.id);
            return (
              <div key={lc.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{lc.title}</p>
                  <p className="text-xs text-slate-500">
                    {lc.course_title || 'General Cohort'} · {lc.scheduled_at} ({lc.duration_minutes}m) · {lc.instructor_name}
                  </p>
                  <p className="text-xs font-mono text-blue-700 mt-0.5">
                    Meeting ID: {lc.meeting_id || ZOOM_MEETING_ID} · Passcode: {lc.passcode || ZOOM_PASSCODE}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={lc.status} />
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
                  <IconActionButton icon={Eye} label="Read live session" variant="info" onClick={() => setViewItem({ kind: 'Live Zoom Class', title: lc.title, meta: `${lc.scheduled_at} (${lc.duration_minutes} min) · Meeting ID: ${ZOOM_MEETING_ID} · Passcode: ${ZOOM_PASSCODE}`, status: lc.status })} />
                  {rowCanEdit && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit live session" onClick={() => setEditLive({ ...lc })} />
                      <IconActionButton icon={Trash2} label="Delete live session" variant="danger" onClick={() => setDeleteTarget({ kind: 'live', id: lc.id, label: lc.title })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.title}` : ''} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{viewItem.meta}</p>
            {viewItem.status && <StatusIndicator status={viewItem.status} />}
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editSchedule)} onClose={() => setEditSchedule(null)} title="Edit Timetable Entry" maxWidth="max-w-md">
        {editSchedule && (
          <form onSubmit={updateSchedule} className="space-y-3">
            <input required value={editSchedule.title} onChange={(e) => setEditSchedule({ ...editSchedule, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <select value={editSchedule.day_of_week} onChange={(e) => setEditSchedule({ ...editSchedule, day_of_week: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d}>{d}</option>)}
              </select>
              <input value={editSchedule.room || ''} onChange={(e) => setEditSchedule({ ...editSchedule, room: e.target.value })} placeholder="Room" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="time" value={editSchedule.start_time} onChange={(e) => setEditSchedule({ ...editSchedule, start_time: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="time" value={editSchedule.end_time} onChange={(e) => setEditSchedule({ ...editSchedule, end_time: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditSchedule(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editLive)} onClose={() => setEditLive(null)} title="Edit Live Zoom Class" maxWidth="max-w-md">
        {editLive && (
          <form onSubmit={updateLiveClass} className="space-y-3">
            <input required value={editLive.title} onChange={(e) => setEditLive({ ...editLive, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input value={editLive.scheduled_at} onChange={(e) => setEditLive({ ...editLive, scheduled_at: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" value={editLive.duration_minutes} onChange={(e) => setEditLive({ ...editLive, duration_minutes: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <select value={editLive.status} onChange={(e) => setEditLive({ ...editLive, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditLive(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Session"
        message={`Delete "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function AttendancePanel({ showNotice, activeChildId }) {
  const { user } = useAuth();
  const canMark = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const [data, setData] = useState({ records: [], summary: { total: 0, present: 0, late: 0, absent: 0, percentage: 100 } });
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ user_id: '', course_id: '', attendance_date: new Date().toISOString().slice(0, 10), status: 'Present', notes: '' });
  const [viewRec, setViewRec] = useState(null);
  const [editRec, setEditRec] = useState(null);
  const [deleteRec, setDeleteRec] = useState(null);

  async function load() {
    const q = activeChildId ? `?studentId=${activeChildId}` : '';
    const d = await apiRequest(`/api/academic/attendance${q}`);
    setData(d);
    if (canMark) {
      const [uRes, cRes] = await Promise.all([apiRequest('/api/dashboard/users?role=Student'), apiRequest('/api/courses?limit=50')]);
      setStudents(uRes.users || []);
      setCourses(cRes.courses || []);
    }
  }
  useEffect(() => {
    load();
  }, [activeChildId]);

  async function recordAtt(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/attendance', { method: 'POST', body: form });
      showNotice('Attendance recorded.');
      setForm({ ...form, notes: '' });
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function saveEditAtt(e) {
    e.preventDefault();
    try {
      await apiRequest(`/api/academic/attendance/${editRec.id}`, { method: 'PUT', body: editRec });
      showNotice('Attendance updated.');
      setEditRec(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="Attendance Tracking" subtitle="Real-time attendance logs and percentage summaries." />
      <StatGrid
        items={[
          { label: 'Attendance Rate', value: `${data.summary.percentage}%` },
          { label: 'Present', value: data.summary.present },
          { label: 'Late', value: data.summary.late },
          { label: 'Absent', value: data.summary.absent },
        ]}
      />

      {canMark && (
        <form onSubmit={recordAtt} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Student</label>
            <select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
            <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <input type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option>Present</option>
              <option>Late</option>
              <option>Absent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input placeholder="Optional note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="flex justify-end">
            <IconActionButton icon={Plus} label="Record attendance" type="submit" variant="primary" />
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Course</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Notes</th>
              <th className="py-3 px-4 text-right">CRUD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.records.map((r) => (
              <tr key={r.id}>
                <td className="py-3 px-4 font-mono text-xs tabular-nums">{r.attendance_date}</td>
                <td className="py-3 px-4 font-medium">{r.user_name}</td>
                <td className="py-3 px-4 text-xs text-slate-600">{r.course_title || 'General'}</td>
                <td className="py-3 px-4"><StatusIndicator status={r.status} /></td>
                <td className="py-3 px-4 text-xs text-slate-500">{r.notes}</td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <IconActionButton icon={Eye} label="Read attendance record" variant="info" onClick={() => setViewRec(r)} />
                    {canMark && (
                      <>
                        <IconActionButton icon={Edit3} label="Edit attendance record" onClick={() => setEditRec({ ...r })} />
                        <IconActionButton icon={Trash2} label="Delete attendance record" variant="danger" onClick={() => setDeleteRec(r)} />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalFrame open={Boolean(viewRec)} onClose={() => setViewRec(null)} title="Attendance Record Details" maxWidth="max-w-md">
        {viewRec && (
          <div className="space-y-2 text-sm">
            <p><strong>Student:</strong> {viewRec.user_name}</p>
            <p><strong>Date:</strong> {viewRec.attendance_date}</p>
            <p><strong>Course:</strong> {viewRec.course_title || 'General'}</p>
            <p><strong>Notes:</strong> {viewRec.notes || '—'}</p>
            <StatusIndicator status={viewRec.status} />
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editRec)} onClose={() => setEditRec(null)} title="Edit Attendance Record" maxWidth="max-w-md">
        {editRec && (
          <form onSubmit={saveEditAtt} className="space-y-3">
            <input type="date" value={editRec.attendance_date} onChange={(e) => setEditRec({ ...editRec, attendance_date: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={editRec.status} onChange={(e) => setEditRec({ ...editRec, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option>Present</option>
              <option>Late</option>
              <option>Absent</option>
            </select>
            <input value={editRec.notes || ''} onChange={(e) => setEditRec({ ...editRec, notes: e.target.value })} placeholder="Notes" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditRec(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteRec)}
        title="Delete Attendance Record"
        message={`Delete attendance entry for ${deleteRec?.user_name} on ${deleteRec?.attendance_date}?`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await apiRequest(`/api/academic/attendance/${deleteRec.id}`, { method: 'DELETE' });
          setDeleteRec(null);
          showNotice('Attendance deleted.');
          load();
        }}
        onCancel={() => setDeleteRec(null)}
      />
    </div>
  );
}

export function AssignmentsQuizzesPanel({ showNotice, activeChildId }) {
  const { user } = useAuth();
  const canCreate = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const [tab, setTab] = useState('assignments');
  const [assignData, setAssignData] = useState({ assignments: [], submissions: [] });
  const [quizData, setQuizData] = useState({ quizzes: [], questions: [], attempts: [] });
  const [courses, setCourses] = useState([]);
  const [newAssign, setNewAssign] = useState({ course_id: '', title: '', description: '', due_date: '2026-12-05', max_score: 100 });
  const [newQuiz, setNewQuiz] = useState({ course_id: '', title: '', description: '', duration_minutes: 30, max_score: 100 });
  const [newQuestion, setNewQuestion] = useState({ quiz_id: '', question_text: '', optionsText: 'Option A, Option B, Option C, Option D', correct_answer: 'Option A', points: 10 });
  const [subText, setSubText] = useState({});
  const [gradeInputs, setGradeInputs] = useState({});
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});

  const [viewItem, setViewItem] = useState(null);
  const [editAssign, setEditAssign] = useState(null);
  const [editQuiz, setEditQuiz] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const q = activeChildId ? `?studentId=${activeChildId}` : '';
    const [aRes, qRes, cRes] = await Promise.all([
      apiRequest(`/api/academic/assignments${q}`),
      apiRequest(`/api/academic/quizzes${q}`),
      apiRequest('/api/courses?limit=50'),
    ]);
    setAssignData(aRes);
    setQuizData(qRes);
    setCourses(cRes.courses || []);
  }
  useEffect(() => {
    load();
  }, [activeChildId]);

  async function createAssign(e) {
    e.preventDefault();
    await apiRequest('/api/academic/assignments', { method: 'POST', body: newAssign });
    showNotice('Assignment published.');
    setNewAssign({ ...newAssign, title: '', description: '' });
    load();
  }

  async function saveEditAssign(e) {
    e.preventDefault();
    await apiRequest(`/api/academic/assignments/${editAssign.id}`, { method: 'PUT', body: editAssign });
    showNotice('Assignment updated.');
    setEditAssign(null);
    load();
  }

  async function createQuiz(e) {
    e.preventDefault();
    await apiRequest('/api/academic/quizzes', { method: 'POST', body: newQuiz });
    showNotice('Quiz published.');
    setNewQuiz({ ...newQuiz, title: '', description: '' });
    load();
  }

  async function saveEditQuiz(e) {
    e.preventDefault();
    await apiRequest(`/api/academic/quizzes/${editQuiz.id}`, { method: 'PUT', body: editQuiz });
    showNotice('Quiz updated.');
    setEditQuiz(null);
    load();
  }

  async function addQuestion(e) {
    e.preventDefault();
    const options = newQuestion.optionsText.split(',').map((o) => o.trim()).filter(Boolean);
    await apiRequest('/api/academic/questions', {
      method: 'POST',
      body: { ...newQuestion, options },
    });
    showNotice('Question added to bank.');
    setNewQuestion({ ...newQuestion, question_text: '' });
    load();
  }

  async function submitWork(assignmentId) {
    try {
      await apiRequest(`/api/academic/assignments/${assignmentId}/submit`, {
        method: 'POST',
        body: { submission_text: subText[assignmentId] || '', attachment_name: 'student-work.pdf' },
      });
      showNotice('Assignment submitted.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function gradeSub(subId) {
    const val = gradeInputs[subId] || {};
    await apiRequest(`/api/academic/submissions/${subId}/grade`, {
      method: 'POST',
      body: { score: Number(val.score || 90), feedback: val.feedback || 'Well done.' },
    });
    showNotice('Submission graded.');
    load();
  }

  async function submitQuizAttempt(e) {
    e.preventDefault();
    const res = await apiRequest(`/api/academic/quizzes/${activeQuiz.id}/attempt`, {
      method: 'POST',
      body: { answers: quizAnswers },
    });
    showNotice(res.message);
    setActiveQuiz(null);
    setQuizAnswers({});
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const url =
      deleteTarget.kind === 'assignment'
        ? `/api/academic/assignments/${deleteTarget.id}`
        : deleteTarget.kind === 'quiz'
          ? `/api/academic/quizzes/${deleteTarget.id}`
          : `/api/academic/questions/${deleteTarget.id}`;
    await apiRequest(url, { method: 'DELETE' });
    showNotice('Deleted successfully.');
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Assignments, Quizzes & Examinations"
        subtitle="Manage coursework submissions, evaluations, question banks, and online assessments."
        actions={
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button onClick={() => setTab('assignments')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'assignments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Assignments</button>
            <button onClick={() => setTab('quizzes')} className={`px-3 py-1.5 text-xs font-medium rounded-md ${tab === 'quizzes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Quizzes &amp; Exams</button>
          </div>
        }
      />

      {tab === 'assignments' ? (
        <div className="space-y-6">
          {canCreate && (
            <form onSubmit={createAssign} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
              <select required value={newAssign.course_id} onChange={(e) => setNewAssign({ ...newAssign, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Select Course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input required placeholder="Assignment Title" value={newAssign.title} onChange={(e) => setNewAssign({ ...newAssign, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input placeholder="Instructions" value={newAssign.description} onChange={(e) => setNewAssign({ ...newAssign, description: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="date" value={newAssign.due_date} onChange={(e) => setNewAssign({ ...newAssign, due_date: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <div className="flex justify-end">
                <IconActionButton icon={Plus} label="Publish assignment" type="submit" variant="primary" />
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-4">
            {assignData.assignments.map((a) => {
              const mySub = assignData.submissions.find((s) => s.assignment_id === a.id);
              return (
                <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 card-hover-lift">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">{a.course_title} · Due {a.due_date} · Max {a.max_score} pts</p>
                      <h3 className="font-display text-base font-semibold text-slate-900">{a.title}</h3>
                      <p className="text-sm text-slate-600 mt-1">{a.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {mySub && <StatusIndicator status={mySub.status} />}
                      <IconActionButton icon={Eye} label="Read assignment details" variant="info" onClick={() => setViewItem({ kind: 'Assignment', title: a.title, meta: `${a.course_title} · Due ${a.due_date} · Max ${a.max_score} pts`, body: a.description })} />
                      {canCreate && (
                        <>
                          <IconActionButton icon={Edit3} label="Edit assignment" onClick={() => setEditAssign({ ...a })} />
                          <IconActionButton icon={Trash2} label="Delete assignment" variant="danger" onClick={() => setDeleteTarget({ kind: 'assignment', id: a.id, label: a.title })} />
                        </>
                      )}
                    </div>
                  </div>

                  {user.role === 'Student' && (
                    mySub ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                        <p>Submitted: {mySub.submission_text}</p>
                        {mySub.score !== null && <p className="font-semibold text-emerald-700">Grade: {mySub.score}/{a.max_score} — {mySub.feedback}</p>}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          value={subText[a.id] || ''}
                          onChange={(e) => setSubText({ ...subText, [a.id]: e.target.value })}
                          placeholder="Enter solution summary or repository link..."
                          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                        <button onClick={() => submitWork(a.id)} className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">Submit</button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {canCreate && assignData.submissions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="font-display text-base font-semibold">Student Submissions &amp; Grading</h3>
              {assignData.submissions.map((s) => (
                <div key={s.id} className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold">{s.student_name} — {s.assignment_title}</p>
                    <p className="text-xs text-slate-600">{s.submission_text}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder={s.score ?? 'Score'}
                      onChange={(e) => setGradeInputs({ ...gradeInputs, [s.id]: { ...gradeInputs[s.id], score: e.target.value } })}
                      className="w-20 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg tabular-nums"
                    />
                    <input
                      placeholder={s.feedback || 'Feedback'}
                      onChange={(e) => setGradeInputs({ ...gradeInputs, [s.id]: { ...gradeInputs[s.id], feedback: e.target.value } })}
                      className="w-44 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <IconActionButton icon={Check} label="Save grade" variant="success" onClick={() => gradeSub(s.id)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {canCreate && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form onSubmit={createQuiz} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-semibold">Create Quiz / Exam</h4>
                  <IconActionButton icon={Plus} label="Publish quiz" type="submit" variant="primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select required value={newQuiz.course_id} onChange={(e) => setNewQuiz({ ...newQuiz, course_id: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="">Select Course</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <input required placeholder="Quiz Title" value={newQuiz.title} onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Description" value={newQuiz.description} onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })} className="col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                  <input type="number" placeholder="Mins" value={newQuiz.duration_minutes} onChange={(e) => setNewQuiz({ ...newQuiz, duration_minutes: Number(e.target.value) })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
              </form>

              <form onSubmit={addQuestion} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-sm font-semibold">Add Question Bank Item</h4>
                  <IconActionButton icon={Plus} label="Add question" type="submit" variant="primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select required value={newQuestion.quiz_id} onChange={(e) => setNewQuestion({ ...newQuestion, quiz_id: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white">
                    <option value="">Select Quiz</option>
                    {quizData.quizzes.map((qz) => <option key={qz.id} value={qz.id}>{qz.title}</option>)}
                  </select>
                  <input required placeholder="Question prompt..." value={newQuestion.question_text} onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input required placeholder="Comma-separated options" value={newQuestion.optionsText} onChange={(e) => setNewQuestion({ ...newQuestion, optionsText: e.target.value })} className="col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                  <input required placeholder="Correct option" value={newQuestion.correct_answer} onChange={(e) => setNewQuestion({ ...newQuestion, correct_answer: e.target.value })} className="px-3 py-2 text-xs border border-slate-300 rounded-lg" />
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizData.quizzes.map((q) => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 card-hover-lift">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{q.course_title} · {q.duration_minutes} mins · {q.max_score} pts</p>
                    <h3 className="font-display text-base font-semibold text-slate-900">{q.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconActionButton icon={Eye} label="Read quiz details" variant="info" onClick={() => setViewItem({ kind: 'Quiz / Exam', title: q.title, meta: `${q.course_title} · ${q.duration_minutes} mins · ${q.max_score} pts`, body: q.description })} />
                    {canCreate && (
                      <>
                        <IconActionButton icon={Edit3} label="Edit quiz" onClick={() => setEditQuiz({ ...q })} />
                        <IconActionButton icon={Trash2} label="Delete quiz" variant="danger" onClick={() => setDeleteTarget({ kind: 'quiz', id: q.id, label: q.title })} />
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-600">{q.description}</p>
                {user.role === 'Student' && (
                  <button onClick={() => setActiveQuiz(q)} className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg">
                    Start Assessment
                  </button>
                )}
              </div>
            ))}
          </div>

          {canCreate && quizData.questions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="font-display text-base font-semibold">Question Bank ({quizData.questions.length})</h3>
              <div className="divide-y divide-slate-100 text-xs">
                {quizData.questions.map((qq) => (
                  <div key={qq.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{qq.question_text}</p>
                      <p className="text-slate-500">Answer: {qq.correct_answer} · {qq.points} pts</p>
                    </div>
                    <IconActionButton icon={Trash2} label="Delete question" variant="danger" onClick={() => setDeleteTarget({ kind: 'question', id: qq.id, label: qq.question_text })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeQuiz && (
            <form onSubmit={submitQuizAttempt} className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-lg font-bold">{activeQuiz.title}</h3>
              {quizData.questions.filter((qq) => qq.quiz_id === activeQuiz.id).map((qq, idx) => {
                const opts = JSON.parse(qq.options_json || '[]');
                return (
                  <div key={qq.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <p className="text-sm font-medium text-slate-900">{idx + 1}. {qq.question_text}</p>
                    <div className="space-y-1.5">
                      {opts.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name={`q_${qq.id}`}
                            required
                            checked={quizAnswers[qq.id] === opt}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [qq.id]: opt })}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg">Submit Quiz</button>
            </form>
          )}

          {quizData.attempts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-display text-base font-semibold mb-3">Recent Quiz Results</h3>
              <div className="divide-y divide-slate-100 text-sm">
                {quizData.attempts.map((att) => (
                  <div key={att.id} className="py-2.5 flex items-center justify-between">
                    <span>{att.student_name} — {att.quiz_title}</span>
                    <span className="font-mono font-semibold tabular-nums">{att.score}/{att.max_score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.title}` : ''} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-slate-500">{viewItem.meta}</p>
            <p className="text-slate-700">{viewItem.body || 'No extra description.'}</p>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editAssign)} onClose={() => setEditAssign(null)} title="Edit Assignment" maxWidth="max-w-md">
        {editAssign && (
          <form onSubmit={saveEditAssign} className="space-y-3">
            <input required value={editAssign.title} onChange={(e) => setEditAssign({ ...editAssign, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <textarea rows={2} value={editAssign.description || ''} onChange={(e) => setEditAssign({ ...editAssign, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editAssign.due_date} onChange={(e) => setEditAssign({ ...editAssign, due_date: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" value={editAssign.max_score} onChange={(e) => setEditAssign({ ...editAssign, max_score: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditAssign(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editQuiz)} onClose={() => setEditQuiz(null)} title="Edit Quiz" maxWidth="max-w-md">
        {editQuiz && (
          <form onSubmit={saveEditQuiz} className="space-y-3">
            <input required value={editQuiz.title} onChange={(e) => setEditQuiz({ ...editQuiz, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <textarea rows={2} value={editQuiz.description || ''} onChange={(e) => setEditQuiz({ ...editQuiz, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={editQuiz.duration_minutes} onChange={(e) => setEditQuiz({ ...editQuiz, duration_minutes: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" value={editQuiz.max_score} onChange={(e) => setEditQuiz({ ...editQuiz, max_score: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditQuiz(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Item"
        message={`Delete "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function GradesCertificatesPanel({ showNotice, activeChildId, mode = 'grades' }) {
  const { user } = useAuth();
  const canEdit = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const canIssueCert = ['Owner', 'Admin'].includes(user.role);
  const [grades, setGrades] = useState([]);
  const [certs, setCerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [gradeForm, setGradeForm] = useState({ student_id: '', course_id: '', assessment_name: '', assessment_type: 'Exam', score: 90, max_score: 100, remarks: '' });
  const [certForm, setCertForm] = useState({ student_id: '', course_id: '' });

  const [viewGrade, setViewGrade] = useState(null);
  const [editGrade, setEditGrade] = useState(null);
  const [viewCert, setViewCert] = useState(null);
  const [editCert, setEditCert] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const q = activeChildId ? `?studentId=${activeChildId}` : '';
    const [gRes, cRes] = await Promise.all([
      apiRequest(`/api/academic/grades${q}`),
      apiRequest(`/api/academic/certificates${q}`),
    ]);
    setGrades(gRes.grades || []);
    setCerts(cRes.certificates || []);
    if (canEdit) {
      const [uRes, crRes] = await Promise.all([apiRequest('/api/dashboard/users?role=Student'), apiRequest('/api/courses?limit=50')]);
      setStudents(uRes.users || []);
      setCourses(crRes.courses || []);
    }
  }
  useEffect(() => {
    load();
  }, [activeChildId]);

  async function addGrade(e) {
    e.preventDefault();
    await apiRequest('/api/academic/grades', { method: 'POST', body: gradeForm });
    showNotice('Grade recorded.');
    setGradeForm({ ...gradeForm, assessment_name: '', remarks: '' });
    load();
  }

  async function saveEditGrade(e) {
    e.preventDefault();
    await apiRequest(`/api/academic/grades/${editGrade.id}`, { method: 'PUT', body: editGrade });
    showNotice('Grade updated.');
    setEditGrade(null);
    load();
  }

  async function issueCert(e) {
    e.preventDefault();
    await apiRequest('/api/academic/certificates', { method: 'POST', body: certForm });
    showNotice('Certificate issued.');
    load();
  }

  async function saveEditCert(e) {
    e.preventDefault();
    await apiRequest(`/api/academic/certificates/${editCert.id}`, { method: 'PUT', body: editCert });
    showNotice('Certificate updated.');
    setEditCert(null);
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const url =
      deleteTarget.kind === 'grade'
        ? `/api/academic/grades/${deleteTarget.id}`
        : `/api/academic/certificates/${deleteTarget.id}`;
    await apiRequest(url, { method: 'DELETE' });
    showNotice('Record deleted.');
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title={mode === 'certificates' ? 'Academic Certificates' : 'Grades & Report Cards'}
        subtitle="Verified assessment marks, grade averages, and printable certificates."
        actions={
          <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-slate-300 bg-white rounded-lg hover:bg-slate-50">
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        }
      />

      {mode !== 'certificates' && (
        <>
          {canEdit && (
            <form onSubmit={addGrade} className="no-print bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
              <select required value={gradeForm.student_id} onChange={(e) => setGradeForm({ ...gradeForm, student_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
              <select required value={gradeForm.course_id} onChange={(e) => setGradeForm({ ...gradeForm, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="">Course</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input required placeholder="Assessment Name" value={gradeForm.assessment_name} onChange={(e) => setGradeForm({ ...gradeForm, assessment_name: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" required placeholder="Score" value={gradeForm.score} onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums" />
              <input placeholder="Remarks" value={gradeForm.remarks} onChange={(e) => setGradeForm({ ...gradeForm, remarks: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <div className="flex justify-end">
                <IconActionButton icon={Plus} label="Record grade" type="submit" variant="primary" />
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Assessment</th>
                  <th className="py-3 px-4 text-right">Score</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-4 text-right">CRUD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map((g) => (
                  <tr key={g.id}>
                    <td className="py-3 px-4 font-medium">{g.student_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{g.course_title}</td>
                    <td className="py-3 px-4 text-xs">{g.assessment_name} ({g.assessment_type})</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{g.score}/{g.max_score}</td>
                    <td className="py-3 px-4 font-display font-bold text-blue-700">{g.letter_grade}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{g.remarks}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconActionButton icon={Eye} label="Read grade report" variant="info" onClick={() => setViewGrade(g)} />
                        {canEdit && (
                          <>
                            <IconActionButton icon={Edit3} label="Edit grade" onClick={() => setEditGrade({ ...g })} />
                            <IconActionButton icon={Trash2} label="Delete grade" variant="danger" onClick={() => setDeleteTarget({ kind: 'grade', id: g.id, label: `${g.student_name} - ${g.assessment_name}` })} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Certificates */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-slate-900">Issued Certificates</h3>
        {canIssueCert && (
          <form onSubmit={issueCert} className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
            <select required value={certForm.student_id} onChange={(e) => setCertForm({ ...certForm, student_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            <select required value={certForm.course_id} onChange={(e) => setCertForm({ ...certForm, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="">Select Course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <IconActionButton icon={Plus} label="Issue certificate" type="submit" variant="primary" />
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certs.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-6 flex items-start justify-between gap-4 card-hover-lift">
              <div>
                <p className="text-xs font-mono text-blue-700">{c.certificate_code}</p>
                <h4 className="mt-1 font-display text-lg font-bold text-slate-900">{c.course_title}</h4>
                <p className="text-sm text-slate-600 mt-1">Awarded to <span className="font-semibold text-slate-900">{c.student_name}</span></p>
                <p className="text-xs text-slate-500 mt-2">Issued {c.issued_at?.slice(0, 10)}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Award className="w-7 h-7 text-amber-600" />
                <div className="inline-flex items-center gap-1">
                  <IconActionButton icon={Eye} label="View printable certificate" variant="info" onClick={() => setViewCert(c)} />
                  {canIssueCert && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit certificate" onClick={() => setEditCert({ ...c })} />
                      <IconActionButton icon={Trash2} label="Revoke certificate" variant="danger" onClick={() => setDeleteTarget({ kind: 'cert', id: c.id, label: c.certificate_code })} />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ModalFrame open={Boolean(viewGrade)} onClose={() => setViewGrade(null)} title="Grade Evaluation Detail" maxWidth="max-w-md">
        {viewGrade && (
          <div className="space-y-2 text-sm">
            <p><strong>Student:</strong> {viewGrade.student_name} ({viewGrade.student_code})</p>
            <p><strong>Course:</strong> {viewGrade.course_title}</p>
            <p><strong>Assessment:</strong> {viewGrade.assessment_name} ({viewGrade.assessment_type})</p>
            <p><strong>Score:</strong> {viewGrade.score}/{viewGrade.max_score} — <span className="font-bold text-blue-700">{viewGrade.letter_grade}</span></p>
            <p><strong>Remarks:</strong> {viewGrade.remarks || '—'}</p>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editGrade)} onClose={() => setEditGrade(null)} title="Edit Grade Record" maxWidth="max-w-md">
        {editGrade && (
          <form onSubmit={saveEditGrade} className="space-y-3">
            <input required value={editGrade.assessment_name} onChange={(e) => setEditGrade({ ...editGrade, assessment_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" required value={editGrade.score} onChange={(e) => setEditGrade({ ...editGrade, score: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <input type="number" required value={editGrade.max_score} onChange={(e) => setEditGrade({ ...editGrade, max_score: Number(e.target.value) })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <input value={editGrade.remarks || ''} onChange={(e) => setEditGrade({ ...editGrade, remarks: e.target.value })} placeholder="Remarks" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditGrade(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(viewCert)} onClose={() => setViewCert(null)} title="Official Ezana Academy Certificate" maxWidth="max-w-lg">
        {viewCert && (
          <div className="border-4 border-double border-slate-300 rounded-xl p-6 text-center space-y-3 bg-slate-50">
            <p className="text-xs font-mono tracking-widest uppercase text-blue-700">{viewCert.certificate_code}</p>
            <h3 className="font-display text-xl font-bold text-slate-900">{viewCert.template_name || 'Certificate of Completion'}</h3>
            <p className="text-xs text-slate-600">This certifies that</p>
            <p className="font-display text-2xl font-bold text-slate-900">{viewCert.student_name}</p>
            <p className="text-xs text-slate-600">has successfully completed the curriculum requirements for</p>
            <p className="font-display text-lg font-semibold text-blue-800">{viewCert.course_title}</p>
            <p className="text-xs text-slate-500 pt-2">Issued {viewCert.issued_at?.slice(0, 10)} · Ezana Academy</p>
            <div className="pt-3 flex justify-center">
              <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg">
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
            </div>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editCert)} onClose={() => setEditCert(null)} title="Edit Certificate Metadata" maxWidth="max-w-md">
        {editCert && (
          <form onSubmit={saveEditCert} className="space-y-3">
            <input required value={editCert.template_name || ''} onChange={(e) => setEditCert({ ...editCert, template_name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={editCert.status || 'Issued'} onChange={(e) => setEditCert({ ...editCert, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option value="Issued">Issued</option>
              <option value="Revoked">Revoked</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditCert(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Record"
        message={`Permanently delete "${deleteTarget?.label}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function ResourcesPanel({ showNotice }) {
  const { user } = useAuth();
  const canUpload = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const [resources, setResources] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ title: '', course_id: '', resource_type: 'PDF', description: '' });
  const [viewRes, setViewRes] = useState(null);
  const [editRes, setEditRes] = useState(null);
  const [deleteRes, setDeleteRes] = useState(null);

  async function load() {
    const [r, c] = await Promise.all([apiRequest('/api/academic/resources'), apiRequest('/api/courses?limit=50')]);
    setResources(r.resources || []);
    setCourses(c.courses || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function uploadResource(e) {
    e.preventDefault();
    await apiRequest('/api/academic/resources', { method: 'POST', body: form });
    showNotice('Resource added.');
    setForm({ title: '', course_id: '', resource_type: 'PDF', description: '' });
    load();
  }

  async function saveEditRes(e) {
    e.preventDefault();
    await apiRequest(`/api/academic/resources/${editRes.id}`, { method: 'PUT', body: editRes });
    showNotice('Resource updated.');
    setEditRes(null);
    load();
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="E-Learning Resources" subtitle="Downloadable course handbooks, lecture slides, and study materials." />
      {canUpload && (
        <form onSubmit={uploadResource} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
          <input required placeholder="Resource Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option value="">All Courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option>PDF</option>
            <option>Document</option>
            <option>Presentation</option>
            <option>Study Guide</option>
          </select>
          <input placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <div className="flex justify-end">
            <IconActionButton icon={Plus} label="Add learning resource" type="submit" variant="primary" />
          </div>
        </form>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4 card-hover-lift">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{r.resource_type} · {r.course_title || 'General Library'}</p>
              <h4 className="font-display text-base font-semibold text-slate-900 mt-0.5 truncate">{r.title}</h4>
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{r.description}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={r.file_url}
                download={r.file_name}
                title="Download resource"
                aria-label="Download resource"
                className="inline-flex items-center justify-center p-1.5 rounded-md border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              <IconActionButton icon={Eye} label="Read resource details" variant="info" onClick={() => setViewRes(r)} />
              {canUpload && (
                <>
                  <IconActionButton icon={Edit3} label="Edit resource" onClick={() => setEditRes({ ...r })} />
                  <IconActionButton icon={Trash2} label="Delete resource" variant="danger" onClick={() => setDeleteRes(r)} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <ModalFrame open={Boolean(viewRes)} onClose={() => setViewRes(null)} title={viewRes?.title || 'Resource'} maxWidth="max-w-md">
        {viewRes && (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-slate-500">{viewRes.resource_type} · {viewRes.course_title || 'General Library'}</p>
            <p className="text-slate-700">{viewRes.description || 'No description provided.'}</p>
            <p className="text-xs font-mono text-slate-500">File: {viewRes.file_name}</p>
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editRes)} onClose={() => setEditRes(null)} title="Edit Resource" maxWidth="max-w-md">
        {editRes && (
          <form onSubmit={saveEditRes} className="space-y-3">
            <input required value={editRes.title} onChange={(e) => setEditRes({ ...editRes, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={editRes.resource_type} onChange={(e) => setEditRes({ ...editRes, resource_type: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              <option>PDF</option>
              <option>Document</option>
              <option>Presentation</option>
              <option>Study Guide</option>
            </select>
            <textarea rows={2} value={editRes.description || ''} onChange={(e) => setEditRes({ ...editRes, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditRes(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteRes)}
        title="Delete Resource"
        message={`Delete "${deleteRes?.title}"?`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await apiRequest(`/api/academic/resources/${deleteRes.id}`, { method: 'DELETE' });
          setDeleteRes(null);
          showNotice('Resource deleted.');
          load();
        }}
        onCancel={() => setDeleteRes(null)}
      />
    </div>
  );
}

export function EnrollmentsPanel({ showNotice }) {
  const { user } = useAuth();
  const isAdminOrOwner = ['Owner', 'Admin'].includes(user.role);
  const [data, setData] = useState({ enrollments: [], requests: [] });
  const [proRequests, setProRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ student_id: '', course_id: '' });
  const [viewItem, setViewItem] = useState(null);
  const [deleteEnroll, setDeleteEnroll] = useState(null);

  async function load() {
    const [eRes, uRes, cRes, pRes] = await Promise.all([
      apiRequest('/api/academic/enrollments'),
      apiRequest('/api/dashboard/users?role=Student'),
      apiRequest('/api/courses?limit=50'),
      apiRequest('/api/finance/ezana-pro/requests').catch(() => ({ requests: [] })),
    ]);
    setData(eRes);
    setStudents(uRes.users || []);
    setCourses(cRes.courses || []);
    setProRequests(pRes.requests || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function directEnroll(e) {
    e.preventDefault();
    await apiRequest('/api/academic/enrollments/direct', { method: 'POST', body: form });
    showNotice('Student enrolled.');
    load();
  }

  async function reviewReq(id, status) {
    await apiRequest(`/api/academic/enrollment-requests/${id}`, { method: 'PATCH', body: { status } });
    showNotice(`Request ${status.toLowerCase()}.`);
    load();
  }

  async function reviewProReq(id, status) {
    try {
      const res = await apiRequest(`/api/finance/ezana-pro/requests/${id}`, { method: 'PATCH', body: { status } });
      showNotice(res.message);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader title="Enrollment Management" subtitle="Direct student course enrollment and pending request approvals." />

      {isAdminOrOwner && (
        <form onSubmit={directEnroll} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap gap-3 items-center">
          <select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option value="">Select Student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_code})</option>)}
          </select>
          <select required value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
            <option value="">Select Course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <IconActionButton icon={Plus} label="Enroll student" type="submit" variant="primary" />
        </form>
      )}

      {proRequests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Ezana Pro Course Upgrade Requests (ETB 218)</h3>
          {proRequests.map((r) => (
            <div key={r.id} className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{r.student_name} &rarr; {r.course_title}</p>
                <p className="text-xs text-slate-500">
                  {r.student_email} · {r.payment_method || 'Ye-Buna'}
                  {r.payment_reference ? ` · Ref: ${r.payment_reference}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusIndicator status={r.status} />
                <IconActionButton icon={Eye} label="Read Pro request" variant="info" onClick={() => setViewItem({ kind: 'Ezana Pro Request', title: `${r.student_name} — ${r.course_title}`, meta: `${formatEtb(r.amount_etb || 218)} · ${r.payment_method || 'Ye-Buna'} · Ref: ${r.payment_reference || 'Pending'}`, status: r.status })} />
                {isAdminOrOwner && r.status === 'Pending' && (
                  <>
                    <IconActionButton icon={Check} label="Approve Pro upgrade" variant="success" onClick={() => reviewProReq(r.id, 'Approved')} />
                    <IconActionButton icon={X} label="Reject Pro upgrade" variant="danger" onClick={() => reviewProReq(r.id, 'Rejected')} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.requests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-base font-semibold">Enrollment Requests</h3>
          {data.requests.map((r) => (
            <div key={r.id} className="p-3.5 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold">{r.student_name} &rarr; {r.course_title}</p>
                <p className="text-xs text-slate-500">{r.notes}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusIndicator status={r.status} />
                {isAdminOrOwner && r.status === 'Pending' && (
                  <>
                    <IconActionButton icon={Check} label="Approve enrollment" variant="success" onClick={() => reviewReq(r.id, 'Approved')} />
                    <IconActionButton icon={X} label="Reject enrollment" variant="danger" onClick={() => reviewReq(r.id, 'Rejected')} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Course</th>
              <th className="py-3 px-4">Enrolled Date</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">CRUD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.enrollments.map((e) => (
              <tr key={e.id}>
                <td className="py-3 px-4 font-medium">{e.student_name} <span className="text-xs text-slate-500 font-mono">{e.student_code}</span></td>
                <td className="py-3 px-4">{e.course_title}</td>
                <td className="py-3 px-4 text-xs font-mono tabular-nums">{e.enrolled_at?.slice(0, 10)}</td>
                <td className="py-3 px-4"><StatusIndicator status={e.status} /></td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <IconActionButton icon={Eye} label="Read enrollment" variant="info" onClick={() => setViewItem({ kind: 'Course Enrollment', title: `${e.student_name} (${e.student_code})`, meta: `Course: ${e.course_title} · Enrolled: ${e.enrolled_at?.slice(0, 10)}`, status: e.status })} />
                    {isAdminOrOwner && (
                      <IconActionButton icon={Trash2} label="Remove enrollment" variant="danger" onClick={() => setDeleteEnroll(e)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.title}` : ''} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">{viewItem.meta}</p>
            {viewItem.status && <StatusIndicator status={viewItem.status} />}
          </div>
        )}
      </ModalFrame>

      <ConfirmModal
        open={Boolean(deleteEnroll)}
        title="Remove Enrollment"
        message={`Unenroll ${deleteEnroll?.student_name} from "${deleteEnroll?.course_title}"?`}
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          await apiRequest(`/api/academic/enrollments/${deleteEnroll.id}`, { method: 'DELETE' });
          setDeleteEnroll(null);
          showNotice('Enrollment removed.');
          load();
        }}
        onCancel={() => setDeleteEnroll(null)}
      />
    </div>
  );
}
