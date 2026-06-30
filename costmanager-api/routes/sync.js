const express = require('express');
const { v4: uuid } = require('uuid');
const { db } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/pull', (req, res) => {
  const since = req.query.since || '1970-01-01T00:00:00.000Z';
  const storesParam = req.query.stores;
  const stores = storesParam ? String(storesParam).split(',') : null;

  let rows;
  if (stores && stores.length) {
    const placeholders = stores.map(() => '?').join(',');
    rows = db
      .prepare(
        `SELECT * FROM business_data WHERE business_id = ? AND updated_at > ? AND store_name IN (${placeholders})`,
      )
      .all(req.auth.businessId, since, ...stores);
  } else {
    rows = db.prepare('SELECT * FROM business_data WHERE business_id = ? AND updated_at > ?').all(req.auth.businessId, since);
  }

  res.json({
    records: rows.map((r) => ({
      store: r.store_name,
      id: r.record_id,
      data: r.is_deleted ? null : JSON.parse(r.data),
      updatedAt: r.updated_at,
      isDeleted: !!r.is_deleted,
    })),
    serverTime: new Date().toISOString(),
  });
});

router.post('/push', (req, res) => {
  const { deviceId, records } = req.body || {};
  if (!Array.isArray(records)) return res.status(400).json({ message: 'records باید آرایه باشد' });

  const upsert = db.prepare(
    `INSERT INTO business_data (id, business_id, store_name, record_id, data, updated_at, updated_by, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(business_id, store_name, record_id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       is_deleted = excluded.is_deleted
     WHERE excluded.updated_at >= business_data.updated_at`,
  );

  const existing = db.prepare(
    'SELECT * FROM business_data WHERE business_id = ? AND store_name = ? AND record_id = ?',
  );

  const conflicts = [];
  let accepted = 0;

  const tx = db.transaction((items) => {
    for (const rec of items) {
      if (!rec || !rec.store || !rec.id) continue;
      const prior = existing.get(req.auth.businessId, rec.store, rec.id);
      if (prior && new Date(prior.updated_at) > new Date(rec.updatedAt)) {
        conflicts.push({
          id: rec.id,
          store: rec.store,
          serverData: prior.is_deleted ? null : JSON.parse(prior.data),
          clientData: rec.data,
        });
        continue;
      }
      upsert.run(
        `${req.auth.businessId}:${rec.store}:${rec.id}`,
        req.auth.businessId,
        rec.store,
        rec.id,
        JSON.stringify(rec.data ?? null),
        rec.updatedAt,
        req.auth.sub,
        rec.isDeleted ? 1 : 0,
      );
      accepted += 1;
    }
  });
  tx(records);

  db.prepare(
    'INSERT INTO sync_log (id, business_id, device_id, synced_at, records_pushed, records_pulled) VALUES (?, ?, ?, ?, ?, 0)',
  ).run(uuid(), req.auth.businessId, deviceId || 'unknown', new Date().toISOString(), accepted);

  res.json({ accepted, conflicts });
});

module.exports = router;
