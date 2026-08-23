import { site } from "./site";

export interface TrustPageDefinition {
  path: string;
  title: string;
  description: string;
  breadcrumbLabel: string | null;
  eyebrow: string;
  heading: string;
  deck: string;
  robots?: "index,follow" | "noindex,follow";
}

export const trustPages = {
  about: {
    path: "/about/",
    title: `About the publication | ${site.name}`,
    description:
      "Learn how Everyday Tech Insight connects small-business problems with practical, source-backed technology decisions and reader outcomes.",
    breadcrumbLabel: "About",
    eyebrow: "Publication purpose",
    heading: "About Everyday Tech Insight",
    deck: "Everyday Tech Insight publishes practical guidance at the intersection of business needs and everyday technology decisions.",
  },
  publisher: {
    path: "/publisher/",
    title: `Publisher identity boundary | ${site.name}`,
    description:
      "A plain statement of the verified public publisher identity and the personal, legal, credential, team, and testing claims not made by this publication.",
    breadcrumbLabel: "Publisher",
    eyebrow: "Publication scope and accountability",
    heading: "Publisher",
    deck: "This page explains the scope of the Everyday Tech Insight publication-name byline and makes its current public identity boundary explicit.",
  },
  editorialStandards: {
    path: "/editorial-standards/",
    title: `Editorial standards and sourcing | ${site.name}`,
    description:
      "How Everyday Tech Insight selects topics, verifies claims, compares software, separates commercial interests, uses AI assistance, and handles corrections.",
    breadcrumbLabel: "Editorial standards",
    eyebrow: "How publication decisions are made",
    heading: "Editorial standards",
    deck: "Every published guide must connect a real business problem to a practical technology decision and stay within the evidence available.",
  },
  corrections: {
    path: "/corrections/",
    title: `Corrections process | ${site.name}`,
    description:
      "How to report a factual error, broken source, or material omission to Everyday Tech Insight through the public GitHub issue tracker.",
    breadcrumbLabel: "Corrections",
    eyebrow: "Accuracy and updates",
    heading: "Corrections",
    deck: "Factual errors, broken primary sources, and material omissions should be reported so the affected guide can be reviewed.",
  },
  contact: {
    path: "/contact/",
    title: `Contact the publication | ${site.name}`,
    description:
      "Contact Everyday Tech Insight about editorial questions or site problems through its public GitHub issue tracker without sharing private information.",
    breadcrumbLabel: "Contact",
    eyebrow: "Public contact channel",
    heading: "Contact",
    deck: "Editorial questions, accessibility problems, and site issues can be submitted through the publication's public issue tracker.",
  },
  privacy: {
    path: "/privacy/",
    title: `Privacy practices for this static site | ${site.name}`,
    description:
      "A factual description of the static site's current cookies, storage, analytics, advertising, contact, hosting, and public GitHub issue practices.",
    breadcrumbLabel: "Privacy",
    eyebrow: "Current site behavior",
    heading: "Privacy",
    deck: "This notice describes the code and services currently used by the static Everyday Tech Insight site as reviewed on August 22, 2026.",
  },
  advertisingDisclosure: {
    path: "/advertising-disclosure/",
    title: `Advertising and compensation disclosure | ${site.name}`,
    description:
      "The current advertising, affiliate, sponsorship, compensation, and AdSense status of the Everyday Tech Insight static publication.",
    breadcrumbLabel: "Advertising disclosure",
    eyebrow: "Current commercial status",
    heading: "Advertising disclosure",
    deck: "Everyday Tech Insight does not currently run advertising on this static site.",
  },
  notFound: {
    path: "/404.html",
    title: `Page not found | ${site.name}`,
    description:
      "The requested Everyday Tech Insight page could not be found. Return home or browse the publication's business-technology categories.",
    breadcrumbLabel: null,
    eyebrow: "404 error",
    heading: "Page not found",
    deck: "The address may be incorrect, or the page may no longer be available.",
    robots: "noindex,follow",
  },
} as const satisfies Record<string, TrustPageDefinition>;

export const trustPageKeys = [
  "about",
  "publisher",
  "editorialStandards",
  "corrections",
  "contact",
  "privacy",
  "advertisingDisclosure",
] as const;

export type TrustPageKey = (typeof trustPageKeys)[number];

export const relatedTrustPages = trustPageKeys.map((key) => ({
  key,
  path: trustPages[key].path,
  label: trustPages[key].breadcrumbLabel,
}));
