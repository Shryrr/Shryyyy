#!/usr/bin/env bash
# backup.sh — dump the SQLite database and uploads to a timestamped archive
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${ROOT}/data"
BACKUP_DIR="${DATA_DIR}/backups"
TS="$(date +%Y%m%d_%H%M%S)"
DEST="${BACKUP_DIR}/backup_${TS}"

mkdir -p "$DEST"

# Dump SQLite with .backup command (safe while DB is live)
DB_PATH="${DATA_DIR}/costmanager.db"
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '${DEST}/costmanager.db'"
  echo "Database backed up to ${DEST}/costmanager.db"
fi

# Copy uploads
UPLOADS_DIR="${DATA_DIR}/uploads"
if [ -d "$UPLOADS_DIR" ]; then
  cp -r "$UPLOADS_DIR" "${DEST}/uploads"
  echo "Uploads copied to ${DEST}/uploads"
fi

# Compress
tar -czf "${BACKUP_DIR}/backup_${TS}.tar.gz" -C "$BACKUP_DIR" "backup_${TS}"
rm -rf "$DEST"
echo "Backup complete: ${BACKUP_DIR}/backup_${TS}.tar.gz"

# Prune backups older than 30 days
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete
echo "Old backups pruned."
