const jwt = require('jsonwebtoken');

const ACCESS_TTL = '8h';
const REFRESH_TTL_DAYS = 30;

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL, algorithm: 'HS256' });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: `${REFRESH_TTL_DAYS}d`,
    algorithm: 'HS256',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'توکن یافت نشد' });
  try {
    const payload = verifyAccessToken(token);
    if (payload.scope !== 'business') return res.status(401).json({ message: 'توکن نامعتبر' });
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'توکن منقضی یا نامعتبر است' });
  }
}

function requirePlatformAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'توکن یافت نشد' });
  try {
    const payload = verifyAccessToken(token);
    if (payload.scope !== 'platform') return res.status(401).json({ message: 'توکن نامعتبر' });
    req.platformAuth = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'توکن منقضی یا نامعتبر است' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'دسترسی غیرمجاز' });
    }
    next();
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requireAuth,
  requirePlatformAuth,
  requireRole,
  REFRESH_TTL_DAYS,
};
