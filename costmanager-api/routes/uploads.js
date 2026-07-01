const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

function checkMagicBytes(buffer, mimeType) {
  if (mimeType === 'image/webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  }
  const sig = MAGIC_BYTES[mimeType];
  if (!sig) return false;
  return sig.every((byte, i) => buffer[i] === byte);
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../data/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(allowed.includes(file.mimetype) ? null : new Error('فرمت فایل مجاز نیست'), allowed.includes(file.mimetype));
  },
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'فایلی ارسال نشده است' });
  const { buffer, originalname, mimetype, size } = req.file;
  if (!checkMagicBytes(buffer, mimetype)) return res.status(400).json({ message: 'فرمت فایل معتبر نیست' });
  const ext = path.extname(originalname) || '.bin';
  const filename = `${uuid()}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  const id = uuid();
  const relPath = `/api/uploads/${filename}`;
  db.prepare('INSERT INTO uploads (id, business_id, uploaded_by, original_name, mime_type, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.auth.businessId, req.auth.sub, originalname, mimetype, size, relPath, new Date().toISOString());
  res.status(201).json({ id, url: relPath });
});

router.get('/:filename', (req, res) => {
  const filepath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ message: 'فایل یافت نشد' });
  res.sendFile(filepath);
});

module.exports = router;
