import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, PlaySquare, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../utils/api.jsx';
import { ModalFrame, PasswordInput, StatusIndicator } from '../components/UiPrimitives.jsx';

export default function YouTubeImportModal({ open, onClose, onImported, showNotice, meta }) {
  const [integrations, setIntegrations] = useState([]);
  const [integrationId, setIntegrationId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);
  const [keyLabel, setKeyLabel] = useState('Course Channel Integration');
  const [channelId, setChannelId] = useState('');

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [videos, setVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [importing, setImporting] = useState(false);

  const [courseInput, setCourseInput] = useState({
    title: '',
    description: '',
    learning_objectives: '',
    prerequisites: '',
    target_audience: '',
    estimated_duration: '6h 30m',
    thumbnail_url: '',
    category_id: '',
    subject_id: '',
    level: 'Beginner',
    language: 'English',
    instructor_id: '',
    status: 'Published',
    visibility: 'Public',
    tagsText: '',
  });

  useEffect(() => {
    if (open) {
      apiRequest('/api/youtube/integrations')
        .then((d) => setIntegrations(d.integrations || []))
        .catch(() => {});
    }
  }, [open]);

  async function handleValidate() {
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await apiRequest('/api/youtube/validate', {
        method: 'POST',
        body: { apiKey, integrationId: integrationId || null, channelId },
      });
      setValidationResult({ ok: true, message: `Channel verified (${res.channel.videoCount} public videos detected).`, channel: res.channel });
      if (!courseInput.thumbnail_url && res.channel.suggestedThumbnail) {
        setCourseInput((c) => ({ ...c, thumbnail_url: res.channel.suggestedThumbnail }));
      }
    } catch (err) {
      setValidationResult({ ok: false, message: err.message });
    } finally {
      setValidating(false);
    }
  }

  async function handlePreview(token = '') {
    setPreviewing(true);
    try {
      const res = await apiRequest('/api/youtube/preview', {
        method: 'POST',
        body: { apiKey, integrationId: integrationId || null, channelId, pageToken: token, maxResults: 25 },
      });
      const fetched = res.videos || [];
      setVideos((prev) => (token ? [...prev, ...fetched] : fetched));
      setNextPageToken(res.nextPageToken || null);
      const eligibleIds = fetched.filter((v) => v.eligible).map((v) => v.youtubeVideoId);
      setSelectedIds((prev) => {
        const next = token ? new Set(prev) : new Set();
        eligibleIds.forEach((id) => next.add(id));
        return next;
      });
      if (!courseInput.thumbnail_url && fetched[0]?.thumbnailUrl) {
        setCourseInput((c) => ({ ...c, thumbnail_url: fetched[0].thumbnailUrl }));
      }
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setPreviewing(false);
    }
  }

  function toggleVideo(ytId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ytId)) next.delete(ytId);
      else next.add(ytId);
      return next;
    });
  }

  function selectAllEligible(flag) {
    if (!flag) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(videos.filter((v) => v.eligible).map((v) => v.youtubeVideoId)));
  }

  async function handleImport(e) {
    e.preventDefault();
    const chosen = videos.filter((v) => v.eligible && selectedIds.has(v.youtubeVideoId));
    if (chosen.length === 0) {
      showNotice('Preview and select at least one eligible video before importing.', 'error');
      return;
    }
    setImporting(true);
    try {
      const tags = courseInput.tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await apiRequest('/api/youtube/import', {
        method: 'POST',
        body: {
          apiKey,
          integrationId: integrationId || null,
          saveKey: Boolean(apiKey && saveKey),
          keyLabel,
          channelId,
          courseInput: { ...courseInput, tags },
          selectedVideos: chosen,
        },
      });
      showNotice(res.message);
      onImported();
      onClose();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <ModalFrame
      open={open}
      onClose={onClose}
      title="Import Course from YouTube Channel"
      subtitle="Retrieve eligible public videos via YouTube Data API v3 and publish as a native Ezana Academy course (ETB 218 Pro / First 5 Free)."
      maxWidth="max-w-4xl"
    >
      <form onSubmit={handleImport} className="space-y-6">
        {/* Step 1: Secure Credentials & Channel ID */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <KeyRound className="w-4 h-4 text-blue-700" />
            <h4 className="font-display text-sm font-semibold">1. YouTube Data API v3 Credentials &amp; Channel ID</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {integrations.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Use Saved Integration Key</label>
                <select
                  value={integrationId}
                  onChange={(e) => {
                    setIntegrationId(e.target.value);
                    const found = integrations.find((i) => String(i.id) === e.target.value);
                    if (found?.default_channel_id && !channelId) setChannelId(found.default_channel_id);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">-- Enter new API key below --</option>
                  {integrations.map((i) => (
                    <option key={i.id} value={i.id}>{i.label} ({i.masked_key})</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">YouTube Data API v3 Key (stored encrypted)</label>
              <PasswordInput
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={integrationId ? 'Using saved encrypted key' : 'AIzaSy...'}
                className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">YouTube Channel ID</label>
              <input
                required
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="UC..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono"
              />
            </div>

            {apiKey && (
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-700 pb-2">
                  <input type="checkbox" checked={saveKey} onChange={(e) => setSaveKey(e.target.checked)} />
                  <span>Save encrypted key for future sync</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={validating || !channelId}
              onClick={handleValidate}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg disabled:opacity-50"
            >
              {validating ? 'Validating...' : 'Validate API Key & Channel ID'}
            </button>
            <button
              type="button"
              disabled={previewing || !channelId}
              onClick={() => handlePreview('')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50"
            >
              <PlaySquare className="w-3.5 h-3.5" />
              <span>{previewing ? 'Loading Videos...' : 'Preview Eligible Videos'}</span>
            </button>
          </div>

          {validationResult && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${validationResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {validationResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
              <span>{validationResult.message}</span>
            </div>
          )}
        </div>

        {/* Step 2: Preview & Select Videos */}
        {videos.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold text-slate-900">
                2. Select Videos to Import ({selectedIds.size} selected of {videos.filter((v) => v.eligible).length} eligible)
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={() => selectAllEligible(true)} className="text-blue-700 font-medium hover:underline">Select All Eligible</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => selectAllEligible(false)} className="text-slate-600 hover:underline">Clear</button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {videos.map((v) => (
                <label key={v.youtubeVideoId} className={`flex items-center gap-3 p-2.5 text-xs ${v.eligible ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    disabled={!v.eligible}
                    checked={selectedIds.has(v.youtubeVideoId)}
                    onChange={() => toggleVideo(v.youtubeVideoId)}
                  />
                  {v.thumbnailUrl && (
                    <img src={v.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="w-14 h-9 object-cover rounded border border-slate-200 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{v.title}</p>
                    <p className="text-slate-500 tabular-nums">{v.durationLabel} · {v.eligible ? 'Eligible Public' : v.reason}</p>
                  </div>
                  <StatusIndicator status={v.eligible ? 'Available' : 'Unavailable'} />
                </label>
              ))}
            </div>

            {nextPageToken && (
              <button
                type="button"
                disabled={previewing}
                onClick={() => handlePreview(nextPageToken)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Load More Videos from Channel</span>
              </button>
            )}
          </div>
        )}

        {/* Step 3: Native Ezana Academy Course Identity */}
        <div className="space-y-4">
          <h4 className="font-display text-sm font-semibold text-slate-900">
            3. Ezana Academy Course Identity (Channel name is never shown to students)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Ezana Academy Course Title *</label>
              <input
                required
                value={courseInput.title}
                onChange={(e) => setCourseInput({ ...courseInput, title: e.target.value })}
                placeholder="e.g., Applied Python & Data Systems"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Course Description *</label>
              <textarea
                required
                rows={2}
                value={courseInput.description}
                onChange={(e) => setCourseInput({ ...courseInput, description: e.target.value })}
                placeholder="Describe syllabus, practical outcomes, and curriculum structure..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={courseInput.category_id}
                onChange={(e) => setCourseInput({ ...courseInput, category_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select Category</option>
                {(meta.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
              <select
                value={courseInput.subject_id}
                onChange={(e) => setCourseInput({ ...courseInput, subject_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Select Subject</option>
                {(meta.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Level</label>
              <select
                value={courseInput.level}
                onChange={(e) => setCourseInput({ ...courseInput, level: e.target.value })}
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
                value={courseInput.instructor_id}
                onChange={(e) => setCourseInput({ ...courseInput, instructor_id: e.target.value })}
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
                  value={courseInput.language}
                  onChange={(e) => setCourseInput({ ...courseInput, language: e.target.value })}
                  placeholder="Language"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <select
                  value={courseInput.status}
                  onChange={(e) => setCourseInput({ ...courseInput, status: e.target.value })}
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
                  value={courseInput.visibility}
                  onChange={(e) => setCourseInput({ ...courseInput, visibility: e.target.value })}
                  className="px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                  <option value="Cohort Only">Cohort Only</option>
                </select>
                <input
                  value={courseInput.estimated_duration}
                  onChange={(e) => setCourseInput({ ...courseInput, estimated_duration: e.target.value })}
                  placeholder="e.g., 6h 30m"
                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Cover Thumbnail URL (optional override)</label>
              <input
                value={courseInput.thumbnail_url}
                onChange={(e) => setCourseInput({ ...courseInput, thumbnail_url: e.target.value })}
                placeholder="/src/assets/images/course_web_engineering_1794751963554.jpg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Prerequisites</label>
              <input
                value={courseInput.prerequisites}
                onChange={(e) => setCourseInput({ ...courseInput, prerequisites: e.target.value })}
                placeholder="e.g., Basic algebra or computer literacy"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
              <input
                value={courseInput.target_audience}
                onChange={(e) => setCourseInput({ ...courseInput, target_audience: e.target.value })}
                placeholder="e.g., University students, software trainees"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Learning Objectives &amp; Tags</label>
              <input
                value={courseInput.learning_objectives}
                onChange={(e) => setCourseInput({ ...courseInput, learning_objectives: e.target.value })}
                placeholder="Key skills students will master..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2"
              />
              <input
                value={courseInput.tagsText}
                onChange={(e) => setCourseInput({ ...courseInput, tagsText: e.target.value })}
                placeholder="Comma-separated tags (e.g., Python, Algorithms, Backend)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">Pricing preserved: First 5 lessons free · Ezana Pro ETB 218</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-60"
            >
              {importing ? 'Importing Course...' : 'Create & Import Course'}
            </button>
          </div>
        </div>
      </form>
    </ModalFrame>
  );
}
