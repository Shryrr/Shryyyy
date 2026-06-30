const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/status', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.auth.businessId);
  if (!business) return res.status(404).json({ message: 'کسب‌وکار یافت نشد' });
  const pending = db
    .prepare(`SELECT * FROM subscription_payments WHERE business_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`)
    .get(business.id);
  res.json({
    plan: business.subscription_plan,
    status: business.subscription_status,
    expiresAt: business.subscription_expires,
    pendingPayment: pending || null,
  });
});

router.post('/payment', requireRole('superadmin', 'manager'), (req, res) => {
  const { plan, amount, transferRef, description } = req.body || {};
  if (!plan || typeof amount !== 'number') return res.status(400).json({ message: 'اطلاعات ناقص است' });

  const id = uuid();
  db.prepare(
    `INSERT INTO subscription_payments (id, business_id, plan, amount, transfer_ref, description, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(id, req.auth.businessId, plan, amount, transferRef || null, description || null, new Date().toISOString());

  res.status(201).json({ payment: db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(id) });
});

router.get('/pricing', (req, res) => {
  res.json({ pricing: db.prepare('SELECT * FROM subscription_pricing').all() });
});

module.exports = router;
