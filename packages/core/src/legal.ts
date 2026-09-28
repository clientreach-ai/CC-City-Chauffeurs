/**
 * The privacy notice and the terms of service: their shape, the rules a saved
 * version must meet, and the wording the site starts with.
 *
 * The documents are edited in the admin (Website → Legal pages) and stored by
 * the API. Until one has been saved — and whenever an editor resets it — the
 * API serves the default below, so the pages can never be empty.
 *
 * The defaults are a DRAFT for the client's review. The PRD (§4.1, §18.8)
 * requires both pages before the site takes enquiries, and requires the
 * wording to be reviewed by a qualified party before it is relied on. Three
 * things in them are proposals rather than confirmed facts:
 *
 *   - the retention periods (the client has no retention policy yet, §4.1);
 *   - the cancellation terms, which are deliberately *not* stated as fixed
 *     figures while PRD §17 Q6 is open — the quote states them instead;
 *   - the ICO registration, which is not claimed until the number is known.
 *
 * Nothing here claims a licence, an accreditation or a response time.
 *
 * The company details are the public Companies House record for company
 * 15481213, which UK law requires a company's website to show.
 */

import { validator, type FieldErrors } from "./validation";

export const LEGAL_DOCUMENT_IDS = ["privacy", "terms"] as const;
export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

/** The date the default wording was written, shown until a version is saved. */
export const LEGAL_DEFAULTS_DATE = "2026-09-28";

export const isLegalDocumentId = (value: string): value is LegalDocumentId =>
  (LEGAL_DOCUMENT_IDS as readonly string[]).includes(value);

export const company = {
  registeredName: "CC City Chauffeurs Ltd",
  number: "15481213",
  registeredIn: "England and Wales",
  registeredOffice: "21–25 Romford Road, London, E15 4LJ",
} as const;

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  points: string[];
};

/** The editable content of a legal page. */
export type LegalDocumentContent = {
  title: string;
  /** Shown under the title and used as the meta description. */
  summary: string;
  sections: LegalSection[];
};

/** A legal page as the API serves it. */
export type LegalDocument = LegalDocumentContent & {
  id: LegalDocumentId;
  /** When it was last saved; null while the default wording is in use. */
  updatedAt: string | null;
  /** Who saved it last, for the admin. */
  updatedBy: string | null;
  /** True while nothing has been saved and the default wording is served. */
  isDefault: boolean;
};

