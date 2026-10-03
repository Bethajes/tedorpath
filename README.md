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
| Client request wizard at `/request-tutor` | Done — 11 steps, adaptive on country |
| Database-driven countries, currencies, curricula, subjects | Done |
| `POST /api/tutor-requests` + PostgreSQL persistence | Done |
| Admin dashboard (`/admin`) | Done, **development-only access** |
| User accounts, sessions, sign-in / sign-up pages | Done, email + password |
| Google sign-in | Built and tested, **switched off** until its redirect URI is registered |
| Phone OTP, Telegram, password reset, email verification | Not started |
| Tutor accounts, matching, payments, scheduling | Not started |

Full working flow today:

```
Client opens /request-tutor ->  GET /api/onboarding/config  ->  wizard renders
Client answers 11 steps   ->  POST /api/tutor-requests    ->  validated  ->  PostgreSQL
Admin opens /admin   ->  sees it as NEW  ->  changes status  ->  adds internal notes
Visitor signs up     ->  POST /api/auth/register  ->  user + credentials account
                      ->  session row  ->  HttpOnly cookie  ->  navbar shows their name
Visitor signs in     ->  POST /api/auth/login  ->  same cookie  ->  GET /api/auth/me works
Visitor signs out    ->  POST /api/auth/logout  ->  session revoked  ->  cookie cleared
```

### Authentication

Real user authentication, separate from the admin token:

- **One account, many sign-in methods.** `User` is the person; `Account` rows
  are the ways they prove who they are (`CREDENTIALS` today, `GOOGLE`,
  `PHONE`, `TELEGRAM` later). Signing in with a second provider reaches the
  same user rather than creating a second one.
- **Passwords** are hashed with Argon2id (OWASP parameters, 19 MiB / 2 passes /
  1 lane). The plaintext never leaves the request, and no response can carry a
  hash — user rows are read through an explicit allow-list of columns.
- **Sessions are opaque.** The browser holds a 256-bit random token in an
  HttpOnly, `SameSite=Lax` cookie (`Secure` in production); the database stores
  only its SHA-256 digest, so a database leak cannot be replayed as a login.
  Signing out revokes the row rather than deleting it.
- **No token in browser storage.** Nothing is written to `localStorage` or
  `sessionStorage`, so there is nothing for a cross-site script to read.
- **Roles are never accepted from input.** Public registration can only ever
  produce a `CLIENT`; the schemas reject unknown keys, so a `role` in the body
  is refused outright rather than quietly ignored.
- **Sign-in failures are indistinguishable**: the same code, message and status
  whether the address is unknown, the password is wrong, or the account has no
  password — and the unknown-address path still pays for a hash comparison so
  the response time does not give it away.
- **The admin dashboard is untouched.** It keeps its own shared-token guard, and
  a normal user's session cookie does not open it.
- A signed-in visitor's tutor request is linked to their account, but signing in
  is never required to ask for a tutor.

### Google sign-in

The authorization-code flow with PKCE, driven entirely by the API. The button
on `/login` and `/register` is a plain link to `/api/auth/google`; the browser
holds no client id, no secret and no OAuth state.

- **CSRF + replay protection.** A random `state` and a PKCE `code_verifier` are
  generated per attempt and stored server-side in the `login_flows` table
  (hashed), so neither can be forged by the client. The flow row is deleted the
  moment it is used, which is what makes a callback URL single-use, and it
  expires after five minutes.
- **One person, one account.** A Google identity is keyed on Google's `sub`, so
  an account can only ever belong to one Tedor user. If somebody who already has
  a password account signs in with Google at the same address, the provider is
  **linked** to that account rather than creating a rival one. Linking only ever
  happens on a **verified** email: an unverified address is refused rather than
  used to claim somebody's email.
- **Failures are the API's to explain.** The callback redirects back to the
  website with a short code (`?authError=…`), and the login page turns that into
  a sentence. Google's own error text and the client secret never reach the
  browser.

Configuring it, all backend-side:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | to enable | OAuth client id |
| `GOOGLE_AUTH_ENABLED` | no (on) | `false` hides Google from the sign-in pages |
| `GOOGLE_CLIENT_SECRET` | no | Only for a confidential "Web application" client |
| `GOOGLE_REDIRECT_URI` | no | Overrides the callback URL (see below) |
| `FRONTEND_URL` | no | Where the browser is sent after sign-in |

