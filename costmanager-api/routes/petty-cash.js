const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function logAudit(businessId, userId, userName, action, resourceId, detail, ip) {
  try {
    db.prepare(
      `INSERT INTO audit_log (id, business_id, user_id, user_name, action, resource_type, resource_id, detail, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuid(), businessId, userId, userName, action, 'petty_cash', resourceId, detail ? JSON.stringify(detail) : null, ip, new Date().toISOString());
  } catch {}
}

function publicTransaction(t) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    reason: t.reason,
    requestedBy: t.requested_by,
    requestedByName: t.requested_by_name,
    status: t.status,
    approvedBy: t.approved_by,
    approvedAt: t.approved_at,
    date: t.date,
    createdAt: t.created_at,
    receiptUrl: t.receipt_url,
  };
}

function computeBalance(transactions) {
  let balance = 0;
  for (const t of transactions) {
    if (t.status !== 'approved') continue;
    if (t.type === 'deposit') balance += t.amount;
    else balance -= t.amount;
  }
  return balance;
}

function getPermission(businessId, userId, role) {
  const perm = db.prepare('SELECT * FROM petty_cash_permissions WHERE business_id = ? AND user_id = ?').get(businessId, userId);
  if (perm) return { canView: !!perm.can_view, canWithdraw: !!perm.can_withdraw, canRequest: !!perm.can_request };
  if (role === 'superadmin' || role === 'manager') return { canView: true, canWithdraw: true, canRequest: true };
  return { canView: true, canWithdraw: false, canRequest: true };
}

// GET /api/petty-cash
router.get('/', (req, res) => {
  const perm = getPermission(req.auth.businessId, req.auth.sub, req.auth.role);
  if (!perm.canView) return res.status(403).json({ message: 'دسترسی غیرمجاز' });
  const transactions = db.prepare('SELECT * FROM petty_cash_transactions WHERE business_id = ? ORDER BY created_at DESC').all(req.auth.businessId);
  res.json({ transactions: transactions.map(publicTransaction), balance: computeBalance(transactions) });
});

// POST /api/petty-cash
router.post('/', (req, res) => {
  const perm = getPermission(req.auth.businessId, req.auth.sub, req.auth.role);
  const { type, amount, reason, date, receiptUrl } = req.body || {};
  if (!type || !amount || !reason) return res.status(400).json({ message: 'اطلاعات ناقص است' });
  if (amount <= 0) return res.status(400).json({ message: 'مبلغ باید بیشتر از صفر باشد' });
  if (type === 'deposit' && !['superadmin', 'manager'].includes(req.auth.role)) return res.status(403).json({ message: 'فقط مدیران می‌توانند واریز کنند' });
  if (type === 'withdrawal' && !perm.canWithdraw) return res.status(403).json({ message: 'مجوز برداشت ندارید' });
  if (type === 'expense' && !perm.canRequest) return res.status(403).json({ message: 'مجوز درخواست هزینه ندارید' });

  const id = uuid();
  const status = type === 'expense' ? 'pending' : 'approved';
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare(
    `INSERT INTO petty_cash_transactions (id, business_id, type, amount, reason, requested_by, requested_by_name, status, date, created_at, receipt_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.auth.businessId, type, amount, reason, req.auth.sub, user?.full_name ?? 'نامشخص', status, date ?? now, now, receiptUrl ?? null);

  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'create', id, { type, amount }, req.ip);
  res.status(201).json({ transaction: publicTransaction(db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ?').get(id)) });
});

// POST /api/petty-cash/:id/approve
router.post('/:id/approve', requireRole('superadmin', 'manager'), (req, res) => {
  const tx = db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!tx) return res.status(404).json({ message: 'تراکنش یافت نشد' });
  if (tx.status !== 'pending') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare('UPDATE petty_cash_transactions SET status=?, approved_by=?, approved_at=? WHERE id=?').run('approved', req.auth.sub, new Date().toISOString(), req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'approve', req.params.id, null, req.ip);
  res.json({ transaction: publicTransaction(db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ?').get(req.params.id)) });
});

// POST /api/petty-cash/:id/reject
router.post('/:id/reject', requireRole('superadmin', 'manager'), (req, res) => {
  const tx = db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!tx) return res.status(404).json({ message: 'تراکنش یافت نشد' });
  if (tx.status !== 'pending') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare('UPDATE petty_cash_transactions SET status=?, approved_by=?, approved_at=? WHERE id=?').run('rejected', req.auth.sub, new Date().toISOString(), req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'reject', req.params.id, null, req.ip);
  res.json({ transaction: publicTransaction(db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ?').get(req.params.id)) });
});

// DELETE /api/petty-cash/:id
router.delete('/:id', requireRole('superadmin', 'manager'), (req, res) => {
  const tx = db.prepare('SELECT * FROM petty_cash_transactions WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!tx) return res.status(404).json({ message: 'تراکنش یافت نشد' });
  db.prepare('DELETE FROM petty_cash_transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/petty-cash/permissions
router.get('/permissions', requireRole('superadmin', 'manager'), (req, res) => {
  const permissions = db.prepare('SELECT * FROM petty_cash_permissions WHERE business_id = ?').all(req.auth.businessId);
  const users = db.prepare('SELECT id, full_name, role, is_active FROM users WHERE business_id = ?').all(req.auth.businessId);
  res.json({
    permissions: permissions.map((p) => ({
      userId: p.user_id, canView: !!p.can_view, canWithdraw: !!p.can_withdraw, canRequest: !!p.can_request, updatedAt: p.updated_at,
    })),
    users,
  });
});

// PUT /api/petty-cash/permissions/:userId
router.put('/permissions/:userId', requireRole('superadmin', 'manager'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND business_id = ?').get(req.params.userId, req.auth.businessId);
  if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });
  const { canView = true, canWithdraw = false, canRequest = true } = req.body || {};
  db.prepare(
    `INSERT INTO petty_cash_permissions (id, business_id, user_id, can_view, can_withdraw, can_request, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(business_id, user_id) DO UPDATE SET can_view=excluded.can_view, can_withdraw=excluded.can_withdraw, can_request=excluded.can_request, updated_at=excluded.updated_at`,
  ).run(uuid(), req.auth.businessId, req.params.userId, canView ? 1 : 0, canWithdraw ? 1 : 0, canRequest ? 1 : 0, new Date().toISOString());
  res.json({ ok: true });
});

module.exports = router;
