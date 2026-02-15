const COMMON_PATTERNS = [
  "/terms",
  "/terms-of-service",
  "/terms-of-use",
  "/legal/terms",
  "/legal/terms-of-service",
  "/tos",
  "/privacy",
  "/privacy-policy",
  "/legal/privacy-policy",
];

const KNOWN_APPS: Record<string, string> = {
  youtube: "https://www.youtube.com/t/terms",
  snapchat: "https://www.snap.com/terms",
  instagram: "https://help.instagram.com/581066165581870",
  facebook: "https://www.facebook.com/terms",
  whatsapp: "https://www.whatsapp.com/legal/terms-of-service",
  netflix: "https://help.netflix.com/legal/termsofuse",
  spotify: "https://www.spotify.com/legal/end-user-agreement",
  tiktok: "https://www.tiktok.com/legal/terms-of-service",
  twitter: "https://x.com/en/tos",
  "x (twitter)": "https://x.com/en/tos",
};

export function guessTermsUrl(appName: string): string | null {
  const normalized = normalizeAppName(appName);

  if (!normalized) return null;

  // Direct mapping for popular services
  if (normalized in KNOWN_APPS) {
    return KNOWN_APPS[normalized];
  }

  // Try to derive a domain from the name
  const slug = buildSlug(normalized);

  if (!slug) return null;

  const domain = `https://${slug}.com`;

  // Try a few common patterns; we just return the most likely one.
  // The caller is responsible for fetching and handling errors.
  return domain + COMMON_PATTERNS[0];
}

export function buildCandidatePolicyUrls(appName: string): string[] {
  const normalized = normalizeAppName(appName);
  if (!normalized) return [];

  const candidates: string[] = [];
  const known = KNOWN_APPS[normalized];
  if (known) candidates.push(known);

  const slug = buildSlug(normalized);
  if (!slug) return dedupeUrls(candidates);

  const baseDomains = [
    `https://${slug}.com`,
    `https://www.${slug}.com`,
    `https://${slug}.io`,
    `https://www.${slug}.io`,
    `https://${slug}.ai`,
    `https://www.${slug}.ai`,
  ];

  for (const domain of baseDomains) {
    for (const pattern of COMMON_PATTERNS) {
      candidates.push(domain + pattern);
    }
  }

  return dedupeUrls(candidates);
}

function normalizeAppName(appName: string): string {
  return appName.trim().toLowerCase();
}

function buildSlug(normalizedName: string): string {
  return normalizedName
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(app|inc|ltd|llc|corp|company)$/g, "")
    .trim();
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}
