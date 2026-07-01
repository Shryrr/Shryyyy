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
    ).run(uuid(), businessId, userId, userName, action, 'purchase_request', resourceId, detail ? JSON.stringify(detail) : null, ip, new Date().toISOString());
  } catch {}
}

function publicPR(row) {
  return {
    id: row.id,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    status: row.status,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    neededByDatetime: row.needed_by_datetime,
    estimatedTotal: row.estimated_total,
    note: row.note,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    estimatedPurchaseDatetime: row.estimated_purchase_datetime,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    actualTotal: row.actual_total,
    receiptUrl: row.receipt_url,
    completionNote: row.completion_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/purchase-requests
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM purchase_requests WHERE business_id = ? ORDER BY created_at DESC').all(req.auth.businessId);
  res.json({ requests: rows.map(publicPR) });
});

// POST /api/purchase-requests
router.post('/', (req, res) => {
  const { items, neededByDatetime, estimatedTotal, note } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) return res.status(400).json({ message: 'اقلام خرید الزامی است' });
  const id = uuid();
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare(
    `INSERT INTO purchase_requests (id, business_id, created_by, created_by_name, status, items, needed_by_datetime, estimated_total, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.auth.businessId, req.auth.sub, user?.full_name ?? 'نامشخص', 'pending', JSON.stringify(items), neededByDatetime ?? null, estimatedTotal ?? null, note ?? null, now, now);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'create', id, { itemCount: items.length }, req.ip);
  res.status(201).json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(id)) });
});

// POST /api/purchase-requests/:id/accept
router.post('/:id/accept', (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status !== 'pending') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const { estimatedPurchaseDatetime } = req.body || {};
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare('UPDATE purchase_requests SET status=?, accepted_by=?, accepted_at=?, estimated_purchase_datetime=?, updated_at=? WHERE id=?')
    .run('accepted', req.auth.sub, now, estimatedPurchaseDatetime ?? null, now, req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'accept', req.params.id, null, req.ip);
  res.json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id)) });
});

// POST /api/purchase-requests/:id/complete
router.post('/:id/complete', (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status === 'completed' || pr.status === 'cancelled') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const { actualTotal, receiptUrl, completionNote } = req.body || {};
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.auth.sub);
  db.prepare('UPDATE purchase_requests SET status=?, completed_by=?, completed_at=?, actual_total=?, receipt_url=?, completion_note=?, updated_at=? WHERE id=?')
    .run('completed', req.auth.sub, now, actualTotal ?? null, receiptUrl ?? null, completionNote ?? null, now, req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'complete', req.params.id, { actualTotal }, req.ip);
  res.json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(req.params.id)) });
});

// POST /api/purchase-requests/:id/cancel
router.post('/:id/cancel', requireRole('superadmin', 'manager'), (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status === 'completed' || pr.status === 'cancelled') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const now = new Date().toISOString();
  db.prepare('UPDATE purchase_requests SET status=?, updated_at=? WHERE id=?').run('cancelled', now, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
