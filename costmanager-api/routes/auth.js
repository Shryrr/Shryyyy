const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { signAccessToken, signRefreshToken, verifyRefreshToken, requireAuth, REFRESH_TTL_DAYS } = require('../auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{4,30}$/;
const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isStrongPassword(pw) {
  return (
    typeof pw === 'string' &&
    pw.length >= 8 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^a-zA-Z0-9]/.test(pw)
  );
}

function createSession({ userId, businessId, refreshToken }) {
  const now = new Date();
  const expires = new Date(now.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  db.prepare(
    `INSERT INTO sessions (id, user_id, business_id, refresh_token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uuid(), userId, businessId, hashToken(refreshToken), now.toISOString(), expires.toISOString());
}

function issueTokens(user) {
  const accessToken = signAccessToken({
    scope: 'business',
    sub: user.id,
    businessId: user.business_id,
    role: user.role,
  });
  const refreshToken = signRefreshToken({ scope: 'business', sub: user.id, businessId: user.business_id });
  createSession({ userId: user.id, businessId: user.business_id, refreshToken });
  return { accessToken, refreshToken };
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: !!u.is_active,
  };
}

function publicBusiness(b) {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    city: b.city,
    subscriptionPlan: b.subscription_plan,
    subscriptionExpires: b.subscription_expires,
    subscriptionStatus: b.subscription_status,
  };
}

router.post('/register', (req, res) => {
  const { businessName, businessType, city, managerName, username, password, email, phone, plan } = req.body || {};

  if (!businessName || !businessType || !managerName || !username || !password) {
    return res.status(400).json({ message: 'اطلاعات ناقص است' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ message: 'نام کاربری باید بین ۴ تا ۳۰ کاراکتر انگلیسی یا عدد باشد' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: 'رمز عبور ضعیف است: حداقل ۸ کاراکتر با حروف بزرگ، کوچک، عدد و نماد' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ message: 'این نام کاربری قبلاً استفاده شده است' });

  const now = new Date();
  const businessId = uuid();
  const trialExpires = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO businesses (id, name, type, city, subscription_plan, subscription_expires, subscription_status, trial_started, created_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 'trial', ?, ?, 1)`,
  ).run(businessId, businessName, businessType, city || null, plan || 'trial', trialExpires, now.toISOString(), now.toISOString());

  const userId = uuid();
  db.prepare(
    `INSERT INTO users (id, business_id, username, password_hash, full_name, email, phone, role, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'superadmin', 1, ?)`,
  ).run(userId, businessId, username, bcrypt.hashSync(password, 12), managerName, email || null, phone || null, now.toISOString());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId);
  const { accessToken, refreshToken } = issueTokens(user);

  res.status(201).json({
    token: accessToken,
    refreshToken,
    user: publicUser(user),
    business: publicBusiness(business),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  });
});

router.post('/login', (req, res) => {
  const { username, password, businessId } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'نام کاربری و رمز عبور الزامی است' });

  const query = businessId
    ? db.prepare('SELECT * FROM users WHERE username = ? AND business_id = ?').bind(username, businessId)
    : db.prepare('SELECT * FROM users WHERE username = ?').bind(username);
  const user = query.get();

  if (!user) return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(423).json({ message: 'حساب موقتاً قفل شده است', lockedUntil: user.locked_until });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    const attempts = (user.failed_attempts || 0) + 1;
    const lockedUntil =
      attempts >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString() : null;
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
      attempts,
      lockedUntil,
      user.id,
    );
    return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است' });
  }

  if (!user.is_active) return res.status(403).json({ message: 'حساب کاربری غیرفعال است' });

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?').run(
    new Date().toISOString(),
    user.id,
  );

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(user.business_id);
  const { accessToken, refreshToken } = issueTokens(user);

  res.json({
    token: accessToken,
    refreshToken,
    user: publicUser(user),
    business: publicBusiness(business),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  });
});

router.post('/refresh', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.refreshToken;
  if (!token) return res.status(401).json({ message: 'توکن یافت نشد' });

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ message: 'توکن منقضی یا نامعتبر است' });
  }

  const session = db
    .prepare(
      `SELECT * FROM sessions WHERE user_id = ? AND refresh_token_hash = ? AND revoked = 0 AND expires_at > ?`,
    )
    .get(payload.sub, hashToken(token), new Date().toISOString());
  if (!session) return res.status(401).json({ message: 'نشست نامعتبر است' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.is_active) return res.status(401).json({ message: 'کاربر یافت نشد' });

  const accessToken = signAccessToken({ scope: 'business', sub: user.id, businessId: user.business_id, role: user.role });
  res.json({ token: accessToken, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(req.auth.sub);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.sub);
  if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });
  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(req.auth.businessId);
  res.json({ user: publicUser(user), business: publicBusiness(business) });
});

module.exports = router;
