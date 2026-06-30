const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { signAccessToken, requirePlatformAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'نام کاربری و رمز عبور الزامی است' });

  const owner = db.prepare('SELECT * FROM platform_owners WHERE username = ?').get(username);
  if (!owner || !bcrypt.compareSync(password, owner.password_hash)) {
    return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
  }

  const token = signAccessToken({ scope: 'platform', sub: owner.id, username: owner.username });
  res.json({ token, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() });
});

router.use(requirePlatformAuth);

function withMetrics(business) {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE business_id = ?').get(business.id).n;
  const lastSync = db
    .prepare('SELECT synced_at FROM sync_log WHERE business_id = ? ORDER BY synced_at DESC LIMIT 1')
    .get(business.id);
  const revenue = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM subscription_payments WHERE business_id = ? AND status = 'approved'`,
    )
    .get(business.id).total;

  return {
    id: business.id,
    name: business.name,
    type: business.type,
    city: business.city,
    subscriptionPlan: business.subscription_plan,
    subscriptionExpires: business.subscription_expires,
    subscriptionStatus: business.subscription_status,
    isActive: !!business.is_active,
    createdAt: business.created_at,
    userCount,
    lastSyncAt: lastSync ? lastSync.synced_at : null,
    totalRevenue: revenue,
  };
}

router.get('/businesses', (req, res) => {
  const businesses = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all();
  res.json({ businesses: businesses.map(withMetrics) });
});

router.get('/businesses/:id', (req, res) => {
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ message: 'کسب‌وکار یافت نشد' });
  const users = db.prepare('SELECT id, username, full_name, role, is_active, last_login FROM users WHERE business_id = ?').all(business.id);
  const payments = db
    .prepare('SELECT * FROM subscription_payments WHERE business_id = ? ORDER BY submitted_at DESC')
    .all(business.id);
  res.json({
    business: withMetrics(business),
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      isActive: !!u.is_active,
      lastLogin: u.last_login,
    })),
    payments,
  });
});

router.patch('/businesses/:id/subscription', (req, res) => {
  const { plan, expiresAt, status } = req.body || {};
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id);
  if (!business) return res.status(404).json({ message: 'کسب‌وکار یافت نشد' });

  db.prepare(
    `UPDATE businesses SET
      subscription_plan = COALESCE(?, subscription_plan),
      subscription_expires = COALESCE(?, subscription_expires),
      subscription_status = COALESCE(?, subscription_status)
     WHERE id = ?`,
  ).run(plan || null, expiresAt || null, status || null, req.params.id);

  res.json({ business: withMetrics(db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.params.id)) });
});

router.get('/payments/pending', (req, res) => {
  const payments = db
    .prepare(
      `SELECT sp.*, b.name AS business_name FROM subscription_payments sp
       JOIN businesses b ON b.id = sp.business_id
       WHERE sp.status = 'pending' ORDER BY sp.submitted_at ASC`,
    )
    .all();
  res.json({ payments });
});

router.post('/payments/:id/approve', (req, res) => {
  const payment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ message: 'پرداخت یافت نشد' });
  if (payment.status !== 'pending') return res.status(409).json({ message: 'این پرداخت قبلاً بررسی شده است' });

  const PLAN_DAYS = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };
  const days = PLAN_DAYS[payment.plan] || 30;
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(payment.business_id);
  const base =
    business.subscription_status === 'active' && new Date(business.subscription_expires) > new Date()
      ? new Date(business.subscription_expires)
      : new Date();
  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE subscription_payments SET status = 'approved', reviewed_by = ?, reviewed_at = ?, note = ? WHERE id = ?`,
  ).run(req.platformAuth.sub, now, req.body?.note || null, payment.id);

  db.prepare(
    `UPDATE businesses SET subscription_plan = ?, subscription_expires = ?, subscription_status = 'active' WHERE id = ?`,
  ).run(payment.plan, newExpiry, payment.business_id);

  res.json({ ok: true, newExpiry });
});

router.post('/payments/:id/reject', (req, res) => {
  const payment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ message: 'پرداخت یافت نشد' });
  if (payment.status !== 'pending') return res.status(409).json({ message: 'این پرداخت قبلاً بررسی شده است' });

  db.prepare(
    `UPDATE subscription_payments SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, note = ? WHERE id = ?`,
  ).run(req.platformAuth.sub, new Date().toISOString(), req.body?.note || null, payment.id);

  res.json({ ok: true });
});

router.get('/metrics', (req, res) => {
  const totals = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN subscription_status = 'trial' THEN 1 ELSE 0 END) AS trial,
        SUM(CASE WHEN subscription_status = 'expired' THEN 1 ELSE 0 END) AS expired
       FROM businesses`,
    )
    .get();
  const revenue = db
    .prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM subscription_payments WHERE status = 'approved'`)
    .get().total;
  res.json({ ...totals, totalRevenue: revenue });
});

router.get('/pricing', (req, res) => {
  res.json({ pricing: db.prepare('SELECT * FROM subscription_pricing').all() });
});

router.patch('/pricing', (req, res) => {
  const { plan, amount } = req.body || {};
  if (!plan || typeof amount !== 'number') return res.status(400).json({ message: 'اطلاعات ناقص است' });
  db.prepare(
    `INSERT INTO subscription_pricing (plan, amount, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(plan) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
  ).run(plan, amount, new Date().toISOString());
  res.json({ pricing: db.prepare('SELECT * FROM subscription_pricing').all() });
});

router.post('/broadcast', (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ message: 'پیام الزامی است' });
  db.prepare('INSERT INTO platform_broadcasts (id, message, created_at) VALUES (?, ?, ?)').run(
    uuid(),
    message,
    new Date().toISOString(),
  );
  res.json({ ok: true });
});

router.get('/broadcast/latest', (req, res) => {
  const latest = db.prepare('SELECT * FROM platform_broadcasts ORDER BY created_at DESC LIMIT 1').get();
  res.json({ broadcast: latest || null });
});

module.exports = router;
