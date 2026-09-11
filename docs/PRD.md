# Product Requirements Document
## CC City Chauffeurs — Website & Booking System Rebuild

| | |
|---|---|
| **Client** | CC City Chauffeurs (Company No. 15481213) |
| **Client sponsor** | Faheem Fareed, Director — sole approver |
| **Agency** | Client Reach |
| **Document owner** | Product Management, Client Reach |
| **Version** | 1.0 — for client review |
| **Date** | 10 September 2026 |
| **Status** | Draft — pending sign-off and answers to §17 |
| **Source material** | Client intake form (Sept 2026); independent audit of the live site, 10 September 2026 |

---

## 1. Executive summary

CC City Chauffeurs has a real, profitable business — 10–15 enquiries a week, an average booking value above £500, a good repeat client worth £30k a year, and a fleet that genuinely impresses. It also has a website that converts **none** of them.

That is not a figure of speech. The client's own answer to "roughly what share of website enquiries become bookings?" was *"None."*

We inspected the live site ourselves to find out why. In plain terms:

- **The site is invisible to Google.** It carries an instruction telling search engines that the "real" version of the business lives at a different web address — one that is dead and shows an error. The site is, in effect, telling Google to ignore it. This alone explains why the business gets nothing from search.
- **The enquiry list can be read by anyone.** There is a web address on the site that returns the enquiry database to any member of the public who visits it, with no password. It currently comes back empty — which means either no enquiry has ever been saved, or they are being thrown away. Both answers are bad. For a business whose entire promise is discretion, a lead list anyone can read is indefensible.
- **The site is enormously heavy.** The photography alone comes to roughly **182 MB** — the equivalent of downloading a feature film to look at a car. Nothing is stored on the visitor's device, so every visit downloads all of it again. On a phone, on mobile data, in a wedding venue car park, it will not load. This is why the Gallery and Showcase pages are the slowest on the site.
- **Nobody knows which number to ring.** Three different phone numbers appear across the site, none of them the number given on the intake form, and the business listing Google reads still contains an unfilled template: `+44-XXX-XXX-XXXX`.
- **The site makes promises the business does not keep.** "24/7 availability" and "Response within 1 hour" are both on the homepage. The client's own answers: no, and *"it can be several hours."*

Underneath the website sits a second, larger problem: **there is no operating system behind it.** Quotes are built "in my head." Enquiries land in WhatsApp. A 2am enquiry waits until morning. Nothing tracks quoted vs won vs lost. Deposits are ad hoc and payment is cash. The client's own stated reason for losing work is *"too slow."*

**Therefore this project is not a website redesign. It is the installation of a commercial engine — capture, respond, quote, take money, deliver, ask for the review — with a website as its front door.** A prettier site pointed at a broken pipeline would simply lose leads more attractively.

We recommend a **rebuild, not a repair** (§12), delivered in four phases, foundation first — which matches the client's own stated priority and reasoning: *"If the foundation is weak everything else will collapse."*

**The single highest-value outcome of Phase 1:** the site should be able to quote, reassure and take a deposit from a serious client at 2am on a Sunday, without Faheem being awake.

---

## 2. Background

### 2.1 The business

| Attribute | Detail |
|---|---|
| Trading name | CC City Chauffeurs |
| Registered address | 21–25 Romford Road, London, E15 4LJ |
| Company number | 15481213 |
| Team | 1 office staff (Faheem); 2–3 chauffeurs on a pay-as-you-go basis |
| Enquiry volume | 10–15 per week, seasonal |
| Average booking value | £500+ |
| Annual value of a good repeat client | ~£30,000 |
| Repeat business | ~30% |
| Primary acquisition | Word of mouth |
| Revenue split | ~70% weddings, ~30% everything else |
| Top three earners | Supercar hire, weddings, private events |
| Stated growth target | Corporate accounts |
| Coverage | UK and Europe; London-based, nationwide operation |
| Booking constraints | 4-hour minimum; 48 hours' notice preferred |

### 2.2 Current digital estate

| Asset | Status |
|---|---|
| `city-chauffeurs.com` | Live. Registered **15 January 2026 through IONOS**, **expires 15 January 2027**. Owner details are private. Client does not know who controls it. |
| `citychauffeurs.co.uk` | Named on every page of the live site as the "official" address, but shows an error. Ownership unknown to client. |
| Hosting | On Google's cloud platform, under an account the client cannot identify. |
| Source code | Held by the original freelancer. Not in the client's possession. |
| Last updated | 26 March 2026 — untouched for nearly six months |
| Google Business Profile | **Does not exist** |
| Google reviews | **0** |
| Analytics / Search Console | **None installed** |
| Privacy policy / Terms | **Neither exists** |
| CRM / booking software | None. TimeTree calendar, WhatsApp, and memory. |
| Payment provider | None. Cash. |

### 2.3 Current site structure

Six pages only:

`/` · `/about` · `/fleet` · `/showcase` · `/gallery` · `/contact`

There are no service pages, no location pages, no wedding page, no corporate page, no blog, and no legal pages.

---

## 3. Audit findings

We inspected the live site directly on 10 September 2026 rather than relying on impressions. Findings are ranked by commercial damage, not by technical interest. The "what we found" column is deliberately brief — the column that matters is "what it costs you".

### 3.1 Critical — costing money or creating liability right now

| # | What we found | What it costs you |
|---|---|---|
| **C1** | The enquiry list is readable by any member of the public, with no password. | Every client name, phone number, email and home address that passes through the site is exposed. For a company selling discretion to high-net-worth clients, this is the worst possible failure. It is also a data-protection breach waiting to be reported. |
| **C2** | That same list comes back **empty**. | The most likely explanation for "none of our website enquiries become bookings" is that website enquiries are being silently thrown away. Real people may have tried to book you and you never knew. *We recommend a controlled test to confirm — see §17, Q9.* |
| **C3** | Every page instructs Google that the real business lives at a **different web address**, and that address is dead. | You are invisible in search. Not "ranking poorly" — actively telling Google not to list you. This is the single cheapest fix with the biggest upside in the entire project. |
| **C4** | **Close protection is advertised across the site** — in the page title, the description, and the copy — and has never once been provided. | Security work in the UK is licensed. Advertising it without the licence is a regulatory problem, not a marketing one. It must come off the site. |
| **C5** | **The six client testimonials are invented.** | Fake reviews became directly enforceable against businesses under the Digital Markets, Competition and Consumers Act 2024. This is the one item we would take down today, before anything else in this document begins. |
| **C6** | The licensing position is unclear — the intake form says there is **no private hire operator licence**, but names **TfL** as the licensing authority. | In London, taking pre-booked private hire work without an operator licence is a criminal offence. Everything the new site is allowed to claim depends on the answer, and it may affect how the business is structured. **This is the one question that could change the shape of the project — §17, Q1.** |

### 3.2 High — actively holding back growth