const privacyNotice: LegalDocumentContent = {
  title: "Privacy notice",
  summary:
    "What CC City Chauffeurs collects when you enquire or book, why, who helps us handle it, how long we keep it, and your rights over it.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `${company.registeredName} ("we", "us") is the controller of the personal information described here. We are a company registered in ${company.registeredIn}, number ${company.number}, with our registered office at ${company.registeredOffice}.`,
        "For anything in this notice — a question, a request or a complaint — contact us by email or telephone using the details at the foot of every page.",
      ],
      points: [],
    },
    {
      heading: "What we collect",
      paragraphs: ["We collect only what we need to answer an enquiry and carry out a journey:"],
      points: [
        "Contact details: your name, telephone number and email address, and how you would like us to reply.",
        "The journey: service, date and time, pick-up and destination addresses, flight number, number of passengers, luggage, vehicle preference and anything else you choose to tell us.",
        "Messages you send us by WhatsApp, email or telephone, and our replies.",
        "Booking and payment records once a journey is agreed.",
        "Basic technical information your browser sends when you visit the site, such as the pages requested. We do not use advertising or tracking cookies.",
      ],
    },
    {
      heading: "Why we use it, and on what basis",
      points: [
        "To answer your enquiry, quote and arrange your journey — because you asked us to, and to take steps towards a contract with you.",
        "To carry out a booking, including sharing the journey details your chauffeur needs — to perform our contract with you.",
        "To keep business, accounting and tax records — because the law requires it.",
        "To keep the site and our systems secure and working, and to understand in aggregate how the site is used — our legitimate interest in running the business safely.",
      ],
      paragraphs: [
        "We do not sell your information, and we do not use it for marketing unless you have separately agreed to hear from us.",
      ],
    },
    {
      heading: "Who helps us handle it",
      paragraphs: [
        "We use a small number of service providers who process information on our behalf and only on our instructions:",
      ],
      points: [
        "Website and database hosting (Vercel, Neon) and photograph storage (Cloudflare).",
        "Email delivery, used to send you confirmations and to notify our office.",
        "WhatsApp messaging, provided by Meta through Twilio. If you message us on WhatsApp, an automated assistant (powered by OpenAI) may answer first, and hands the conversation to a person whenever needed.",
        "Your chauffeur, who receives only the details needed for your journey.",
      ],
    },
    {
      heading: "International transfers",
      paragraphs: [
        "Some of these providers store or process information in the United States. Where they do, the transfer is protected by the UK's approved safeguards, such as the UK Extension to the EU–US Data Privacy Framework or standard contractual clauses.",
      ],
      points: [],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "An enquiry that does not become a booking is deleted 12 months after our last contact with you. Records of completed bookings and payments are kept for six years, as UK tax law requires, and then deleted.",
      ],
      points: [],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You can ask us for a copy of the information we hold about you, and ask us to correct it, delete it, restrict how we use it, or send it to you or another organisation in a portable form. You can object to our using it on the basis of our legitimate interests. We will answer within one month.",
        "If you are unhappy with how we have handled your information, please tell us first. You also have the right to complain to the Information Commissioner's Office (ico.org.uk, 0303 123 1113).",
      ],
      points: [],
    },
    {
      heading: "Confidentiality",
      paragraphs: [
        "Discretion is central to what we do. We do not name our clients, publish photographs that identify them, or share details of their journeys with anyone who does not need them to carry the journey out.",
      ],
      points: [],
    },
    {
      heading: "Changes to this notice",
      paragraphs: [
        "If we change how we use your information, we will update this page and the date below.",
      ],
      points: [],
    },
  ],
};

const termsOfService: LegalDocumentContent = {
  title: "Terms of service",
  summary:
    "The terms on which CC City Chauffeurs quotes for and carries out chauffeur journeys, and on which you may use this website.",
  sections: [
    {
      heading: "About these terms",
      paragraphs: [
        `These terms apply between you and ${company.registeredName}, a company registered in ${company.registeredIn}, number ${company.number}, whose registered office is at ${company.registeredOffice}.`,
        "Self-drive supercar hire is subject to its own separate agreement, which we provide with any self-drive quote. Where it conflicts with these terms, that agreement applies.",
      ],
      points: [],
    },
    {
      heading: "Enquiries and quotes",
      paragraphs: [],
      points: [
        "Sending an enquiry, through this website or otherwise, does not create a booking and commits neither of us to anything.",
        "Any rate shown on the website is indicative. The price for your journey is the one we confirm to you in writing.",
        "A quote is valid for the period it states, and is subject to the vehicle and a chauffeur being available when you accept it.",
      ],
    },
    {
      heading: "Making a booking",
      paragraphs: [],
      points: [
        "A booking is confirmed only when we confirm it to you in writing and, where we have asked for one, we have received your deposit.",
        "We ask for at least 48 hours' notice wherever possible. Chauffeur bookings are subject to a four-hour minimum unless we agree otherwise.",
        "Deposits are required from new clients. The amount is stated in your quote.",
      ],
    },
    {
      heading: "Charges in addition to the journey",
      paragraphs: [
        "Unless your quote says they are included, the following are charged in addition: bank holiday supplements, the Congestion Charge and ULEZ, airport parking and drop-off fees, additional stops, and waiting time beyond any included in your quote.",
      ],
      points: [],
    },
    {
      heading: "Changes and cancellations",
      paragraphs: [
        "The cancellation terms that apply to your booking — including any charge for cancelling close to the journey — are stated in your quote and booking confirmation. Please read them before you accept.",
        "If you need to change a booking, tell us as early as you can. We will do our best to accommodate a change, and will tell you before making it if it affects the price.",
        "If we have to cancel a booking, we will offer a suitable alternative vehicle where one is available, or refund what you have paid for that booking in full.",
      ],
      points: [],
    },
    {
      heading: "On the day",
      paragraphs: [],
      points: [
        "Please be ready at the agreed time and place. Where waiting time is not included, it may be charged.",
        "For airport collections we track your flight, and the waiting time included is stated in your quote.",
        "Your chauffeur may decline to carry anyone whose behaviour puts the journey, the vehicle or other people at risk. Smoking is not permitted in our vehicles.",
        "You are responsible for any damage caused to a vehicle by you or your party, beyond ordinary wear, including cleaning charges where a vehicle has to be taken out of service.",
      ],
    },
    {
      heading: "Our responsibility to you",
      paragraphs: [
        "We will carry out your journey with reasonable care and skill. We are not responsible for delays caused by events outside our reasonable control, such as traffic, road closures, severe weather or accidents involving other vehicles, though we will always do what we reasonably can to get you there.",
        "Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited by law. Your statutory rights as a consumer are not affected.",
      ],
      points: [],
    },
    {
      heading: "Using this website",
      paragraphs: [
        "The photographs, text and design of this website belong to us or are used with permission. Please do not copy them for commercial use without asking.",
        "We try to keep the website accurate, but fleet, rates and availability can change; what we confirm to you in writing is what applies.",
      ],
      points: [],
    },
    {
      heading: "Law and complaints",
      paragraphs: [
        "If something goes wrong, please tell us straight away so we can put it right. These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction, except that if you live elsewhere in the UK you may bring proceedings in your home courts.",
      ],
      points: [],
    },
  ],
};

