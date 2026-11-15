const TOKEN_KEY = 'ezana_academy_jwt';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage restriction
  }
}

export async function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getStoredToken();
  const reqHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.error || 'REQUEST_ERROR';
    err.payload = data;
    throw err;
  }
  return data;
}

export function exportRowsToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const escape = (val) => {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  };
  const csv = [cols.map(escape).join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatEtb(amount) {
  return `ETB ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const ZOOM_MEETING_URL = 'https://us05web.zoom.us/j/4619028612?pwd=D8hDld9Qase3OLIDozrgc9axiBDadQ.1';
export const ZOOM_MEETING_ID = '461 902 8612';
export const ZOOM_PASSCODE = 'MJQNp0';

export async function triggerZoomJoin(liveClassId, showNotice) {
  const credMsg = `Zoom Credentials — Meeting ID: ${ZOOM_MEETING_ID} | Passcode: ${ZOOM_PASSCODE}. Redirecting to Zoom meeting...`;
  if (showNotice) showNotice(credMsg);
  if (liveClassId) {
    try {
      await apiRequest(`/api/academic/live-classes/${liveClassId}/join`, { method: 'POST' });
    } catch {
      // Proceed with redirect even if notification insert fails
    }
  }
  setTimeout(() => {
    window.location.href = ZOOM_MEETING_URL;
  }, 650);
}
