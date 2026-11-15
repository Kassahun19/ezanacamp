import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Edit3, Eye, Plus, RefreshCw, Trash2, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, formatEtb } from '../utils/api.jsx';
import {
  ConfirmModal,
  EmptyState,
  IconActionButton,
  LoadingRows,
  ModalFrame,
  SectionHeader,
  StatusIndicator,
} from '../components/UiPrimitives.jsx';
import YouTubeImportModal from './YouTubeImportModal.jsx';

const DEFAULT_NEW_COURSE = {
  title: '',
  description: '',
  learning_objectives: '',
  prerequisites: '',
  target_audience: '',
  estimated_duration: '6h 30m',
  thumbnail_url: '/src/assets/images/course_web_engineering_1794751963554.jpg',
  category_id: '',
  subject_id: '',
  level: 'Beginner',
  language: 'English',
  instructor_id: '',
  status: 'Published',
  visibility: 'Public',
  tagsText: '',
};

export function CourseManagementPanel({ showNotice, onOpenCourse, initialAction = '' }) {
  const { user } = useAuth();
  const canManageCourses = ['Owner', 'Admin', 'Instructor'].includes(user.role);
  const canDeleteCourses = ['Owner', 'Admin'].includes(user.role);

  const [courses, setCourses] = useState([]);
  const [meta, setMeta] = useState({ categories: [], levels: [], subjects: [], instructors: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(initialAction === 'create');
  const [ytImportOpen, setYtImportOpen] = useState(false);
  const [viewingCourse, setViewingCourse] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [lessonsDrawerCourse, setLessonsDrawerCourse] = useState(null);
  const [courseLessons, setCourseLessons] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [newCourse, setNewCourse] = useState(DEFAULT_NEW_COURSE);
  const [newLesson, setNewLesson] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    instructor_notes: '',
    youtube_video_id: '',
    duration_label: '12:00',
    duration_seconds: 720,
  });
  const [viewingLesson, setViewingLesson] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [deleteLessonTarget, setDeleteLessonTarget] = useState(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [cData, mData] = await Promise.all([
        apiRequest(`/api/courses?includeAllStatuses=true&limit=100&search=${encodeURIComponent(search)}`),
        apiRequest('/api/courses/meta'),
      ]);
      setCourses(cData.courses || []);
      setMeta(mData);
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [search]);

  async function handleViewCourse(course) {
    try {
      const detail = await apiRequest(`/api/courses/${course.id}`);
      setViewingCourse({ ...course, ...detail.course, lessons: detail.lessons || [] });
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  function openEditCourse(c) {
    let tagsText = '';
    try {
      const parsed = JSON.parse(c.tags_json || '[]');
      if (Array.isArray(parsed)) tagsText = parsed.join(', ');
    } catch {
      tagsText = '';
    }
    setEditingCourse({
      ...c,
      category_id: c.category_id ? String(c.category_id) : '',
      subject_id: c.subject_id ? String(c.subject_id) : '',
      instructor_id: c.instructor_id ? String(c.instructor_id) : '',
      tagsText,
    });
  }

  async function handleCreateManual(e) {
    e.preventDefault();
    try {
      const tags = (newCourse.tagsText || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await apiRequest('/api/academic/courses', {
        method: 'POST',
        body: { ...newCourse, tags },
      });
      showNotice(res.message);
      setCreateOpen(false);
      setNewCourse(DEFAULT_NEW_COURSE);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleUpdateCourse(e) {
    e.preventDefault();
    try {
      const tags = (editingCourse.tagsText || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await apiRequest(`/api/academic/courses/${editingCourse.id}`, {
        method: 'PUT',
        body: { ...editingCourse, tags },
      });
      showNotice(res.message);
      setEditingCourse(null);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleDeleteCourse() {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/academic/courses/${deleteTarget.id}`, { method: 'DELETE' });
      showNotice('Course deleted.');
      setDeleteTarget(null);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function openLessonsModal(course) {
    setLessonsDrawerCourse(course);
    try {
      const d = await apiRequest(`/api/courses/${course.id}`);
      setCourseLessons(d.lessons || []);
      if (course.source_type === 'YouTube') {
        const logs = await apiRequest(`/api/youtube/courses/${course.id}/sync-logs`).catch(() => ({ logs: [] }));
        setSyncLogs(logs.logs || []);
      } else {
        setSyncLogs([]);
      }
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleAddLesson(e) {
    e.preventDefault();
    if (!lessonsDrawerCourse) return;
    try {
      await apiRequest(`/api/academic/courses/${lessonsDrawerCourse.id}/lessons`, {
        method: 'POST',
        body: newLesson,
      });
      showNotice('Lesson added.');
      setNewLesson({
        title: '',
        description: '',
        learning_objectives: '',
        instructor_notes: '',
        youtube_video_id: '',
        duration_label: '12:00',
        duration_seconds: 720,
      });
      openLessonsModal(lessonsDrawerCourse);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleUpdateLesson(e) {
    e.preventDefault();
    if (!editingLesson) return;
    try {
      await apiRequest(`/api/academic/lessons/${editingLesson.id}`, {
        method: 'PUT',
        body: editingLesson,
      });
      showNotice('Lesson updated.');
      setEditingLesson(null);
      openLessonsModal(lessonsDrawerCourse);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function moveLesson(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= courseLessons.length) return;
    const copy = [...courseLessons];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setCourseLessons(copy);
    await apiRequest(`/api/academic/courses/${lessonsDrawerCourse.id}/lessons/reorder`, {
      method: 'PUT',
      body: { orderedLessonIds: copy.map((l) => l.id) },
    });
    showNotice('Lesson order saved.');
  }

  async function confirmRemoveLesson() {
    if (!deleteLessonTarget) return;
    try {
      await apiRequest(`/api/academic/lessons/${deleteLessonTarget.id}`, { method: 'DELETE' });
      showNotice('Lesson removed from course.');
      setDeleteLessonTarget(null);
      openLessonsModal(lessonsDrawerCourse);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleSyncCourse(courseId) {
    try {
      const res = await apiRequest(`/api/youtube/courses/${courseId}/sync`, { method: 'POST', body: {} });
      showNotice(`Synced: ${res.added} added, ${res.updated} updated, ${res.unavailable} unavailable.`);
      loadAll();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Course Management"
        subtitle="Create courses manually or import eligible public tutorial playlists via YouTube Data API v3."
        actions={
          canManageCourses && (
            <>
              <button
                onClick={() => setYtImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap transition-colors"
              >
                <Video className="w-4 h-4" />
                <span>Import from YouTube Channel</span>
              </button>
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg whitespace-nowrap transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Manual Course</span>
              </button>
            </>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses..."
          className="w-full sm:w-80 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
        />
        <span className="text-xs text-slate-500 tabular-nums">{courses.length} total courses</span>
      </div>

      {loading ? (
        <LoadingRows count={5} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses found"
          description="Create a course manually or import a YouTube channel curriculum."
          actionLabel={canManageCourses ? 'Create Manual Course' : undefined}
          onAction={canManageCourses ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Course Title</th>
                <th className="py-3 px-4">Category &amp; Level</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4 text-right">Lessons</th>
                <th className="py-3 px-4 text-right">Ezana Pro</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">CRUD Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((c) => {
                const isOwnCourse = user.role === 'Instructor' && (c.instructor_id === user.id || c.created_by === user.id);
                const allowEdit = ['Owner', 'Admin'].includes(user.role) || isOwnCourse;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onOpenCourse(c.id)}
                        className="font-semibold text-slate-900 hover:text-blue-700 text-left"
                      >
                        {c.title}
                      </button>
                      <p className="text-xs text-slate-500">{c.instructor_name || 'Unassigned'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {c.category_name || 'General'} · {c.level}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{c.source_type}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{c.lesson_count}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatEtb(c.pro_price_etb)}</td>
                    <td className="py-3 px-4"><StatusIndicator status={c.status} /></td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <IconActionButton
                          icon={Eye}
                          label="Read course details"
                          variant="info"
                          onClick={() => handleViewCourse(c)}
                        />
                        {allowEdit && (
                          <IconActionButton
                            icon={BookOpen}
                            label="Manage curriculum & lessons"
                            onClick={() => openLessonsModal(c)}
                          />
                        )}
                        {allowEdit && c.source_type === 'YouTube' && (
                          <IconActionButton
                            icon={RefreshCw}
                            label="Sync channel videos"
                            onClick={() => handleSyncCourse(c.id)}
                          />
                        )}
                        {allowEdit && (
                          <IconActionButton
                            icon={Edit3}
                            label="Update course"
                            onClick={() => openEditCourse(c)}
                          />
                        )}
                        {canDeleteCourses && (
                          <IconActionButton
                            icon={Trash2}
                            label="Delete course"
                            variant="danger"
                            onClick={() => setDeleteTarget(c)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Create Modal — Exact parity with "Import from YouTube Channel" Step 3 fields minus API Key & Channel ID */}
      <ModalFrame
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Manual Course"
        subtitle="Ezana Academy Course Identity (All curriculum metadata fields; YouTube API Key & Channel ID are exclusive to YouTube Import)"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateManual} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Ezana Academy Course Title *</label>
              <input
                required
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                placeholder="e.g., Applied Python & Data Systems"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Course Description *</label>
              <textarea
                required
                rows={3}
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                placeholder="Describe syllabus, practical outcomes, and curriculum structure..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={newCourse.category_id}
                onChange={(e) => setNewCourse({ ...newCourse, category_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select Category</option>
                {(meta.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
              <select
                value={newCourse.subject_id}
                onChange={(e) => setNewCourse({ ...newCourse, subject_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select Subject</option>
                {(meta.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Level</label>
              <select
                value={newCourse.level}
                onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {(meta.levels || [{ name: 'Beginner' }, { name: 'Intermediate' }, { name: 'Advanced' }]).map((l) => (
                  <option key={l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Ezana Instructor</label>
              <select
                value={newCourse.instructor_id}
                onChange={(e) => setNewCourse({ ...newCourse, instructor_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Default (Current User)</option>
                {(meta.instructors || []).map((i) => (
                  <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Language &amp; Status</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newCourse.language}
                  onChange={(e) => setNewCourse({ ...newCourse, language: e.target.value })}
                  placeholder="Language"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <select
                  value={newCourse.status}
                  onChange={(e) => setNewCourse({ ...newCourse, status: e.target.value })}
                  className="px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Visibility &amp; Estimated Duration</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newCourse.visibility}
                  onChange={(e) => setNewCourse({ ...newCourse, visibility: e.target.value })}
                  className="px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                  <option value="Cohort Only">Cohort Only</option>
                </select>
                <input
                  value={newCourse.estimated_duration}
                  onChange={(e) => setNewCourse({ ...newCourse, estimated_duration: e.target.value })}
                  placeholder="e.g., 6h 30m"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Cover Thumbnail URL (optional override)</label>
              <input
                value={newCourse.thumbnail_url}
                onChange={(e) => setNewCourse({ ...newCourse, thumbnail_url: e.target.value })}
                placeholder="/src/assets/images/course_web_engineering_1794751963554.jpg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Prerequisites</label>
              <input
                value={newCourse.prerequisites}
                onChange={(e) => setNewCourse({ ...newCourse, prerequisites: e.target.value })}
                placeholder="e.g., Basic algebra or computer literacy"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
              <input
                value={newCourse.target_audience}
                onChange={(e) => setNewCourse({ ...newCourse, target_audience: e.target.value })}
                placeholder="e.g., University students, software trainees"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Learning Objectives &amp; Tags</label>
              <input
                value={newCourse.learning_objectives}
                onChange={(e) => setNewCourse({ ...newCourse, learning_objectives: e.target.value })}
                placeholder="Key skills students will master..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2"
              />
              <input
                value={newCourse.tagsText}
                onChange={(e) => setNewCourse({ ...newCourse, tagsText: e.target.value })}
                placeholder="Comma-separated tags (e.g., Python, Algorithms, Backend)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">Pricing preserved: First 5 lessons free · Ezana Pro ETB 218</span>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg">Create Course</button>
            </div>
          </div>
        </form>
      </ModalFrame>

      {/* Read Course Details Modal */}
      <ModalFrame
        open={Boolean(viewingCourse)}
        onClose={() => setViewingCourse(null)}
        title={viewingCourse?.title || 'Course Details'}
        subtitle="Full course syllabus metadata and tutorial breakdown"
        maxWidth="max-w-2xl"
      >
        {viewingCourse && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
              <div><span className="text-slate-500 block">Category</span><strong>{viewingCourse.category_name || 'General'}</strong></div>
              <div><span className="text-slate-500 block">Level &amp; Language</span><strong>{viewingCourse.level} · {viewingCourse.language}</strong></div>
              <div><span className="text-slate-500 block">Visibility</span><strong>{viewingCourse.visibility || 'Public'}</strong></div>
              <div><span className="text-slate-500 block">Duration</span><strong>{viewingCourse.estimated_duration || 'Self-paced'}</strong></div>
              <div><span className="text-slate-500 block">Ezana Pro Price</span><strong>{formatEtb(viewingCourse.pro_price_etb)}</strong></div>
              <div><span className="text-slate-500 block">Status</span><StatusIndicator status={viewingCourse.status} /></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1">Description</p>
              <p className="text-slate-700 leading-relaxed">{viewingCourse.description || '—'}</p>
            </div>
            {viewingCourse.learning_objectives && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Learning Objectives</p>
                <p className="text-slate-600">{viewingCourse.learning_objectives}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-700 block mb-0.5">Prerequisites</span>
                <span className="text-slate-600">{viewingCourse.prerequisites || 'None specified'}</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="font-semibold text-slate-700 block mb-0.5">Target Audience</span>
                <span className="text-slate-600">{viewingCourse.target_audience || 'All learners'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500">{(viewingCourse.lessons || []).length} lessons in curriculum</span>
              <button
                onClick={() => {
                  const id = viewingCourse.id;
                  setViewingCourse(null);
                  onOpenCourse(id);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg"
              >
                Open Course Player
              </button>
            </div>
          </div>
        )}
      </ModalFrame>

      {/* Edit Course Modal */}
      <ModalFrame open={Boolean(editingCourse)} onClose={() => setEditingCourse(null)} title="Edit Course & Publication Workflow" maxWidth="max-w-3xl">
        {editingCourse && (
          <form onSubmit={handleUpdateCourse} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                <input required value={editingCourse.title} onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={editingCourse.description || ''} onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select value={editingCourse.category_id} onChange={(e) => setEditingCourse({ ...editingCourse, category_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  <option value="">Select Category</option>
                  {(meta.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                <select value={editingCourse.subject_id} onChange={(e) => setEditingCourse({ ...editingCourse, subject_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  <option value="">Select Subject</option>
                  {(meta.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Approval / Publication Status</label>
                <select value={editingCourse.status} onChange={(e) => setEditingCourse({ ...editingCourse, status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  <option value="Draft">Draft</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Changes Requested">Changes Requested</option>
                  <option value="Approved">Approved</option>
                  <option value="Published">Published</option>
                  <option value="Unpublished">Unpublished</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Level</label>
                <select value={editingCourse.level} onChange={(e) => setEditingCourse({ ...editingCourse, level: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  {meta.levels.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Instructor</label>
                <select value={editingCourse.instructor_id} onChange={(e) => setEditingCourse({ ...editingCourse, instructor_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                  <option value="">Unassigned</option>
                  {(meta.instructors || []).map((i) => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Visibility &amp; Duration</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={editingCourse.visibility || 'Public'} onChange={(e) => setEditingCourse({ ...editingCourse, visibility: e.target.value })} className="px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    <option value="Public">Public</option>
                    <option value="Private">Private</option>
                    <option value="Cohort Only">Cohort Only</option>
                  </select>
                  <input value={editingCourse.estimated_duration || ''} onChange={(e) => setEditingCourse({ ...editingCourse, estimated_duration: e.target.value })} placeholder="Duration" className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Prerequisites</label>
                <input value={editingCourse.prerequisites || ''} onChange={(e) => setEditingCourse({ ...editingCourse, prerequisites: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
                <input value={editingCourse.target_audience || ''} onChange={(e) => setEditingCourse({ ...editingCourse, target_audience: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Learning Objectives</label>
                <input value={editingCourse.learning_objectives || ''} onChange={(e) => setEditingCourse({ ...editingCourse, learning_objectives: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Cover Thumbnail URL &amp; Tags</label>
                <input value={editingCourse.thumbnail_url || ''} onChange={(e) => setEditingCourse({ ...editingCourse, thumbnail_url: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2" />
                <input value={editingCourse.tagsText || ''} onChange={(e) => setEditingCourse({ ...editingCourse, tagsText: e.target.value })} placeholder="Comma-separated tags" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button type="button" onClick={() => setEditingCourse(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Changes</button>
            </div>
          </form>
        )}
      </ModalFrame>

      {/* Lessons & Sync History Modal */}
      <ModalFrame
        open={Boolean(lessonsDrawerCourse)}
        onClose={() => setLessonsDrawerCourse(null)}
        title={lessonsDrawerCourse ? `Curriculum: ${lessonsDrawerCourse.title}` : 'Curriculum'}
        maxWidth="max-w-3xl"
      >
        {lessonsDrawerCourse && (
          <div className="space-y-6">
            <div className="space-y-2 max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {courseLessons.map((l, idx) => (
                <div key={l.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{idx + 1}. {l.title}</p>
                    <p className="text-xs text-slate-500">
                      {l.duration_label} · {idx < 5 ? 'Free Tier' : 'Ezana Pro (ETB 218)'} · {l.availability_status}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconActionButton icon={Eye} label="View lesson details" variant="info" onClick={() => setViewingLesson(l)} />
                    <IconActionButton icon={Edit3} label="Edit lesson" onClick={() => setEditingLesson({ ...l })} />
                    <IconActionButton icon={ArrowUp} label="Move lesson up" disabled={idx === 0} onClick={() => moveLesson(idx, -1)} />
                    <IconActionButton icon={ArrowDown} label="Move lesson down" disabled={idx === courseLessons.length - 1} onClick={() => moveLesson(idx, 1)} />
                    <IconActionButton icon={Trash2} label="Delete lesson" variant="danger" onClick={() => setDeleteLessonTarget(l)} />
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddLesson} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <h4 className="font-display text-sm font-semibold text-slate-900">Add Tutorial Lesson</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input required placeholder="Lesson Title" value={newLesson.title} onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })} className="sm:col-span-2 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg" />
                <input placeholder="YouTube Video ID (e.g. rfscVS0vtbw)" value={newLesson.youtube_video_id} onChange={(e) => setNewLesson({ ...newLesson, youtube_video_id: e.target.value })} className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono" />
              </div>
              <input placeholder="Lesson Description / Notes" value={newLesson.description} onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })} className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg" />
              <div className="flex items-center justify-between gap-3">
                <input placeholder="Duration (e.g. 14:20)" value={newLesson.duration_label} onChange={(e) => setNewLesson({ ...newLesson, duration_label: e.target.value })} className="w-40 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg" />
                <IconActionButton icon={Plus} label="Add lesson" type="submit" variant="primary" />
              </div>
            </form>

            {syncLogs.length > 0 && (
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900 mb-2">Synchronization History</h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="p-2.5 flex items-center justify-between">
                      <span>{log.started_at} · {log.triggered_by_name}</span>
                      <span>+{log.videos_added} added, {log.videos_updated} updated, {log.videos_unavailable} unavailable</span>
                      <StatusIndicator status={log.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalFrame>

      {/* View Lesson Modal */}
      <ModalFrame open={Boolean(viewingLesson)} onClose={() => setViewingLesson(null)} title={viewingLesson?.title || 'Lesson Details'} maxWidth="max-w-lg">
        {viewingLesson && (
          <div className="space-y-3 text-sm">
            <p className="text-xs font-mono text-slate-500">Video ID: {viewingLesson.youtube_video_id || '—'} · Duration: {viewingLesson.duration_label}</p>
            <p className="text-slate-700">{viewingLesson.description || 'No description provided.'}</p>
            {viewingLesson.instructor_notes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <strong>Instructor Notes:</strong> {viewingLesson.instructor_notes}
              </div>
            )}
            <StatusIndicator status={viewingLesson.availability_status} />
          </div>
        )}
      </ModalFrame>

      {/* Edit Lesson Modal */}
      <ModalFrame open={Boolean(editingLesson)} onClose={() => setEditingLesson(null)} title="Edit Lesson" maxWidth="max-w-lg">
        {editingLesson && (
          <form onSubmit={handleUpdateLesson} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lesson Title</label>
              <input required value={editingLesson.title} onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">YouTube Video ID</label>
                <input value={editingLesson.youtube_video_id || ''} onChange={(e) => setEditingLesson({ ...editingLesson, youtube_video_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Duration Label</label>
                <input value={editingLesson.duration_label || ''} onChange={(e) => setEditingLesson({ ...editingLesson, duration_label: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea rows={2} value={editingLesson.description || ''} onChange={(e) => setEditingLesson({ ...editingLesson, description: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Instructor Notes</label>
              <input value={editingLesson.instructor_notes || ''} onChange={(e) => setEditingLesson({ ...editingLesson, instructor_notes: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Availability</label>
              <select value={editingLesson.availability_status || 'Available'} onChange={(e) => setEditingLesson({ ...editingLesson, availability_status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingLesson(null)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg">Save Lesson</button>
            </div>
          </form>
        )}
      </ModalFrame>

      <YouTubeImportModal
        open={ytImportOpen}
        onClose={() => setYtImportOpen(false)}
        onImported={loadAll}
        showNotice={showNotice}
        meta={meta}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All associated lessons will be removed.`}
        confirmLabel="Delete Course"
        danger
        onConfirm={handleDeleteCourse}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={Boolean(deleteLessonTarget)}
        title="Delete Lesson"
        message={`Remove lesson "${deleteLessonTarget?.title}" from this course?`}
        confirmLabel="Delete Lesson"
        danger
        onConfirm={confirmRemoveLesson}
        onCancel={() => setDeleteLessonTarget(null)}
      />
    </div>
  );
}

export function TaxonomyPanel({ showNotice }) {
  const { user } = useAuth();
  const canEdit = ['Owner', 'Admin'].includes(user.role);

  const [data, setData] = useState({ categories: [], subjects: [], levels: [] });
  const [catName, setCatName] = useState('');
  const [subjForm, setSubjForm] = useState({ name: '', code: '', category_id: '' });
  const [lvlName, setLvlName] = useState('');
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const d = await apiRequest('/api/academic/taxonomy');
    setData(d);
  }
  useEffect(() => {
    load();
  }, []);

  async function addCat(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/categories', { method: 'POST', body: { name: catName } });
      setCatName('');
      showNotice('Category added.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function addSubj(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/subjects', { method: 'POST', body: subjForm });
      setSubjForm({ name: '', code: '', category_id: '' });
      showNotice('Subject added.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function addLevel(e) {
    e.preventDefault();
    try {
      await apiRequest('/api/academic/levels', {
        method: 'POST',
        body: { name: lvlName, sort_order: data.levels.length + 1 },
      });
      setLvlName('');
      showNotice('Level added.');
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editItem) return;
    try {
      const endpoint =
        editItem.kind === 'category'
          ? `/api/academic/categories/${editItem.id}`
          : editItem.kind === 'subject'
            ? `/api/academic/subjects/${editItem.id}`
            : `/api/academic/levels/${editItem.id}`;
      await apiRequest(endpoint, { method: 'PUT', body: editItem });
      showNotice('Updated successfully.');
      setEditItem(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      const endpoint =
        deleteTarget.kind === 'category'
          ? `/api/academic/categories/${deleteTarget.id}`
          : deleteTarget.kind === 'subject'
            ? `/api/academic/subjects/${deleteTarget.id}`
            : `/api/academic/levels/${deleteTarget.id}`;
      await apiRequest(endpoint, { method: 'DELETE' });
      showNotice('Item deleted.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showNotice(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionHeader
        title="Subjects, Categories & Levels"
        subtitle="Manage dynamic curriculum categories, academic subjects, and proficiency levels."
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
          <h3 className="font-display text-base font-semibold">Categories</h3>
          {canEdit && (
            <form onSubmit={addCat} className="flex gap-2 items-center">
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="New category..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <IconActionButton icon={Plus} label="Create category" type="submit" variant="primary" />
            </form>
          )}
          <ul className="divide-y divide-slate-100 text-sm">
            {data.categories.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-2">
                <span className="truncate">{c.name}</span>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <IconActionButton icon={Eye} label="Read category" variant="info" onClick={() => setViewItem({ kind: 'Category', ...c })} />
                  {canEdit && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit category" onClick={() => setEditItem({ kind: 'category', id: c.id, name: c.name, description: c.description || '' })} />
                      <IconActionButton icon={Trash2} label="Delete category" variant="danger" onClick={() => setDeleteTarget({ kind: 'category', id: c.id, label: c.name })} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
          <h3 className="font-display text-base font-semibold">Subjects</h3>
          {canEdit && (
            <form onSubmit={addSubj} className="space-y-2">
              <input
                required
                value={subjForm.name}
                onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })}
                placeholder="Subject name"
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2 items-center">
                <input
                  value={subjForm.code}
                  onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })}
                  placeholder="Code (CS-101)"
                  className="w-24 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                />
                <select
                  value={subjForm.category_id}
                  onChange={(e) => setSubjForm({ ...subjForm, category_id: e.target.value })}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Category</option>
                  {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <IconActionButton icon={Plus} label="Create subject" type="submit" variant="primary" />
              </div>
            </form>
          )}
          <ul className="divide-y divide-slate-100 text-sm">
            {data.subjects.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium truncate">{s.name}</span>
                  <span className="ml-2 text-xs text-slate-500 font-mono">{s.code}</span>
                </div>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <IconActionButton icon={Eye} label="Read subject" variant="info" onClick={() => setViewItem({ kind: 'Subject', ...s })} />
                  {canEdit && (
                    <>
                      <IconActionButton
                        icon={Edit3}
                        label="Edit subject"
                        onClick={() => setEditItem({ kind: 'subject', id: s.id, name: s.name, code: s.code || '', category_id: s.category_id ? String(s.category_id) : '', description: s.description || '' })}
                      />
                      <IconActionButton icon={Trash2} label="Delete subject" variant="danger" onClick={() => setDeleteTarget({ kind: 'subject', id: s.id, label: s.name })} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 card-hover-lift">
          <h3 className="font-display text-base font-semibold">Difficulty Levels</h3>
          {canEdit && (
            <form onSubmit={addLevel} className="flex gap-2 items-center">
              <input
                required
                value={lvlName}
                onChange={(e) => setLvlName(e.target.value)}
                placeholder="New level..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <IconActionButton icon={Plus} label="Create level" type="submit" variant="primary" />
            </form>
          )}
          <ul className="divide-y divide-slate-100 text-sm">
            {data.levels.map((l) => (
              <li key={l.id} className="py-2 flex items-center justify-between gap-2">
                <span>
                  {l.name} <span className="text-xs text-slate-400 tabular-nums">#{l.sort_order}</span>
                </span>
                <div className="inline-flex items-center gap-1 shrink-0">
                  <IconActionButton icon={Eye} label="Read level" variant="info" onClick={() => setViewItem({ kind: 'Difficulty Level', ...l })} />
                  {canEdit && (
                    <>
                      <IconActionButton icon={Edit3} label="Edit level" onClick={() => setEditItem({ kind: 'level', id: l.id, name: l.name, sort_order: l.sort_order })} />
                      <IconActionButton icon={Trash2} label="Delete level" variant="danger" onClick={() => setDeleteTarget({ kind: 'level', id: l.id, label: l.name })} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ModalFrame open={Boolean(viewItem)} onClose={() => setViewItem(null)} title={viewItem ? `${viewItem.kind}: ${viewItem.name}` : ''} maxWidth="max-w-md">
        {viewItem && (
          <div className="space-y-2 text-sm">
            <p><strong className="text-slate-600">Name:</strong> {viewItem.name}</p>
            {viewItem.slug && <p><strong className="text-slate-600">Slug:</strong> <span className="font-mono text-xs">{viewItem.slug}</span></p>}
            {viewItem.code && <p><strong className="text-slate-600">Code:</strong> <span className="font-mono text-xs">{viewItem.code}</span></p>}
            {viewItem.category_name && <p><strong className="text-slate-600">Category:</strong> {viewItem.category_name}</p>}
            {viewItem.sort_order !== undefined && <p><strong className="text-slate-600">Sort Order:</strong> {viewItem.sort_order}</p>}
            {viewItem.description && <p className="text-slate-600">{viewItem.description}</p>}
          </div>
        )}
      </ModalFrame>

      <ModalFrame open={Boolean(editItem)} onClose={() => setEditItem(null)} title="Update Taxonomy Item" maxWidth="max-w-md">
        {editItem && (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
              <input required value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            {editItem.kind === 'subject' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                  <input value={editItem.code} onChange={(e) => setEditItem({ ...editItem, code: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select value={editItem.category_id} onChange={(e) => setEditItem({ ...editItem, category_id: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    <option value="">None</option>
                    {data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {editItem.kind === 'level' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sort Order</label>
                <input type="number" value={editItem.sort_order} onChange={(e) => setEditItem({ ...editItem, sort_order: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
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
        title="Delete Item"
        message={`Delete "${deleteTarget?.label}"? Courses referencing it will safely clear the reference.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