/** The wording each document starts with, and returns to on reset. */
export const defaultLegalDocuments: Record<LegalDocumentId, LegalDocumentContent> = {
  privacy: privacyNotice,
  terms: termsOfService,
};

/** Limits generous enough for real legal text, tight enough to catch a paste gone wrong. */
export const LEGAL_LIMITS = {
  title: 80,
  summary: 300,
  sections: 40,
  heading: 120,
  paragraph: 3000,
  point: 1000,
  itemsPerSection: 30,
} as const;

/** What a legal page must have before it may be saved. */
export function validateLegalDocument(document: LegalDocumentContent): FieldErrors {
  const v = validator()
    .required("title", document.title, "Add the page title.")
    .maxLength("title", document.title, LEGAL_LIMITS.title)
    .required("summary", document.summary, "Add a one-line summary — it is shown under the title and in search results.")
    .maxLength("summary", document.summary, LEGAL_LIMITS.summary)
    .required("sections", document.sections, "Add at least one section.")
    .custom("sections", document.sections.length > LEGAL_LIMITS.sections, `Keep to ${LEGAL_LIMITS.sections} sections or fewer.`);

  document.sections.forEach((section, i) => {
    const at = `sections.${i}`;
    v.required(`${at}.heading`, section.heading, "Add a heading for this section.")
      .maxLength(`${at}.heading`, section.heading, LEGAL_LIMITS.heading)
      .custom(
        `${at}.paragraphs`,
        !section.paragraphs.some((text) => text.trim()) && !section.points.some((text) => text.trim()),
        "Add some text or at least one bullet point.",
      )
      .custom(
        `${at}.paragraphs`,
        section.paragraphs.length > LEGAL_LIMITS.itemsPerSection || section.points.length > LEGAL_LIMITS.itemsPerSection,
        `Keep each section to ${LEGAL_LIMITS.itemsPerSection} paragraphs and ${LEGAL_LIMITS.itemsPerSection} points or fewer.`,
      );
    section.paragraphs.forEach((text, j) => v.maxLength(`${at}.paragraphs.${j}`, text, LEGAL_LIMITS.paragraph));
    section.points.forEach((text, j) => v.maxLength(`${at}.points.${j}`, text, LEGAL_LIMITS.point));
  });

  return v.result();
}

/** Drops blank paragraphs and points and trims every string, before saving. */
export function tidyLegalDocument(document: LegalDocumentContent): LegalDocumentContent {
  return {
    title: document.title.trim(),
    summary: document.summary.trim(),
    sections: document.sections.map((section) => ({
      heading: section.heading.trim(),
      paragraphs: section.paragraphs.map((text) => text.trim()).filter(Boolean),
      points: section.points.map((text) => text.trim()).filter(Boolean),
    })),
  };
}
