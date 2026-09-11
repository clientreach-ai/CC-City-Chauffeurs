import type { VehicleId } from "./fleet";
import type { MediaKey } from "./media";

/**
 * Chauffeur services.
 *
 * Copy is drawn from the client's existing site and the client intake. Nothing
 * here claims 24/7 availability, certifications, statistics or guarantees the
 * business has not stated. Where a page needs proof the client cannot yet
 * supply, the structure is left for it rather than invented.
 */

export type ServiceSlug =
  | "private-chauffeur"
  | "airport-transfers"
  | "corporate"
  | "weddings"
  | "events"
  | "city-to-city"
  | "roadshows"
  | "tours"
  | "school-family";

export type Service = {
  slug: ServiceSlug;
  index: string;
  /** Short label for navigation and indexes. */
  label: string;
  /** Page title, set as display type. Lines break exactly as written. */
  display: readonly string[];
  /** One-line summary used on the overview page and in the footer. */
  summary: string;
  /** Opening paragraph on the service page. */
  standfirst: string;
  hero: MediaKey;
  heroAlt: string;
  /** Hairline facts under the hero. */
  facts: readonly { label: string; value: string }[];
  /** What the service actually involves. */
  included: readonly { title: string; copy: string }[];
  /** Second editorial movement — a longer read with a photograph. */
  detail: {
    heading: string;
    paragraphs: readonly string[];
    image: MediaKey;
    imageAlt: string;
  };
  /** Vehicles typically used, by id. */
  vehicles: readonly VehicleId[];
  /** What we need to quote this service, and one practical note. */
  booking: { needs: readonly string[]; note: string };
  /** Closing line above the enquiry band. */
  closing: string;
  seo: { title: string; description: string };
  /** Composition template — keeps neighbouring pages from reading the same. */
  template: "index" | "columns" | "stack";
};

