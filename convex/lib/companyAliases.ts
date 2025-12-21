/**
 * Company Alias Database for Intelligent Matching
 *
 * This module provides:
 * 1. Company name aliases (e.g., Google = Alphabet = YouTube)
 * 2. Email domain to company name mapping
 * 3. ATS domain identification (domains that shouldn't be matched as companies)
 */

// =============================================================================
// COMPANY ALIASES
// Maps canonical company name (lowercase) to list of known aliases
// =============================================================================

export const COMPANY_ALIASES: Record<string, string[]> = {
  // Big Tech
  google: [
    'alphabet',
    'alphabet inc',
    'google llc',
    'google inc',
    'youtube',
    'waymo',
    'deepmind',
    'verily',
    'x development',
    'calico',
    'nest',
    'waze',
    'fitbit',
  ],
  meta: [
    'facebook',
    'facebook inc',
    'meta platforms',
    'meta platforms inc',
    'instagram',
    'whatsapp',
    'oculus',
    'reality labs',
  ],
  amazon: [
    'amazon inc',
    'amazon.com',
    'aws',
    'amazon web services',
    'twitch',
    'whole foods',
    'ring',
    'audible',
    'imdb',
    'zappos',
    'mgm',
    'one medical',
  ],
  microsoft: [
    'microsoft corporation',
    'msft',
    'linkedin',
    'github',
    'azure',
    'xbox',
    'activision',
    'blizzard',
    'nuance',
    'bethesda',
  ],
  apple: ['apple inc', 'apple computer', 'beats', 'shazam'],

  // Other Major Tech
  netflix: ['netflix inc'],
  nvidia: ['nvidia corporation'],
  salesforce: ['salesforce.com', 'salesforce inc', 'slack', 'tableau', 'mulesoft', 'heroku'],
  oracle: ['oracle corporation', 'netsuite', 'cerner'],
  ibm: ['international business machines', 'red hat', 'watson'],
  intel: ['intel corporation'],
  adobe: ['adobe inc', 'adobe systems', 'figma', 'magento', 'marketo'],
  twitter: ['twitter inc', 'x corp', 'x'],
  uber: ['uber technologies'],
  lyft: ['lyft inc'],
  airbnb: ['airbnb inc'],
  stripe: ['stripe inc'],
  coinbase: ['coinbase inc', 'coinbase global'],
  robinhood: ['robinhood markets'],
  square: ['square inc', 'block', 'block inc', 'cash app'],
  paypal: ['paypal holdings', 'venmo', 'braintree'],
  shopify: ['shopify inc'],
  zoom: ['zoom video', 'zoom video communications'],
  dropbox: ['dropbox inc'],
  atlassian: ['atlassian corporation', 'jira', 'confluence', 'trello', 'bitbucket'],
  spotify: ['spotify technology', 'spotify ab'],
  snap: ['snap inc', 'snapchat'],
  pinterest: ['pinterest inc'],
  doordash: ['doordash inc'],
  instacart: ['maplebear inc'],
  databricks: ['databricks inc'],
  snowflake: ['snowflake inc', 'snowflake computing'],
  palantir: ['palantir technologies'],
  mongodb: ['mongodb inc'],
  datadog: ['datadog inc'],
  cloudflare: ['cloudflare inc'],
  crowdstrike: ['crowdstrike holdings'],
  okta: ['okta inc', 'auth0'],
  twilio: ['twilio inc', 'sendgrid'],
  splunk: ['splunk inc'],
  elastic: ['elastic nv', 'elasticsearch'],
  confluent: ['confluent inc'],
  hashicorp: ['hashicorp inc'],

  // Finance
  jpmorgan: [
    'jp morgan',
    'jpmorgan chase',
    'j.p. morgan',
    'chase',
    'chase bank',
    'jpmorgan chase & co',
  ],
  'goldman sachs': ['goldman', 'gs', 'marcus by goldman sachs'],
  'morgan stanley': ['morgan stanley & co'],
  'bank of america': ['bofa', 'boa', 'merrill lynch', 'merrill'],
  'wells fargo': ['wells fargo & company', 'wells fargo bank'],
  citi: ['citigroup', 'citibank', 'citi bank'],
  barclays: ['barclays plc', 'barclays bank'],
  'credit suisse': ['cs'],
  'deutsche bank': ['db'],
  ubs: ['ubs group', 'ubs ag'],
  hsbc: ['hsbc holdings', 'hsbc bank'],
  blackrock: ['blackrock inc'],
  vanguard: ['vanguard group'],
  fidelity: ['fidelity investments', 'fidelity management'],
  'charles schwab': ['schwab'],
  visa: ['visa inc'],
  mastercard: ['mastercard inc'],
  'american express': ['amex'],
  'capital one': ['capital one financial'],

  // Consulting
  mckinsey: ['mckinsey & company', 'mckinsey and company'],
  bcg: ['boston consulting group', 'boston consulting'],
  bain: ['bain & company', 'bain and company'],
  deloitte: ['deloitte touche tohmatsu', 'deloitte consulting', 'deloitte llp'],
  pwc: ['pricewaterhousecoopers', 'price waterhouse coopers'],
  ey: ['ernst & young', 'ernst and young'],
  kpmg: ['kpmg llp'],
  accenture: ['accenture plc'],
  booz: ['booz allen', 'booz allen hamilton'],

  // Automotive
  tesla: ['tesla inc', 'tesla motors'],
  ford: ['ford motor', 'ford motor company'],
  gm: ['general motors', 'chevrolet', 'cadillac', 'buick', 'gmc'],
  rivian: ['rivian automotive'],
  lucid: ['lucid motors', 'lucid group'],

  // Retail / E-commerce
  walmart: ['walmart inc', 'wal-mart'],
  target: ['target corporation'],
  costco: ['costco wholesale'],
  'home depot': ['the home depot'],
  lowes: ["lowe's", "lowe's companies"],
  nike: ['nike inc'],
  adidas: ['adidas ag'],
  gap: ['gap inc', 'old navy', 'banana republic', 'athleta'],

  // Healthcare
  unitedhealth: ['united health', 'united healthcare', 'optum'],
  cvs: ['cvs health', 'aetna'],
  johnson: ['johnson & johnson', 'j&j', 'janssen'],
  pfizer: ['pfizer inc'],
  abbvie: ['abbvie inc'],
  merck: ['merck & co', 'msd'],
  'eli lilly': ['lilly', 'lilly and company'],
  bristol: ['bristol myers squibb', 'bristol-myers squibb', 'bms'],
  amgen: ['amgen inc'],
  gilead: ['gilead sciences'],
  moderna: ['moderna inc'],
  regeneron: ['regeneron pharmaceuticals'],

  // Media / Entertainment
  disney: ['the walt disney company', 'walt disney', 'pixar', 'marvel', 'lucasfilm', 'espn', 'abc'],
  warner: [
    'warner bros',
    'warner bros discovery',
    'wbd',
    'hbo',
    'cnn',
    'dc comics',
    'dc entertainment',
  ],
  paramount: ['paramount global', 'viacom', 'cbs', 'mtv', 'nickelodeon', 'comedy central'],
  nbcuniversal: ['nbc', 'universal', 'comcast', 'peacock'],
  sony: ['sony corporation', 'sony interactive', 'playstation', 'columbia pictures'],

  // Telecom
  att: ['at&t', 'at and t', 'att inc'],
  verizon: ['verizon communications'],
  tmobile: ['t-mobile', 't mobile', 'sprint'],
};

