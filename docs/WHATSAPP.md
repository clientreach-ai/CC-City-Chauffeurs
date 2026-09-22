# WhatsApp

A customer messages the City Chauffeurs WhatsApp number. An assistant answers
from the published fleet and services, takes a journey down, and records an
enquiry or a booking request in the same tables the website's forms write to.
When it cannot help — or the customer asks for a person — it hands the
conversation to the office and stops.

It is not a chatbot. It talks about City Chauffeurs and nothing else, it
states nothing it did not read from a tool, and it has no way to confirm,
price, change or cancel anything.

## What is real and what is waiting

| | |
|---|---|
| **Built and tested** | The channel, the agent, the tools, handoff, idempotency, the database tables, the webhook, the admin API, the simulator |
| **Needs the client** | A WhatsApp Business Account approved by Meta, a Twilio WhatsApp sender on the business number, an Anthropic API key |
| **Needs a deploy step** | Migration `0004_whatsapp` applied to the production database, and the environment variables below set on the API server |

Until all three rows are done the channel is switched off in production.
`WHATSAPP_PROVIDER` defaults to `disabled`, and a disabled server mounts no
webhook and never loads the package, so the deployment boots exactly as it
did before.

## How it fits

```
  Customer on WhatsApp
        │
        ▼
     Twilio  ──POST (signed)──►  apps/server  /api/whatsapp/twilio
                                     │
                                     │  hands the raw request to
                                     ▼
                              apps/whatsapp  (a library — no database, no business rules)
                               provider · channel · agent loop · tools
                                     │                    │
                          ConversationStore           Backend
                                     │                    │
                                     ▼                    ▼
                            apps/server              apps/server
                     repositories/whatsapp.ts   lib/whatsapp-backend.ts
                                     │                    │  the existing repositories:
                                     │                    │  createPublicEnquiry, createBooking,
                                     │                    │  published fleet and services
                                     ▼                    ▼
                                   packages/db — the one Postgres
```

There is one backend and one database. `apps/whatsapp` is a library the
server mounts; it is not deployed on its own. It declares two ports —
`ConversationStore` and `Backend` (`apps/whatsapp/src/ports.ts`) — and the
server implements both over what it already had. An enquiry from WhatsApp is
made by `createPublicEnquiry` with `source = "whatsapp"`, the same function the
website's form calls, with the same validation, the same customer matching and
the same reference sequence. A booking request is made by `createBooking`,
always `pending`.

What the server gained for WhatsApp, and why:

| Change | Why |
|---|---|
| `createPublicEnquiry(input, { source })` | The source was fixed to `website` |
| `createBooking(input, { request })` | A WhatsApp request must be idempotent and must never arrive as anything but `pending`; its activity line says "requested on WhatsApp — not yet confirmed" |
| `enquiryForPhone(reference, phone)` | A customer can ask after their own enquiry — and only their own |
| Four `whatsapp_*` tables | Identities, conversations, messages, agent runs |
| `/api/whatsapp/{twilio,simulator}` | The webhook |
| `/api/admin/whatsapp/conversations…` | The office reads conversations, replies, and moves them between states |

### A message, start to finish

1. **Verify.** Twilio signs every request (HMAC-SHA1 of the public URL and
   the sorted form fields). A request that does not verify gets 401 and is
   not read. The URL checked is `WHATSAPP_WEBHOOK_URL`, not whatever the server
   thinks its own address is — behind a proxy those differ.
2. **Record.** The sender is normalised to E.164 (`07700 900321` and
   `+44 7700 900321` are one person), the message is stored against its
   conversation, and a run is queued for it — in one transaction. The
   provider's message id is unique, so a retried webhook is recorded once
   and queues nothing.
3. **Acknowledge.** Twilio gets its answer at once. Twilio gives up on a
   webhook after 15 seconds and a model turn can take longer, so the reply is
   worked out after the response has gone. The queued run is the durable
   record: a run queued before a restart is picked up at boot.
