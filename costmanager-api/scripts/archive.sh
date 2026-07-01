#!/usr/bin/env bash
# archive.sh — move old business_data records (> 2 years) to archive table
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="${ROOT}/data/costmanager.db"
CUTOFF="$(date -d '2 years ago' --utc +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-2y -u +%Y-%m-%dT%H:%M:%SZ)"

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found: $DB_PATH"
  exit 1
fi

echo "Archiving records older than $CUTOFF..."

sqlite3 "$DB_PATH" <<SQL
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS archive_business_data (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT NOT NULL
);

INSERT OR IGNORE INTO archive_business_data
  SELECT id, business_id, store_name, record_id, data, updated_at, updated_by, is_deleted, datetime('now')
  FROM business_data
  WHERE updated_at < '$CUTOFF';

DELETE FROM business_data WHERE updated_at < '$CUTOFF' AND id IN (SELECT id FROM archive_business_data);

SELECT changes() || ' records archived.';
SQL

echo "Archive complete."
