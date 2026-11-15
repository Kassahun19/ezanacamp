import jwt from 'jsonwebtoken';
import { securityConfig } from '../../database/config.js';
import { get } from '../../database/db.js';

async function loadUserFromToken(token) {
  const decoded = jwt.verify(token, securityConfig.jwtSecret);
  const user = await get(
    `SELECT id, first_name, last_name, email, role, status, phone, avatar_url, timezone, language,
            qualifications, expertise, experience_years, bio, student_code, notify_email, notify_sms, created_at
     FROM users WHERE id = ?`,
    [decoded.userId]
  );
  if (!user) return null;
  const roleRow = await get(`SELECT permissions_json FROM roles WHERE name = ?`, [user.role]);
  let permissions = [];
  try {
    permissions = roleRow ? JSON.parse(roleRow.permissions_json) : [];
  } catch {
    permissions = [];
  }
  return { ...user, permissions };
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      if (token) {
        const user = await loadUserFromToken(token);
        if (user && user.status === 'Active') {
          req.user = user;
        }
      }
    }
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const token = header.slice(7).trim();
    const user = await loadUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired session.' });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'ACCOUNT_INACTIVE', message: `Account is currently ${user.status}. Contact an administrator.` });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    if (req.user.role === 'Owner') return next();
    if (!Array.isArray(req.user.permissions) || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: `Your role (${req.user.role}) does not have permission: ${permission}.`,
      });
    }
    next();
  };
}

export function signAuthToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    securityConfig.jwtSecret,
    { expiresIn: securityConfig.jwtExpiresIn }
  );
}
