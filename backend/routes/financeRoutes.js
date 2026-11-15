import express from 'express';
import { get, query, run, transaction } from '../../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { logAudit } from '../services/auditService.js';

const router = express.Router();
const paymentLimiter = createRateLimiter({ windowMs: 60000, max: 20, keyPrefix: 'payment' });

const EZANA_PRO_CHECKOUT_URL =
  'https://ye-buna.com/kassahunmulatu?ref=product_detail&product=6af9e5352ee4a_kassahunmulatu';

// Request Ezana Pro upgrade for a specific course (creates Pending request + returns external checkout URL; Owner/Admin approves)
router.post('/ezana-pro/checkout', requireAuth, paymentLimiter, async (req, res) => {
  try {
    const { courseId, method = 'Telebirr', accountRef = '' } = req.body || {};
    const cid = Number(courseId);
    if (!cid) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid courseId is required.' });

    const course = await get(`SELECT id, title, pro_price_etb, status FROM courses WHERE id = ?`, [cid]);
    if (!course) return res.status(404).json({ error: 'NOT_FOUND', message: 'Course not found.' });

    const existingEnt = await get(`SELECT id, status FROM course_entitlements WHERE user_id = ? AND course_id = ?`, [req.user.id, cid]);
    if (existingEnt?.status === 'Active') {
      return res.json({ message: 'You already have Ezana Pro access for this course.', alreadyUnlocked: true });
    }
    if (existingEnt?.status === 'Pending') {
      return res.json({
        message: 'Your Ezana Pro upgrade request is pending Owner/Admin approval. Complete payment at checkout if you have not yet.',
        pendingApproval: true,
        status: 'Pending',
        checkoutUrl: EZANA_PRO_CHECKOUT_URL,
      });
    }

    const allowedMethods = ['Telebirr', 'CBE Birr', 'Chapa', 'Amole', 'Card', 'Ye-Buna'];
    const cleanMethod = allowedMethods.includes(method) ? method : 'Ye-Buna';

    // Enforce server-side fixed ETB 218 price
    const amountEtb = Number(course.pro_price_etb || 218);
    const reference = `PRO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const invoiceNum = `INV-PRO-${Date.now().toString().slice(-6)}`;

    const out = await transaction(async (tx) => {
      const payRes = await tx.run(
        `INSERT INTO payments (reference, user_id, student_id, course_id, payment_type, amount_etb, method, status, gateway_meta)
         VALUES (?, ?, ?, ?, 'Ezana Pro', ?, ?, 'Pending', ?)`,
        [
          reference,
          req.user.id,
          req.user.id,
          cid,
          amountEtb,
          cleanMethod,
          accountRef ? `Ref: ${accountRef} | Awaiting Owner/Admin approval` : 'Ye-Buna checkout · Awaiting Owner/Admin approval',
        ]
      );

      let entitlementId;
      if (existingEnt) {
        await tx.run(
          `UPDATE course_entitlements SET plan_name = 'Ezana Pro', amount_etb = ?, payment_id = ?, status = 'Pending', granted_at = NOW() WHERE id = ?`,
          [amountEtb, payRes.lastInsertRowid, existingEnt.id]
        );
        entitlementId = existingEnt.id;
      } else {
        const entRes = await tx.run(
          `INSERT INTO course_entitlements (user_id, course_id, plan_name, amount_etb, payment_id, status)
           VALUES (?, ?, 'Ezana Pro', ?, ?, 'Pending')`,
          [req.user.id, cid, amountEtb, payRes.lastInsertRowid]
        );
        entitlementId = entRes.lastInsertRowid;
      }

      await tx.run(
        `INSERT INTO invoices (invoice_number, student_id, payment_id, amount_etb, status, issue_date, due_date)
         VALUES (?, ?, ?, ?, 'Pending', DATE_FORMAT(CURDATE(), '%Y-%m-%d'), DATE_FORMAT(CURDATE(), '%Y-%m-%d'))`,
        [invoiceNum, req.user.id, payRes.lastInsertRowid, amountEtb]
      );

      await tx.run(
        `INSERT INTO notifications (user_id, title, body, category, link_target)
         VALUES (?, 'Ezana Pro Request Pending', ?, 'Finance', 'courses')`,
        [req.user.id, `Your Ezana Pro request for ${course.title} (ETB ${amountEtb}, ref ${reference}) is pending Owner/Admin approval.`]
      );

      const approvers = await tx.query(`SELECT id FROM users WHERE role IN ('Owner', 'Admin') AND status = 'Active'`);
      for (const appUser of approvers) {
        await tx.run(
          `INSERT INTO notifications (user_id, title, body, category, link_target)
           VALUES (?, 'Pending Ezana Pro Approval', ?, 'Finance', 'finance-fees')`,
          [appUser.id, `${req.user.first_name} ${req.user.last_name} submitted an Ezana Pro ETB ${amountEtb} request for ${course.title} (${reference}).`]
        );
      }

      return { entitlementId, paymentId: payRes.lastInsertRowid, reference, invoiceNum, amountEtb };
    });

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'EZANA_PRO_REQUESTED',
      entityType: 'CourseEntitlement',
      entityId: out.entitlementId,
      details: { courseId: cid, courseTitle: course.title, amountEtb: out.amountEtb, method: cleanMethod, reference: out.reference, status: 'Pending' },
    });

    return res.status(201).json({
      message: `Ezana Pro request recorded (${out.reference}). Redirecting to checkout — full access unlocks once approved by Owner/Admin.`,
      pendingApproval: true,
      status: 'Pending',
      checkoutUrl: EZANA_PRO_CHECKOUT_URL,
      ...out,
    });
  } catch (err) {
    return res.status(500).json({ error: 'PAYMENT_FAILED', message: err.message });
  }
});

// List Ezana Pro Upgrade Requests (Owner / Admin)
router.get('/ezana-pro/requests', requireAuth, requireRole('Owner', 'Admin'), async (_req, res) => {
  try {
    const requests = await query(
      `SELECT ce.id, ce.user_id, ce.course_id, ce.plan_name, ce.amount_etb, ce.payment_id, ce.status, ce.granted_at,
              CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.email AS student_email, u.student_code,
              c.title AS course_title,
              p.reference AS payment_reference, p.method AS payment_method, p.gateway_meta, p.status AS payment_status
       FROM course_entitlements ce
       JOIN users u ON u.id = ce.user_id
       JOIN courses c ON c.id = ce.course_id
       LEFT JOIN payments p ON p.id = ce.payment_id
       ORDER BY CASE WHEN ce.status = 'Pending' THEN 0 ELSE 1 END, ce.granted_at DESC`
    );
    return res.json({ requests });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Approve or Reject Ezana Pro Upgrade Request (Owner / Admin)
router.patch('/ezana-pro/requests/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const entitlementId = Number(req.params.id);
    const { status } = req.body || {};
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Status must be Approved or Rejected.' });
    }

    const ent = await get(
      `SELECT ce.*, c.title AS course_title, CONCAT(u.first_name, ' ', u.last_name) AS student_name
       FROM course_entitlements ce
       JOIN courses c ON c.id = ce.course_id
       JOIN users u ON u.id = ce.user_id
       WHERE ce.id = ?`,
      [entitlementId]
    );
    if (!ent) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Ezana Pro request not found.' });
    }

    const nextEntStatus = status === 'Approved' ? 'Active' : 'Rejected';
    const nextPayStatus = status === 'Approved' ? 'Completed' : 'Rejected';
    const nextInvStatus = status === 'Approved' ? 'Paid' : 'Rejected';

    await transaction(async (tx) => {
      await tx.run(`UPDATE course_entitlements SET status = ?, granted_at = NOW() WHERE id = ?`, [nextEntStatus, entitlementId]);

      if (ent.payment_id) {
        await tx.run(`UPDATE payments SET status = ?, paid_at = NOW() WHERE id = ?`, [nextPayStatus, ent.payment_id]);
        await tx.run(`UPDATE invoices SET status = ? WHERE payment_id = ?`, [nextInvStatus, ent.payment_id]);
      }

      if (status === 'Approved') {
        await tx.run(
          `INSERT IGNORE INTO enrollments (student_id, course_id, status) VALUES (?, ?, 'Active')`,
          [ent.user_id, ent.course_id]
        );
        await tx.run(
          `INSERT INTO notifications (user_id, title, body, category, link_target)
           VALUES (?, 'Ezana Pro Approved', ?, 'Finance', 'student-courses')`,
          [ent.user_id, `Your Ezana Pro access for ${ent.course_title} has been approved! All tutorial videos are now unlocked in your dashboard.`]
        );
      } else {
        await tx.run(
          `INSERT INTO notifications (user_id, title, body, category, link_target)
           VALUES (?, 'Ezana Pro Request Declined', ?, 'Finance', 'finance-my-fees')`,
          [ent.user_id, `Your Ezana Pro upgrade request for ${ent.course_title} was declined. Please complete checkout or contact administration.`]
        );
      }
    });

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: status === 'Approved' ? 'EZANA_PRO_APPROVED' : 'EZANA_PRO_REJECTED',
      entityType: 'CourseEntitlement',
      entityId: entitlementId,
      details: { studentName: ent.student_name, courseTitle: ent.course_title, status: nextEntStatus },
    });

    return res.json({
      message:
        status === 'Approved'
          ? `Approved Ezana Pro access for ${ent.student_name} on "${ent.course_title}".`
          : `Declined Ezana Pro request for ${ent.student_name}.`,
      status: nextEntStatus,
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Student or Parent Finance Data (Fees, Invoices, Payments)
router.get('/my', requireAuth, async (req, res) => {
  try {
    let studentIds = [req.user.id];
    if (req.user.role === 'Parent') {
      const links = await query(
        `SELECT student_id FROM parent_student_links WHERE parent_id = ? AND status = 'Approved'`,
        [req.user.id]
      );
      studentIds = links.map((l) => l.student_id);
      if (req.query.studentId) {
        const reqChild = Number(req.query.studentId);
        if (!studentIds.includes(reqChild)) {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view financial records for your linked children.' });
        }
        studentIds = [reqChild];
      }
    }

    if (studentIds.length === 0) {
      return res.json({ fees: [], payments: [], invoices: [], entitlements: [] });
    }

    const placeholders = studentIds.map(() => '?').join(',');
    const fees = await query(
      `SELECT f.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, c.title AS course_title
       FROM fees f
       JOIN users u ON u.id = f.student_id
       LEFT JOIN courses c ON c.id = f.course_id
       WHERE f.student_id IN (${placeholders})
       ORDER BY f.due_date ASC`,
      studentIds
    );
    const payments = await query(
      `SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, c.title AS course_title
       FROM payments p
       LEFT JOIN users u ON u.id = COALESCE(p.student_id, p.user_id)
       LEFT JOIN courses c ON c.id = p.course_id
       WHERE p.user_id = ? OR p.student_id IN (${placeholders})
       ORDER BY p.paid_at DESC`,
      [req.user.id, ...studentIds]
    );
    const invoices = await query(
      `SELECT inv.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, f.title AS fee_title
       FROM invoices inv
       JOIN users u ON u.id = inv.student_id
       LEFT JOIN fees f ON f.id = inv.fee_id
       WHERE inv.student_id IN (${placeholders})
       ORDER BY inv.issue_date DESC`,
      studentIds
    );
    const entitlements = await query(
      `SELECT ce.*, c.title AS course_title FROM course_entitlements ce JOIN courses c ON c.id = ce.course_id WHERE ce.user_id IN (${placeholders})`,
      studentIds
    );

    return res.json({ fees, payments, invoices, entitlements });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Pay a specific Fee (Student, Parent for linked child, or Admin/Owner)
router.post('/fees/:feeId/pay', requireAuth, paymentLimiter, async (req, res) => {
  try {
    const feeId = Number(req.params.feeId);
    const { amountEtb, method = 'Telebirr', accountRef = '' } = req.body || {};

    const fee = await get(`SELECT * FROM fees WHERE id = ?`, [feeId]);
    if (!fee) return res.status(404).json({ error: 'NOT_FOUND', message: 'Fee record not found.' });

    if (req.user.role === 'Student' && fee.student_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot pay fees for another student.' });
    }
    if (req.user.role === 'Parent') {
      const link = await get(`SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ? AND status = 'Approved'`, [req.user.id, fee.student_id]);
      if (!link) return res.status(403).json({ error: 'FORBIDDEN', message: 'Child is not linked to your parent account.' });
    }

    const netTotal = Math.max(Number(fee.amount_etb) - Number(fee.discount_etb || 0), 0);
    const remaining = Math.max(netTotal - Number(fee.paid_etb || 0), 0);
    if (remaining <= 0) {
      return res.status(400).json({ error: 'ALREADY_PAID', message: 'This fee is already fully paid.' });
    }

    const payAmount = amountEtb ? Math.min(Number(amountEtb), remaining) : remaining;
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Payment amount must be greater than zero.' });
    }

    const reference = `FEE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newPaid = Number(fee.paid_etb || 0) + payAmount;
    const newStatus = newPaid >= netTotal ? 'Paid' : 'Partially Paid';

    const out = await transaction(async (tx) => {
      const payRes = await tx.run(
        `INSERT INTO payments (reference, user_id, student_id, fee_id, course_id, payment_type, amount_etb, method, status, gateway_meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?)`,
        [reference, req.user.id, fee.student_id, fee.id, fee.course_id, fee.fee_type, payAmount, method, accountRef || 'Verified settlement']
      );

      await tx.run(`UPDATE fees SET paid_etb = ?, status = ? WHERE id = ?`, [newPaid, newStatus, fee.id]);

      const existingInv = await tx.get(`SELECT id FROM invoices WHERE fee_id = ?`, [fee.id]);
      if (existingInv) {
        await tx.run(`UPDATE invoices SET payment_id = ?, status = ? WHERE id = ?`, [payRes.lastInsertRowid, newStatus, existingInv.id]);
      } else {
        await tx.run(
          `INSERT INTO invoices (invoice_number, student_id, fee_id, payment_id, amount_etb, status, issue_date, due_date)
           VALUES (?, ?, ?, ?, ?, ?, DATE_FORMAT(CURDATE(), '%Y-%m-%d'), ?)`,
          [`INV-${Date.now().toString().slice(-6)}`, fee.student_id, fee.id, payRes.lastInsertRowid, netTotal, newStatus, fee.due_date]
        );
      }
      return { reference, payAmount, newStatus };
    });

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FEE_PAYMENT_COMPLETED',
      entityType: 'Fee',
      entityId: fee.id,
      details: out,
    });

    return res.json({ message: `Payment of ETB ${out.payAmount} completed (${out.reference}).`, ...out });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

// Owner / Admin Finance Management
router.get('/summary', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { status = '', method = '', search = '' } = req.query;

    const fees = await query(
      `SELECT f.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, u.email AS student_email, c.title AS course_title
       FROM fees f JOIN users u ON u.id = f.student_id LEFT JOIN courses c ON c.id = f.course_id
       ORDER BY f.created_at DESC`
    );
    let payments = await query(
      `SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) AS payer_name,
              CONCAT(su.first_name, ' ', su.last_name) AS student_name, c.title AS course_title
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN users su ON su.id = p.student_id
       LEFT JOIN courses c ON c.id = p.course_id
       ORDER BY p.paid_at DESC`
    );
    const invoices = await query(
      `SELECT inv.*, CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.student_code, f.title AS fee_title
       FROM invoices inv JOIN users u ON u.id = inv.student_id LEFT JOIN fees f ON f.id = inv.fee_id
       ORDER BY inv.issue_date DESC`
    );

    if (status) payments = payments.filter((p) => p.status === status);
    if (method) payments = payments.filter((p) => p.method === method);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      payments = payments.filter((p) =>
        (p.reference || '').toLowerCase().includes(q) ||
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.payer_name || '').toLowerCase().includes(q)
      );
    }

    const proRequests = await query(
      `SELECT ce.id, ce.user_id, ce.course_id, ce.plan_name, ce.amount_etb, ce.payment_id, ce.status, ce.granted_at,
              CONCAT(u.first_name, ' ', u.last_name) AS student_name, u.email AS student_email, u.student_code,
              c.title AS course_title,
              p.reference AS payment_reference, p.method AS payment_method, p.gateway_meta, p.status AS payment_status
       FROM course_entitlements ce
       JOIN users u ON u.id = ce.user_id
       JOIN courses c ON c.id = ce.course_id
       LEFT JOIN payments p ON p.id = ce.payment_id
       ORDER BY CASE WHEN ce.status = 'Pending' THEN 0 ELSE 1 END, ce.granted_at DESC`
    );

    const totalRevenue = payments.filter((p) => p.status === 'Completed').reduce((s, p) => s + Number(p.amount_etb || 0), 0);
    const totalExpected = fees.reduce((s, f) => s + Math.max(Number(f.amount_etb) - Number(f.discount_etb || 0), 0), 0);
    const totalCollectedFees = fees.reduce((s, f) => s + Number(f.paid_etb || 0), 0);
    const outstandingBalance = Math.max(totalExpected - totalCollectedFees, 0);

    return res.json({
      metrics: {
        totalRevenue,
        outstandingBalance,
        paidFeesCount: fees.filter((f) => f.status === 'Paid').length,
        unpaidFeesCount: fees.filter((f) => f.status !== 'Paid').length,
        pendingProCount: proRequests.filter((r) => r.status === 'Pending').length,
      },
      fees,
      payments,
      invoices,
      proRequests,
    });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.post('/fees', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const { studentId, courseId = null, title, feeType = 'Tuition', amountEtb, discountEtb = 0, dueDate } = req.body || {};
    if (!studentId || !title?.trim() || !amountEtb || !dueDate) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Student, title, amount, and due date are required.' });
    }
    const feeRes = await run(
      `INSERT INTO fees (student_id, course_id, title, fee_type, amount_etb, discount_etb, paid_etb, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'Unpaid')`,
      [Number(studentId), courseId ? Number(courseId) : null, title.trim(), feeType, Number(amountEtb), Number(discountEtb), dueDate]
    );
    await run(
      `INSERT INTO invoices (invoice_number, student_id, fee_id, amount_etb, status, issue_date, due_date)
       VALUES (?, ?, ?, ?, 'Issued', DATE_FORMAT(CURDATE(), '%Y-%m-%d'), ?)`,
      [`INV-${Date.now().toString().slice(-6)}`, Number(studentId), feeRes.lastInsertRowid, Math.max(Number(amountEtb) - Number(discountEtb), 0), dueDate]
    );
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FEE_CREATED',
      entityType: 'Fee',
      entityId: feeRes.lastInsertRowid,
      details: { studentId, title, amountEtb },
    });
    return res.status(201).json({ message: 'Fee & invoice created successfully.', id: feeRes.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.put('/fees/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get(`SELECT * FROM fees WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Fee record not found.' });

    const { title, feeType, amountEtb, discountEtb, dueDate, status } = req.body || {};
    const nextAmount = amountEtb !== undefined ? Number(amountEtb) : Number(existing.amount_etb);
    const nextDiscount = discountEtb !== undefined ? Number(discountEtb) : Number(existing.discount_etb || 0);
    const netTotal = Math.max(nextAmount - nextDiscount, 0);
    const paid = Number(existing.paid_etb || 0);
    const computedStatus = status || (paid >= netTotal ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid');

    await run(
      `UPDATE fees SET
        title = COALESCE(?, title),
        fee_type = COALESCE(?, fee_type),
        amount_etb = ?,
        discount_etb = ?,
        due_date = COALESCE(?, due_date),
        status = ?
       WHERE id = ?`,
      [title?.trim() || null, feeType || null, nextAmount, nextDiscount, dueDate || null, computedStatus, id]
    );
    await run(`UPDATE invoices SET amount_etb = ?, due_date = COALESCE(?, due_date), status = ? WHERE fee_id = ?`, [netTotal, dueDate || null, computedStatus, id]);

    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FEE_UPDATED',
      entityType: 'Fee',
      entityId: id,
      details: { title: title || existing.title, amountEtb: nextAmount, status: computedStatus },
    });
    return res.json({ message: 'Fee record updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.delete('/fees/:id', requireAuth, requireRole('Owner', 'Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await get(`SELECT * FROM fees WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND', message: 'Fee record not found.' });
    await run(`DELETE FROM invoices WHERE fee_id = ?`, [id]);
    await run(`DELETE FROM fees WHERE id = ?`, [id]);
    await logAudit({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FEE_DELETED',
      entityType: 'Fee',
      entityId: id,
      details: { title: existing.title },
    });
    return res.json({ message: 'Fee record deleted.' });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

router.get('/instructor-earnings', requireAuth, requireRole('Owner', 'Admin', 'Instructor'), async (req, res) => {
  try {
    const targetId = req.user.role === 'Instructor' ? req.user.id : Number(req.query.instructorId || req.user.id);
    const payouts = await query(
      `SELECT ip.*, CONCAT(u.first_name, ' ', u.last_name) AS instructor_name
       FROM instructor_payouts ip JOIN users u ON u.id = ip.instructor_id
       WHERE ip.instructor_id = ? ORDER BY ip.created_at DESC`,
      [targetId]
    );
    const totalPaid = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + Number(p.amount_etb), 0);
    const totalPending = payouts.filter((p) => p.status === 'Pending').reduce((s, p) => s + Number(p.amount_etb), 0);
    return res.json({ payouts, summary: { totalPaid, totalPending, totalEarned: totalPaid + totalPending } });
  } catch (err) {
    return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
