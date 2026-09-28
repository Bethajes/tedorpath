# Tedor Tutors

Public website, tutor-request form, and a staff admin dashboard for managing
incoming requests.

- **Frontend** — Vite + React 19 + TypeScript + Tailwind CSS v4 + React Router
- **Backend** — Node.js + Express 5
- **Database** — PostgreSQL 16 with Prisma 7

---

## Current stage

| Area | Status |
| --- | --- |
| Public website (home, about, contact, 404) | Done |
| Client request form at `/request-tutor` | Done, with client-side validation |
| `POST /api/tutor-requests` + PostgreSQL persistence | Done |
| Admin dashboard (`/admin`) | Done, **development-only access** |
| Tutor accounts, matching, payments, scheduling | Not started |

Full working flow today:

```
Client submits form  ->  POST /api/tutor-requests  ->  validated  ->  PostgreSQL
Admin opens /admin   ->  sees it as NEW  ->  changes status  ->  adds internal notes
```

---

## Prerequisites

- **Node.js 20+** (this project is developed on 22)
- **npm 10+**
- **PostgreSQL 16** running locally

Check them:

```bash
node -v
npm -v
pg_isready          # expect: accepting connections
```

If PostgreSQL is not installed, install it and start the service first
(`sudo systemctl start postgresql` on Linux).

---

## 1. Create the database (one time)

The app uses its own database and its own role — not `postgres` — so it cannot
accidentally touch your other databases.

```bash
# If your PostgreSQL allows local admin access without sudo:
psql -U postgres -c "CREATE ROLE tedorpath LOGIN PASSWORD 'choose-a-password';"
psql -U postgres -c "CREATE DATABASE tedorpath OWNER tedorpath;"

# Otherwise run the same statements as the postgres system user:
sudo -u postgres psql -c "CREATE ROLE tedorpath LOGIN PASSWORD 'choose-a-password';"
sudo -u postgres psql -c "CREATE DATABASE tedorpath OWNER TO tedorpath;"
```

Already created? `CREATE DATABASE` and `CREATE ROLE` will simply report that
they exist — that is fine.

Pick your own password and put it in `backend/.env` (step 2).

---

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set your database password:

```dotenv
DATABASE_URL="postgresql://tedorpath:your-password@127.0.0.1:5432/tedorpath?schema=public"
PORT=4000
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
ADMIN_API_TOKEN="a-long-random-string"
```

Generate an admin token:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Then install, set up the database and start:

```bash
npm install        # also runs `prisma generate` automatically
npm run setup      # prisma generate + apply migrations
npm run dev        # http://localhost:4000
```

Check it is alive:

```bash
curl http://localhost:4000/api/health
# {"success":true,"data":{"status":"ok"}}
```

---

