/**
 * The settings that decide whether the post can go out.
 *
 * These are the rules the server is held to at boot, and they exist for the
 * mistakes that cannot be caught any later. A key that is not a Resend key,
 * or a sender with no address in it, is refused by Resend on every single
 * send — so the office simply never hears about an enquiry, and the only
 * trace is a line in a log nobody is reading. Far better that the server
 * refuses to start and says which setting is wrong.
 */

import { describe, expect, test } from "bun:test";
import { mailConfigProblems, type MailSettings } from "@CC-City-Chauffeurs/env/mail";

const sending: MailSettings = {
  MAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_a_test_key_0123456789",
  MAIL_FROM: "City Chauffeurs <bookings@citychauffeurs.co.uk>",
  OFFICE_EMAIL: "bookings@citychauffeurs.co.uk",
};

const paths = (settings: MailSettings) => mailConfigProblems(settings).map((problem) => problem.path);

describe("switched off", () => {
  test("nothing else matters — which is what every deployment and every test does", () => {
    expect(mailConfigProblems({})).toEqual([]);
    expect(mailConfigProblems({ MAIL_PROVIDER: "off", NODE_ENV: "production" })).toEqual([]);
    // Even with a key sitting in the file, off is off.
    expect(mailConfigProblems({ MAIL_PROVIDER: "off", RESEND_API_KEY: "re_live_key" })).toEqual([]);
  });
});

describe("sending through Resend", () => {
  test("a full configuration is accepted, in production as anywhere else", () => {
    expect(mailConfigProblems(sending)).toEqual([]);
    expect(mailConfigProblems({ ...sending, NODE_ENV: "production" })).toEqual([]);
  });

  test("a mailer with nothing to send, or nobody to tell, is refused", () => {
    expect(paths({ ...sending, MAIL_FROM: undefined })).toEqual(["MAIL_FROM"]);
    expect(paths({ ...sending, OFFICE_EMAIL: undefined })).toEqual(["OFFICE_EMAIL"]);
    expect(paths({ MAIL_PROVIDER: "resend" })).toEqual(["MAIL_FROM", "OFFICE_EMAIL", "RESEND_API_KEY"]);
  });

  test("a sender has to carry an address, named or bare", () => {
    expect(mailConfigProblems({ ...sending, MAIL_FROM: "bookings@citychauffeurs.co.uk" })).toEqual([]);

    const problems = mailConfigProblems({ ...sending, MAIL_FROM: "City Chauffeurs" });
    expect(problems.map((problem) => problem.path)).toEqual(["MAIL_FROM"]);
    expect(problems[0]!.message).toContain("must carry an address");
  });

  test("the office address has to be one address, not a name and not a list", () => {
    expect(paths({ ...sending, OFFICE_EMAIL: "The office" })).toEqual(["OFFICE_EMAIL"]);
    expect(paths({ ...sending, OFFICE_EMAIL: "a@b.co.uk, c@d.co.uk" })).toEqual(["OFFICE_EMAIL"]);
  });

  test("a key that is not a Resend key is caught here rather than on the first enquiry", () => {
    const problems = mailConfigProblems({ ...sending, RESEND_API_KEY: "SG.a-sendgrid-key" });

    expect(problems.map((problem) => problem.path)).toEqual(["RESEND_API_KEY"]);
    expect(problems[0]!.message).toContain("begins re_");
  });
});
