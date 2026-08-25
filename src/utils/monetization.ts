import { z } from "zod";

export const MONETIZATION_MODES = ["off", "verification", "live"] as const;
export const AD_PLACEMENTS = [
  "article-after-intro",
  "article-before-sources",
] as const;
export const MINIMUM_AD_ARTICLE_WORDS = 800;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ADSENSE_PUBLISHER_ID_PATTERN = /^ca-pub-\d{16}$/;
const ADSENSE_SELLER_ID_PATTERN = /^pub-\d{16}$/;
const ADSENSE_SLOT_ID_PATTERN = /^\d{5,20}$/;
const ADS_TXT_PATTERN = /^google\.com, (pub-\d{16}), DIRECT, f08c47fec0942fa0$/;

function isRealCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dateOnlySchema = z
  .string()
  .regex(ISO_DATE_PATTERN, "Use an ISO date in YYYY-MM-DD form.")
  .refine(isRealCalendarDate, "Date must be a real calendar date.");

const publisherIdSchema = z
  .string()
  .regex(
    ADSENSE_PUBLISHER_ID_PATTERN,
    "AdSense publisher ID must use the exact ca-pub- plus 16 digits form.",
  );

const adsTxtLineSchema = z
  .string()
  .regex(
    ADS_TXT_PATTERN,
    "ads.txt must be one exact Google DIRECT seller declaration.",
  );

const offSchema = z.strictObject({
  mode: z.literal("off"),
});

const metaVerificationSchema = z.strictObject({
  method: z.literal("meta"),
  ownerAuthorized: z.literal(true),
  value: publisherIdSchema,
});

const adsTxtVerificationSchema = z.strictObject({
  line: adsTxtLineSchema,
  method: z.literal("ads-txt"),
  ownerAuthorized: z.literal(true),
  reviewed: z.literal(true),
});

const verificationSchema = z.strictObject({
  mode: z.literal("verification"),
  provider: z.literal("google-adsense"),
  verification: z.discriminatedUnion("method", [
    metaVerificationSchema,
    adsTxtVerificationSchema,
  ]),
});

const readySiteStatusSchema = z.strictObject({
  checkedOn: dateOnlySchema,
  source: z.literal("adsense-sites-list"),
  status: z.literal("ready"),
});

const ownerAuthorizationSchema = z.strictObject({
  authorized: z.literal(true),
  recordedOn: dateOnlySchema,
});

const disclosureSchema = z.strictObject({
  reviewed: z.literal(true),
  reviewedOn: dateOnlySchema,
});

const liveAdsTxtSchema = z.strictObject({
  authorized: z.literal(true),
  line: adsTxtLineSchema,
  reviewedOn: dateOnlySchema,
});

const requiredCmpSchema = z.strictObject({
  decision: z.literal("required"),
  googleCertified: z.literal(true),
  providerName: z.string().trim().min(2).max(120),
  reviewedOn: dateOnlySchema,
  tcfIntegrated: z.literal(true),
});

const notApplicableCmpSchema = z.strictObject({
  decision: z.literal("not-applicable"),
  reason: z.string().trim().min(40).max(500),
  reviewedOn: dateOnlySchema,
});

const placementSchema = z.strictObject({
  placement: z.enum(AD_PLACEMENTS),
  slotId: z
    .string()
    .regex(
      ADSENSE_SLOT_ID_PATTERN,
      "AdSense slot ID must contain only 5 to 20 digits.",
    ),
});

const liveSchema = z
  .strictObject({
    adsTxt: liveAdsTxtSchema,
    cmpDecision: z.discriminatedUnion("decision", [
      requiredCmpSchema,
      notApplicableCmpSchema,
    ]),
    disclosure: disclosureSchema,
    mode: z.literal("live"),
    ownerAuthorization: ownerAuthorizationSchema,
    placements: z.array(placementSchema).min(1).max(AD_PLACEMENTS.length),
    provider: z.literal("google-adsense"),
    publisherId: publisherIdSchema,
    siteStatus: readySiteStatusSchema,
  })
  .superRefine((config, context) => {
    const sellerId = ADS_TXT_PATTERN.exec(config.adsTxt.line)?.[1];
    const expectedSellerId = config.publisherId.slice("ca-".length);
    if (!sellerId || !ADSENSE_SELLER_ID_PATTERN.test(sellerId)) {
      context.addIssue({
        code: "custom",
        message: "ads.txt seller ID is invalid.",
        path: ["adsTxt", "line"],
      });
    } else if (sellerId !== expectedSellerId) {
      context.addIssue({
        code: "custom",
        message: "ads.txt seller ID must match the configured publisher ID.",
        path: ["adsTxt", "line"],
      });
    }

    const placements = config.placements.map(({ placement }) => placement);
    if (new Set(placements).size !== placements.length) {
      context.addIssue({
        code: "custom",
        message: "Each advertising placement may be configured only once.",
        path: ["placements"],
      });
    }
    const slotIds = config.placements.map(({ slotId }) => slotId);
    if (new Set(slotIds).size !== slotIds.length) {
      context.addIssue({
        code: "custom",
        message: "Each advertising slot ID may be configured only once.",
        path: ["placements"],
      });
    }
  });