// =============================================================================
// EMAIL DOMAIN TO COMPANY MAPPING
// Maps email domain to canonical company name
// =============================================================================

export const DOMAIN_TO_COMPANY: Record<string, string | null> = {
  // Big Tech
  'google.com': 'Google',
  'youtube.com': 'Google',
  'alphabet.com': 'Google',
  'x.company': 'Google',
  'meta.com': 'Meta',
  'fb.com': 'Meta',
  'instagram.com': 'Meta',
  'whatsapp.com': 'Meta',
  'amazon.com': 'Amazon',
  'amazon.jobs': 'Amazon',
  'aws.amazon.com': 'Amazon',
  'microsoft.com': 'Microsoft',
  'linkedin.com': 'Microsoft',
  'github.com': 'Microsoft',
  'apple.com': 'Apple',
  'netflix.com': 'Netflix',
  'nvidia.com': 'NVIDIA',
  'salesforce.com': 'Salesforce',
  'slack.com': 'Salesforce',
  'oracle.com': 'Oracle',
  'ibm.com': 'IBM',
  'redhat.com': 'IBM',
  'intel.com': 'Intel',
  'adobe.com': 'Adobe',
  'figma.com': 'Adobe',
  'uber.com': 'Uber',
  'lyft.com': 'Lyft',
  'airbnb.com': 'Airbnb',
  'stripe.com': 'Stripe',
  'coinbase.com': 'Coinbase',
  'robinhood.com': 'Robinhood',
  'squareup.com': 'Square',
  'block.xyz': 'Square',
  'paypal.com': 'PayPal',
  'venmo.com': 'PayPal',
  'shopify.com': 'Shopify',
  'zoom.us': 'Zoom',
  'dropbox.com': 'Dropbox',
  'atlassian.com': 'Atlassian',
  'spotify.com': 'Spotify',
  'snap.com': 'Snap',
  'pinterest.com': 'Pinterest',
  'doordash.com': 'DoorDash',
  'instacart.com': 'Instacart',
  'databricks.com': 'Databricks',
  'snowflake.com': 'Snowflake',
  'palantir.com': 'Palantir',
  'mongodb.com': 'MongoDB',
  'datadoghq.com': 'Datadog',
  'cloudflare.com': 'Cloudflare',
  'crowdstrike.com': 'CrowdStrike',
  'okta.com': 'Okta',
  'auth0.com': 'Okta',
  'twilio.com': 'Twilio',
  'sendgrid.com': 'Twilio',
  'splunk.com': 'Splunk',
  'elastic.co': 'Elastic',
  'confluent.io': 'Confluent',
  'hashicorp.com': 'HashiCorp',

  // Finance
  'jpmorgan.com': 'JPMorgan',
  'jpmorganchase.com': 'JPMorgan',
  'chase.com': 'JPMorgan',
  'gs.com': 'Goldman Sachs',
  'goldmansachs.com': 'Goldman Sachs',
  'morganstanley.com': 'Morgan Stanley',
  'bankofamerica.com': 'Bank of America',
  'bofa.com': 'Bank of America',
  'ml.com': 'Bank of America',
  'wellsfargo.com': 'Wells Fargo',
  'citi.com': 'Citi',
  'citigroup.com': 'Citi',
  'barclays.com': 'Barclays',
  'credit-suisse.com': 'Credit Suisse',
  'db.com': 'Deutsche Bank',
  'ubs.com': 'UBS',
  'hsbc.com': 'HSBC',
  'blackrock.com': 'BlackRock',
  'vanguard.com': 'Vanguard',
  'fidelity.com': 'Fidelity',
  'schwab.com': 'Charles Schwab',
  'visa.com': 'Visa',
  'mastercard.com': 'Mastercard',
  'americanexpress.com': 'American Express',
  'capitalone.com': 'Capital One',

  // Consulting
  'mckinsey.com': 'McKinsey',
  'bcg.com': 'BCG',
  'bain.com': 'Bain',
  'deloitte.com': 'Deloitte',
  'pwc.com': 'PwC',
  'ey.com': 'EY',
  'kpmg.com': 'KPMG',
  'accenture.com': 'Accenture',
  'bah.com': 'Booz Allen Hamilton',

  // Automotive
  'tesla.com': 'Tesla',
  'ford.com': 'Ford',
  'gm.com': 'GM',
  'rivian.com': 'Rivian',
  'lucidmotors.com': 'Lucid',

  // Healthcare
  'unitedhealthgroup.com': 'UnitedHealth',
  'optum.com': 'UnitedHealth',
  'cvshealth.com': 'CVS',
  'aetna.com': 'CVS',
  'jnj.com': 'Johnson & Johnson',
  'pfizer.com': 'Pfizer',
  'abbvie.com': 'AbbVie',
  'merck.com': 'Merck',
  'lilly.com': 'Eli Lilly',
  'bms.com': 'Bristol Myers Squibb',
  'amgen.com': 'Amgen',
  'gilead.com': 'Gilead',
  'modernatx.com': 'Moderna',
  'regeneron.com': 'Regeneron',

  // ATS platforms - null means don't use as company name
  'greenhouse.io': null,
  'lever.co': null,
  'myworkday.com': null,
  'myworkdayjobs.com': null,
  'icims.com': null,
  'smartrecruiters.com': null,
  'ashbyhq.com': null,
  'taleo.net': null,
  'jobvite.com': null,
  'successfactors.com': null,
  'breezy.hr': null,
  'bamboohr.com': null,
  'jazzhr.com': null,
  'recruiterbox.com': null,
  'workable.com': null,
  'applytojob.com': null,
  'hire.lever.co': null,
  'jobs.lever.co': null,
  'boards.greenhouse.io': null,

  // Job boards - could be company or not
  'indeed.com': null,
  'glassdoor.com': null,
  'ziprecruiter.com': null,
  'monster.com': null,
  'wellfound.com': null,
  'angel.co': null,
};

