import { auth } from "@CC-City-Chauffeurs/auth";
import { env } from "@CC-City-Chauffeurs/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { errorResponse } from "./lib/errors";
import { revalidateSite } from "./lib/revalidate";
import { requireUser, sameSiteWrites, withSession, type Variables } from "./lib/session";
import { resumeWhatsApp, whatsappChannel, whatsappMode } from "./lib/whatsapp";
import { contentRoutes } from "./routes/content";
import { fleetRoutes } from "./routes/fleet";
import { galleryRoutes } from "./routes/gallery";
import { mediaRoutes } from "./routes/media";
import { operationRoutes } from "./routes/operations";
import { publicRoutes } from "./routes/public";
import { serviceRoutes } from "./routes/services";
import { testimonialRoutes } from "./routes/testimonials";
import { whatsappAdminRoutes, whatsappWebhookRoutes } from "./routes/whatsapp";

/**
 * The API.
 *
 *   /api/auth/*     sessions, from better-auth
 *   /api/public/*   what the website reads — published records, no session
 *   /api/admin/*    the admin — every route needs a session, writes need a role
 *   /api/whatsapp/* the WhatsApp webhook — signed by the provider, no session;
 *                   mounted only when WHATSAPP_PROVIDER is set
 */

const app = new Hono<{ Variables: Variables }>();

app.use(logger());
// nosniff, frame-deny, a strict referrer policy and HSTS on every response.
app.use(secureHeaders());
const browserCors = cors({
  origin: env.CORS_ORIGIN,
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
// The WhatsApp webhook is called by the provider's servers, never by a page
// in a browser, so no origin is ever allowed to call it with credentials.
app.use("/*", (c, next) => (c.req.path.startsWith("/api/whatsapp/") ? next() : browserCors(c, next)));

/** One shape of error for every route — see `lib/errors.ts`. */
app.onError((error, c) => errorResponse(error, c));

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/public", publicRoutes);

/**
 * The WhatsApp webhook, outside /api/admin on purpose: the caller is Twilio,
 * which has no session and no origin, and whose only credential is the
 * signature the channel checks over the raw body. Not mounted at all when
 * WhatsApp is switched off.
 */
if (whatsappMode) app.route("/api/whatsapp", whatsappWebhookRoutes(whatsappMode, whatsappChannel));

/**
 * Everything under /api/admin needs a signed-in user. Reads are open to any
 * role; each write declares the capability it needs, so hiding a control in
 * the UI is never the only thing standing in the way of it.
 */
const admin = new Hono<{ Variables: Variables }>()
  .use(sameSiteWrites)
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

if (whatsappMode) admin.route("/", whatsappAdminRoutes(whatsappChannel));

app.route("/api/admin", admin);

app.get("/", (c) => c.text("OK"));

// Anything the assistant was about to answer when the process last stopped.
void resumeWhatsApp();

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};

export type AppType = typeof app;