export const monetizationConfigSchema = z.discriminatedUnion("mode", [
  offSchema,
  verificationSchema,
  liveSchema,
]);

export type MonetizationConfig = z.infer<typeof monetizationConfigSchema>;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export type AdSurface =
  | "article"
  | "archive"
  | "cms"
  | "download"
  | "feed"
  | "navigation"
  | "not-found"
  | "sitemap"
  | "toolkit"
  | "trust";

export type AdPlacementContext = Readonly<{
  articleStatus: "draft" | "review" | "published" | "archived";
  articleWordCount: number;
  placement: AdPlacement;
  surface: AdSurface;
}>;

type PublicMonetizationCopy = Readonly<{
  approvalBoundary: string;
  disclosureState: string;
  mode: MonetizationConfig["mode"];
  privacyState: string;
}>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export function defineMonetizationConfig(input: unknown): MonetizationConfig {
  const result = monetizationConfigSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map(({ message, path }) => `${path.join(".") || "config"}: ${message}`)
      .join("; ");
    throw new TypeError(`Invalid monetization configuration: ${details}`);
  }
  return deepFreeze(result.data) as MonetizationConfig;
}

function validated(config: MonetizationConfig): MonetizationConfig {
  return defineMonetizationConfig(config);
}

export function verificationMetaFor(
  config: MonetizationConfig,
): Readonly<{ content: string; name: "google-adsense-account" }> | null {
  const current = validated(config);
  if (current.mode === "verification") {
    if (current.verification.method !== "meta") return null;
    return Object.freeze({
      content: current.verification.value,
      name: "google-adsense-account" as const,
    });
  }
  if (current.mode !== "live") return null;
  return Object.freeze({
    content: current.publisherId,
    name: "google-adsense-account" as const,
  });
}

export function adsTextFor(config: MonetizationConfig): string | null {
  const current = validated(config);
  if (current.mode === "verification") {
    return current.verification.method === "ads-txt"
      ? `${current.verification.line}\n`
      : null;
  }
  return current.mode === "live" ? `${current.adsTxt.line}\n` : null;
}

export function adScriptUrlFor(config: MonetizationConfig): string | null {
  const current = validated(config);
  if (current.mode !== "live") return null;
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${current.publisherId}`;
}

export function resolveAdUnit(
  config: MonetizationConfig,
  context: AdPlacementContext,
): Readonly<{
  placement: AdPlacement;
  publisherId: string;
  slotId: string;
}> | null {
  const current = validated(config);
  if (
    current.mode !== "live" ||
    context.surface !== "article" ||
    context.articleStatus !== "published" ||
    !Number.isSafeInteger(context.articleWordCount) ||
    context.articleWordCount < MINIMUM_AD_ARTICLE_WORDS ||
    !AD_PLACEMENTS.includes(context.placement)
  ) {
    return null;
  }

  const unit = current.placements.find(
    ({ placement }) => placement === context.placement,
  );
  if (!unit) return null;
  return Object.freeze({
    placement: unit.placement,
    publisherId: current.publisherId,
    slotId: unit.slotId,
  });
}

export function monetizationPublicCopy(
  config: MonetizationConfig,
): PublicMonetizationCopy {
  const current = validated(config);
  const approvalBoundary =
    "Google alone decides whether a site is approved for AdSense; this configuration makes no approval claim.";

  if (current.mode === "off") {
    return Object.freeze({
      approvalBoundary,
      disclosureState:
        "No advertising integration, publisher identifier, verification marker, ads.txt seller file, display unit, or advertising consent platform is active in this build.",
      mode: current.mode,
      privacyState:
        "This site's code sets no cookies or browser storage and includes no analytics or advertising, ad requests, or advertising consent platform.",
    });
  }

  if (current.mode === "verification") {
    return Object.freeze({
      approvalBoundary,
      disclosureState:
        "An owner-authorized AdSense site-verification marker is present. No advertising script or display unit is active, and verification does not mean approval.",
      mode: current.mode,
      privacyState:
        "The configured AdSense site-verification marker does not itself serve advertising or add advertising cookies or browser storage.",
    });
  }

  return Object.freeze({
    approvalBoundary,
    disclosureState:
      "Owner-authorized Google AdSense display advertising is configured only for eligible published guides and labeled placements.",
    mode: current.mode,
    privacyState:
      "Google AdSense advertising and the recorded consent decision are active; advertising may process device, request, storage, consent, and usage data according to the configured integration and applicable policies.",
  });
}