// =============================================================================
// ATS DOMAINS (known to be ATS, not hiring companies)
// =============================================================================

export const ATS_DOMAINS: Set<string> = new Set([
  'greenhouse.io',
  'lever.co',
  'hire.lever.co',
  'jobs.lever.co',
  'myworkday.com',
  'myworkdayjobs.com',
  'icims.com',
  'smartrecruiters.com',
  'ashbyhq.com',
  'taleo.net',
  'jobvite.com',
  'successfactors.com',
  'breezy.hr',
  'bamboohr.com',
  'jazzhr.com',
  'recruiterbox.com',
  'workable.com',
  'applytojob.com',
  'boards.greenhouse.io',
  'app.greenhouse.io',
  'jobapply.page',
  'recruiter.greenhouse.io',
]);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Normalize a company name for comparison.
 * Lowercases, removes common suffixes, and normalizes whitespace.
 */
export function normalizeCompanyForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|inc\.|llc|l\.l\.c\.|ltd|ltd\.|corp|corp\.|co|co\.|company|plc)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pre-built reverse lookup map for O(1) alias lookups
// Maps normalized alias -> canonical company name
const ALIAS_TO_CANONICAL: Map<string, string> = new Map();

// Build the reverse lookup map at module load time
for (const [canonical, aliases] of Object.entries(COMPANY_ALIASES)) {
  // Add the canonical name itself
  ALIAS_TO_CANONICAL.set(normalizeCompanyForMatching(canonical), canonical);
  // Add all aliases
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(normalizeCompanyForMatching(alias), canonical);
  }
}

