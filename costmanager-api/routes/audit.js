const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('superadmin', 'manager', 'accountant'), (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const rows = db.prepare('SELECT * FROM audit_log WHERE business_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(req.auth.businessId, limit, offset);
  res.json({ log: rows });
});

module.exports = router;
