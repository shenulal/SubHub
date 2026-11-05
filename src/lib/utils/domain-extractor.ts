// src/lib/utils/domain-extractor.ts
/**
 * Utility that extracts the main domain from a URL
 * e.g. https://www.google.com/a/b/c → google.com
 */

/**
 * Extract the main domain from a URL
 * @param url - URL to analyse
 * @returns main domain (e.g. google.com) or null
 */
export function extractMainDomain(url: string): string | null {
  try {
    // Prepend https:// when the URL has no protocol
    let normalizedUrl = url.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // Return IP addresses as-is
    if (isIPAddress(hostname)) {
      return null;
    }

    // Exclude localhost and internal domains
    if (isInternalDomain(hostname)) {
      return null;
    }

    // Strip the www. prefix
    let domain = hostname.startsWith("www.") ? hostname.substring(4) : hostname;

    // Extract the main domain (strip subdomains)
    domain = extractRegisteredDomain(domain);

    return domain || null;
  } catch {
    return null;
  }
}

/**
 * Build a wildcard domain pattern from a URL
 * @param url - URL to analyse
 * @returns wildcard pattern (e.g. *.google.com)
 */
export function extractWildcardPattern(url: string): string | null {
  const domain = extractMainDomain(url);
  if (!domain) return null;
  return `*.${domain}`;
}

/**
 * Check whether a domain matches a URL (supports wildcard patterns)
 * @param pattern - wildcard pattern (e.g. *.google.com)
 * @param url - URL to check
 * @returns whether it matches
 */
export function matchDomainPattern(pattern: string, url: string): boolean {
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // Handle wildcard patterns
    if (pattern.startsWith("*.")) {
      const baseDomain = pattern.substring(2).toLowerCase();
      // Exact match or ends with the domain as a subdomain
      return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
    }

    // Exact match
    return hostname === pattern.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Check whether the value is an IP address
 */
function isIPAddress(hostname: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    return true;
  }

  // IPv6 (without brackets)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Check whether the domain is internal/local
 */
function isInternalDomain(hostname: string): boolean {
  const internalPatterns = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    ".local",
    ".internal",
    ".test",
    ".example",
    ".invalid",
    ".localhost",
  ];

  return internalPatterns.some(
    (pattern) => hostname === pattern || hostname.endsWith(pattern)
  );
}

/**
 * Extract the registered domain (strip subdomains)
 * Simplified version of Public Suffix List (PSL) handling
 */
function extractRegisteredDomain(hostname: string): string {
  const parts = hostname.split(".");

  // Two parts or fewer: return as-is
  if (parts.length <= 2) {
    return hostname;
  }

  // Handle country-code TLD + gTLD combinations (co.kr, com.au, etc.)
  const ccTldPatterns = [
    "co.kr",
    "go.kr",
    "or.kr",
    "ne.kr",
    "re.kr",
    "pe.kr",
    "ac.kr",
    "hs.kr",
    "ms.kr",
    "es.kr",
    "sc.kr",
    "kg.kr",
    "com.au",
    "net.au",
    "org.au",
    "com.br",
    "net.br",
    "org.br",
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "co.jp",
    "ne.jp",
    "or.jp",
    "ac.jp",
    "go.jp",
    "com.cn",
    "net.cn",
    "org.cn",
    "gov.cn",
    "com.tw",
    "net.tw",
    "org.tw",
    "com.hk",
    "net.hk",
    "org.hk",
    "com.sg",
    "net.sg",
    "org.sg",
  ];

  const lastTwoParts = parts.slice(-2).join(".");
  if (ccTldPatterns.includes(lastTwoParts)) {
    // Return three parts (e.g. naver.co.kr)
    return parts.slice(-3).join(".");
  }

  // Default: return the last two parts
  return parts.slice(-2).join(".");
}

/**
 * Check whether a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    new URL(normalizedUrl);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the unique main domains from a list of URLs
 */
export function extractUniqueMainDomains(urls: string[]): string[] {
  const domains = new Set<string>();

  for (const url of urls) {
    const domain = extractMainDomain(url);
    if (domain) {
      domains.add(domain);
    }
  }

  return Array.from(domains);
}

/**
 * Extract the base name of a domain without its TLD
 * e.g. atlassian.com → atlassian, atlassian.net → atlassian
 * Also handles country-code TLDs: naver.co.kr → naver
 */
export function extractDomainBase(domain: string): string {
  const cleaned = domain.toLowerCase().replace(/^\*\./, "");
  const parts = cleaned.split(".");

  if (parts.length <= 1) return cleaned;

  const ccTldSuffixes = [
    "co.kr",
    "go.kr",
    "or.kr",
    "ne.kr",
    "re.kr",
    "pe.kr",
    "ac.kr",
    "co.uk",
    "org.uk",
    "ac.uk",
    "gov.uk",
    "co.jp",
    "ne.jp",
    "or.jp",
    "ac.jp",
    "go.jp",
    "com.au",
    "net.au",
    "org.au",
    "com.br",
    "net.br",
    "org.br",
    "com.cn",
    "net.cn",
    "org.cn",
    "com.tw",
    "net.tw",
    "org.tw",
    "com.hk",
    "net.hk",
    "org.hk",
    "com.sg",
    "net.sg",
    "org.sg",
  ];

  const lastTwo = parts.slice(-2).join(".");
  if (ccTldSuffixes.includes(lastTwo) && parts.length >= 3) {
    return parts[parts.length - 3];
  }

  return parts[parts.length - 2];
}

/**
 * Match domains while ignoring TLD variations
 * e.g. returns true when comparing pattern *.atlassian.net with domain atlassian.com
 */
export function matchDomainWithTldVariants(
  pattern: string,
  url: string
): boolean {
  try {
    const patternBase = extractDomainBase(pattern);
    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const urlBase = extractDomainBase(hostname);

    return patternBase === urlBase;
  } catch {
    return false;
  }
}