| # | What we found | What it costs you |
|---|---|---|
| **H1** | The site's content only exists once a visitor's browser has done a lot of work. Google is served a blank page. | Every word of copy on the site — the fleet, the services, the areas you cover — is effectively unreadable to search engines. You cannot rank for anything. |
| **H2** | There is no site map or crawl guidance for Google, and any made-up web address on your domain returns a normal-looking page rather than a "not found". | Google wastes its time crawling pages that do not exist, and never builds a clear picture of what you actually offer. |
| **H3** | Roughly **182 MB of photography** across 71 files, some individual photos over 2 MB, in outdated formats and never resized for phones. | Your best asset — the cars — is the reason people leave before seeing them. A bride checking your Gallery on her phone will give up. |
| **H4** | Nothing is cached on the visitor's device. | Every return visit re-downloads everything from scratch. Repeat visitors — the ones closest to booking — get the slowest experience. |
| **H5** | Over 25 typefaces are loaded on every page, almost none of them used. | Pure dead weight, slowing every page for no visual benefit. A sign the site was assembled from a template and never finished. |
| **H6** | Behind-the-scenes database code has been bundled into the public site. | Nothing is leaking today, but it tells us the build was never reviewed by anyone. It is part of why we recommend rebuilding rather than patching. |
| **H7** | **Four different phone numbers and two spellings of your email address** are in circulation across the site and the intake form, plus an unfilled template in the code Google reads. | Google rewards businesses whose name, address and phone number match everywhere. Yours match nowhere. This must be settled before we create your Google listing — **§17, Q2.** |
| **H8** | The homepage promises **"24/7 availability"** and a **"response within 1 hour"**. Neither is true today. | Either the claims come down, or we build the system that makes them true. **This PRD proposes making them true** (§10.4) — it is the highest-leverage change available to you. |
| **H9** | The site sells a **Ferrari SF90** and a **Lamborghini SVJ**. The intake form lists a **Huracán** and a **Revuelto**, and neither site car is mentioned. | We cannot build fleet pages on a fleet nobody has confirmed. We need the real list, marked owned vs sourced — **§17, Q4.** |
| **H10** | **The domain expires on 15 January 2027**, registered through IONOS by someone we cannot identify. | About four months of runway. If the previous freelancer holds that account and lets it lapse, the website and any email on the domain vanish overnight, with no warning. **This is the most urgent administrative task on the list.** |

### 3.3 Medium

| # | What we found | What it costs you |
|---|---|---|
| **M1** | Key brand imagery — including a large hero image — is **AI-generated**. | Consistent with your own verdict on the site: *"Looks childish."* A luxury operator cannot lead with synthetic pictures of cars it does not own. |
| **M2** | **Showcase and Gallery do the same job.** | Splits your best content across two pages and doubles the load time problem. You have already decided: merge them (§10.7). |
| **M3** | The form asks 7 questions, and you have to go back and ask for **date, time and passenger numbers every single time**. | Each round-trip adds hours to a process you already lose on speed. Your stated reason for losing work is "too slow" — this is a self-inflicted part of it. |
| **M4** | The About page still says *"We are not a vehicle hire company."* | You now hire cars out for self-drive. This needs a structural answer, not a copy edit (§7.2). |
| **M5** | No visible spam filtering, and you are unsure whether spam even arrives. | You cannot tell a real lead from noise, and you cannot measure what you are not seeing. |

---

## 4. Compliance and integrity gates

These are **gates, not tasks**. Nothing else launches until they are cleared. They are cheap to fix and expensive to ignore, and several of them create liability that no amount of design work offsets.

### 4.1 Data protection
- The open `/api/enquiries` endpoint must be taken down or authenticated **immediately**, ahead of the rebuild.
- Register with the ICO and pay the data protection fee (required for most UK businesses processing personal data).
- Publish a privacy policy and terms of service before the new site takes a single enquiry.
- Define a retention policy. Client currently answers "we don't" to how client data is handled — for a business selling discretion, this is the gap between the promise and the practice.

### 4.2 Close protection
Remove every reference to close protection, "protection service", and "VIP protection" from copy, page titles, meta descriptions and keywords until such time as the client holds the appropriate SIA licensing and can genuinely deliver it. The current page title — *"Luxury VIP Chauffeur & Protection Service London"* — must change.

### 4.3 Testimonials
Remove the six placeholder testimonials from the live site now, as a standalone action, without waiting for the rebuild. Replace with real, attributed quotes (§10.11). The client can obtain **first name, role and district** — that is sufficient and credible.

### 4.4 Licensing
Establish, in writing, the client's TfL position: operator licence, vehicle licences, driver licences, and insurance class (hire and reward). Every trust claim on the new site — "Fully Licensed & Insured" is currently a homepage badge — depends on this. **This is the one open question that can change the shape of the project.**

### 4.5 Claims discipline
A simple standing rule for all new copy: **if we cannot evidence it, it does not go on the site.** This applies to 24/7 availability, response times, fleet size, client types, years trading (the form gives "2026" as the trading start, while the company was incorporated in 2024 — §17, Q3), and any statistic.

---

## 5. Goals and success metrics

### 5.1 Business goals

| # | Goal | Why |
|---|---|---|
| G1 | Convert website traffic into paid bookings | Current conversion is zero. This is the entire commercial case for the project. |
| G2 | Collapse response time from hours to seconds | Client's stated reason for losing work is "too slow". |
| G3 | Make the business legible outside Faheem's head | Quotes, availability and pipeline currently exist only in memory — the acknowledged bottleneck. |
| G4 | Open the corporate channel | Zero accounts today; the client's clearest growth ambition. |
| G5 | Become findable | No GBP, no reviews, no analytics, no search visibility. |
| G6 | Take money properly | Cash-only, ad hoc deposits, no provider. |

### 5.2 Success metrics

Baselines are the client's own intake figures. Targets are proposed and require sign-off (§17, Q7).

| Metric | Baseline (Sept 2026) | 3 months | 6 months |
|---|---|---|---|
| Website enquiry → booking conversion | 0% | 10% | 20% |
| Median first response time | Several hours (overnight: 8h+) | Under 5 minutes, automated, 24/7 | Same, with a quote attached |
| Enquiries captured and tracked | 0 (unmeasured) | 100% logged with status | 100%, with won/lost reasons |
| Online deposits taken | £0 | First deposit taken | 50% of new-client bookings deposit online |
| Google Business Profile reviews | 0 | 10 | 30 |
| Indexed, ranking service pages | 0 | 6 | 15+ |
| Corporate accounts | 0 | 2 in pipeline | 3 active |
| Monthly organic enquiries | Unmeasured | Baseline established | +50% on the 3-month baseline |

**The one number the client asked for:** *"How many leads we have converted."* The monthly report leads with exactly that, on one line, before anything else (§16).

### 5.3 Non-goals for this phase

