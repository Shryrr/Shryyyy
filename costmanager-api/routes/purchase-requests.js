const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// ── helpers ──────────────────────────────────────────────────────────────────

function logAudit(businessId, userId, userName, action, resourceId, detail, ip) {
  try {
    db.prepare(
      `INSERT INTO audit_log (id, business_id, user_id, user_name, action, resource_type, resource_id, detail, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuid(), businessId, userId, userName, action, 'purchase_request', resourceId,
      detail ? JSON.stringify(detail) : null, ip, new Date().toISOString());
  } catch {}
}

function publicPR(row) {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    requestedQty: row.requested_qty,
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
    actualPrice: row.actual_price,
    actualQty: row.actual_qty,
    actualTotal: row.actual_total,
    paymentMethod: row.payment_method,
    cashAmount: row.cash_amount,
    creditAmount: row.credit_amount,
    supplierId: row.supplier_id,
    invoiceRef: row.invoice_ref,
    invoiceImageUrl: row.invoice_image_url,
    receiptUrl: row.receipt_url,
    completionNote: row.completion_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Read an ingredient from the business_data sync store
function getIngredient(businessId, ingredientId) {
  const row = db.prepare(
    `SELECT data FROM business_data WHERE business_id=? AND store_name='ingredients' AND record_id=? AND is_deleted=0`,
  ).get(businessId, ingredientId);
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}

// Patch an ingredient back into business_data
function patchIngredient(businessId, ingredientId, byUserId, patch) {
  const row = db.prepare(
    `SELECT data FROM business_data WHERE business_id=? AND store_name='ingredients' AND record_id=? AND is_deleted=0`,
  ).get(businessId, ingredientId);
  if (!row) return;
  const merged = { ...JSON.parse(row.data), ...patch };
  db.prepare(
    `UPDATE business_data SET data=?, updated_at=?, updated_by=? WHERE business_id=? AND store_name='ingredients' AND record_id=?`,
  ).run(JSON.stringify(merged), new Date().toISOString(), byUserId, businessId, ingredientId);
}

// Core completion logic — runs inside caller's transaction
function applyCompletion(pr, body, userId, userName, businessId, ip) {
  const {
    actualPrice,
    actualQty,
    paymentMethod = 'cash',
    cashAmount,
    creditAmount,
    supplierId,
    invoiceRef,
    invoiceImageUrl,
    receiptUrl,
    note,
  } = body;

  const now = new Date().toISOString();
  const qty = Number(actualQty) || 0;
  const price = Number(actualPrice) || 0;
  const lineTotal = qty * price;

  let cash = 0;
  let credit = 0;
  if (paymentMethod === 'cash') {
    cash = Number(cashAmount) || lineTotal;
  } else if (paymentMethod === 'credit') {
    credit = Number(creditAmount) || lineTotal;
  } else if (paymentMethod === 'split') {
    cash = Number(cashAmount) || 0;
    credit = Number(creditAmount) || 0;
  }
  const actualTotal = cash + credit || lineTotal;

  // 1. Mark the request completed with full completion fields
  db.prepare(`
    UPDATE purchase_requests SET
      status='completed', completed_by=?, completed_at=?,
      actual_price=?, actual_qty=?, actual_total=?,
      payment_method=?, cash_amount=?, credit_amount=?,
      supplier_id=?, invoice_ref=?, invoice_image_url=?,
      receipt_url=?, completion_note=?, updated_at=?
    WHERE id=?
  `).run(
    userId, now,
    price || null, qty || null, actualTotal || null,
    paymentMethod, cash || null, credit || null,
    supplierId || null, invoiceRef || null, invoiceImageUrl || null,
    receiptUrl || null, note || null, now,
    pr.id,
  );

  // 2. Update ingredient stock + weighted average cost in business_data
  const ingredientId = pr.ingredient_id;
  if (ingredientId && qty > 0) {
    const ingredient = getIngredient(businessId, ingredientId);
    if (ingredient) {
      const oldStock = Number(ingredient.currentStock) || 0;
      const oldCost = Number(ingredient.unitCost) || 0;
      const newStock = oldStock + qty;
      // Weighted average price: if there was existing stock, blend; otherwise use new price
      const newCost = oldStock > 0 && price > 0
        ? (oldStock * oldCost + qty * price) / newStock
        : (price > 0 ? price : oldCost);
      patchIngredient(businessId, ingredientId, userId, {
        currentStock: parseFloat(newStock.toFixed(4)),
        unitCost: parseFloat(newCost.toFixed(4)),
      });
    }
  }

  // 3. Auto-approved petty cash expense for cash portion
  if ((paymentMethod === 'cash' || paymentMethod === 'split') && cash > 0) {
    db.prepare(`
      INSERT INTO petty_cash_transactions
        (id, business_id, type, amount, reason, requested_by, requested_by_name,
         status, approved_by, approved_at, date, created_at, receipt_url)
      VALUES (?, ?, 'expense', ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?)
    `).run(
      uuid(), businessId,
      cash,
      `پرداخت خرید #${pr.id.slice(0, 8)}${invoiceRef ? ' — ' + invoiceRef : ''}`,
      userId, userName,
      userId, now, now.slice(0, 10), now,
      receiptUrl || null,
    );
  }

  // 4. Supplier accounts-payable for credit portion
  if ((paymentMethod === 'credit' || paymentMethod === 'split') && credit > 0 && supplierId) {
    const supplier = db.prepare('SELECT id FROM suppliers WHERE id=? AND business_id=?').get(supplierId, businessId);
    if (supplier) {
      db.prepare('UPDATE suppliers SET balance=balance+?, updated_at=? WHERE id=?').run(credit, now, supplierId);
      db.prepare(`
        INSERT INTO supplier_transactions
          (id, business_id, supplier_id, purchase_request_id, type, amount, note, created_at)
        VALUES (?, ?, ?, ?, 'payable', ?, ?, ?)
      `).run(uuid(), businessId, supplierId, pr.id, credit, note || null, now);
    }
  }

  logAudit(businessId, userId, userName, 'complete', pr.id, { actualTotal, paymentMethod }, ip);
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/purchase-requests
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM purchase_requests WHERE business_id=? ORDER BY created_at DESC').all(req.auth.businessId);
  res.json({ requests: rows.map(publicPR) });
});

