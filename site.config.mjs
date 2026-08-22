export const siteConfig = Object.freeze({
  name: "Everyday Tech Insight",
  tagline:
    "Practical guidance for choosing, using, and securing business technology.",
  publicationByline: "Everyday Tech Insight",
  locale: "en-US",
  timeZone: "America/Los_Angeles",
  launchDate: "2026-08-21",
  intendedAudience: "small-business decision makers",
  url: "https://everyday-tech-insight.vercel.app/",
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

export const siteUrl = siteConfig.url;
export const siteOrigin = new URL(siteUrl).origin;
