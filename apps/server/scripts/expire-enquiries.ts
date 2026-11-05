/**
 * Closes the enquiries whose journey date has gone by.
 *
 *   bun run scripts/expire-enquiries.ts [--dry-run]
 *
 * Run hourly by `cc-expire-enquiries.timer` (see `deploy/`), and by hand
 * whenever somebody wants to know what it would do. Both are safe: the sweep
 * closes an enquiry once in its life and writes one line on its trail,
 * however many times it runs. `--dry-run` reports and writes nothing.
 *
 * It imports the repository and nothing else. Importing `src/index.ts` would
 * start the API, open the WhatsApp channel and have a cron job answering
 * customers, which is not what anybody asked this to do.
 */

import { expireDueEnquiries } from "../src/repositories/operations";

const dryRun = process.argv.includes("--dry-run");
const started = performance.now();

const { checked, expired } = await expireDueEnquiries({ dryRun });

const took = Math.round(performance.now() - started);

// One line when there is nothing to say, so an hourly job does not fill the
// journal, and a line each when there is — the references are what somebody
// reading `journalctl` after a complaint actually needs. Both go to stdout:
// closing an enquiry is the job working, not a problem.
console.log(
  `${dryRun ? "Dry run: checked" : "Checked"} ${checked} enquir${checked === 1 ? "y" : "ies"}, ` +
    `${dryRun ? "would close" : "closed"} ${expired.length}, in ${took}ms.`,
);
for (const enquiry of expired) {
  console.log(`  ${enquiry.reference} — ${enquiry.date}${enquiry.time ? ` ${enquiry.time}` : ""}`);
}

// Bun keeps the process alive for the database pool otherwise, and a
// `Type=oneshot` unit would sit in `activating` until systemd timed it out.
process.exit(0);
