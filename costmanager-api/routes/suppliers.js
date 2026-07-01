const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function pub(s) {
  return { id: s.id, name: s.name, phone: s.phone, balance: s.balance, createdAt: s.created_at, updatedAt: s.updated_at };
}

// GET /api/suppliers
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM suppliers WHERE business_id=? ORDER BY name').all(req.auth.businessId);
  res.json({ suppliers: rows.map(pub) });
});

// POST /api/suppliers
router.post('/', (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ message: 'نام تامین‌کننده الزامی است' });
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO suppliers (id, business_id, name, phone, balance, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
  ).run(id, req.auth.businessId, name.trim(), phone?.trim() || null, now, now);
  res.status(201).json({ supplier: pub(db.prepare('SELECT * FROM suppliers WHERE id=?').get(id)) });
});

module.exports = router;
