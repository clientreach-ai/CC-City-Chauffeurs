import { auth } from "@CC-City-Chauffeurs/auth";
import { env } from "@CC-City-Chauffeurs/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize } from "node:path";

import { errorResponse } from "./lib/errors";
import { revalidateSite } from "./lib/revalidate";
import { requireUser, withSession, type Variables } from "./lib/session";
import { contentRoutes } from "./routes/content";
import { fleetRoutes } from "./routes/fleet";
import { galleryRoutes } from "./routes/gallery";
import { mediaRoutes } from "./routes/media";
import { operationRoutes } from "./routes/operations";
import { publicRoutes } from "./routes/public";
import { serviceRoutes } from "./routes/services";
import { testimonialRoutes } from "./routes/testimonials";
import { UPLOAD_DIR } from "./lib/uploads";

/**
 * The API.
 *
 *   /api/auth/*     sessions, from better-auth
 *   /api/public/*   what the website reads — published records, no session
 *   /api/admin/*    the admin — every route needs a session, writes need a role
 */

const app = new Hono<{ Variables: Variables }>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

/** One shape of error for every route — see `lib/errors.ts`. */
app.onError((error, c) => errorResponse(error, c));

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

/**
 * Uploaded photographs. Served from here because this is where they were
 * stored; with object storage in front they would be served by the CDN and
 * this route would go away.
 */
app.get("/uploads/:name", async (c) => {
  const name = c.req.param("name");
  // Nothing but a bare filename may be read out of the upload directory.
  if (name !== normalize(name) || name.includes("/") || name.startsWith(".")) {
    return c.notFound();
  }
  const path = join(UPLOAD_DIR, name);
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) return c.notFound();

  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
  };
  const extension = name.slice(name.lastIndexOf("."));
  return new Response(createReadStream(path) as unknown as ReadableStream, {
    headers: {
      "Content-Type": types[extension] ?? "application/octet-stream",
      "Content-Length": String(info.size),
      // The name is unique per upload, so this can never go stale.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.route("/api/public", publicRoutes);

/**
 * Everything under /api/admin needs a signed-in user. Reads are open to any
 * role; each write declares the capability it needs, so hiding a control in
 * the UI is never the only thing standing in the way of it.
 */
const admin = new Hono<{ Variables: Variables }>()
  .use(withSession)
  .use(requireUser)
  // Runs after the handler: a successful write tells the website to refresh.
  .use(revalidateSite)
  .get("/me", (c) => c.json(c.get("user")))
  .route("/", fleetRoutes)
  .route("/", serviceRoutes)
  .route("/", galleryRoutes)
  .route("/", testimonialRoutes)
  .route("/", contentRoutes)
  .route("/", mediaRoutes)
  .route("/", operationRoutes);

app.route("/api/admin", admin);

app.get("/", (c) => c.text("OK"));

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};

export type AppType = typeof app;
