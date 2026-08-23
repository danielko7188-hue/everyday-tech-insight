export const DEFAULT_SITE_URL = "https://everyday-tech-insight.vercel.app/";

export function resolveSiteUrl(candidate) {
  if (candidate === undefined) return DEFAULT_SITE_URL;
  if (typeof candidate !== "string" || candidate.trim() !== candidate) {
    throw new TypeError(
      "PUBLIC_SITE_URL must be an HTTPS origin without credentials, path, query, or hash.",
    );
  }

  let resolved;
  try {
    resolved = new URL(candidate);
  } catch {
    throw new TypeError(
      "PUBLIC_SITE_URL must be an HTTPS origin without credentials, path, query, or hash.",
    );
  }

  const lexicalOrigin =
    candidate === resolved.origin || candidate === `${resolved.origin}/`;

  if (
    !lexicalOrigin ||
    resolved.protocol !== "https:" ||
    resolved.username ||
    resolved.password ||
    resolved.pathname !== "/" ||
    resolved.search ||
    resolved.hash
  ) {
    throw new TypeError(
      "PUBLIC_SITE_URL must be an HTTPS origin without credentials, path, query, or hash.",
    );
  }

  return `${resolved.origin}/`;
}

export const siteUrl = resolveSiteUrl(process.env.PUBLIC_SITE_URL);
export const siteOrigin = new URL(siteUrl).origin;

export const siteConfig = Object.freeze({
  name: "Everyday Tech Insight",
  tagline:
    "Practical guidance for choosing, using, and securing business technology.",
  publicationByline: "Everyday Tech Insight",
  locale: "en-US",
  timeZone: "America/Los_Angeles",
  launchDate: "2026-08-21",
  intendedAudience: "small-business decision makers",
  url: siteUrl,
  contact: Object.freeze({
    method: "github-issues",
    url: "https://github.com/danielko7188-hue/everyday-tech-insight/issues",
  }),
  integrations: Object.freeze({
    monetization: Object.freeze({ enabled: false, provider: null }),
    analytics: Object.freeze({ enabled: false, provider: null }),
    consentManagementPlatform: Object.freeze({
      enabled: false,
      provider: null,
    }),
  }),
});
