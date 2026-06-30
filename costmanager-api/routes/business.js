const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const USERNAME_RE = /^[a-zA-Z0-9_]{4,30}$/;

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: !!u.is_active,
    lastLogin: u.last_login,
  };
}

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE business_id = ?').all(req.auth.businessId);
  res.json({ users: users.map(publicUser) });
});

router.post('/users', requireRole('superadmin'), (req, res) => {
  const { username, password, fullName, role, email, phone } = req.body || {};
  if (!username || !password || !fullName || !role) return res.status(400).json({ message: 'اطلاعات ناقص است' });
  if (!USERNAME_RE.test(username)) return res.status(400).json({ message: 'نام کاربری نامعتبر است' });

  const existing = db
    .prepare('SELECT id FROM users WHERE business_id = ? AND username = ?')
    .get(req.auth.businessId, username);
  if (existing) return res.status(409).json({ message: 'این نام کاربری قبلاً استفاده شده است' });

  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, business_id, username, password_hash, full_name, email, phone, role, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(id, req.auth.businessId, username, bcrypt.hashSync(password, 12), fullName, email || null, phone || null, role, new Date().toISOString());

  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
});

router.patch('/users/:id', requireRole('superadmin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND business_id = ?').get(req.params.id, req.auth.businessId);
  if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });

  const { fullName, role, email, phone, isActive, password } = req.body || {};
  db.prepare(
    `UPDATE users SET
      full_name = COALESCE(?, full_name),
      role = COALESCE(?, role),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      is_active = COALESCE(?, is_active)
     WHERE id = ?`,
  ).run(fullName || null, role || null, email ?? null, phone ?? null, typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null, req.params.id);

  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), req.params.id);
  }

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)) });
});

module.exports = router;
