import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Publishing, felt immediately.
 *
 * Pages read through tagged, cached fetches with a one-minute window. That
 * window is a floor, not a delay an editor should have to sit through: when
 * the API accepts a write it calls this, the matching tags are dropped, and
 * the next request rebuilds the page from the change.
 *
 * The shared secret is what stops anyone on the internet emptying the cache
 * at will. Without one configured the route refuses everything, so a
 * misconfigured deployment falls back to the timed window rather than
 * silently accepting anonymous purges.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Revalidation is not configured." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag) => typeof tag === "string") : [];
  if (!tags.length) {
    return NextResponse.json({ error: "Name at least one tag." }, { status: 400 });
  }

  // "max" drops every cached entry for the tag, however it was cached.
  for (const tag of tags) revalidateTag(tag, "max");
  return NextResponse.json({ revalidated: tags });
}