**Google is currently switched off** (`GOOGLE_AUTH_ENABLED=false` in
`backend/.env`) because its redirect URI is not registered in the Google Cloud
console yet. The sign-in pages read `/api/auth/providers` and show a provider
button only when the server says it is usable, so nothing half-configured is
offered to a visitor. Flip the flag to `true` — no code change, no rebuild — once
`npm run auth:check` says Google accepts the redirect URI.

**The callback must be answered on the origin the app is served from.** The
session cookie is set by whoever answers the callback, and a browser only sends
cookies back to the origin that stored them — so a callback answered on the API's
own host leaves the visitor apparently signed in but not actually holding a
session. The dev server and nginx both proxy `/api` and forward the original
host, so the app derives that origin from `x-forwarded-host` and the whole
conversation happens on the app's own origin. When the API has its own host in
production there is no proxy, the API answers the callback, and the app sends
the cookie back with `credentials: 'include'`.

**Check it at any time:**

```bash
cd backend && npm run auth:check
```

That asks the app which redirect URI it will use and asks Google whether it is
registered, so a failure reads as "add this one line" rather than a guess:

```
  redirect URI  http://localhost:5173/api/auth/google/callback
  ✗ Google does not recognise this redirect URI.
```

Register it in the Google Cloud console (APIs & Services → Credentials → your
client → *Authorized redirect URIs*), matching character for character, then run
the command again. If Google accepts it but refuses a particular account, the
app is still in the **Testing** publishing status and that account has to be
listed under *OAuth consent screen → Test users*.

Not built yet, deliberately: phone OTP, Telegram, password reset, email
verification, and any client/tutor area to protect.

---

## Prerequisites

