import React, { useEffect, useState } from 'react';
import { Bookmark, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest, formatEtb } from '../utils/api.jsx';
import { EmptyState, FallbackCover, LoadingRows } from '../components/UiPrimitives.jsx';

export default function CoursesCatalogPage({ onOpenCourse, onOpenPro }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ categories: [], levels: [], instructors: [] });
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    level: '',
    language: '',
    accessType: '',
    statusFilter: '',
    instructorId: '',
    sort: 'recent',
    page: 1,
  });

  useEffect(() => {
    apiRequest('/api/courses/meta').then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) params.set(k, String(v));
    });
    params.set('limit', '9');

    apiRequest(`/api/courses?${params.toString()}`)
      .then((d) => {
        if (!active) return;
        setCourses(d.courses || []);
        setPagination(d.pagination || { total: 0, page: 1, totalPages: 1 });
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [filters, user]);

  function clearFilters() {
    setSearchInput('');
    setFilters({
      search: '',
      category: '',
      level: '',
      language: '',
      accessType: '',
      statusFilter: '',
      instructorId: '',
      sort: 'recent',
      page: 1,
    });
  }

  async function toggleBookmark(e, courseId) {
    e.stopPropagation();
    if (!user) return;
    try {
      const res = await apiRequest(`/api/courses/${courseId}/bookmark`, { method: 'POST' });
      setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, is_bookmarked: res.bookmarked } : c)));
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Course Catalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse all courses. Signed-in users watch up to 5 lessons free per course; Ezana Pro (ETB 218) unlocks the full course.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, topic, or lesson..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <button
            onClick={() => setShowMobileFilters((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-300 bg-white rounded-lg"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block bg-white border border-slate-200 rounded-xl p-4`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Categories</option>
            {meta.categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by level"
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Levels</option>
            {meta.levels.map((l) => (
              <option key={l.id} value={l.name}>{l.name}</option>
            ))}
          </select>

          <select
            aria-label="Filter by access type"
            value={filters.accessType}
            onChange={(e) => setFilters({ ...filters, accessType: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Access Types</option>
            <option value="free">Free Preview (First 5)</option>
            <option value="pro">Ezana Pro (ETB 218)</option>
          </select>

          <select
            aria-label="Filter by instructor"
            value={filters.instructorId}
            onChange={(e) => setFilters({ ...filters, instructorId: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Instructors</option>
            {meta.instructors.map((i) => (
              <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>
            ))}
          </select>

          {user ? (
            <select
              aria-label="Filter by status"
              value={filters.statusFilter}
              onChange={(e) => setFilters({ ...filters, statusFilter: e.target.value, page: 1 })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Course Statuses</option>
              <option value="available">Available</option>
              <option value="enrolled">Enrolled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="locked">Pro Locked</option>
            </select>
          ) : (
            <select
              aria-label="Filter by language"
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value, page: 1 })}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">All Languages</option>
              <option value="English">English</option>
              <option value="Amharic">Amharic</option>
            </select>
          )}

          <select
            aria-label="Sort courses"
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-medium"
          >
            <option value="recent">Sort: Recently Added</option>
            <option value="title_asc">Sort: Title A–Z</option>
            <option value="title_desc">Sort: Title Z–A</option>
            <option value="popular">Sort: Most Popular</option>
            <option value="highest_rated">Sort: Highest Rated</option>
            <option value="shortest">Sort: Shortest Duration</option>
            <option value="longest">Sort: Longest Duration</option>
          </select>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            Showing {courses.length} of {pagination.total} courses
          </span>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
          >
            <X className="w-3.5 h-3.5" />
            Clear all filters
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingRows count={6} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No matching courses found"
          description="Try removing one or more filters or searching with broader keywords."
          actionLabel="Clear Filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => onOpenCourse(course.id)}
              className="group cursor-pointer bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
                {!imgErrors[course.id] && course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((p) => ({ ...p, [course.id]: true }))}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                ) : (
                  <FallbackCover title={course.title} className="w-full h-full" />
                )}
                {user && (
                  <button
                    onClick={(e) => toggleBookmark(e, course.id)}
                    aria-label="Bookmark course"
                    className={`absolute top-3 right-3 p-2 rounded-lg border transition-colors ${
                      course.is_bookmarked
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>{course.category_name || 'General'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{course.level}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{course.lesson_count} lessons</span>
                  {course.estimated_duration && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{course.estimated_duration}</span>
                    </>
                  )}
                </div>

                <h3 className="mt-2 font-display text-lg font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2 flex-1">{course.description}</p>

                {user && course.is_enrolled && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>Progress</span>
                      <span className="tabular-nums font-medium">{course.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-700 rounded-full" style={{ width: `${course.progress_percent}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-600 truncate">
                    <span className="font-medium text-slate-800">{course.instructor_name || 'Ezana Faculty'}</span>
                    {course.avg_rating && <span className="ml-2 text-amber-700 tabular-nums">★ {course.avg_rating}</span>}
                  </div>

                  {course.has_pro_access ? (
                    <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">Full Access</span>
                  ) : course.pro_request_status === 'Pending' ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPro(course);
                      }}
                      className="text-xs font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap"
                    >
                      Pro Pending Approval
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPro(course);
                      }}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap font-mono tabular-nums"
                    >
                      Pro {formatEtb(course.pro_price_etb)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: pagination.totalPages }).map((_, idx) => {
            const p = idx + 1;
            return (
              <button
                key={p}
                onClick={() => setFilters({ ...filters, page: p })}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border tabular-nums ${
                  filters.page === p
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