## 3. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev        # http://localhost:5173
```

Open **http://localhost:5173**.

You do **not** need to set `VITE_API_URL` in development: the Vite dev server
proxies `/api/*` to the backend, so the browser only makes same-origin requests
and CORS is not involved.

> The dev server polls for file changes instead of using the OS `inotify`
> limits, because editors and AI tools can easily exhaust them on a shared
> machine (this is why hot reload is a moment slower here). If you have raised
> the host limit and want native watching back, start the server with
> `VITE_USE_POLLING=false npm run dev`.

---

## 4. Use the admin dashboard

1. Go to **http://localhost:5173/admin/login**
2. Paste the `ADMIN_API_TOKEN` value from `backend/.env`
3. You land on the dashboard: totals per status plus the 5 most recent requests
4. **Tutor Requests** — search by name/phone/email/subject, filter by status,
   page through results
5. Open a request to read the full submission, change its status and write
   internal notes, or delete it (with confirmation)

> ### The admin area is development-only
>
> There is **no authentication system** in this project yet. Access is a single
> shared token: no users, no roles, no sessions, no expiry, and anyone holding
> the token has full access to all client personal data.
>
> The backend refuses to start in production unless `ADMIN_API_TOKEN` is set, and
> every `/api/admin` request is rejected without a valid token. That is a
> boundary, **not** authentication. Replace `backend/src/middleware/adminAuth.js`
> with real staff authentication before deploying publicly. Everything else in
> the admin module can stay as it is.

---

## Project layout

```
backend/
  prisma/schema.prisma              TutorRequest model + status enum
  prisma/migrations/                applied migrations
  prisma7.config.ts                 Prisma 7 config (connection URL lives here)
  src/app.js                        Express app, CORS, error handling
  src/config/env.js                 environment access
  src/lib/prisma.js                 Prisma client + pool
  src/middleware/adminAuth.js       admin guard (dev-only token)
  src/modules/tutorRequests/        public submission endpoint
  src/modules/adminRequests/        admin read/update/delete endpoints
  src/routes/health.js              GET /api/health
  tests/                            API tests (node:test)

frontend/
  public/brand/tedor-mark.svg       the logo artwork (single source of truth)
  public/favicon.svg                favicon, mirrors the mark
  src/app/                          router, public/admin page maps, admin guard
  src/components/brand/Logo.tsx     logo + wordmark component
  src/components/ui/                Button, Input, Select, Textarea, Field, Card, Alert
  src/components/layout/            public Navbar/Footer/PageShell, admin AdminShell
  src/components/home/              homepage sections + subject catalogue
  src/features/tutorRequest/        public form, Zod schema, API call
  src/features/adminRequests/       admin API, types, components
  src/pages/                        all route components
  src/lib/                          api client, query helpers, hooks
```

### Brand

The logo is a real asset at `frontend/public/brand/tedor-mark.svg` and is
referenced through `LOGO_SRC` in `src/components/brand/Logo.tsx`. To swap in
official artwork, replace that one file — no component needs to change. The
colours in the mark (`#1E96E8`, `#F5801F`) are mirrored by the `brand-*` and
`accent-*` ramps in `src/index.css`.

The homepage discovery panel and the subject cards are **discovery UI, not a
matching engine**. They carry the visitor's choices to `/request-tutor` as
`?subject=&level=&mode=`, where they become the form's starting values. Any
value that is not one of the accepted `SUBJECTS` / `EDUCATION_LEVELS` /
`LEARNING_MODES` entries is ignored, so a hand-edited URL cannot put the form
into an invalid state.

---

## API

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/tutor-requests` | Submit a request. `201` returns `{ id }` |

### Admin (all require `Authorization: Bearer <ADMIN_API_TOKEN>`)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | Counts per status |
| `GET` | `/api/admin/tutor-requests` | `?page&limit&status&q`, newest first, `limit` max 100 |
| `GET` | `/api/admin/tutor-requests/:id` | Full record including internal notes |
| `PATCH` | `/api/admin/tutor-requests/:id` | **Only** `status` and `adminNotes` |
| `DELETE` | `/api/admin/tutor-requests/:id` | Permanent |

The PATCH endpoint rejects any attempt to change what the client submitted, so
the stored record always reflects the original request.

---

## Tests

```bash
cd backend  && npm test     # API tests against a real app + real database
cd frontend && npm test     # admin UI tests (vitest + Testing Library)
```

Backend tests create and clean up their own records. They need `ADMIN_API_TOKEN`
in `backend/.env` and a working database.

Other checks:

```bash
cd frontend && npx tsc -b --force   # types
cd frontend && npm run lint         # lint
cd frontend && npm run build        # production build
cd backend  && npm run db:status    # migration status
```

---

## Environment variables

**Backend** (`backend/.env`, never committed)

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PORT` | no (4000) | API port |
| `CORS_ORIGINS` | yes | Comma-separated allowed browser origins |
| `ADMIN_API_TOKEN` | yes in production | Shared admin token |
| `NODE_ENV` | no | `production` enables the admin safety checks |

**Frontend** (`frontend/.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_DEV_API_TARGET` | no | Where the dev server proxies `/api` (default `http://localhost:4000`) |
| `VITE_API_URL` | no | Absolute API URL. Leave unset in development; set in production if the API is on another host |

Never put a secret in a `VITE_*` variable — everything prefixed `VITE_` is
inlined into the browser bundle and is public.

---

## Troubleshooting

**`SyntaxError: Named export 'PrismaClient' not found`**
The Prisma client has not been generated. Run `npm run db:generate` in
`backend/`. (`npm install` does this automatically going forward.)

**`P3014: could not create the shadow database`**
Only affects `npm run db:migrate:dev`. It needs a role with `CREATEDB`. Use
`npm run db:migrate` (`migrate deploy`) instead, which does not need it.

**`permission denied for schema public`**
The database is not owned by the app role. Re-run:
`sudo -u postgres psql -c "ALTER DATABASE tedorpath OWNER TO tedorpath;"`

**`ECONNREFUSED` / `Unable to connect` from the frontend**
The backend is not running on port 4000, or `VITE_DEV_API_TARGET` points
somewhere else. Check `curl http://localhost:4000/api/health`.

**`ENOSPC: System limit for number of file watchers reached`**
The OS `inotify` watch limit for your user is full. This project already avoids
it by polling, so if you still see this from another tool, raise the limit:

```bash
echo 'fs.inotify.max_user_watches=524288' | sudo tee /etc/sysctl.d/99-inotify.conf
sudo sysctl --system
```

Check current usage before blaming this project:

```bash
grep -h "^inotify wd:" /proc/*/fdinfo/* 2>/dev/null | wc -l
cat /proc/sys/fs/inotify/max_user_watches
```

On this machine a single AI editor process held ~46,000 of the 65,536 watches,
so the limit was nearly full before any of this project's dev servers started.

**Admin page shows "Unable to load tutor requests"**
Usually a missing or wrong `ADMIN_API_TOKEN`. Sign out and re-enter it. If the
token changed, restart the backend.

**Admin returns 401 immediately after signing in**
The token in `backend/.env` is not the one you pasted. The `/api/admin` guard
always applies, in development too.
