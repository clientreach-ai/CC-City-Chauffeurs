# CC-City-Chauffeurs

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Hono, and more.

Three applications — a website, an admin and the API behind both — sharing one
typed contract. See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for how
they fit together.

| | | |
|---|---|---|
| `apps/web` | The public website | http://localhost:3001 |
| `apps/admin` | The admin | http://localhost:3002 |
| `apps/server` | The API | http://localhost:3000 |
| `packages/core` | Types, validation and publishing rules, shared by all three | |
| `packages/db` | Drizzle schema, migrations and the seed | |
| `packages/ui` | Design tokens and the components the site and its previews share | |

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Fill in the Cloudflare R2 variables — every photograph is stored in and served
   from that bucket. `apps/server/.env.example` explains each one.

4. Apply the schema, then seed it from the website's own content:

```bash
pnpm run db:migrate
pnpm run db:seed -- --samples   # --samples adds example enquiries and bookings
```

Seeding is destructive for content and idempotent: it rewrites every content
table from `apps/web/src/content/*`. It leaves enquiries, bookings and
customers alone unless you ask it not to.

The seed writes bucket addresses for the site's own photography. To put the
files themselves in the bucket (once, or again to fill a gap):

```bash
cd apps/server
bun run scripts/migrate-media-to-r2.ts            # says what it would do
bun run scripts/migrate-media-to-r2.ts --apply    # does it
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@CC-City-Chauffeurs/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
CC-City-Chauffeurs/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
