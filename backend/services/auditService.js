import { run } from '../../database/db.js';

const SENSITIVE_KEYS = ['apikey', 'api_key', 'password', 'token', 'secret', 'encrypted_api_key', 'authorization'];

function sanitizeDetails(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDetails);
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((sk) => k.toLowerCase().includes(sk))) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clean[k] = sanitizeDetails(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export async function logAudit({ actorId = null, actorRole = 'System', action, entityType = '', entityId = '', details = {} }) {
  try {
    const safeDetails = sanitizeDetails(details);
    await run(
      `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId, actorRole, action, entityType, String(entityId || ''), JSON.stringify(safeDetails || {})]
    );
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err.message);
  }
}