export const services: readonly Service[] = [
  {
    slug: "private-chauffeur",
    index: "01",
    label: "Private Chauffeur",
    display: ["A chauffeur", "at your", "disposal"],
    summary:
      "As directed, by the hour or by the day — a chauffeur and vehicle held for you alone.",
    standfirst:
      "Private chauffeur hire is the service the rest of the company is built around. A chauffeur and vehicle are assigned to you for the period you book, and the day runs to your schedule rather than ours — a single collection, a full day of appointments, or a week in London.",
    hero: "cullinanHotelSide",
    heroAlt: "Rolls-Royce Cullinan waiting at a London hotel entrance",
    facts: [
      { label: "Booked", value: "By the hour or by the day" },
      { label: "Coverage", value: "London, UK and Europe" },
      { label: "Vehicles", value: "Chauffeur fleet" },
    ],
    included: [
      {
        title: "As directed",
        copy: "The vehicle stays with you between stops. No re-booking, no waiting for a car to come back, no explaining the plan twice.",
      },
      {
        title: "One chauffeur",
        copy: "Where the booking runs across several days, we keep the same chauffeur on it wherever we can — so the second morning is easier than the first.",
      },
      {
        title: "Routes planned in advance",
        copy: "Chauffeurs know London and the wider UK. Timings are set against the schedule you give us, not against optimistic traffic.",
      },
      {
        title: "Discretion as standard",
        copy: "Names, destinations and schedules stay between us. Nothing is discussed and nothing is published.",
      },
    ],
    detail: {
      heading: "The rear seat is the product",
      paragraphs: [
        "Vehicles are selected for the quality of the seat you sit in rather than the badge on the bonnet. Rear cabins are quiet, the ride is settled, and the car is presented immaculately for every journey.",
        "If you want to work, you can. If you want to arrive without having thought about parking, congestion charging, or where the entrance is, that is the point of the service.",
      ],
      image: "cullinanRearCabin" as MediaKey,
      imageAlt: "The rear cabin of a Rolls-Royce Cullinan",
    },
    vehicles: ["cullinan", "ghost", "s-class", "range-rover"],
    booking: {
      needs: [
        "The date and a start time",
        "Where the day begins, and roughly where it goes",
        "How many hours, or a full day",
        "How many are travelling",
      ],
      note: "Hourly bookings have a four-hour minimum. Day rates start from £500.",
    },
    closing: "Tell us the shape of the day and we will put a chauffeur against it.",
    seo: {
      title: "Private Chauffeur Hire London | CC City Chauffeurs",
      description:
        "Private chauffeur hire in London — as directed, by the hour or by the day. Professional, comfortable and discreet travel across the UK and Europe.",
    },
    template: "index",
  },
  {
    slug: "airport-transfers",
    index: "02",
    label: "Airport Transfers",
    display: ["Met at", "arrivals"],
    summary:
      "Meet & greet, flight tracking, luggage assistance and 60 minutes complimentary waiting after landing.",
    standfirst:
      "Airport work is where a chauffeur service is judged. Flights are tracked, so a delay changes our arrangements and not yours, and your chauffeur is inside the terminal before you clear customs.",
    hero: "cullinanO2Front",
    heroAlt: "Rolls-Royce Cullinan at night in London",
    facts: [
      { label: "Waiting", value: "60 minutes complimentary after landing" },
      { label: "Included", value: "Meet & greet · Flight tracking" },
      { label: "Airports", value: "Gatwick and all London airports" },
    ],
    included: [
      {
        title: "Meet & greet",
        copy: "Your chauffeur waits inside the terminal at arrivals and helps with luggage to the car. You are not looking for a registration plate in a car park.",
      },
      {
        title: "Flight tracking",
        copy: "We track the flight number you give us. If you land early or late, the collection moves with it.",
      },
      {
        title: "60 minutes complimentary waiting",
        copy: "One hour of waiting time after landing is included, which covers immigration and baggage on all but the worst mornings.",
      },
      {
        title: "Luggage assistance",
        copy: "Tell us the luggage and party size and we will send a vehicle that takes it — including the V-Class where a saloon will not do.",
      },
      {
        title: "Private terminals",
        copy: "Collections and drop-offs at private aviation terminals are arranged on request.",
      },
    ],
    detail: {
      heading: "Departures, handled the same way",
      paragraphs: [
        "Outbound, we work backwards from the time you want to be airside — not from the time the journey planner says the road takes. The vehicle arrives early, the luggage goes in, and the car leaves when you do.",
        "For regular travellers, the arrangement is agreed once and repeated — the details do not have to be sent every time.",
      ],
      image: "cullinanWorkshopRear" as MediaKey,
      imageAlt: "Rolls-Royce Cullinan from the rear, photographed in the workshop",
    },
    vehicles: ["s-class", "range-rover", "cullinan", "v-class"],
    booking: {
      needs: [
        "Flight number and arrival or departure time",
        "The airport and terminal",
        "The collection or drop-off address",
        "Passengers, and how many large cases",
      ],
      note: "Waiting is complimentary for 60 minutes after landing. Airport parking and drop-off fees are added to the quote.",
    },
    closing: "Send the flight number and we will do the rest.",
    seo: {
      title: "Airport Transfers London | Meet & Greet | CC City Chauffeurs",
      description:
        "Chauffeur airport transfers for Gatwick and all London airports — meet & greet, flight tracking, luggage help and 60 minutes' free waiting after landing.",
    },
    template: "columns",
  },
  {
    slug: "corporate",
    index: "03",
    label: "Corporate",
    display: ["For people", "whose time", "is the asset"],
    summary:
      "Executive travel, client transportation and meeting schedules held to the minute, with arrangements for regular travel.",
    standfirst:
      "Executives, fund managers, visiting clients and the people who have to get them there. Corporate work is planned around the schedule rather than the journey — the car is already waiting when the meeting overruns.",
    hero: "cullinanCanaryWharf",
    heroAlt: "Rolls-Royce Cullinan against the Canary Wharf skyline at night",
    facts: [
      { label: "Regular travel", value: "Arranged around your schedule" },
      { label: "Districts", value: "Canary Wharf · Mayfair · The City" },
      { label: "Coverage", value: "London, UK and Europe" },
    ],
    included: [
      {
        title: "Executive travel",
        copy: "Directors and senior staff moved between offices, meetings and airports on a schedule that is agreed before the day starts.",
      },
      {
        title: "Client transportation",
        copy: "Visiting clients collected properly. The vehicle, the chauffeur and the timing all reflect on you rather than on us.",
      },
      {
        title: "Meetings and site visits",
        copy: "The car waits between appointments so nobody is standing on a pavement rearranging the afternoon.",
      },
      {
        title: "Corporate events",
        copy: "Arrivals and departures coordinated across multiple vehicles, with one point of contact for the whole movement.",
      },
      {
        title: "Regular requirements",
        copy: "Talk to us about how your travel is organised — who books, how often, where — and we will set up an arrangement around it.",
      },
    ],
    detail: {
      heading: "Canary Wharf to Mayfair, and everything between",
      paragraphs: [
        "Most corporate work is London work: the City, Canary Wharf, Mayfair, Knightsbridge and the airports either side of them. Chauffeurs know the entrances, the restricted streets and where a car can actually stop.",
        "Beyond London, the same vehicles run city to city across the United Kingdom and into Europe — often a better use of a working day than a short flight.",
      ],
      image: "cullinanRearCabin" as MediaKey,
      imageAlt: "The rear cabin of a Rolls-Royce Cullinan",
    },
    vehicles: ["s-class", "cullinan", "flying-spur", "v-class-jet"],
    booking: {
      needs: [
        "Who is travelling, and who is booking",
        "The dates — a single day or a regular pattern",
        "Addresses and the meeting schedule",
        "Any vehicle preference",
      ],
      note: "Regular travel is arranged around your pattern of bookings rather than priced journey by journey.",
    },
    closing: "Tell us the pattern of travel and we will put together the arrangement.",
    seo: {
      title: "Corporate Chauffeur Service London | CC City Chauffeurs",
      description:
        "Corporate chauffeur service in London — executive travel, client transportation, roadshows and regular business travel across Canary Wharf, Mayfair and the UK.",
    },
    template: "columns",
  },
  {
    slug: "weddings",
    index: "04",
    label: "Weddings",
    display: ["A day that", "runs to", "the minute"],
    summary:
      "The principal car, vehicles for the wider party, and every timing agreed long before the morning itself.",
    standfirst:
      "Weddings and private occasions make up the majority of our work. The car is the visible part; the planning is what makes the day feel effortless.",
    hero: "weddings",
    heroAlt: "Rolls-Royce Cullinan waiting on a lit hotel forecourt",
    facts: [
      { label: "Principal car", value: "Chosen from the chauffeur fleet" },
      { label: "The wider party", value: "Additional vehicles alongside" },
      { label: "Agreed in advance", value: "Timings, routes, presentation" },
    ],
    included: [
      {
        title: "The principal car",
        copy: "Usually the Cullinan, the Ghost or the Flying Spur. Presented immaculately, and photographed all day whether anyone plans for it or not.",
      },
      {
        title: "Vehicles for the party",
        copy: "Additional cars for parents, bridal party and guests, run alongside the principal car on the same schedule.",
      },
      {
        title: "Timings and routes",
        copy: "Routes are planned in advance for the day itself, and timings are agreed with you rather than assumed.",
      },
      {
        title: "Presentation",
        copy: "Ribbons and vehicle presentation are agreed beforehand so nothing is decided on the morning.",
      },
      {
        title: "One point of contact",
        copy: "Whoever is coordinating the day speaks to one person about the cars, not to each driver in turn.",
      },
    ],
    detail: {
      heading: "The quiet part of a loud day",
      paragraphs: [
        "A wedding is the one booking where being ten minutes late is not recoverable. So wedding work is planned harder than anything else we do: the order of movements, where each car waits, who travels in which vehicle, and what happens if the ceremony overruns.",
        "The chauffeurs who do this work are used to it. They know when to open a door and when to stay out of a photograph.",
      ],
      image: "cullinanHotelSide" as MediaKey,
      imageAlt: "Rolls-Royce Cullinan in profile at a hotel entrance",
    },
    vehicles: ["cullinan", "ghost", "flying-spur", "v-class"],
    booking: {
      needs: [
        "The date",
        "Ceremony and reception venues",
        "How many cars, and who travels in each",
        "The timings for the day",
      ],
      note: "Wedding pricing is bespoke to the day — send the venues and timings and we will come back with a figure.",
    },
    closing: "Send us the date and the venues and we will build the day around them.",
    seo: {
      title: "Wedding Car Hire London | Chauffeur-Driven | CC City Chauffeurs",
      description:
        "Chauffeur-driven wedding cars in London — Rolls-Royce Cullinan and Ghost, Bentley Flying Spur and cars for the wider party, every timing agreed in advance.",
    },
    template: "stack",
  },
  {
    slug: "events",
    index: "05",
    label: "Events",
    display: ["Arrivals", "and", "departures"],
    summary:
      "Private and corporate events, occasions and VIP transportation — one vehicle or several, held on site.",
    standfirst:
      "Dinners, parties, premieres, corporate hospitality and private engagements. Vehicles are held on site for the evening, so guests leave when they want to rather than when a car becomes available.",
    hero: "cullinanPeninsulaNight",
    heroAlt: "Rolls-Royce Cullinan outside The Peninsula in London",
    facts: [
      { label: "Held on site", value: "For the evening" },
      { label: "Scale", value: "One vehicle or several" },
      { label: "Coverage", value: "London and UK-wide" },
    ],
    included: [
      {
        title: "Held for the evening",
        copy: "The vehicle waits nearby for the duration rather than being released and re-booked.",
      },
      {
        title: "Multiple vehicles",
        copy: "Where several cars are needed, arrivals and departures are sequenced so the front of the venue never becomes a queue.",
      },
      {
        title: "Discreet by default",
        copy: "For higher-profile guests, arrangements are kept quiet and nothing is discussed outside the booking.",
      },
      {
        title: "Late finishes",
        copy: "Evening work runs as late as the event does — agreed when the booking is made.",
      },
    ],
    detail: {
      heading: "The front of the venue is part of the event",
      paragraphs: [
        "Arrivals set the tone. A car that stops in the right place, at the right moment, with a chauffeur who steps out and opens the door properly, is doing more work than it appears to be.",
        "Departures matter more. Guests remember the twenty minutes they spent waiting for a car far longer than they remember the room.",
      ],
      image: "heroCullinanEntrance" as MediaKey,
      imageAlt: "Rolls-Royce Cullinan waiting at a London hotel entrance at night",
    },
    vehicles: ["cullinan", "g-wagon", "v-class", "ghost"],
    booking: {
      needs: [
        "The date and the venue",
        "Arrival and finish times",
        "How many guests, and how many vehicles",
        "Whether cars should be held on site",
      ],
      note: "Late finishes are agreed when the booking is made, not on the night.",
    },
    closing: "Give us the venue and the running order and we will cover the movements.",
    seo: {
      title: "Event Chauffeur Service London | CC City Chauffeurs",
      description:
        "Chauffeur-driven transport for private and corporate events in London — VIP arrivals, vehicles held on site, and coordinated departures.",
    },
    template: "index",
  },
  {
    slug: "city-to-city",
    index: "06",
    label: "City to City",
    display: ["The long", "way is the", "civilised way"],
    summary:
      "Long-distance travel across the United Kingdom and into Europe — a considered alternative to a short flight.",
    standfirst:
      "London to Manchester, Birmingham, Edinburgh or Paris. Door to door, with your luggage in the boot and no terminal at either end.",
    hero: "cullinanCanaryWharf",
    heroAlt: "Rolls-Royce Cullinan at Canary Wharf",
    facts: [
      { label: "Coverage", value: "United Kingdom and Europe" },
      { label: "Booked", value: "One way or return" },
      { label: "Vehicles", value: "Long-distance saloons and SUVs" },
    ],
    included: [
      {
        title: "Door to door",
        copy: "Collected where you are, delivered where you are going. No airport, no transfer at the far end.",
      },
      {
        title: "Work or rest",
        copy: "A quiet rear cabin for several hours is a usable working morning, or a proper opportunity not to work.",
      },
      {
        title: "Planned stops",
        copy: "Breaks are built into longer routes rather than improvised at a service station.",
      },
      {
        title: "Into Europe",
        copy: "Continental journeys are arranged on request, with routes and crossings agreed before the booking is confirmed.",
      },
    ],
    detail: {
      heading: "Counted properly, it is often faster",
      paragraphs: [
        "A short flight is rarely a short journey. Counted door to door — the run to the airport, the wait, the flight, the transfer at the other end — a car is frequently level on time and considerably better on everything else.",
        "It is also the only version where your luggage never leaves the vehicle and the meeting can happen on the way.",
      ],
      image: "cullinanWorkshopSide" as MediaKey,
      imageAlt: "Rolls-Royce Cullinan in profile",
    },
    vehicles: ["flying-spur", "s-class", "cullinan", "v-class-jet"],
    booking: {
      needs: [
        "Both addresses",
        "The date and departure time",
        "One way or return",
        "Passengers and luggage",
      ],
      note: "Continental journeys are arranged on request, with the route and crossing agreed before the booking is confirmed.",
    },
    closing: "Tell us the two cities and the date.",
    seo: {
      title: "City to City Chauffeur | UK & Europe | CC City Chauffeurs",
      description:
        "Long-distance chauffeur travel from London across the United Kingdom and into Europe. Door to door, one way or return, in the chauffeur fleet.",
    },
    template: "stack",
  },
  {
    slug: "roadshows",
    index: "07",
    label: "Roadshows",
    display: ["Multi-day.", "Multi-city.", "One chauffeur"],
    summary:
      "Corporate roadshows and multi-day itineraries with a dedicated chauffeur and vehicle for the duration.",
    standfirst:
      "Investor roadshows, client tours and multi-city executive itineraries. One chauffeur and one vehicle stay with the party for the whole programme, so the schedule is held by someone who already knows it.",
    hero: "fleetCullinan",
    heroAlt: "Rolls-Royce Cullinan in black, photographed in the workshop",
    facts: [
      { label: "Duration", value: "Multi-day programmes" },
      { label: "Chauffeur", value: "Dedicated for the itinerary" },
      { label: "Coverage", value: "UK-wide and European" },
    ],
    included: [
      {
        title: "A dedicated chauffeur",
        copy: "The same chauffeur for the full programme. By the second day they know the party, the luggage and the pace.",
      },
      {
        title: "The itinerary held",
        copy: "We work from your schedule directly — meeting addresses, times and the gaps between them — rather than being told each leg as it comes.",
      },
      {
        title: "Multiple cities",
        copy: "The vehicle moves with the party between cities. Nobody is re-briefing a new driver in a different postcode.",
      },
      {
        title: "Vehicles that can work",
        copy: "The JetClass V-Class carries a party of four with lounge seating — useful when the journey between meetings is the only time to talk.",
      },
      {
        title: "One point of contact",
        copy: "Whoever coordinates the programme deals with one person for the whole movement.",
      },
    ],
    detail: {
      heading: "Built for the executive assistant",
      paragraphs: [
        "Roadshow bookings are usually made by the person who will be blamed if it goes wrong. So the service is designed around them: one contact, one confirmed itinerary, and a chauffeur who does not need to be told the plan twice.",
        "Changes happen — meetings move, legs are added. Send the change and it is absorbed into the programme.",
      ],
      image: "cullinanFrontCabin" as MediaKey,
      imageAlt: "The front cabin of a Rolls-Royce Cullinan",
    },
    vehicles: ["v-class-jet", "s-class", "flying-spur", "cullinan"],
    booking: {
      needs: [
        "The draft itinerary — cities, dates and meeting addresses",
        "How many are in the party, and the luggage",
        "Any vehicle preference",
        "Who is coordinating the programme",
      ],
      note: "Send the itinerary as it stands; changes can follow as the programme settles.",
    },
    closing: "Send the draft itinerary and we will price the programme.",
    seo: {
      title: "Corporate Roadshow Chauffeur | CC City Chauffeurs",
      description:
        "Corporate roadshow chauffeur service — multi-day, multi-city itineraries with a dedicated chauffeur and vehicle across the UK and Europe.",
    },
    template: "columns",
  },
  {
    slug: "tours",
    index: "08",
    label: "Tours",
    display: ["London,", "at your", "own pace"],
    summary:
      "Private sightseeing and bespoke itineraries in London and beyond, with a chauffeur who knows where to stop.",
    standfirst:
      "A private car and chauffeur for the day rather than a coach and a headset. You decide how long to spend anywhere, and the car is waiting when you come back out.",
    hero: "cullinanO2Front",
    heroAlt: "Rolls-Royce Cullinan photographed in London",
    facts: [
      { label: "Booked", value: "Half day or full day" },
      { label: "Itinerary", value: "Yours, or built with you" },
      { label: "Coverage", value: "London and beyond" },
    ],
    included: [
      {
        title: "At your pace",
        copy: "Stop where you want, for as long as you want. Nothing is on a timetable except the things you have booked.",
      },
      {
        title: "A chauffeur who knows London",
        copy: "Where to stop, where not to bother, and which entrance is the one worth using.",
      },
      {
        title: "Beyond the city",
        copy: "Windsor, Oxford, Bath, the Cotswolds — day trips out of London are arranged the same way.",
      },
      {
        title: "Luggage and shopping",
        copy: "Everything stays in the car between stops, which is the practical reason most people book this rather than taxis.",
      },
    ],
    detail: {
      heading: "Sightseeing without the coach",
      paragraphs: [
        "Most of the value is in what you do not do: no queueing to board, no waiting for the group, no route decided by somebody else's schedule.",
        "Tell us what you want to see, or tell us how long you have and let us suggest something.",
      ],
      image: "cullinanO2Front" as MediaKey,
      imageAlt: "Rolls-Royce Cullinan photographed in London",
    },
    vehicles: ["cullinan", "range-rover", "v-class", "ghost"],
    booking: {
      needs: [
        "The date, and a half or full day",
        "Where to start from",
        "What you would like to see — or ask us to suggest",
        "How many are travelling",
      ],
      note: "Hourly bookings have a four-hour minimum. Day rates start from £500.",
    },
    closing: "Tell us the day and roughly what you would like to see.",
    seo: {
      title: "Private London Tours by Chauffeur | CC City Chauffeurs",
      description:
        "Private chauffeur-driven sightseeing tours of London and beyond — half day or full day, with a bespoke itinerary and a chauffeur who knows the city.",
    },
    template: "index",
  },
  {
    slug: "school-family",
    index: "09",
    label: "School & Family",
    display: ["The same", "familiar", "face"],
    summary:
      "Regular school runs and family travel with consistent arrangements and a familiar chauffeur.",
    standfirst:
      "Regular arrangements for school runs and family travel, with — as far as we can manage it — the same chauffeur each time.",
    hero: "cullinanForecourt",
    heroAlt: "Rolls-Royce Cullinan waiting on a lit forecourt",
    facts: [
      { label: "Booked", value: "Regular or one-off" },
      { label: "Chauffeurs", value: "Consistent, where we can" },
      { label: "Booster seats", value: "Isofix, on request" },
    ],
    included: [
      {
        title: "A consistent chauffeur",
        copy: "For regular bookings we keep the same chauffeur on the run wherever the schedule allows, so it becomes routine for everyone.",
      },
      {
        title: "A familiar face",
        copy: "We keep the same chauffeur on a regular arrangement wherever scheduling allows, presented to the same standard as on any other booking.",
      },
      {
        title: "Booster seats",
        copy: "Isofix booster seats are available on request — tell us the children's ages when you book so the right number are fitted.",
      },
      {
        title: "Standing arrangements",
        copy: "Term-time schedules can be set up as a standing booking rather than arranged week by week.",
      },
    ],
    detail: {
      heading: "Reliability is the whole service",
      paragraphs: [
        "There is nothing glamorous about a school run, and that is rather the point. It has to happen at the same time, in the same way, with someone you have already met.",
        "For families who also use us for airports and evenings out, the school run simply becomes part of the same arrangement.",
      ],
      image: "gWagonSide" as MediaKey,
      imageAlt: "Mercedes-AMG G-Wagon in profile",
    },
    vehicles: ["range-rover", "v-class", "s-class", "g-wagon"],
    booking: {
      needs: [
        "The schedule — days, times and term dates",
        "Home and school addresses",
        "Children's ages, if booster seats are needed",
        "Regular arrangement or one-off",
      ],
      note: "Isofix booster seats are available on request — the one type of child seat currently offered.",
    },
    closing: "Tell us the schedule and we will set it up.",
    seo: {
      title: "School Run & Family Chauffeur London | CC City Chauffeurs",
      description:
        "Regular school runs and family chauffeur travel in London with a consistent chauffeur, standing arrangements and Isofix booster seats on request.",
    },
    template: "stack",
  },
];

export function getService(slug: string) {
  return services.find((service) => service.slug === slug);
}

export const serviceSlugs = services.map((service) => service.slug);
