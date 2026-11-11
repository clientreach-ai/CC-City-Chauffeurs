/**
 * The hourly round on the enquiries nobody has booked: reminds, then closes.
 *
 *   bun run scripts/expire-enquiries.ts [--dry-run]
 *
 * Two sweeps, in this order, because the order is the point. A customer
 * whose journey is two days off and who has not booked hears from us; a
 * customer whose journey has been and gone has their enquiry closed. The
 * reminder comes first so that nobody is ever reminded and closed in the
 * same run, and so an enquiry has had its chance before it is shut.
 *
 * Run hourly by `cc-expire-enquiries.timer` (see `deploy/`), and by hand
 * whenever somebody wants to know what it would do. Both are safe: each
 * sweep touches an enquiry once in its life and writes one line on its
 * trail, however many times it runs. `--dry-run` reports and writes nothing
 * and sends nothing.
 *
 * The file is still called `expire-enquiries.ts` because the unit installed
 * on the VPS names it, and renaming it here would leave a machine running a
 * script that no longer exists until somebody reinstalled the unit as root.
 *
 * It imports the repository and the mailer, and nothing else. Importing
 * `src/index.ts` would start the API, open the WhatsApp channel and have a
 * cron job answering customers, which is not what anybody asked this to do.
 */

import { enquiryReminder } from "../src/lib/notifications";
import { expireDueEnquiries, remindDueEnquiries } from "../src/repositories/operations";

const dryRun = process.argv.includes("--dry-run");
const started = performance.now();

// The reminder is the newer job and the one that talks to a mail server. If
// it throws, the closing sweep still runs: the office's list should not stop
// being tidied because a reminder could not be worked out. The run is still
// reported as failed, at the end, so the journal and systemd both show it.
let reminders: Awaited<ReturnType<typeof remindDueEnquiries>> | null = null;
let reminderError: unknown = null;
try {
  reminders = await remindDueEnquiries({ dryRun, send: enquiryReminder });
} catch (error) {
  reminderError = error;
}
const { checked, expired } = await expireDueEnquiries({ dryRun });

const took = Math.round(performance.now() - started);

if (!reminders) {
  console.error("The reminder sweep failed; nobody was reminded. The closing sweep still ran.");
  console.error(reminderError);
} else if (!reminders.inWindow) {
  console.log("Outside the hours a reminder may be sent; none was. The closing sweep still ran.");
} else {
  console.log(
    `${dryRun ? "Dry run: found" : "Found"} ${reminders.checked} enquir${reminders.checked === 1 ? "y" : "ies"} due a reminder, ` +
      `${dryRun ? "would email" : "emailed"} ${reminders.reminded.length}.`,
  );
  for (const reminder of reminders.reminded) {
    console.log(`  ${reminder.reference} — ${reminder.date} to ${reminder.email}`);
  }
  for (const reminder of reminders.unsent) {
    console.error(`  ${reminder.reference} — the reminder did not leave; the office has to chase it`);
  }
}

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
process.exit(reminders ? 0 : 1);
