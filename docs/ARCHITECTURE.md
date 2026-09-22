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

Every photograph lives in a Cloudflare R2 bucket and is served from the
bucket's public address. The database stores that absolute address in every
`ImageRef`, and the media library keeps the object key beside it so a
photograph can be replaced or removed in the bucket when its record is.

`apps/server/src/lib/storage.ts` is the seam. An upload goes to the API, which
checks the bytes are an image, reads the real dimensions from the header,
writes the file under a fresh key and returns the address. A key is never
written twice: a page already pointing at a photograph never finds it
changed underneath, so the address can be cached forever.

The bucket may be shared with other projects, so everything this site stores
sits under `R2_PREFIX` (`city-chauffeurs/…`) and nothing outside it is ever
listed, written or deleted. The website's own photography sits at the path it
had under `public/` — `/media/fleet-cullinan.jpg` became
`<bucket>/city-chauffeurs/media/fleet-cullinan.jpg` — put there once by
`apps/server/scripts/migrate-media-to-r2.ts`, which can be run again to fill
any gaps. The files stay in `apps/web/public` as the seed's source; the seed
writes bucket addresses.

The **Media** screen in the admin is the whole collection: upload, describe,
replace and delete. Two rules hold there, enforced by the API. A photograph a
page still shows cannot be deleted — `GET /media/usage` says where each one
is used, by walking every `ImageRef` on the website. And replacing a
photograph rewrites every reference to it in one transaction, keeping each
page's own description, so a change lands everywhere at once or nowhere.

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

## `apps/whatsapp` — the WhatsApp assistant

A library, not a service: the API mounts it at `/api/whatsapp/*` when
`WHATSAPP_PROVIDER` is set, and never loads it otherwise. It holds the
provider (Twilio, or a simulator), the conversation and the agent loop, and
declares two ports the server implements — a conversation store over the
`whatsapp_*` tables, and a backend over the existing repositories. An
enquiry from WhatsApp is the website's enquiry with `source = "whatsapp"`; a
booking request is a `pending` booking. No second database, no second copy of
a rule. See [WHATSAPP.md](WHATSAPP.md).

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

Sign-up is closed. `emailAndPassword.disableSignUp` refuses
`/api/auth/sign-up/email` outright, because the API answers to the internet and
an account made there would arrive with the `editor` role and the run of the
client's content. Accounts are made against the database instead:

```bash
# Hash the password the way better-auth reads it back.
bun --filter server run scripts/create-user.ts you@example.com 'a-long-password' 'Your Name' admin
```

If that script has not been written yet, the two rows can be inserted by hand —
a `user` row carrying the role, and an `account` row whose `password` holds
better-auth's scrypt hash of the password. Copy the shape from the row that is
already there; a hash written any other way will not verify.

Roles: `editor` — drafts only, no publishing, no operations. `manager` adds
operations and publishing. `admin` adds site settings.

## What is still not real

- **WhatsApp is switched off in production.** It is built and tested, and
  waits on a Meta-approved business account, a Twilio sender, an OpenAI key
  and migration `0004_whatsapp` — see [WHATSAPP.md](WHATSAPP.md#going-live).
- **Nothing is sent to anybody.** A status change, a recorded quote or a note
  is written to the book of record and no further: no email reaches a
  customer, no chauffeur is dispatched. Every screen offering one of these
  says so.
- **No testimonials are published.** The client has not supplied attributable
  quotes, and one cannot be published without a first name, a role, a district
  and a record that the customer agreed — fake reviews are an offence under
  the Digital Markets, Competition and Consumers Act 2024.
