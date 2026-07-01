# Deploying costmanager-api to the VPS (91.107.249.240)

This backend was built and verified inside the dev sandbox, but it cannot be
deployed from there — the sandbox has no network path to the real server.
Run the steps below on the VPS itself (as a user with sudo).

## 1. Get the code onto the server

```bash
sudo mkdir -p /var/www/costmanager-api
sudo chown "$USER":"$USER" /var/www/costmanager-api
git clone <your-repo-url> /tmp/costmanager-src
cp -r /tmp/costmanager-src/costmanager-api/. /var/www/costmanager-api/
cd /var/www/costmanager-api
```

(Or `git pull` directly if the repo is already cloned on the server — just
make sure you're on `claude/session-ijbgj3` or whatever branch/tag you've
merged this onto.)

## 2. Run setup

```bash
cd /var/www/costmanager-api
bash setup.sh
```

This installs Node 20 if missing, runs `npm install`, generates `.env`
with random `JWT_SECRET` / `JWT_REFRESH_SECRET` / `PLATFORM_OWNER_PASSWORD`,
and runs the first DB migration (creates `data/costmanager.db`, seeds the
platform owner and default subscription pricing).

**Save the printed `PLATFORM_OWNER_PASSWORD` immediately** — it is only
shown once. This is the login for `/platform-login` in the PWA.

Review `.env` afterwards and confirm `CORS_ORIGIN` matches the real origin
the PWA is served from (defaults to `http://91.107.249.240`).

## 3. Create the uploads directory

```bash
mkdir -p /var/www/costmanager-api/data/uploads
sudo chown -R www-data:www-data /var/www/costmanager-api/data
```

## 4. Install the systemd service

```bash
sudo cp deploy/costmanager-api.service /etc/systemd/system/costmanager-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now costmanager-api
sudo systemctl status costmanager-api
```

Check logs if anything looks wrong:

```bash
sudo journalctl -u costmanager-api -f
```

## 5. Wire up nginx

Copy the snippet and include it from the existing site config that already
serves the PWA static files:

```bash
sudo cp deploy/nginx-costmanager-api.conf /etc/nginx/snippets/costmanager-api.conf
sudo nano /etc/nginx/sites-available/costmanager   # add: include /etc/nginx/snippets/costmanager-api.conf;
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Smoke test

```bash
curl http://91.107.249.240/api/health
# {"ok":true}
```

```bash
curl -X POST http://91.107.249.240/api/platform/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"platform_admin","password":"<the saved password>"}'
```

Should return a token + expiresAt.

## 7. Schedule automated backup and archiving (crontab)

Run as the service user (`www-data`) or root. Edit crontab with:

```bash
sudo crontab -e
```

Add these lines:

```cron
# Daily backup at 02:00 — keeps last 30 days of .tar.gz snapshots
0 2 * * * /var/www/costmanager-api/scripts/backup.sh >> /var/log/costmanager-backup.log 2>&1

# Monthly archive on the 1st at 03:00 — moves records >2 years old to archive table
0 3 1 * * /var/www/costmanager-api/scripts/archive.sh >> /var/log/costmanager-archive.log 2>&1
```

Make the scripts executable (if not already):

```bash
chmod +x /var/www/costmanager-api/scripts/backup.sh
chmod +x /var/www/costmanager-api/scripts/archive.sh
```

Verify after first run:

```bash
ls -lh /var/www/costmanager-api/data/backups/
tail /var/log/costmanager-backup.log
```

## 8. Updating later

```bash
cd /var/www/costmanager-api
git pull
npm install
sudo systemctl restart costmanager-api
```

`server.js` runs migrations on every boot (`migrate()` is idempotent —
`CREATE TABLE IF NOT EXISTS`), so schema changes ship automatically on
restart.

## Notes

- `.env` and `data/` are gitignored on purpose — they hold secrets and the
  live database. Never commit them.
- The service runs as `www-data` per the unit file; make sure
  `/var/www/costmanager-api` (including `data/` and `data/uploads/`) is
  writable by that user:
  ```bash
  sudo chown -R www-data:www-data /var/www/costmanager-api
  ```
- Rate limits are in-memory per-process — restarting the service clears them.
- File uploads are stored in `data/uploads/` and served at `/api/uploads/<filename>`.
  Include that directory in your backup policy (the `backup.sh` script already
  handles it).
- The `archive.sh` script moves `business_data` rows older than 2 years into
  `archive_business_data`. The live table stays lean; the archive table is
  queryable in place.