// POST /api/purchase-requests
// Required: ingredientId, requestedQty, neededByDatetime
// Guard: currentStock <= minStock (else 400)
router.post('/', (req, res) => {
  const { ingredientId, requestedQty, neededByDatetime, estimatedTotal, note } = req.body || {};

  if (!ingredientId) return res.status(400).json({ message: 'شناسه ماده اولیه الزامی است' });
  if (!requestedQty || Number(requestedQty) <= 0) return res.status(400).json({ message: 'مقدار درخواستی الزامی است' });
  if (!neededByDatetime) return res.status(400).json({ message: 'زمان نیاز الزامی است' });

  const ingredient = getIngredient(req.auth.businessId, ingredientId);
  if (!ingredient) return res.status(404).json({ message: 'ماده اولیه یافت نشد' });

  const currentStock = Number(ingredient.currentStock) ?? 0;
  const minStock = Number(ingredient.minStock) ?? 0;
  if (currentStock > minStock) {
    return res.status(400).json({ message: 'موجودی کافی است، درخواست نیاز نیست' });
  }

  const id = uuid();
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.auth.sub);
  const qty = Number(requestedQty);
  const items = [{ ingredientId, name: ingredient.name ?? ingredientId, requestedQty: qty }];

  db.prepare(`
    INSERT INTO purchase_requests
      (id, business_id, created_by, created_by_name, status,
       ingredient_id, requested_qty, items,
       needed_by_datetime, estimated_total, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.auth.businessId, req.auth.sub, user?.full_name ?? 'نامشخص',
    ingredientId, qty, JSON.stringify(items),
    neededByDatetime, estimatedTotal ?? null, note ?? null, now, now,
  );

  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'create', id,
    { ingredientId, requestedQty: qty, currentStock, minStock }, req.ip);

  res.status(201).json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id=?').get(id)) });
});

// POST /api/purchase-requests/batch-complete
// Body: { items: [{ id, actualPrice, actualQty, paymentMethod, cashAmount, creditAmount, supplierId, invoiceRef, invoiceImageUrl, receiptUrl, note }] }
router.post('/batch-complete', (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'اقلام الزامی است' });
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.auth.sub);
  const completed = [];
  const errors = [];

  const tx = db.transaction(() => {
    for (const item of items) {
      if (!item.id) { errors.push({ id: null, message: 'شناسه الزامی است' }); continue; }
      const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=? AND business_id=?').get(item.id, req.auth.businessId);
      if (!pr) { errors.push({ id: item.id, message: 'درخواست یافت نشد' }); continue; }
      if (pr.status === 'completed' || pr.status === 'cancelled') {
        errors.push({ id: item.id, message: 'وضعیت قابل تغییر نیست' }); continue;
      }
      applyCompletion(pr, item, req.auth.sub, user?.full_name ?? 'نامشخص', req.auth.businessId, req.ip);
      completed.push(item.id);
    }
  });

  try {
    tx();
  } catch (err) {
    return res.status(500).json({ message: err.message || 'خطا در ثبت دسته‌ای' });
  }

  res.json({ completed, errors });
});

// POST /api/purchase-requests/:id/accept
router.post('/:id/accept', (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=? AND business_id=?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status !== 'pending') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const { estimatedPurchaseDatetime } = req.body || {};
  const now = new Date().toISOString();
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.auth.sub);
  db.prepare('UPDATE purchase_requests SET status=?, accepted_by=?, accepted_at=?, estimated_purchase_datetime=?, updated_at=? WHERE id=?')
    .run('accepted', req.auth.sub, now, estimatedPurchaseDatetime ?? null, now, req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, user?.full_name, 'accept', req.params.id, null, req.ip);
  res.json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id=?').get(req.params.id)) });
});

// POST /api/purchase-requests/:id/complete
// Body: { actualPrice, actualQty, paymentMethod ('cash'|'credit'|'split'), cashAmount, creditAmount, supplierId, invoiceRef, invoiceImageUrl, receiptUrl, note }
router.post('/:id/complete', (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=? AND business_id=?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status === 'completed' || pr.status === 'cancelled') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const user = db.prepare('SELECT full_name FROM users WHERE id=?').get(req.auth.sub);
  try {
    db.transaction(() => applyCompletion(pr, req.body || {}, req.auth.sub, user?.full_name ?? 'نامشخص', req.auth.businessId, req.ip))();
  } catch (err) {
    return res.status(500).json({ message: err.message || 'خطا در ثبت تکمیل' });
  }
  res.json({ request: publicPR(db.prepare('SELECT * FROM purchase_requests WHERE id=?').get(req.params.id)) });
});

// POST /api/purchase-requests/:id/cancel
router.post('/:id/cancel', requireRole('superadmin', 'manager'), (req, res) => {
  const pr = db.prepare('SELECT * FROM purchase_requests WHERE id=? AND business_id=?').get(req.params.id, req.auth.businessId);
  if (!pr) return res.status(404).json({ message: 'درخواست یافت نشد' });
  if (pr.status === 'completed' || pr.status === 'cancelled') return res.status(400).json({ message: 'وضعیت قابل تغییر نیست' });
  const now = new Date().toISOString();
  db.prepare('UPDATE purchase_requests SET status=?, updated_at=? WHERE id=?').run('cancelled', now, req.params.id);
  logAudit(req.auth.businessId, req.auth.sub, null, 'cancel', req.params.id, null, req.ip);
  res.json({ ok: true });
});

module.exports = router;
