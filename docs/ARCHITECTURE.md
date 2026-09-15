# How this system is put together

Three applications and one contract.

```
                        packages/core
              types · validation · publishing rules
                    ▲          ▲           ▲
                    │          │           │
   apps/web ────────┘   apps/server ───────┘   apps/admin
   the website          the API                the admin
        │                    │                      │
        │  GET /api/public/* │  /api/admin/*        │
        └───────────────────►│◄─────────────────────┘
                             │
                        packages/db
                     Drizzle · PostgreSQL
```

## The contract comes first

`packages/core` defines what a vehicle, a service or an enquiry *is*, and the
three applications compile against it. A shape changed there stops every
consumer that disagrees from compiling, which is the point.

It holds four things:

| Module | What it settles |
|---|---|
| `types.ts` | The records themselves |
| `schemas.ts` | Zod shapes for every request body the API accepts |
| `rules/` | What may be **saved**, and what may be **published** |
| `status.ts` | Every status label and its order, so no two screens disagree |

The split between `schemas` and `rules` is deliberate. A schema proves the
JSON is the right shape; a rule decides whether a testimonial has enough
attribution to go live. The admin form runs the same rule as you type that
the API runs on write, so a rule is written once and cannot be bypassed by
calling the API directly.

## `apps/server` — the API

Hono, on Bun. Three surfaces:

- **`/api/auth/*`** — sessions, from better-auth.
- **`/api/public/*`** — what the website reads. No session. Only published
  records leave here: a draft is indistinguishable from a record that does not
  exist, so an unpublished vehicle cannot be read by guessing its slug.
- **`/api/admin/*`** — every route needs a session. Reads are open to any
  signed-in role; each write declares the capability it needs.

Roles are real. `user.role` is read off the session, and `requires()` enforces
it on every write. The admin hides what a role cannot do as a courtesy — the
server is what actually refuses.

Repositories (`src/repositories/`) hold all the SQL and all the rules. Routes
parse, authorise and hand off; they contain no logic of their own.

### Errors keep their shape across the wire

A failed write throws `CmsValidationError` with per-field messages. The API
serialises it as a 422 carrying those fields, and the admin's client rebuilds
the same error object. That is what lets a form show a server-side rule
inline, beside the input that caused it.

## `packages/db` — the schema

Scalar columns for anything filtered, sorted or joined on. `jsonb`, typed
against the domain contract, for value objects a record is only ever read and
written whole — a vehicle's specs, its pricing, its image set.

**Relationships are stored once, on the side that orders them.**
`vehicle_category` carries the order the fleet page prints a grouping in;
`service_vehicle` carries the order a service page lists its cars in. Both are
read back onto the vehicle so a caller sees one whole record.

The homepage is eight bands with wildly different fields, always read and
written whole, and never queried field by field — so a band is its columns
plus one `data` document, reassembled into the union on the way out.

### Seeding

`pnpm db:seed` reads the website's own content files — `apps/web/src/content/*` —
through that app's own `@/` alias, and writes them to the database. A small Bun
plugin supplies the image loader Next would normally provide, reading each
photograph's real dimensions from the file.

Reading the real files rather than transcribing them is the point: the seeded
database *is* the site as it was written. After the first seed the database is
the source of truth, and reseeding overwrites whatever the client has since
changed.

```bash
pnpm db:seed                # content only; enquiries and bookings untouched
pnpm db:seed -- --samples   # also insert the sample operational records
```

## `apps/admin` — the admin

Next, on its own origin, behind a session.

- **TanStack Query** holds server state. `useCmsQuery(key, loader)` keeps the
  `{ data, loading, error, reload }` shape the screens were written against,
  so a screen does not know it is reading a real API through a cache.
- **Zustand** holds what is genuinely client state: the sidebar's width
  (persisted per browser), the unsaved-changes flag, and the signed-in user.
- A write anywhere invalidates the admin's cache, because publishing a vehicle
  changes the fleet list, the dashboard's counts, the grouping it belongs to
  *and* the homepage band that features it. Naming those relationships at
  every call site is how they get missed.

### Photographs

The database stores the site's own photography as site-relative paths
(`/media/fleet-cullinan.jpg`), so records survive a rebuild, a redeploy and a
change of domain — none of which a `/_next/static/…` URL would. The website
serves those directly. The admin is another origin, so it resolves them
against the website at the point of rendering; what is stored is never
rewritten.

An uploaded photograph is different: it goes to the API, which stores it and
returns an absolute URL, and that is what the database keeps. `lib/uploads.ts`
is the seam — swapping it for R2 or S3 changes that file and nothing else.

## `apps/web` — the website

Every page renders published records fetched from `/api/public/*`. Reads are
cached for a minute and tagged by area.

A minute is a floor, not a delay an editor should sit through. When the API
accepts a write, middleware calls the website's `/api/revalidate` with the
affected tags and the next request rebuilds from the change. It runs *after*
the handler on purpose: telling the website to refresh before the write lands
would just re-cache the old content. It is fire-and-forget, and a shared
secret is what stops anyone emptying the cache at will.

The enquiry form records the enquiry **before** handing the same message to
WhatsApp or email. An enquiry that exists only in a chat window is one that
can be missed, and the admin's pipeline is built on having the record. If
recording fails the visitor is never told — their message still goes.

## Running it

```bash
docker run -d --name cc-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=city_chauffeurs -p 5432:5432 postgres:17-alpine

cp apps/server/.env.example apps/server/.env   # fill in the secrets
cp apps/web/.env.example    apps/web/.env
cp apps/admin/.env.example  apps/admin/.env

pnpm install
pnpm db:migrate
pnpm db:seed -- --samples
pnpm dev
```

| | |
|---|---|
| API | http://localhost:3000 |
| Website | http://localhost:3001 |
| Admin | http://localhost:3002 |

### The first account

Sign-up is not exposed in the admin — accounts are made deliberately.

```bash
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"a-long-password","name":"Your Name"}'

psql "$DATABASE_URL" -c "update \"user\" set role='admin' where email='you@example.com';"
```

New accounts default to `editor` — drafts only, no publishing, no operations.
`manager` adds operations and publishing; `admin` adds site settings.

## What is still not real

- **Nothing is sent to anybody.** A status change, a recorded quote or a note
  is written to the book of record and no further: no email reaches a
  customer, no chauffeur is dispatched. Every screen offering one of these
  says so.
- **No testimonials are published.** The client has not supplied attributable
  quotes, and one cannot be published without a first name, a role, a district
  and a record that the customer agreed — fake reviews are an offence under
  the Digital Markets, Competition and Consumers Act 2024.
- **Uploads are stored on the API's own disk.** Fine for one server; the seam
  for object storage is `apps/server/src/lib/uploads.ts`.
