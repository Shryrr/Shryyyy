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

## 3. Install the systemd service

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

## 4. Wire up nginx

Copy the snippet and include it from the existing site config that already
serves the PWA static files:

```bash
sudo cp deploy/nginx-costmanager-api.conf /etc/nginx/snippets/costmanager-api.conf
sudo nano /etc/nginx/sites-available/costmanager   # add: include /etc/nginx/snippets/costmanager-api.conf;
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Smoke test

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

## 6. Updating later

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
  live database. Never commit them. Back up `data/costmanager.db` directly
  on the server if you need backups (e.g. a cron'd `sqlite3 .backup`).
- The service runs as `www-data` per the unit file; make sure
  `/var/www/costmanager-api` (including `data/`) is writable by that user
  (`sudo chown -R www-data:www-data /var/www/costmanager-api`).
- Rate limits are in-memory per-process — restarting the service clears
  them.
