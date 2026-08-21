export const site = {
  name: "Everyday Tech Insight",
  tagline:
    "Practical guidance for choosing, using, and securing business technology.",
  publicationByline: "Everyday Tech Insight",
  locale: "en-US",
  timeZone: "America/Los_Angeles",
  intendedAudience: "small-business decision makers",
  url: "https://everyday-tech-insight.vercel.app/",
  contact: {
    method: "github-issues",
    url: "https://github.com/danielko7188-hue/everyday-tech-insight/issues",
  },
  integrations: {
    monetization: { enabled: false, provider: null },
    analytics: { enabled: false, provider: null },
    consentManagementPlatform: { enabled: false, provider: null },
  },
} as const;

export type SiteConfig = typeof site;