- **Node.js 20.19+** (this project is developed on 22). Prisma 7 requires it, and
  so does the Argon2 native module the API hashes passwords with — on Node 18
  `npm test` crashes rather than reporting a failure.
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
npm run db:seed    # reference data + demo tutors
npm run dev        # http://localhost:4000
```

Check it is alive:

```bash
curl http://localhost:4000/api/health
# {"success":true,"data":{"status":"ok"}}
```

### Reference data

`npm run setup` creates the schema. It does **not** populate it. Only the two
`markets` rows come from a migration — the 68 countries, 61 currencies, the
education systems and levels, the 42 subjects and the 7 learning goals are all
written by `npm run db:seed`, which the request wizard, the subject list and the
tutor directory cannot work without.

So on any new environment, migrations alone are not enough:

```bash
npm run setup && npm run db:seed
```

On **production**, `db:seed` refuses to run by default, because it also creates
demo tutors. To provision reference data there, acknowledge it explicitly — the
demo tutors are still never created:

```bash
NODE_ENV=production node prisma/seed.js --allow-production
```

Both halves use upserts, so re-running is safe and only ever fills in what is
missing.

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
  prisma/schema.prisma              User/Account/Session + TutorRequest models
  prisma/migrations/                applied migrations
  prisma7.config.ts                 Prisma 7 config (connection URL lives here)
  src/app.js                        Express app, CORS, error handling
  src/config/env.js                 environment access
  src/lib/prisma.js                 Prisma client + pool
  src/lib/validators.js             shared input patterns
  src/middleware/adminAuth.js       admin guard (dev-only token)
  src/modules/auth/                 register/login/logout/me, sessions, Argon2id, Google OAuth
  src/modules/tutorRequests/        public submission endpoint
  src/modules/onboarding/          GET /api/onboarding/config (reference data) and /market
  src/modules/adminRequests/        admin read/update/delete endpoints
  prisma/onboardingConfigData.js   reference data used by the seed (countries, levels, subjects)
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
  src/features/tutorRequest/        the wizard: steps, stepper, choice groups, review, schema
  src/features/auth/                auth store, provider, guard, sign-in/up pages
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
`?subject=&level=&mode=`, where they become the wizard's starting values. The
wizard resolves the subject and the level against its own catalogue, so a link
to a subject added after those links were built still works; a value matching
nothing is simply not pre-filled, which a hand-edited URL cannot turn into an
invalid answer. Only the teaching mode is checked against a fixed list, because
it is a delivery method with exactly three values rather than catalogue content.

---

## The adaptive tutor-request wizard

`/request-tutor` is an eleven-step wizard rather than one long form. It is
built around a single question — *what country is this person in?* — because the
answer to that decides everything downstream: which currency a budget is quoted
in, which timezone lessons are scheduled in, which education levels are offered,
and which subjects are suggested first.

### The flow

| # | Step | Collected |
| --- | --- | --- |
| 1 | Country | Which country, which selects the currency, timezone and curriculum |
| 2 | Education level | From that country's curriculum, grouped by stage |
| 3 | Subjects | Multiple, with the level's subjects suggested first, plus "Other" |
| 4 | Main goal | Grades, exams, homework, skills, university prep, professional, other |
| 5 | Teaching mode | Online, in person, or either |
| 6 | Location | Required only when a tutor could turn up in a room |
| 7 | Availability | Days, time ranges, and the timezone they are expressed in |
| 8 | Budget | An amount **and** a currency, always as two fields |
| 9 | About the learner | What they need help with, and anything else |
| 10 | Your details | Name and phone, plus optional email and Telegram |
| 11 | Review | Everything above, with an Edit link per section |

Step 10 is the one addition to the specified flow. The API has always required a
name and a phone number, and there is nowhere sensible to collect them inside the
ten steps above, so they get a step of their own between the last question and
the review.

### Configuration lives in the database

Nothing in the wizard is a list in React. `GET /api/onboarding/config` returns
the whole configuration in one document, and each part is a table:

| Table | Holds | Notes |
| --- | --- | --- |
| `currencies` | ISO 4217 codes, names, symbols, decimal places | What the budget field is labelled with |
| `countries` | Code, currency, timezone, education system | ISO 3166-1 alpha-2 |
| `education_systems` | A named curriculum | `isDefault` is the fallback for countries without their own |
| `education_levels` | Stages within a curriculum, with `aliases` | Aliases keep older links resolving after a rename |
| `education_level_subjects` | Which subjects a level usually covers | Suggestions, never a limit |
| `learning_goals` | Why someone is asking | Configurable, like everything else |
| `subjects` | The existing catalogue | Extended from 10 rows to 34 |

Adding a country, a currency or a curriculum is therefore a data change an
operator makes; it reaches the form on the next page load with no deploy. A
country with no configuration of its own inherits the generic international
system, so adding a country never means inventing its grades first.

The indirection through `education_systems` is the important part: the wizard
never branches on a country code, it follows `country → educationSystem →
levels`. Giving a third country its own structure means adding a row, not
changing application code.

### Money and time are never converted

This is the rule the whole budget step is built around, and it is enforced in
three places:

- **The database** refuses to hold `budgetAmount` without `budgetCurrency`
  (`CHECK` constraint), so a number whose unit is a guess cannot be stored.
- **The API** rejects the same pairing, and never applies an exchange rate.
  No rate is stored anywhere in the codebase.
- **The form** sends the two as separate fields, and when a client changes their
  country after typing an amount it does *not* rescale the number. It says what
  changed, shows the amount it still holds, and offers both currencies.

The currency code is shown next to every amount rather than a symbol alone:
`$` is shared by a dozen countries, and a budget nobody can read back correctly is
worse than one that looks slightly technical.

Availability works the same way. The client's timezone is stored verbatim and
never converted to ours, so an admin reading "18:00" can see which 18:00 it is.
The field is prefilled from the country and stays editable, and the browser's own
timezone is offered as a one-click correction rather than applied automatically —
a device can be set to the wrong zone, and a scheduling timezone nobody chose is
worse than one they did.

### Tutor rates are stated per market, not converted

Tedor Tutors serves Ethiopian learners, who think in birr, and learners elsewhere,
who think in dollars. A tutor states what an hour of their teaching costs in **each**
market, and neither number is derived from the other.

There is **no exchange rate anywhere in this codebase**, and that is the whole
point: a converted price is a price nobody agreed to charge. A tutor who would
take 500 birr for an hour in Addis has not said they would take 6 dollars for it,
so the tutor states both — or states one and leaves the other empty, which is
entirely normal and is what the directory reports rather than guessing at.

Rates are **rows, not columns**:

| Table | Holds |
| --- | --- |
| `markets` | The markets the platform sells in: code, name, currency, and which one is the default |
| `tutor_profile_rates` | One row per (tutor, market): the price that tutor charges in that market |

A rate-per-column schema would mean a database migration every time a market is
added, plus a field in the validation schema, the API payload, the wizard's form
type and two components. The registry is the reason a third market is a row:

```sql
INSERT INTO markets (code, name, currency_name, symbol, decimals, is_default, sort_order)
VALUES ('EUR', 'Europe', 'Euro', '€', 2, false, 2);
```

`market.code` is a real foreign key to `currencies.code`, so a market cannot name a
currency the platform has never heard of. `markets.is_default` is the market served
to a visitor who has said nothing — **not** the same idea as `currencies.is_default`,
which is about the platform's primary currency. They point opposite ways today: ETB
is the primary currency and sorts first, USD is the default market. Inheriting one
from the other would show every unmarked visitor prices in birr.

The migration that introduced these tables copied the existing `hourlyRateEtb` and
`hourlyRateUsd` values before dropping them. The old single `hourlyRate` column was
dropped rather than backfilled: it held a bare number whose unit was never recorded,
so its currency cannot be recovered, and copying it would be a guess.

`GET /api/tutors` and `GET /api/tutors/:id` take a `market` parameter, which decides
three things: the row results are filtered on, the order they are sorted in, and the
price each card shows. `minRate=10` is a different question for someone in Addis than
for someone in London, so the filter and the displayed price are held to the same
market — filtering one market while showing another's prices would quietly return the
wrong tutors.

Sorting by price is the one place raw SQL is used (`rankedProfileIds`): Prisma cannot
order by a relation, only by columns on the model. Every filter and the count stay in
Prisma; only the ordering is hand-written, and the direction is built from a boolean
rather than interpolated.

### One price at a time

Public responses carry a single price and its market:

```json
{ "hourlyRate": 900, "hourlyRateCurrency": "ETB" }
```

There is deliberately no second price. An earlier version returned both the birr and
the dollar rate so a card could show "also 500 ETB for local students". That is a true
fact about the tutor and a bad thing to put in front of a learner: two numbers for the
same hour of teaching, with no way to tell which one they would be charged. A client
that holds both prices is one layout change away from showing them.

So the API does not send both, and the visitor changes market with the selector —
`Prices shown for 🇪🇹 Ethiopia  Change` — which re-prices every card, the rate range
filter and the sort at once, because all three are held to the same market.

The tutor's **own** profile is the exception: `GET /api/tutor-profile/me` returns
every market, because a tutor editing prices needs to see the ones they set. That
response goes to nobody else.

### What a tutor may state

Rates must be **greater than zero**. Zero used to be accepted on the theory that a
free first lesson is a stated price; it is not. A zero rate sorts above every other
tutor, filters under every budget, and reads as free lessons nobody offered. A tutor
who wants to offer something unusual leaves that market unpriced instead, and the
directory reports no rate rather than `0`.

Declining a market is normal and blocks nothing: a tutor priced in one market is a
valid profile, and the completeness check at submit only requires at least one price.

### How a client's market is worked out

In order of how much the visitor has actually said:

| Source | Notes |
| --- | --- |
| **Their choice** | The selector, or a country on the request form — remembered in `sessionStorage` for the visit |
| **Their platform** | `GET /api/onboarding/market`, reading the country header the CDN already sets (`CF-IPCountry`, `X-Vercel-IP-Country`, …) |
| **Their device** | `Africa/Addis_Ababa` means Ethiopia; anything else means the default market |
| **The default** | Whichever market the `markets` table marks `is_default` — currently dollars |

Every candidate is validated against the registry before it is used, so a stored or
detected code for a market that has since been withdrawn falls through to the next
source rather than producing a page whose every price is missing.

There is no third-party geolocation request and no GeoIP database: the hosting
platform already knows the requester's country and sets it in a header. Those headers
are spoofable, which is why the answer can only ever choose between real prices a tutor
published. The worst a forged header achieves is showing someone the dollar rate
instead of the birr rate.

Cards and profile links carry `?market=`, so a shared link shows the recipient the
prices the sender saw, and a card can never link to a page that prices the same tutor
differently. A hand-edited `?market=EUR` is ignored on a profile and rejected with a
400 on the directory, rather than turning a page view into an error.

### The older `hourlyRateEtb` / `hourlyRateUsd` request shape

The tutor profile API still accepts the pre-markets pair alongside the `rates` map:

```json
{ "rates": { "ETB": 900, "USD": 12 } }   // current
{ "hourlyRateEtb": 900, "hourlyRateUsd": 12 }   // still accepted
```

Both are folded into the same map at the service boundary, so nothing else in the
backend knows the older shape existed. This is what keeps a bundle already in a
tutor's browser cache working; the response keeps both shapes too, derived from the
same rows so an old client and a new one can never be told different prices for the
same tutor.

### Backward compatibility

The wizard and the original single-page form are both live clients of the same
endpoint, and every column the wizard adds to `tutor_requests` is nullable with a
default. A request from the old form still validates, still stores, and reads as
`null` for everything new — which is honest, because nobody asked.

Both request shapes end up in the same two text columns:

| Sent | Stored |
| --- | --- |
| `subject: "Mathematics"` | `subject`, and no join rows |
| `subjectIds: [a, b, c]` | `subject: "Mathematics, Physics, Chemistry"`, plus join rows |
| `educationLevel: "University"` | `educationLevel` |
| `educationLevelCode: "eth-university"` | `educationLevel: "University or College"`, resolved from the database |
| `preferredDays: "Monday"` | `preferredDays` |
| `preferredDayNames: ["Monday", "Wednesday"]` | `preferredDays: "Monday and Wednesday"`, plus the array |
| `budget: "$20 per hour"` | `budget`, verbatim |
| `budgetAmount: 450, budgetCurrency: "ETB"` | `budget: "450 ETB"`, plus both columns |

The legacy columns stay as the single readable summary the admin list and detail
screen already read, and resolving identifiers to names in the service layer is
what stops the two paths drifting into meaning different things under the same
column.

---

## API

### Public

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/onboarding/config` | Countries, currencies, timezones, curricula, subjects, goals |
| `GET` | `/api/onboarding/market` | A market code from the registry, chosen from the platform's country header |
| `GET` | `/api/subjects` | The subject catalogue, flat, active only |
| `POST` | `/api/tutor-requests` | Submit a request. `201` returns `{ id }` |

