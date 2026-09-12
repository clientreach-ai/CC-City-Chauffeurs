# The CMS layer

What the admin at `/admin` reads and writes, and how it connects to a real
backend later.

```
  screens (components/admin/*)
        │  only ever call repository functions
        ▼
  repositories/*.ts            ← the API contract, in TypeScript
        │  today: a mock adapter
        ▼
  store/database.ts            ← in-memory + this browser's localStorage
        ▲
        │ seeded from
  seed/content.ts (server)     ← the public site's own content/* files
  seed/operations.ts (client)  ← clearly-marked sample enquiries/bookings
```

## The rules this layer keeps

1. **Screens never touch the store.** They call `getVehicles()`,
   `updateVehicle()` and so on, and handle `CmsValidationError`. Swapping the
   adapter for `fetch` changes no screen.
2. **Validation runs on write, not only in the form.** `validateVehicle()` and
   its siblings are used by both, so a rule added once applies in both places —
   and can move to the server unchanged.
3. **Nothing is invented.** A capacity, rate or photograph the client has not
   given stays `null` or `""`, and the website prints "On enquiry" or a
   typographic plate. Publishing gates exist for the same reason: a testimonial
   cannot be published without attribution and recorded permission, and a
   photograph cannot be published without a description.
4. **Relationships are stored once**, on the side that orders them:
   `FleetCategory.vehicleOrder` and `Service.vehicleIds` own their order, while
   `Vehicle.categoryIds` and `Vehicle.serviceIds` are read and written through
   the repository, which keeps both sides in step.

## What is real and what is not

| Real | Not real yet |
|---|---|
| The content: the twelve vehicles, four groupings, nine services, 64 photographs, homepage copy and site settings, seeded from the live site | Authentication — there is no sign-in, and roles are a preview setting (`permissions.ts`) |
| Every CRUD operation, validation rule and publishing gate | Persistence — writes go to this browser's localStorage, not a server |
| Enquiry, booking and customer workflows | The records themselves: sample data, labelled on every screen |
| Image handling, ordering and alt text | Uploads — files are reduced to a local preview, never uploaded (`storage.ts`) |

## Connecting a backend

1. **Data.** Replace the body of each function in `repositories/*` with a
   `fetch` to the matching endpoint (each file lists its future routes in its
   header comment). Keep the signatures, the thrown `CmsValidationError`, and
   the shapes in `types.ts` — those are the contract. Delete `store/database.ts`
   and `seed/operations.ts`.
2. **Files.** Implement `MediaStorage` in `storage.ts` against R2 or S3:
   request a signed URL, PUT the original, return the CDN address and
   dimensions. Nothing else changes.
3. **Caching.** `hooks.ts` re-runs a query whenever the local store changes.
   With a real API, replace `useCmsQuery` with the caching library of the day,
   keyed the same way; screens keep using `{ data, loading, error }`.
4. **Auth.** Put the admin behind a session, give the server the role, and
   enforce the capabilities in `permissions.ts` on every write. `can()` then
   reflects a real role instead of a preview one.
5. **The public site.** Today `app/(site)` reads `content/*` directly. Once the
   API exists, those pages fetch the published records instead — the shapes
   already match, and `seed/content.ts` shows the mapping in reverse.

## Where the admin and the public site already share code

- `components/site/vehicle-entry.tsx` renders a vehicle on `/fleet` **and** in
  the admin's preview, so a preview cannot drift from the page.
- `components/site/page-hero.tsx` and `index-rows.tsx` do the same for the
  service-page preview.
- `format.ts` holds the rules the public site prints by: the rate line, the
  "On enquiry" capacity, British dates.