4. **Decide.** In order: an attachment gets a fixed reply ("text only for
   now"); a request for a person, an urgent matter or a complaint is handed
   over **before the model is asked** (`agent/guardrails.ts`); anything else
   goes to the model.
5. **Turn.** The model sees the recent conversation, the journey so far, and
   the tools. It calls tools until it has an answer — at most eight rounds.
   Every tool argument is validated with Zod before the tool runs.
6. **Commit.** The reply, the updated journey, the status and the run's
   record (model, tool calls, tokens, time) are written together.
7. **Send.** Through Twilio, retried once if Twilio says it is worth it. The
   message is marked sent or undelivered — never assumed.

Two messages sent together ("Heathrow to Mayfair tomorrow" / "3 of us") get
one reply that answers both, not two replies racing each other. Each
conversation is answered one turn at a time, and a turn whose message has
already been answered, or which has a newer message waiting, stands down.

### The tools

Nine, deliberately narrow (`apps/whatsapp/src/tools/city-chauffeurs.ts`). The
model has no SQL and no route to anything else.

| Tool | Does |
|---|---|
| `get_fleet`, `get_vehicle` | The published fleet — names, descriptions, confirmed capacities, the website's indicative rates |
| `get_services`, `get_service` | Published services, what each includes, what the office needs to quote it |
| `record_journey_details` | Adds what the customer said to the journey: resolves "the S Class" to the real vehicle, checks a date exists and has not passed, a time is HH:MM, passengers are 1–50. Refused values come back with a reason; a refused value never overwrites a good one |
| `create_enquiry` | Records an enquiry from the recorded journey — takes **no arguments**, so what reaches the office is what was validated, not what the model wrote last |
| `create_booking_request` | The same, as a `pending` booking. Needs a name, a date and a pickup |
| `get_enquiry_status` | The status of an enquiry made from this number. Another customer's reference answers exactly like one that does not exist |
| `handoff_to_human` | Hands over, with a reason and a summary for the office |

There is no tool to confirm a booking, check a car is free, quote a price, or
change or cancel anything. The prompt tells the model not to promise those
things; the missing tools are why it cannot.

### Handoff

| Status | Who answers |
|---|---|
| `ai_active` | The assistant |
| `human_requested` | Nobody yet — the office has been asked. The assistant is silent |
| `human_active` | A person in the office. The assistant is silent |
| `closed` | Nobody. A new message from the customer opens a new conversation |

A conversation leaves `ai_active` when the customer asks for a person, when
something urgent or a complaint is spotted, when the model calls
`handoff_to_human`, or when the assistant fails (the model is unreachable, it
refuses, it runs out of rounds). In every case the customer is told a member
of the team will reply there, and the reason and a summary are stored for the
office. A failed turn never leaves the customer without an answer.

When the office replies through the admin API the conversation becomes
`human_active`. The office can hand it back to the assistant with
`PATCH …/status {"status":"ai_active"}`.

WhatsApp only lets a business message a customer freely within 24 hours of
the customer's last message. An office reply outside that window is refused
with a reason rather than sent and lost; replying later needs an approved
template, which is not built.

### Never twice

A provider retry, a crash half way through a turn, and a customer who says
"yes" twice cannot make two records.

- **The message** — `(provider, provider_message_id)` is unique.
- **The run** — one per triggering message (`whatsapp_agent_run.triggering_message_id` is unique), and a run is claimed before it is worked.
- **The record** — the enquiry or booking carries `submission_id = wa:<message id>:<kind>`, the same unique column the website's forms use, so a turn run again finds the record it already made.
- **The confirmation** — asking again for the journey already recorded returns the same reference.

## Configuration

All in `apps/server/.env` (documented in `apps/server/.env.example`). None of
it is needed unless WhatsApp is switched on; the server refuses to start if
the channel is on and something it needs is missing.

| Variable | |
|---|---|
| `WHATSAPP_PROVIDER` | `disabled` (default), `twilio`, or `simulator` |
| `WHATSAPP_WEBHOOK_URL` | The exact public URL Twilio posts to: `https://citychauffeursapi.clientreach.ai/api/whatsapp/twilio` |
| `WHATSAPP_NUMBER` | The business number, E.164 — messages to any other number are ignored |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Required for `twilio` |
| `WHATSAPP_SIMULATOR_SECRET` | Signs simulator posts; at least 16 characters |
| `WHATSAPP_AI_PROVIDER` | `anthropic` (default) or `scripted` (no model — local only) |
| `WHATSAPP_AI_MODEL` | Default `claude-opus-5` |
| `WHATSAPP_AI_EFFORT` | `low`, `medium` (default), `high` |
| `ANTHROPIC_API_KEY` | Required for `anthropic` |

Secrets live only in the server's environment. Nothing WhatsApp-related is
sent to the website or the admin bundle.

### The model

Claude, through the official Anthropic SDK (`apps/whatsapp/src/agent/anthropic.ts`).
The system prompt (`agent/prompt.ts`) is split in two: the fixed rules, which
are cached between requests, and a short per-turn context — today's date in
London, the name on file, the journey so far.

`claude-opus-5` is the default because a wrong answer here is a wrong
promise to a paying customer. It is the most expensive choice; for lower
cost set `WHATSAPP_AI_MODEL=claude-sonnet-5` and watch the run records.
Server-side fallbacks are enabled: if the model declines a request, the API
retries it on a fallback model instead of failing, and if that also declines
the customer is handed to the office.

The model sits behind a small interface (`agent/model.ts`). The tests use a
scripted model that says exactly what each test needs, so they cost nothing
and prove what the system does with each decision.

### Logs

One line of JSON per event: a message recorded or ignored as a duplicate, a
signature or payload rejected, a turn completed or skipped, a send failed. Phone numbers appear as their last four digits;
message text, names and email addresses never appear. Token counts and timing
are in the run record (`whatsapp_agent_run`), not the log.

## Local development

### Tests

```bash
pnpm --filter @CC-City-Chauffeurs/whatsapp test   # the channel, agent, tools, providers — no database
pnpm --filter server test                         # the store, the backend, the routes, end to end on Postgres
```

`apps/server/tests/whatsapp-acceptance.test.ts` is the whole path — simulator,
channel, real store, real repositories, Postgres (PGlite, in process) — for
each scenario: greeting, fleet, service, enquiry, booking request, a
duplicate webhook, and handoff. Every record is checked in the tables the
admin reads.

### Talking to it

Against a **local** database — the script refuses any other:

```bash
# once: a local Postgres with the site's content (see ARCHITECTURE.md → Running it)
pnpm db:migrate && pnpm db:seed

cd apps/server
DATABASE_URL=postgres://postgres:postgres@localhost:5432/city_chauffeurs \
ANTHROPIC_API_KEY=sk-ant-… \
bun run scripts/whatsapp-chat.ts --from +447700900123
```

Each line is delivered as a WhatsApp message and the reply printed. Enquiries
and bookings made here appear in a locally running admin like any other.

### The simulator webhook

To exercise the HTTP path too, run the server with `WHATSAPP_PROVIDER=simulator`
and post:

```bash
BODY='{"messages":[{"id":"SIM1","from":"+447700900123","to":"+442084433332","name":"Test","type":"text","text":"What cars do you have?"}]}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_SIMULATOR_SECRET" -hex | cut -d' ' -f2)"
curl -X POST http://localhost:3000/api/whatsapp/simulator \
  -H 'Content-Type: application/json' -H "X-Simulator-Signature: $SIG" -d "$BODY"
```

The simulator records replies instead of sending them; read them with
`GET /api/admin/whatsapp/conversations/:id` while signed in to the admin.

## Going live

1. **Meta.** The client verifies the business in Meta Business Manager and
   creates a WhatsApp Business Account. The number (+44 20 8443 3332, or
   another) must not be registered on the WhatsApp app — moving it to the
   API removes it from the phone.
2. **Twilio.** In the Twilio console, register a WhatsApp sender on that
   number, linked to the WABA. Set the sender's incoming-message webhook to
   `https://citychauffeursapi.clientreach.ai/api/whatsapp/twilio`, `POST`.
3. **Anthropic.** An API key on the client's account, with a spend limit set.
4. **Database.** Apply migration `0004_whatsapp` to production
   (`pnpm db:migrate`). It only adds tables.
5. **Server.** On the VPS, set `WHATSAPP_PROVIDER=twilio`, the webhook URL,
   the number, the Twilio SID and token, and the Anthropic key; restart.
   A `POST` to the webhook with no signature should now answer 401 — before,
   it was 404.
6. **Try it** from a phone that is not the business number: a greeting, a
   fleet question, an enquiry. Check the enquiry in the admin under
   Enquiries, source WhatsApp.

## Limitations

- **One server process.** Replies to one customer are kept in order by a lock
  in memory. The database keeps a restart or retry safe, but a second
  instance would need that lock moved somewhere shared.
- **Bookings do not record their source.** The `booking` table has no source
  column; a WhatsApp request is identified by its activity line. Adding the
  column is a migration of its own.
- **Text only.** Voice notes, photos and locations get a fixed reply asking
  for text.
- **No outbound notifications.** Nothing is sent to the customer when the
  office confirms a booking, and nothing tells the office a conversation
  needs a person — they see it by listing `human_requested` conversations.
- **No admin screen yet.** The API is built (`/api/admin/whatsapp/conversations`);
  the screen that lists conversations and lets the office reply is not.
- **No template messages.** The office cannot start a conversation, or reply
  more than 24 hours after the customer last wrote.
- **English only.** The prompt and the fixed replies are written in English.
