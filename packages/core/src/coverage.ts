/**
 * Where we go, and how a place a customer names is judged against it.
 *
 * The client publishes two things about coverage: six London districts, and
 * the sentence "London based. UK & Europe." Neither can settle whether
 * "Saffron Walden" is somewhere we drive and "El Salvador" is not, so this
 * module does it, and it is deliberate about the one answer it is allowed to
 * give when it cannot tell: ask.
 *
 * Three outcomes, never a guess:
 *
 *   supported — a place we cover, or a country we cover
 *   outside   — a country we do not cover, named outright
 *   unclear   — anything else, which is a question for the customer
 *
 * `unclear` is the common case for a small British town, and that is the
 * right trade. A clarifying question costs a message; refusing a real
 * customer in Milton Keynes costs the job. Nothing here ever decides that a
 * place is outside because it failed to recognise it.
 *
 * The two kinds of match are deliberately unequal. Somewhere we cover may be
 * found anywhere in what the customer wrote, because a false positive there
 * costs nothing. Somewhere we do not cover has to be named on its own — a
 * whole part of the address, not a word inside one — because London is full
 * of Canada Squares, Jamaica Roads, India Docks and Half Moon pubs, and a
 * refusal that fires on those turns away the client's own neighbours.
 *
 * The lists below are defaults for the settings the admin edits, not the
 * rule itself. The client can add a town, a county or a country without
 * anybody touching this file.
 */

/** Letters and digits only, lower case: "Canary Wharf" and "canary-wharf" are one place. */
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * What the business covers, as the settings hold it.
 *
 * Read from `SiteSettings.business`, so the site, the admin and the
 * assistant cannot disagree about where we go.
 */
export type Coverage = {
  /** The districts the website prints. */
  serviceAreas: readonly string[];
  /** Towns, cities, counties and airports we cover, beyond the districts. */
  servedPlaces: readonly string[];
  /** Countries we cover. */
  servedCountries: readonly string[];
};

export type LocationVerdict =
  | { outcome: "supported"; matched: string }
  /** `named` is the country that put it out of range, for the reason given to the customer. */
  | { outcome: "outside"; named: string }
  | { outcome: "unclear" };

/**
 * The United Kingdom, its nations, and Europe.
 *
 * The client's own sentence is "UK & Europe", so Europe is in scope and a
 * journey to Monaco or Geneva is ordinary work, not something to refuse. The
 * nations are here as well as the state because a customer writes "Scotland",
 * not "United Kingdom".
 */
export const DEFAULT_SERVED_COUNTRIES = [
  "United Kingdom", "UK", "Great Britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland",
  "Ireland", "Republic of Ireland", "France", "Monaco", "Belgium", "Netherlands", "Holland", "Luxembourg",
  "Germany", "Switzerland", "Austria", "Liechtenstein", "Italy", "San Marino", "Vatican City", "Spain",
  "Portugal", "Andorra", "Gibraltar", "Malta", "Denmark", "Sweden", "Norway", "Finland", "Iceland",
  "Estonia", "Latvia", "Lithuania", "Poland", "Czech Republic", "Czechia", "Slovakia", "Hungary",
  "Slovenia", "Croatia", "Bosnia and Herzegovina", "Serbia", "Montenegro", "North Macedonia", "Albania",
  "Greece", "Bulgaria", "Romania", "Moldova",
] as const;

/**
 * Where we drive, beyond the six districts the website names.
 *
 * Generous on purpose. Every name here is a place a customer can state and
 * be answered without a further question, so the list is worth more than it
 * costs: the alternative is asking a customer in Birmingham which country
 * Birmingham is in.
 */