- Full dispatch/driver-app software. The client has 2–3 chauffeurs; a dispatch platform is over-engineering.
- Real-time vehicle GPS tracking for clients.
- Multi-language. Client: no language demand.
- Wheelchair-accessible vehicle booking. Client cannot currently accommodate; do not advertise it.
- A public price list. Indicative rates only — see §10.2.
- Private aviation brokerage. The site references "private jet collection" as a *transfer* service, which is accurate; the business does not charter aircraft.

---

## 6. Users

### 6.1 Prospective clients

| Segment | Profile (client's words) | What they need from the site | Primary journey |
|---|---|---|---|
| **Occasion — wedding** (70% of revenue) | *"Groom, bride, and bride and groom's family"* | Photographs of the actual cars, availability on one specific date, a sense of what it costs, reassurance the car will not let them down on the most important day of their life | Wedding page → fleet gallery → date check → indicative quote → deposit |
| **Private** | *"Lives in a nice area, needs a driver for weekly visits"* | Reliability, the same chauffeur, an easy way to rebook | Homepage → chauffeur service → enquiry → account/repeat booking |
| **Corporate booker** | *"Canary Wharf, Mayfair — bankers or fund managers booking for clients and meetings"* | Invoicing rather than cash, a rate card, proof of licensing and insurance, someone who answers | Corporate page → credit/account application → account portal |
| **Self-drive supercar** | Enquiries via supercar hire | Availability, price, eligibility requirements, deposit terms | Supercar hire → eligibility → quote → deposit |

The client rates all three core segments as *roughly equal* in value and wants more of all of them. **Sequencing is therefore driven by revenue concentration and by what search demand exists — weddings first**, which is also the client's own choice.

### 6.2 Internal users

| User | Role | Needs |
|---|---|---|
| Faheem (Director) | Answers every enquiry, quotes, dispatches, drives | To stop being the single point of failure. Mobile-first. Must work from a phone between jobs. |
| Faheem's brother | Second operator | Same view of the pipeline, so nothing is dropped |
| Chauffeurs (2–3, PAYG) | Delivery | Job details, timings, addresses. Read-only, no admin. |

**Design constraint that overrides everything on the internal side:** the client's honest self-assessment is *"What frustrates me most is my own personal organisation."* The ops tool must be simpler than WhatsApp, or it will not be used. He said he would use a pipeline *"if it's simple enough."* That conditional is the acceptance criterion.

---

## 7. Positioning and brand

### 7.1 Direction

| Attribute | Decision |
|---|---|
| Elevator description | *"A luxury, discreet way of travelling without the hassle"* |
| Differentiator | *"The best quality cars at competitive rates with high standards of professionalism"* |
| Three principles | Professionalism, Comfort, Discretion — confirmed, retained |
| Tagline | *"Your city, your chauffeur — City Chauffeurs"* |
| Tone | Confident |
| Should feel | Corporate and reliable |
| Must never feel | Exclusive, hard to contact, intimidating |
| Colours | Black, silver, white. *"Primary colours, not too loud, not too quiet."* |
| Typography | *"Easiest to read"* — legibility over decoration |
| Reference | `llccars.co.uk` |
| Logo | Open to redesign — client: *"Go crazy, change the logo if you want."* |

### 7.2 The two tensions to resolve

**Tension 1 — dark and cinematic vs corporate and approachable.**
The current site is full-dark and photographic. The client says it should feel *"corporate and reliable"* and must never feel *"intimidating"* — and calls the current site *"childish."* Those pull in opposite directions. The reference site, LLC Cars, is clean, light, generously spaced and confident rather than moody.

> **Recommendation:** move to a **light, editorial, corporate-luxury system** — white and off-white ground, black type, silver/graphite accents, with photography carrying all the drama. Reserve full-black for hero and fleet-detail sections. Light backgrounds also read as more contactable and score better on legibility, which serves both the "never intimidating" and "easiest to read" requirements. Present two directions at design stage (§15).

**Tension 2 — "We are not a vehicle hire company" vs self-drive supercar hire.**
The client wants to keep pushing chauffeur work while still selling self-drive. The answer is architectural, not editorial: **chauffeur is the spine of the site; self-drive is a clearly-signposted branch off it**, with its own page, its own qualification gate and its own terms. The About page line is rewritten to lead with the chauffeur promise rather than defining the business by what it is not.

### 7.3 Making "discretion" concrete

The client was candid: *"I'm not actually sure [what discretion means day to day]."* Left vague, it is an empty luxury word. Defined, it becomes a set of features that competitors will not have bothered to build:

1. **Confidentiality on request** — an NDA offered on the enquiry form for clients who want one (client currently has no formal agreement).
2. **No public identification of clients** — no client names, no number plates visible in photography, no location tagging of live jobs.
3. **Chauffeur presentation** — faces shown, names withheld. This is the client's stated preference and it is a genuine discretion signal.
4. **Data minimisation** — we collect what a booking requires, retain it for a stated period, and delete it. The privacy policy states this plainly.
5. **Private arrival protocols** — a named option on the booking form for discreet collection (no name board, unmarked arrival, side entrance).

This converts a word the client could not define into five things the site can actually say and the business can actually do.

---

## 8. Scope and phasing

The client ranked the work themselves: **foundation first**, *"if the foundation is weak everything else will collapse."* We agree and have structured delivery accordingly.

### Phase 0 — Custody and compliance (Week 1, runs in parallel with everything)
Recover control, remove liability, stop the bleeding. **Independent of the rebuild.**

- Take down or authenticate `/api/enquiries` (C1)
- Remove placeholder testimonials from the live site (C5)
- Remove close protection claims (C4)
- Remove "24/7" and "response within the hour" claims, or route them to the interim WhatsApp auto-reply (H8)
- Recover domain control from IONOS; establish `citychauffeurs.co.uk` ownership; **renew before 15 Jan 2027** (H10)
- Recover Google App Engine hosting access, or plan a clean migration without it
- Settle one canonical phone number and one canonical email (H7)
- Register with the ICO; publish privacy policy and terms
- Create the Google Business Profile and verify it
- Install analytics and Search Console on the current site to establish a baseline before we change anything

### Phase 1 — Foundation (the new site and the commercial engine)
The revenue-critical build.

- New site on a server-rendered stack, correct SEO fundamentals, fast on mobile
- Homepage, About, Fleet (four tiers), merged Gallery, Contact
- **Weddings service page** (client's chosen first priority; 70% of revenue)
- Airport transfers and Corporate service pages
- **Smart multi-step enquiry form** capturing everything currently chased by hand
- **Instant indicative quote engine**
- **Deposit payment link** (Stripe)
- **Instant automated response** — 24/7, with a quote where possible
- **Enquiry pipeline** — new / quoted / won / lost, with notifications to WhatsApp, email, SMS and push
- Real testimonials, real trust signals, legal pages
- Analytics, call tracking, conversion goals

### Phase 2 — Growth
- Remaining service pages: private events, city-to-city, supercar chauffeur, self-drive supercar hire, tours, school/family runs, roadshows
- Location pages: Mayfair, Knightsbridge, Chelsea, Kensington, Fulham
- Nationwide coverage positioning
- **Corporate accounts**: application, agreed rates, monthly invoicing, statements
- **Discount codes** for wedding season
- Client booking portal (scope subject to §17, Q8)
- Automated review requests → Google Business Profile
- Blog / guides section

### Phase 3 — Ongoing (retainer)
Client has asked for: SEO and content, hosting and maintenance, Google Ads management, social media. Scoped separately (§17, Q7).

---

## 9. Information architecture

```
/                                  Home
/about                             About — story, principles, chauffeur standards, licensing
/fleet                             Fleet overview — four tiers
  /fleet/[vehicle]                 Individual vehicle: specs, capacity, gallery, hourly rate, enquire
/gallery                           Merged gallery — filterable by all vehicles (Showcase absorbed)
/services                          Services index
  /services/weddings               ★ PHASE 1 — priority build
  /services/airport-transfers      ★ PHASE 1
  /services/corporate              ★ PHASE 1
  /services/private-chauffeur      Phase 2
  /services/private-events         Phase 2
  /services/city-to-city           Phase 2
  /services/supercar-chauffeur     Phase 2
  /services/supercar-self-drive    Phase 2 — separate branch, own terms
  /services/tours-sightseeing      Phase 2
  /services/school-family-runs     Phase 2
  /services/roadshows              Phase 2
/corporate-accounts                Accounts, invoicing, credit application (after service pages, per client)
/chauffeur-service/[area]          Mayfair · Knightsbridge · Chelsea · Kensington · Fulham — Phase 2
/quote                             Instant indicative quote
/contact                           Contact + enquiry form
/journal                           Blog / guides — Phase 2
/privacy · /terms · /cancellation  Legal — Phase 0/1

/admin                             Internal — pipeline, quotes, bookings, calendar, reports
/account                           Client portal — Phase 2
```

**Nothing gets lost:** Showcase permanently forwards to Gallery, and every existing link is mapped to its new home before launch.

---

## 10. What we are building

Each feature below states the business problem it solves, what it does, and how we will know it works. Priorities: **P0** = Phase 1, must launch with the site. **P1** = Phase 2. **P2** = later.

---

### 10.1 The smart enquiry form — P0

**The problem.** The current form asks seven questions and misses the three you need most. Your own words: *"we always have to go back and ask… time, locations, passengers."* Every round-trip costs hours, and you lose work because you are *"too slow."*

**What it does.** A short, staged form that collects a complete, quotable brief in one pass — and never feels like a form.

**What it asks**

*Step 1 — What and when*
- Service type (the existing nine options, confirmed correct by the client)
- Date, and whether it is a return or multi-day booking
- Pickup time
- Duration or estimated finish time

*Step 2 — Where*
- Pickup address (with address autocomplete so it is captured accurately first time)
- Drop-off address
- Additional stops — add as many as needed
- Flight number, where the service is an airport transfer

*Step 3 — Who and what*
- Number of passengers
- Number and size of bags
- Vehicle preference — chosen visually from the fleet, not from a dropdown
- Child seats required (Isofix booster — the only type currently available)
- Occasion notes, and any special requirements

*Step 4 — You*
- Name, phone, email
- Preferred contact method, defaulting to WhatsApp
- Confidentiality requested (yes/no) — see §7.3
- Consent to be contacted, and an optional marketing opt-in kept separate

**Requirements**
- Progress is saved as they go. A half-finished enquiry with a phone number in it is still a lead worth chasing.
- Works on one thumb, on a phone, in poor signal.
- Invisible spam filtering — no puzzles, no "click all the traffic lights".
- Every enquiry is stored securely and privately, and appears in your pipeline instantly.
- The form also feeds the quote engine (§10.2) so most people see a price before they submit.

**Done when:** you can quote from the enquiry alone, without going back to ask a single question, on at least 9 of every 10 enquiries.

---

### 10.2 Instant indicative quote — P0

**The problem.** You said it plainly: *"Yes — we're losing people who want a price now."* Quotes take *"a few hours"* and are built *"in my head. There's no method to the madness."* Meanwhile the customer has messaged three other companies.

**What it does.** Gives a serious enquirer a credible price range on the spot, then invites them to secure it. It does not replace your judgement — it buys you the booking while you sleep.

**How the price is built.** You already gave us the ingredients:

| Vehicle | Hourly rate |
|---|---|
| Rolls-Royce Cullinan | £200 |
| Lamborghini Urus | £150 |
| Mercedes G-Wagon | £125 |
| Mercedes S-Class | £90 |
| Mercedes V-Class | £75 |

Plus: **4-hour minimum booking**, **day rates from £500**, and surcharges for **bank holidays, Congestion Charge & ULEZ, airport parking and drop-off fees, and additional stops**.

That is enough to quote hourly and as-directed work today. **Airport transfers are the gap** — you answered *"varies depending on airport."* We will supply a simple grid (airport × vehicle tier × zone) for you to fill in once, and it then runs itself. **§17, Q5.**

**Requirements**
- Show a **range**, not a fixed figure — "from £X" — with a clear note that it is confirmed by us before booking. This protects you on unusual jobs while still answering the question.
- Surcharges shown as named line items. Nobody argues with a Congestion Charge; they argue with a number that appeared from nowhere.
- Weddings quote as **"bespoke"** by design — you confirmed wedding pricing is tailored — but still capture the full brief and give a starting-from figure so the enquiry does not go cold.
- Rates are editable by you from your admin screen. No developer needed to change a price.
- Every quote given is logged against the enquiry, so you can see later what was quoted and whether it won.

**Done when:** a visitor can go from landing on the site to a credible price in under 90 seconds, at 2am, with nobody awake.

---

### 10.3 Deposits and payment — P0

**The problem.** You take cash. You have no payment provider. You take a deposit from all new clients — but arranging it is manual, and your own strongest buying signal is *"when they want to pay a deposit."* Right now that signal costs you a phone call to collect.

**What it does.** Lets a client pay a deposit the moment they decide, which is the moment they are most likely to.

**Requirements**
- Card payment via a reputable provider (Stripe recommended — standard, trusted, and supports everything in Phase 2).
- **Deposit link** issued automatically with every quote, and re-sendable in one tap from your phone.
- Deposit rule configurable by you: a percentage or a flat amount, with different rules by service type.
- Balance payable by link, on account, or in cash — your choice per booking.
- Cancellation terms shown at the point of payment: **free up to 24 hours before, 50% thereafter** (as you specified) — this needs a final wording check, **§17, Q6**.
- Automatic receipt and booking confirmation, so the client gets something that looks like a real company.

**Done when:** a client can confirm and pay a deposit without you touching your phone.

---

### 10.4 The 24/7 instant response — P0

**The problem, and the biggest opportunity in this project.** Your homepage promises a reply within the hour. The truth is *"several hours"*, and a 2am enquiry *"wouldn't get a response until someone is awake."* You lose work because you are *"too slow."*

Rather than remove the promise, we recommend making it true — automatically.

**What happens when an enquiry lands**

1. **Within seconds**, the client receives a branded confirmation on their preferred channel (WhatsApp, email or SMS): their booking brief read back to them, their indicative price, a deposit link, and a realistic note on when a human will confirm.
2. **You are notified immediately** on all four channels you asked for — WhatsApp, email, SMS and push notification.
3. **Out of hours**, the message sets an honest expectation: *"We've got your details and your indicative price. Faheem will personally confirm by 9am."* Honest and instant beats vague and slow.
4. **If nobody has responded within your chosen window**, the system chases you, then escalates to your brother.

**Requirements**
- Response templates are yours to edit, per service type.
- Nothing here fakes being a human. It reads as an efficient company, not a bot pretending to be Faheem.
- Only once this is live may the site claim a response time — and then it can claim a far better one than "within the hour."

**Done when:** median first response is under five minutes, at every hour of the day, measured over a full month.

---

### 10.5 The enquiry pipeline — P0

**The problem.** *"It's all in my head."* No CRM. Nothing shows what is unanswered. No record of quoted vs won vs lost. You cannot improve what you cannot see, and you told us your biggest frustration is *"my own personal organisation."*

**What it does.** One screen, on your phone, that answers: *what needs me right now?*

**Requirements — exactly what you asked for**
- **Log every enquiry automatically** — website, and manually added ones from WhatsApp or phone
- **Show which are unanswered** — sorted by how long they have been waiting, oldest and hottest first
- **Track quoted vs won vs lost** — with a one-tap reason when lost (price, availability, too slow, no reply, other)

**Plus**
- Statuses: New → Quoted → Deposit paid → Confirmed → Completed → Lost
- Everything about one client on one card: brief, quote, messages, payments
- Two logins — you and your brother — seeing the same live picture
- Built phone-first. If it is slower than typing into WhatsApp, it has failed.

**The hard constraint.** You said you would use a pipeline *"if it's simple enough."* We are treating that as the acceptance criterion, not a nice-to-have. **Fewer than four taps from notification to sent quote.**

**Done when:** you go a full week without needing to remember anything, and can answer "how many did we convert?" without thinking.

---

### 10.6 Fleet and availability — P1

**The problem.** *"How do you keep track of who's driving what, when?" — "In my head."* You run TimeTree and 2–3 pay-as-you-go chauffeurs. The most time-consuming part of your week is *"picking up and dropping off cars"* — a scheduling problem, not a driving one.

**What it does.** A simple calendar showing each vehicle and who is on it, so a wedding date can be checked in seconds rather than recalled.

**Requirements**
- Vehicle-by-day view, with bookings, blocks and maintenance
- Assign a chauffeur to a booking; they receive the job details only
- **Availability check on wedding enquiries** — the highest-value question a bride asks is "is the Cullinan free on the 14th of June?" Answering instantly wins the job.
- Mark vehicles as owned or sourced, so you know when you need to call a partner
- Exports to the calendar you already use, rather than replacing it on day one

---

### 10.7 Fleet pages and the merged gallery — P0

**The problem.** Your cars are your single strongest asset, and they are currently trapped behind a 182 MB page split across two competing sections.

**Requirements**
- Keep the **four tiers exactly as they are** — you confirmed this: chauffeur-driven core, high-profile SUVs, group transport, statement & experience vehicles.
- A page per vehicle, with: passenger and luggage capacity, what is included as standard, indicative hourly rate, gallery, and an enquire button that pre-fills the form with that car selected.
- **Capacity shown honestly.** You gave: Cullinan 3 passengers / 2 large cases; S-Class 3 / 2; V-Class 6 / 5. We need the remaining vehicles — **§17, Q4.**
- **Standard inclusions, stated on every vehicle:** bottled water, phone chargers, privacy glass, rear climate control, umbrellas, child seats on request (Isofix booster), refreshments on request.
- **Showcase is merged into Gallery** (your decision), filterable by every vehicle, and permanently redirected so no existing links break.
- All photography re-processed: modern formats, sized correctly for the device, loaded as the visitor scrolls. Target: the Gallery becomes one of the *fastest* pages on the site, not the slowest.
- **Owned vs sourced marked internally**, and language on the public site kept accurate — you own most and source the rest, and the copy should never imply otherwise.

---

### 10.8 The weddings page — P0, first service page built

**Why first.** 70% of your revenue, one of your top three earners, your own stated first priority, and the single clearest search intent in the market. If this project only did one thing well, this would be it.

**What the page must do.** A wedding client is not buying transport. They are buying the certainty that nothing goes wrong on the most scrutinised day of their life, and a car that looks extraordinary in photographs.

**Requirements**
- Lead with real photography from real weddings (you confirmed you can use these with permission)
- **Date availability check, prominently placed** — the first question every couple asks
- The wedding-specific brief: ceremony and reception addresses, timings, how many cars, who travels in which, ribbons and dressing, second trips for family
- Bespoke pricing with a clear "from" figure, so nobody bounces for lack of a number
- What is included: chauffeur in formal dress, red carpet if offered, umbrellas, water, waiting time, second journeys
- Real testimonials from real couples (§10.11)
- **Wedding-season discount codes** applied here first — a feature you specifically asked to start offering (§10.12)
- Reassurance content: what happens if a car breaks down, what the backup plan is, how far ahead to book

**Airport transfers** and **corporate** follow the same template in Phase 1, using facts you have already given us: meet & greet with name board, flight tracking, luggage assistance, **60 minutes' free waiting after landing**, Gatwick and the London airports as the priority routes.

---

### 10.9 Corporate accounts — P1

**The problem.** You have zero corporate accounts and this is your clearest growth ambition. You also asked to start offering **monthly invoicing for corporates**. Corporate bookers in Canary Wharf and Mayfair cannot use a supplier who takes cash and quotes from memory.

**Sequencing note.** You asked for a corporate page *"after the service pages"* — we agree, and Phase 1 will still capture corporate leads through a dedicated service page. The account machinery follows in Phase 2.

**Requirements**
- Corporate landing page: agreed rates, monthly invoicing, named account contact, licensing and insurance evidence, discretion and confidentiality terms
- **Account application** capturing the things procurement always asks for
- **Monthly consolidated invoicing** — one invoice, all bookings itemised, per cost centre where needed
- Agreed rate card per account
- Booking on behalf of someone else — the booker is rarely the passenger, and the system must handle that properly
- Monthly statement of journeys

**What we need from you:** credit terms, whether accounts get preferential rates, and your invoicing process. All currently "N/A" — we will work through these together (**§17, Q8**).

---

### 10.10 Self-drive supercar hire — P1, deliberately separated

**The tension.** Self-drive is one of your top three earners. It also directly contradicts *"We are not a vehicle hire company"* and carries risk that chauffeur work does not.

**Our recommendation.** Do not put a "book now" button on a £300,000 car.

- Give self-drive its **own page and its own visual treatment**, clearly branched off the chauffeur spine so the main site stays chauffeur-led — which is what you asked for.
- Gate it behind a **qualification form**, not an instant booking: driver age, licence held for how long, endorsements, security deposit acknowledgement, insurance requirements, mileage limits.
- No price until qualified. This filters time-wasters, which is the main cost of this service line.
- Separate terms, separate deposit rules, separate cancellation policy.

**Flag:** self-drive insurance, security deposits and driver verification are commercially significant and sit outside a website's remit. We will build the funnel; the underwriting and policy decisions are yours, and we recommend taking advice on them.

---

### 10.11 Reviews and trust — P0 (removal) / P1 (engine)

**The problem, stated bluntly.** You have **zero Google reviews**, **no Google Business Profile**, and six invented testimonials on your live site. For a local service business, this is more damaging than the website itself. Somebody searching "chauffeur Mayfair" sees a map with three companies on it. You are not on it.

**Phase 0 — remove.** The placeholder testimonials come down immediately (§4.3).

**Phase 1 — replace.** Real quotes, attributed as **first name, role and district** — the level you told us you can get. Six real ones beat sixty anonymous ones.

**Phase 1 — the profile.** Create and verify the Google Business Profile. Correct name, address and phone everywhere. This is the highest-return hour of work in the entire project.

**Phase 2 — the engine.** You said asking for reviews *"feels awkward."* So stop asking.
- An automatic, warmly-worded request goes out a set period after every completed journey
- One tap to the Google review form
- Happy clients are routed to Google; unhappy ones are routed privately to you first, so problems reach you rather than the internet
- A running count in your monthly report

**Other trust signals to display, once §4.4 is settled:** licensing status, insurance cover (£5m public liability, Royal & Sun Alliance), chauffeur vetting (advanced driving qualification), and confidentiality terms.

**Note on chauffeur training.** You answered "none" to what training chauffeurs receive. If that stays true, we simply will not claim it. If you introduce even a short standards induction, it becomes a genuine selling point — and a cheap one.

---

### 10.12 Discount codes — P1

You asked to start offering **discount codes during wedding seasons.**

- Codes created by you, with expiry dates, usage limits and service restrictions
- Percentage or fixed amount
- Applied at quote and deposit stage
- Reported on: how many redeemed, how much revenue they carried

**A word of caution as your product managers:** you position on quality and told us you handle *"why so expensive?"* with *"my cars are expensive."* Discounting is the fastest way to undermine that. We recommend using codes for **seasonal demand-filling in your quiet months** and for **partner referrals**, not as a general price reduction. We would rather build you a "book early for 2027 weddings" incentive than a sale.

---

### 10.13 Content and being found — P1/P2

**Where you stand.** No Search Console, no analytics, no ads ever run, no idea how you perform. We are starting from zero — which is genuinely good news, because there is nothing to undo.

**Search priorities, in your stated order:** weddings → events → airport.

**Terms you believe people search:** "chauffeurs in London", "self drive hire London". We will validate these with real search data before writing a word, and we expect the wedding and airport terms to carry the commercial volume.

**Areas to be found in:** Mayfair, Knightsbridge, Chelsea, Kensington, Fulham. You asked our advice on area pages — **yes, but only real ones.** Five genuinely useful pages about serving those districts will outperform fifty thin ones, and thin location pages are actively penalised.

**Nationwide.** You confirmed this is a real part of the business, so the site will carry it properly rather than burying it.

**Blog / guides.** You want one, correctly, for ranking. We propose a small number of genuinely useful pieces over a large number of filler ones — for example: what to look for in a wedding car, how airport meet & greet actually works, what a chauffeur day rate includes, how far in advance to book for a summer wedding.

**Things you do not want to be found for:** "cheap", "Uber". Noted, and reflected in both copy and any future ad targeting.

**Content process.** You said you would want to *"talk it through first"* rather than write it. That is the right call. We will write; you will review on your weekly call. We need roughly 30 minutes of your time per service page, recorded, and we will do the rest.

---

### 10.14 Knowing whether any of this worked — P0

**The problem.** Nothing is measured. No analytics, no Search Console, no call tracking. Your stated fear about this project is *"wasting money and being in the same position as when we start."* The only defence against that fear is measurement, installed from day one.

**Requirements**
- Analytics and Search Console installed on the **current** site immediately, so we have a genuine before-and-after rather than a story
- Every enquiry attributed to its source: search, direct, social, referral, ad
- **Call tracking**, so phone enquiries are counted too — currently invisible to you
- Conversion tracking end to end: visit → enquiry → quote → deposit → completed booking
- A monthly one-page report (§15)

---

### 10.15 Editing the site yourself — P1

You should not need us to change a price, add a car, publish a testimonial or write a post. Fleet, rates, testimonials, service copy, discount codes and blog posts will all be editable by you, in plain language, without touching code.

---

## 11. Standards the new site must meet

These are commitments we hold ourselves to, written in terms you can check yourself.

| Area | The standard |
|---|---|
| **Speed** | Every page usable within 2.5 seconds on a mid-range phone on 4G, including the Gallery. Total page weight a small fraction of today's. You will be able to feel the difference on your own phone — and we will ask you to check, because you told us you never have. |
| **Mobile** | Designed for the phone first. Most of your wedding and private enquiries will arrive from one. Every form completable with one thumb. |
| **Findability** | Content readable by Google without any special handling. Correct site map. Correct business listing information. One canonical web address, pointing at itself. Every old link redirected, nothing lost. |
| **Accessibility** | Meets recognised accessibility standards (WCAG 2.2 AA). Legible type, real contrast, keyboard-navigable forms. This also serves your "easiest to read" instruction directly. |
| **Security and privacy** | No public access to any enquiry or client data, ever. Encrypted in transit and at rest. Two-factor login on the admin. Card details never touch our systems — handled entirely by the payment provider. A stated retention period, and deletion when it expires. |
| **Reliability** | Independently monitored, with an alert if the site or the enquiry form goes down. You should never again be in a position where enquiries are disappearing and nobody notices. |
| **Ownership** | Every account — domain, hosting, analytics, payments, Google — registered in **CC City Chauffeurs' name**, with you as owner and us granted access. This is the mistake that created the current situation, and we will not repeat it. |

---

## 12. Rebuild or repair — our recommendation

You asked us to advise. **We recommend a rebuild.**

Not because rebuilding is what agencies say, but because repairing requires three things you do not have:

1. **The source code.** It sits with the previous freelancer.
2. **Access to the hosting.** You do not have it and do not know whose account it is.
3. **A foundation worth keeping.** The core problem — that the site's content is invisible to Google — is not a bug to be fixed. It is a consequence of how the site was built. Correcting it means rebuilding it anyway.

Add the 182 MB of imagery, the open enquiry list, and the fact that none of the systems this PRD describes exist at all, and repair becomes the more expensive route to a worse outcome.

**What that means practically:** we build fresh, on foundations we control, in accounts you own, with everything in this document designed in from the start rather than bolted on. The existing photography is reused (you own the rights — confirmed). The existing copy is rewritten. Nothing that works today is lost.

**Two things must happen regardless of this decision**, and should happen this week: take down the open enquiry list, and secure the domain before January.

---

## 13. What we need from you

The project's critical path runs through your inbox more than ours. You said you can be responsive and can give this plenty of time — this is where that matters.

| # | What | When | Why it blocks us |
|---|---|---|---|
| 1 | **Answers to §17** | Week 1 | Several are genuinely blocking |
| 2 | **Domain and hosting access** — IONOS login, whoever holds it | Week 1 | Domain expires January; nothing launches without it |
| 3 | **One phone number, one email** | Week 1 | Everything downstream — Google listing, site, invoices — depends on it |
| 4 | **Confirmed fleet list**, marked owned vs sourced, with passenger and luggage capacity for each | Week 2 | Fleet pages cannot be built without it |
| 5 | **Real testimonials** — first name, role, district | Week 2–3 | The trust section cannot launch with placeholders |
| 6 | **Licensing and insurance documents** | Week 2 | Determines what the site may claim |
| 7 | **Airport pricing grid** — we send the template, you fill it once | Week 3 | Airport quotes cannot be automated without it |
| 8 | **Photography** — your phone library, and permission to use real job photos | Week 2–3 | Better material than what is on the site today |
| 9 | **30 minutes per service page**, recorded, to capture how you actually talk about the work | Weeks 3–5 | Copy written from your words converts better than copy written about you |
| 10 | **Weekly call**, as you requested | Throughout | Decisions made in the call do not become blockers |

### On photography

You have *"a fair amount on phones"* and are open to a shoot *"if the budget allows."* Our honest advice: **the existing photography is good and you own it — that is not the gap.** The gap is that some of your brand imagery is AI-generated, and you have no video.

You said video would help, specifically *"shorter clips throughout."* We agree — short, silent, looping clips of doors closing, the Spirit of Ecstasy, a car pulling up to a venue, do more for a luxury site than a two-minute film nobody watches. That is a half-day shoot, not a production.

**Recommendation:** replace the AI-generated imagery first, add short clips second, and consider a full shoot in Phase 2 once the site is earning. You have also agreed to show chauffeurs' faces without names — worth capturing, as it is one of the few things that makes a chauffeur company feel like people rather than cars.

---

## 14. How we will run it

Timeline is indicative pending scope sign-off and answers to §17. You asked for it live *"as soon as possible"*; we have sequenced so the things that stop losses happen in week one, not week twelve.

| Phase | What lands | Indicative |
|---|---|---|
| **0 — Stop the bleeding** | Open enquiry list closed. Fake testimonials removed. Close protection claims removed. False availability claims corrected. Domain secured. Analytics installed for a baseline. Google Business Profile created. | Week 1 |
| **A — Direction** | Discovery call. Two design directions (§7.2). Brand and logo direction agreed. Site structure signed off. | Weeks 1–2 |
| **B — Design** | Homepage, fleet, weddings, enquiry flow and quote journey designed and approved. Legal pages drafted. | Weeks 3–4 |
| **C — Build** | New site built. Enquiry form, quote engine, deposits, instant response, pipeline. Content written and approved. | Weeks 5–8 |
| **D — Launch** | Testing on real devices. Redirects. Search Console. Handover and training on the pipeline. Go live. | Week 9 |
| **E — Prove it** | Watch, measure, fix. First monthly report. | Weeks 10–12 |
| **Phase 2** | Remaining service pages, area pages, corporate accounts and invoicing, review engine, discount codes, blog. | From month 4 |

**Decisions** are yours alone — you confirmed you are the sole approver, and nobody else is working on the site. That is a significant advantage for speed, and we will use it.

**Updates:** a weekly call, as you asked, plus a written summary after each so decisions are recorded rather than remembered.

---

## 15. The monthly report

Your answer to what you want to know each month was *"how many leads we have converted."* So the report opens with that, in one line, before anything else.

**Page one, every month:**

1. **Leads converted this month** — number, value, and the change on last month
2. Enquiries received, by source
3. Median response time
4. Quotes sent, won, lost — and why they were lost
5. Deposits taken
6. New Google reviews
7. Search visibility and the pages driving it
8. What we did last month, and what we are doing next

Your fear is *"being in the same position as when we start."* This report is how you will know, by month three rather than month twelve, whether that is happening — and it is deliberately blunt enough to tell you if it is.

---

## 16. Risks

| Risk | Likelihood | Impact | What we do about it |
|---|---|---|---|
| **Licensing position is not what the site claims** (§4.4) | Medium | Severe — could halt the project | Resolve in week one, before design begins. Nothing is claimed until evidenced. |
| **Domain lost in January 2027** | Medium | Severe | Recover the IONOS account in week one. If it cannot be recovered, secure alternatives and plan a clean migration well ahead of expiry. |
| **More leads than the business can serve** — 1 office person, 2–3 PAYG chauffeurs | High | High | This is the most under-appreciated risk here. A successful project doubles your enquiries. Availability checking, honest lead times, the 4-hour minimum and 48-hour notice are built into the quote engine deliberately, so growth does not become a service failure. Revisit chauffeur capacity at month three. |
| **The pipeline goes unused** | Medium | High | The stated constraint is simplicity. We will test it against the honest benchmark: is it faster than WhatsApp? If not, we simplify until it is. |
| **Content sign-off stalls** | Medium | Medium | You review, we write. 30 minutes recorded per page, not blank documents to fill in. |
| **Fake testimonials remain live** | Low | High | Removed in week one, independent of everything else. |
| **Fleet changes** — cars sourced rather than owned | Medium | Medium | Fleet is editable by you. Sourced vehicles marked, and never described in a way that implies otherwise. |
| **Discounting erodes positioning** | Medium | Medium | Codes restricted to quiet seasons and partner referrals (§10.12). |
| **Expectations of instant results** | High | Medium | Search takes months. Response time, conversion and deposits improve in weeks. We report both, separately, so early wins are visible while the slower work matures. |

---

## 17. Open questions

**Blocking — we need these before design begins.**

| # | Question | Why it matters |
|---|---|---|
| **Q1** | **What is your exact TfL position?** Do you hold a Private Hire Vehicle Operator Licence? Are the vehicles and drivers licensed? Is the insurance hire-and-reward? | You answered "no" to an operator licence but named TfL as your authority. In London, pre-booked private hire without an operator licence is a criminal offence. This determines what the site can say and may affect the business structure. **The single most important answer in this document.** |
| **Q2** | **Which one phone number and one email?** The site shows 020 8443 3332, 07370 955161 and WhatsApp 07804 429407. The intake form gives 07706754724. The email is spelled two ways. | Everything downstream depends on it. We recommend one business landline plus one WhatsApp Business number, and moving off Gmail to an address on your own domain. |
| **Q3** | **When did you actually start trading?** The company was incorporated in 2024; the form says 2026. | We will not publish a claim we cannot evidence. |
| **Q4** | **What is the real, current fleet?** The site sells a Ferrari SF90 and a Lamborghini SVJ; you listed a Huracán and a Revuelto. Which can you supply today, which do you own, and what are the capacities for the vehicles you have not yet given? | Fleet pages cannot be built on an unconfirmed fleet. |
| **Q5** | **Airport pricing.** We will send a grid — airport by vehicle by zone. | Without it, airport transfers cannot be quoted automatically, and airport is one of your three priority services. |

**Important — needed during the build.**

| # | Question |
|---|---|
| **Q6** | **Cancellation policy wording.** You wrote *"Free up to 24 hours before, or yes it's a 50% charge."* We need the exact terms, per service — weddings and supercars usually differ. |
| **Q7** | **Budget and ongoing retainer.** You are unsure whether there is a monthly budget, but want SEO and content, hosting and maintenance, Google Ads, and social. These are four different disciplines with four different costs. We would rather scope two properly than four thinly — and our recommendation is to start with SEO/content and maintenance, and add Ads once the site is converting. |
| **Q8** | **Corporate account terms.** Credit terms, whether accounts get preferential rates, invoicing process, and whether a client-facing portal is genuinely wanted. You answered "not sure" — that is a fair answer, and we will work it through with you rather than guess. |
| **Q9** | **May we submit one controlled test enquiry to your live site?** It would confirm whether website enquiries are being lost today. It may ping your WhatsApp, so we will not do it without your say-so. |

**Worth your thought — not blocking.**

| # | Question |
|---|---|
| **Q10** | **Do you want to keep the name "City Chauffeurs" or move to "CC City Chauffeurs"?** They are currently used interchangeably across the site, the company record and your tagline. One name, used consistently, is worth more than two. |
| **Q11** | **Chauffeur training.** Currently none. Even a short written standards induction would give us something real to say, and would genuinely improve consistency across pay-as-you-go drivers. |
| **Q12** | **Do you want an NDA available to clients?** You have no formal agreement today. Offering one costs nothing and directly substantiates the discretion promise (§7.3). |
| **Q13** | **Hotel and concierge partnerships.** You have none, and the site already references "Luxury Hotel Concierge" as a client type. This is the fastest route to corporate-adjacent work in your target districts, and it is a relationship play rather than a website one. |

---

## 18. Assumptions

1. The intake form answers are accurate as of September 2026 and are the client's own.
2. The client owns the rights to all existing fleet photography, as stated.
3. Faheem is the sole decision-maker and no other party has authority over the site.
4. The business will continue to serve chauffeur work as its primary line, with self-drive secondary.
5. Rates quoted in the intake form are current and may be published as indicative.
6. Domain and hosting access is recoverable. If it is not, a migration plan is required and the timeline in §14 extends.
7. Phase 1 does not require dispatch software, driver apps or live vehicle tracking.
8. Legal wording for terms, privacy and cancellation will be reviewed by a qualified party before publication. **This document is not legal advice, and the licensing and advertising points in §4 should be confirmed with a solicitor or with TfL directly.**

---

## Appendix A — Rate card as supplied

| Vehicle | Hourly |
|---|---|
| Rolls-Royce Cullinan | £200 |
| Lamborghini Urus | £150 |
| Mercedes G-Wagon | £125 |
| Mercedes S-Class | £90 |
| Mercedes V-Class | £75 |

- **Minimum booking:** 4 hours
- **Day rates:** from £500
- **Notice preferred:** 48 hours
- **Airport free waiting:** 60 minutes after landing
- **Coverage:** UK and Europe
- **Deposit:** required from all new clients
- **Cancellation:** free to 24 hours; 50% thereafter *(wording to confirm — Q6)*
- **Surcharges:** bank holidays · Congestion Charge & ULEZ · airport parking and drop-off · additional stops
- **Weddings:** bespoke
- **Payment today:** cash *(to be replaced — §10.3)*

## Appendix B — Fleet, as confirmed on the intake form

**Chauffeur-driven core** — Rolls-Royce Cullinan · Rolls-Royce Ghost · Bentley Flying Spur · Mercedes S-Class · Range Rover Vogue · Mercedes V-Class

**High-profile SUVs** — Range Rover Vogue · Mercedes G-Wagon · Bentley Bentayga · Lamborghini Urus · Rolls-Royce Cullinan

**Group transport** — Mercedes V-Class (8 seats) · Mercedes V-Class JetClass (4 seats)

**Statement & experience** — Lamborghini Huracán · Lamborghini Revuelto

*Four tiers confirmed correct and retained. Vehicles approximately 3 years old. Most owned, remainder sourced. **Discrepancy against the live site flagged at H9 / Q4.***

**Standard in every car:** bottled water · phone chargers · privacy glass · rear climate control · umbrellas · child seats on request (Isofix booster) · refreshments on request.
**Not available:** wheelchair or mobility access — and therefore not advertised.

## Appendix C — Services offered

Private chauffeur (hourly / as-directed) · Airport transfers · Weddings · Corporate events · Private events & occasions · City-to-city / long distance · Roadshows & multi-day corporate · Supercar hire (self-drive) · Supercar chauffeur / experience · Tours & sightseeing · School & family runs

**Removed:** close protection (§4.2).
**Wanted, not yet offered:** monthly corporate invoicing · wedding-season discount codes · roadshows and multi-day corporate work.

## Appendix D — Enquiry form, current vs proposed

| Today (7 fields) | Proposed |
|---|---|
| Name | Name |
| Phone | Phone |
| Email | Email |
| Service | Service |
| Pickup | Pickup *(with address lookup)* |
| Drop-off | Drop-off *(with address lookup)* |
| Notes | Notes |
| — | **Date** |
| — | **Pickup time** |
| — | **Duration / return** |
| — | **Number of passengers** |
| — | **Luggage** |
| — | **Additional stops** |
| — | **Vehicle preference** |
| — | **Flight number** *(airport only)* |
| — | **Child seats** |
| — | **Preferred contact method** |
| — | **Confidentiality requested** |
| — | **Consent and marketing opt-in, kept separate** |

*The three you chase on every single enquiry — date, time, passengers — are in bold.*

---

### Sign-off

| Role | Name | Date |
|---|---|---|
| Client approver | Faheem Fareed, Director | |
| Agency | Client Reach | |

*Prepared by Client Reach. Findings in §3 reflect the live site as at 10 September 2026 and may change if the site is edited. This document is not legal advice; see §18.8.*
