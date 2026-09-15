# `content/` — what this folder is now

The website used to read these files directly. It no longer does: every page
reads published records from the API (`src/lib/site-data.ts`).

What is left here has two jobs.

**Still rendered by the site** — things that are the application's own, not
the client's to edit:

| File | Why it stays |
|---|---|
| `brand.ts` | The logo, a local asset |
| `media.ts` | Art-directed photography chosen by page, not by an editor |
| `seo.ts` | The shape of page metadata; the values come from settings |
| `site.ts` | Route paths and the few facts that are code, not content |

**The database seed** reads the rest. `packages/db/src/seed` imports
`fleet.ts`, `services.ts`, `gallery.ts`, `testimonials.ts` and `enquiry.ts`
through this app's own `@/` alias, so seeding produces exactly the site as it
was written rather than a transcription of it.

That makes these files the *initial* content and nothing more. After the first
seed the database is the source of truth: editing a service here changes
nothing until someone reseeds, and reseeding overwrites whatever the client
has since written. Change copy in the admin, not here.