export const DEFAULT_SERVED_PLACES = [
  // London, and the ways people say it
  "London", "Greater London", "Central London", "City of London", "Westminster", "Soho",
  "Belgravia", "Marylebone", "Notting Hill", "Hampstead", "Islington", "Shoreditch", "Richmond",
  "Wimbledon", "Greenwich", "Camden", "Battersea", "Croydon", "Barnet", "Harrow", "Ealing",
  // The airports, by name and by code
  "Heathrow", "LHR", "Gatwick", "LGW", "Stansted", "STN", "Luton", "LTN", "London City Airport", "LCY",
  "Farnborough", "Biggin Hill", "Southend Airport", "Manchester Airport", "Birmingham Airport",
  "Edinburgh Airport", "Bristol Airport",
  // The home counties and the south east
  "Essex", "Kent", "Surrey", "Sussex", "East Sussex", "West Sussex", "Hertfordshire", "Buckinghamshire",
  "Berkshire", "Oxfordshire", "Hampshire", "Bedfordshire", "Cambridgeshire", "Suffolk", "Norfolk",
  "Brighton", "Windsor", "Ascot", "Reading", "Guildford", "Watford", "St Albans", "Milton Keynes",
  "Southampton", "Portsmouth", "Canterbury", "Dover", "Folkestone", "Chelmsford", "Colchester",
  // The rest of the country
  "Manchester", "Birmingham", "Liverpool", "Leeds", "Sheffield", "Bristol", "Bath", "Oxford",
  "Cambridge", "Nottingham", "Leicester", "Coventry", "Newcastle", "Newcastle upon Tyne", "Sunderland",
  "York", "Hull", "Derby", "Stoke on Trent", "Wolverhampton", "Plymouth", "Exeter", "Bournemouth",
  "Swindon", "Gloucester", "Cheltenham", "Worcester", "Shrewsbury", "Chester", "Preston", "Blackpool",
  "Bolton", "Wigan", "Warrington", "Lancaster", "Carlisle", "Durham", "Middlesbrough", "Harrogate",
  "Cardiff", "Swansea", "Newport", "Wrexham", "Edinburgh", "Glasgow", "Aberdeen", "Dundee", "Inverness",
  "Stirling", "Belfast", "Londonderry",
] as const;

/**
 * Not places on this earth.
 *
 * Short, and not an attempt to be exhaustive. A customer who writes "Mars"
 * is making a joke or testing the assistant, and either way the honest answer
 * is that we do not go there, rather than a question about which Mars.
 */
const NOT_ON_EARTH = [
  "Mars", "the Moon", "Moon", "Venus", "Jupiter", "Saturn", "Mercury", "Neptune", "Uranus", "Pluto",
  "outer space", "space", "the Sun", "Narnia", "Atlantis", "Mordor", "Wakanda", "Westeros", "Hogwarts",
] as const;

/**
 * Every country, so that one we do not cover can be recognised as a country
 * at all.
 *
 * This is the smallest data that separates "El Salvador" from "Saffron
 * Walden": without it, both are simply unrecognised, and a customer asking
 * for a journey to El Salvador would be asked to clarify rather than told we
 * do not go. It is a list of country names and nothing more — no
 * coordinates, no populations, no geography to maintain.
 *
 * Common short forms and former names are included where a customer would
 * really write them.
 */
const WORLD_COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
  "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo",
  "Democratic Republic of the Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Swaziland", "Ethiopia", "Fiji",
  "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada",
  "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan",
  "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Burma", "Namibia",
  "Nauru", "Nepal", "Netherlands", "Holland", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Korea", "North Macedonia", "Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine",
  "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Russian Federation", "Rwanda", "Saint Lucia", "Samoa", "San Marino",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "Korea", "South Sudan",
  "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "UAE", "United Kingdom",
  "United States", "United States of America", "USA", "America", "Uruguay", "Uzbekistan", "Vanuatu",
  "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
] as const;

/**
 * The defaults for a settings record that has never been edited, and for the
 * seed.
 */
export const DEFAULT_COVERAGE_LISTS = {
  servedPlaces: DEFAULT_SERVED_PLACES,
  servedCountries: DEFAULT_SERVED_COUNTRIES,
} as const;

