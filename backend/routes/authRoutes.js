import bcrypt from 'bcryptjs';
import express from 'express';
import { get, run } from '../../database/db.js';
import { requireAuth, signAuthToken } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();
const authLimiter = createRateLimiter({ windowMs: 60000, max: 30, keyPrefix: 'auth' });

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone = '' } = req.body || {};
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'First name, last name, email, and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'INVALID_EMAIL', message: 'Please enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters long.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH', message: 'Password and confirm password do not match.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await get(`SELECT id FROM users WHERE email = ?`, [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const studentCode = `EZN-2027-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const result = await run(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, status, phone, student_code)
       VALUES (?, ?, ?, ?, 'Student', 'Active', ?, ?)`,
      [firstName.trim(), lastName.trim(), cleanEmail, passwordHash, phone.trim(), studentCode]
    );

    const user = await get(
      `SELECT id, first_name, last_name, email, role, status, phone, avatar_url, timezone, language, student_code, created_at
       FROM users WHERE id = ?`,
      [result.lastInsertRowid]
    );

    const roleRow = await get(`SELECT permissions_json FROM roles WHERE name = 'Student'`);
    const permissions = roleRow ? JSON.parse(roleRow.permissions_json) : [];
    const token = signAuthToken(user);

    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email },
    });

    return res.status(201).json({ token, user: { ...user, permissions } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await get(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'ACCOUNT_INACTIVE', message: `Your account is ${user.status}. Please contact Ezana Academy administration.` });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const roleRow = await get(`SELECT permissions_json FROM roles WHERE name = ?`, [user.role]);
    const permissions = roleRow ? JSON.parse(roleRow.permissions_json) : [];
    const token = signAuthToken(user);

    await logAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: { role: user.role },
    });

    const { password_hash: _pw, ...safeUser } = user;
    return res.json({ token, user: { ...safeUser, permissions } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const {
      first_name, last_name, phone, avatar_url, timezone, language,
      bio, qualifications, expertise, experience_years, notify_email, notify_sms
    } = req.body || {};

    await run(
      `UPDATE users SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        phone = COALESCE(?, phone),
        avatar_url = COALESCE(?, avatar_url),
        timezone = COALESCE(?, timezone),
        language = COALESCE(?, language),
        bio = COALESCE(?, bio),
        qualifications = COALESCE(?, qualifications),
        expertise = COALESCE(?, expertise),
        experience_years = COALESCE(?, experience_years),
        notify_email = COALESCE(?, notify_email),
        notify_sms = COALESCE(?, notify_sms),
        updated_at = NOW()
       WHERE id = ?`,
      [
        first_name?.trim() || null,
        last_name?.trim() || null,
        phone !== undefined ? String(phone) : null,
        avatar_url !== undefined ? String(avatar_url) : null,
        timezone || null,
        language || null,
        bio !== undefined ? String(bio) : null,
        qualifications !== undefined ? String(qualifications) : null,
        expertise !== undefined ? String(expertise) : null,
        experience_years !== undefined ? Number(experience_years) : null,
        notify_email !== undefined ? (notify_email ? 1 : 0) : null,
        notify_sms !== undefined ? (notify_sms ? 1 : 0) : null,
        req.user.id,
      ]
    );

    const updated = await get(
      `SELECT id, first_name, last_name, email, role, status, phone, avatar_url, timezone, language,
              qualifications, expertise, experience_years, bio, student_code, notify_email, notify_sms, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: req.user.id,
    });

    return res.json({ user: { ...updated, permissions: req.user.permissions } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'All password fields are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'PASSWORD_MISMATCH', message: 'New password and confirmation do not match.' });
    }

    const user = await get(`SELECT id, password_hash FROM users WHERE id = ?`, [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'INCORRECT_PASSWORD', message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await run(`UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`, [newHash, req.user.id]);

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: req.user.id,
    });

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