/**
 * Check if two company names match, considering aliases.
 */
export function companiesMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeCompanyForMatching(name1);
  const norm2 = normalizeCompanyForMatching(name2);

  // Direct match
  if (norm1 === norm2) return true;

  // Check if one contains the other (for partial matches)
  // Only use contains match for strings with reasonable length to avoid false positives
  // (e.g., "at" matching "atlassian")
  const minLength = Math.min(norm1.length, norm2.length);
  if (minLength >= 4 && (norm1.includes(norm2) || norm2.includes(norm1))) return true;

  // Check aliases
  const canonical1 = findCanonicalCompany(norm1);
  const canonical2 = findCanonicalCompany(norm2);

  if (canonical1 && canonical2 && canonical1 === canonical2) return true;

  return false;
}

/**
 * Find the canonical company name for a given name (if it's an alias).
 * Uses pre-built reverse lookup map for O(1) performance.
 */
export function findCanonicalCompany(name: string): string | null {
  const normalized = normalizeCompanyForMatching(name);
  return ALIAS_TO_CANONICAL.get(normalized) ?? null;
}

/**
 * Get company name from email domain.
 * Returns null if domain is an ATS or job board.
 */
export function getCompanyFromDomain(domain: string): string | null {
  const normalizedDomain = domain.toLowerCase().trim();

  // Direct lookup
  if (normalizedDomain in DOMAIN_TO_COMPANY) {
    return DOMAIN_TO_COMPANY[normalizedDomain];
  }

  // Check for subdomain matches (e.g., careers.google.com -> google.com)
  const parts = normalizedDomain.split('.');
  if (parts.length > 2) {
    const baseDomain = parts.slice(-2).join('.');
    if (baseDomain in DOMAIN_TO_COMPANY) {
      return DOMAIN_TO_COMPANY[baseDomain];
    }
  }

  return null;
}

/**
 * Check if a domain is a known ATS platform.
 */
export function isATSDomain(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().trim();

  if (ATS_DOMAINS.has(normalizedDomain)) return true;

  // Check for subdomain matches
  const parts = normalizedDomain.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const subdomain = parts.slice(i).join('.');
    if (ATS_DOMAINS.has(subdomain)) return true;
  }

  return false;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1, where 1 is identical).
 */
export function stringSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLength;
}

/**
 * Find the best matching company from a list using fuzzy matching.
 */
export function findBestCompanyMatch(
  searchName: string,
  candidates: Array<{ company: string; [key: string]: unknown }>,
  minSimilarity = 0.7,
): { match: (typeof candidates)[0] | null; similarity: number } {
  const normalizedSearch = normalizeCompanyForMatching(searchName);
  let bestMatch: (typeof candidates)[0] | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeCompanyForMatching(candidate.company);

    // Check exact match first
    if (normalizedSearch === normalizedCandidate) {
      return { match: candidate, similarity: 1 };
    }

    // Check alias match
    if (companiesMatch(searchName, candidate.company)) {
      return { match: candidate, similarity: 0.95 };
    }

    // Fuzzy match
    const similarity = stringSimilarity(normalizedSearch, normalizedCandidate);
    if (similarity > bestSimilarity && similarity >= minSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }

  return { match: bestMatch, similarity: bestSimilarity };
}