/**
 * Whether one name appears in what the customer wrote.
 *
 * The customer's text contains the name, not the other way round: "Heathrow
 * Terminal 5" contains "Heathrow", while a bare "airport" must not match
 * "Manchester Airport" and be read as Manchester. Each side is squashed
 * first, and a match has to fall on a boundary the squashing did not invent —
 * so "Bath" does not match inside "Bathgate".
 */
function names(said: string, candidate: string): boolean {
  const haystack = squash(said);
  const needle = squash(candidate);
  if (!needle || !haystack) return false;
  if (haystack === needle) return true;

  // Where the squashed name appears, it has to sit against a word boundary in
  // the original text rather than inside a longer word.
  const pattern = candidate
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .join("[^a-zA-Z0-9]*");
  if (!pattern) return false;
  return new RegExp(`(?:^|[^a-zA-Z0-9])${pattern}(?:[^a-zA-Z0-9]|$)`, "i").test(said);
}

const firstNamed = (said: string, candidates: readonly string[]) =>
  candidates.find((candidate) => names(said, candidate));

/**
 * The parts of an address, as a customer separates them.
 *
 * Commas and line breaks, and the two words that join a place to where it
 * is: "Hotel in Nicosia, Cyprus" is three parts, the last of which is a
 * country. Each part is squashed so "El Salvador" and "el-salvador" compare.
 */
const segments = (said: string) =>
  said
    .split(/[,;\n]|\s+in\s+|\s+to\s+/i)
    .map(squash)
    .filter(Boolean);

/**
 * Whether one of the names *is* a part of what the customer wrote, rather
 * than appearing inside one.
 *
 * This is the stricter match, kept for the names that refuse. "Manchester,
 * Jamaica" names Jamaica on its own and is refused; "Jamaica Road,
 * Bermondsey" does not, and is left for the looser checks below to place —
 * or to ask about. A country nobody wrote as a whole part of the address is
 * a question, never a closed door.
 */
const namedAsSegment = (said: string, candidates: readonly string[]) => {
  const parts = segments(said);
  return candidates.find((candidate) => parts.includes(squash(candidate)));
};

/**
 * What a place a customer named is, as far as the client's own coverage can
 * say.
 *
 * Order matters. A country we do not cover is checked before anywhere we do,
 * because "Manchester, Jamaica" is a real place in Jamaica and the parish
 * name must not win. But it only counts when it is named as a part of the
 * address in its own right — "One Canada Square, Canary Wharf" is in Canary
 * Wharf, not Canada, and falls through to the places we cover. A country we
 * *do* cover is checked next, so "Paris, France" is answered without France
 * needing to be in the places list.
 */
export function classifyLocation(said: string, coverage: Coverage): LocationVerdict {
  const text = said.trim();
  if (!text) return { outcome: "unclear" };

  const offWorld = namedAsSegment(text, NOT_ON_EARTH);
  if (offWorld) return { outcome: "outside", named: offWorld };

  const served = new Set(coverage.servedCountries.map(squash));
  const foreign = WORLD_COUNTRIES.filter((country) => !served.has(squash(country)));
  const outside = namedAsSegment(text, foreign);
  if (outside) return { outcome: "outside", named: outside };

  const country = firstNamed(text, coverage.servedCountries);
  if (country) return { outcome: "supported", matched: country };

  const place = firstNamed(text, [...coverage.serviceAreas, ...coverage.servedPlaces]);
  if (place) return { outcome: "supported", matched: place };

  return { outcome: "unclear" };
}

/**
 * Whether an enquiry may be recorded with this place on it.
 *
 * `unclear` passes. The assistant is told to ask, and the website's own form
 * has always taken a free-text address, so a real customer in a town nobody
 * listed is never turned away by this. Only a place named as somewhere we do
 * not go is refused.
 */
export function locationRefusal(said: string, coverage: Coverage): string | null {
  const verdict = classifyLocation(said, coverage);
  if (verdict.outcome !== "outside") return null;
  return `We do not cover ${verdict.named}. City Chauffeurs drives in London, across the UK and in Europe.`;
}