### Authentication

Sessions travel in the `tedor_session` cookie (`HttpOnly`, `SameSite=Lax`,
`Secure` in production). The browser never has to hold the token, so these
endpoints work with plain `credentials: 'include'` and a cross-origin request
only works from an allow-listed `CORS_ORIGINS` entry.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Creates a `CLIENT`. `201` returns the user and sets the cookie |
| `POST` | `/api/auth/login` | Sets the cookie. `401` is deliberately vague |
| `POST` | `/api/auth/logout` | Revokes the session, clears the cookie. Always `200` |
| `GET` | `/api/auth/me` | The signed-in user, or `401` |
| `GET` | `/api/auth/providers` | Which sign-in methods are on offer, e.g. `{ providers: ["GOOGLE"] }` |
| `GET` | `/api/auth/google` | `302` to Google. Starts the OAuth flow |
| `GET` | `/api/auth/google/callback` | Google calls this. `302` back to the website with the session cookie |

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
cd backend  && npm test     # auth + admin API tests against a real app + real database
cd frontend && npm test     # auth, admin and homepage UI tests (vitest + Testing Library)
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
| `SESSION_TTL_DAYS` | no (30) | Lifetime of a sign-in session |
| `GOOGLE_CLIENT_ID` | to enable Google | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | no | OAuth client secret (confidential clients) |
| `GOOGLE_REDIRECT_URI` | no | OAuth callback URL |
| `FRONTEND_URL` | no | Where sign-in sends the browser |
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
