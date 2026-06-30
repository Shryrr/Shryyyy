require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { migrate } = require('./db');

for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env — run setup.sh first.`);
    process.exit(1);
  }
}

migrate();

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://91.107.249.240',
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/platform/login', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/platform', require('./routes/platform'));
app.use('/api/business', require('./routes/business'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/subscription', require('./routes/subscription'));

app.use((req, res) => res.status(404).json({ message: 'یافت نشد' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'خطای داخلی سرور' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`costmanager-api listening on :${port}`));
