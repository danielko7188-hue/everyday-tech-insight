import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type MonetizationModule = typeof import("../../src/utils/monetization");

async function loadMonetization(): Promise<Partial<MonetizationModule>> {
  return import("../../src/utils/monetization").catch(() => ({}));
}

const publisherDigits = "1".repeat(16);
const publisherId = ["ca", "pub", publisherDigits].join("-");
const sellerId = ["pub", publisherDigits].join("-");
const googleCertificationAuthorityId = ["f08c47fec", "0942fa0"].join("");
const adsTxtLine = `google.com, ${sellerId}, DIRECT, ${googleCertificationAuthorityId}`;

function liveConfig() {
  return {
    mode: "live" as const,
    provider: "google-adsense" as const,
    publisherId,
    siteStatus: {
      status: "ready" as const,
      checkedOn: "2026-08-25",
      source: "adsense-sites-list" as const,
    },
    ownerAuthorization: {
      authorized: true as const,
      recordedOn: "2026-08-25",
    },
    disclosure: {
      reviewed: true as const,
      reviewedOn: "2026-08-25",
    },
    adsTxt: {
      authorized: true as const,
      line: adsTxtLine,
      reviewedOn: "2026-08-25",
    },
    cmpDecision: {
      decision: "required" as const,
      googleCertified: true as const,
      providerName: "Owner-selected certified CMP",
      reviewedOn: "2026-08-25",
      tcfIntegrated: true as const,
    },
    placements: [
      {
        placement: "article-after-intro" as const,
        slotId: "1".repeat(10),
      },
      {
        placement: "article-before-sources" as const,
        slotId: "2".repeat(10),
      },
    ],
  };
}

describe("monetization configuration", () => {
  it("defines exactly the off, verification, and live modes", async () => {
    const monetization = await loadMonetization();

    expect(monetization.MONETIZATION_MODES).toEqual([
      "off",
      "verification",
      "live",
    ]);
  });

  it("accepts and freezes the exact advertising-off configuration", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("defineMonetizationConfig");
    if (!monetization.defineMonetizationConfig) return;

    const config = monetization.defineMonetizationConfig({ mode: "off" });
    expect(config).toEqual({ mode: "off" });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    ["provider", { provider: "google-adsense" }],
    ["publisher ID", { publisherId }],
    ["verification", { verification: { method: "meta", value: publisherId } }],
    ["ads.txt", { adsTxt: { line: adsTxtLine } }],
    ["CMP", { cmpDecision: { decision: "required" } }],
    ["placements", { placements: [] }],
    ["display switch", { displayAds: false }],
  ])(
    "rejects an off configuration containing a %s field",
    async (_name, extra) => {
      const monetization = await loadMonetization();

      expect(monetization).toHaveProperty("defineMonetizationConfig");
      if (!monetization.defineMonetizationConfig) return;
      const defineMonetizationConfig = monetization.defineMonetizationConfig;

      expect(() => defineMonetizationConfig({ mode: "off", ...extra })).toThrow(
        /monetization/i,
      );
    },
  );

  it("requires a complete owner-authorized meta verification tuple", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("defineMonetizationConfig");
    if (!monetization.defineMonetizationConfig) return;

    const config = monetization.defineMonetizationConfig({
      mode: "verification",
      provider: "google-adsense",
      verification: {
        method: "meta",
        ownerAuthorized: true,
        value: publisherId,
      },
    });

    expect(monetization.verificationMetaFor?.(config)).toEqual({
      content: publisherId,
      name: "google-adsense-account",
    });
    expect(monetization.adsTextFor?.(config)).toBeNull();
    expect(monetization.adScriptUrlFor?.(config)).toBeNull();

    for (const invalid of [
      {
        mode: "verification",
        provider: "google-adsense",
        verification: { method: "meta", value: publisherId },
      },
      {
        mode: "verification",
        provider: "google-adsense",
        verification: {
          method: "meta",
          ownerAuthorized: true,
          value: "not-an-owner-publisher-id",
        },
      },
      {
        mode: "verification",
        provider: "google-adsense",
        verification: {
          method: "meta",
          ownerAuthorized: true,
          value: publisherId,
        },
        placements: [],
      },
    ]) {
      expect(() => monetization.defineMonetizationConfig?.(invalid)).toThrow(
        /monetization/i,
      );
    }
  });

  it("requires a reviewed owner-authorized ads.txt verification tuple", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("defineMonetizationConfig");
    if (!monetization.defineMonetizationConfig) return;

    const config = monetization.defineMonetizationConfig({
      mode: "verification",
      provider: "google-adsense",
      verification: {
        line: adsTxtLine,
        method: "ads-txt",
        ownerAuthorized: true,
        reviewed: true,
      },
    });

    expect(monetization.adsTextFor?.(config)).toBe(`${adsTxtLine}\n`);
    expect(monetization.verificationMetaFor?.(config)).toBeNull();

    for (const invalidVerification of [
      {
        line: adsTxtLine,
        method: "ads-txt",
        ownerAuthorized: true,
      },
      {
        line: adsTxtLine,
        method: "ads-txt",
        reviewed: true,
      },
      {
        line: `${adsTxtLine}\nsecond.example, ${sellerId}, DIRECT`,
        method: "ads-txt",
        ownerAuthorized: true,
        reviewed: true,
      },
    ]) {
      expect(() =>
        monetization.defineMonetizationConfig?.({
          mode: "verification",
          provider: "google-adsense",
          verification: invalidVerification,
        }),
      ).toThrow(/monetization/i);
    }
  });

  it("rejects partial live tuples and cross-checks publisher, seller, and placement IDs", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("defineMonetizationConfig");
    if (!monetization.defineMonetizationConfig) return;

    const valid = monetization.defineMonetizationConfig(liveConfig());
    expect(valid.mode).toBe("live");
    expect(monetization.adsTextFor?.(valid)).toBe(`${adsTxtLine}\n`);
    expect(monetization.adScriptUrlFor?.(valid)).toBe(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`,
    );
    expect(monetization.verificationMetaFor?.(valid)).toEqual({
      content: publisherId,
      name: "google-adsense-account",
    });

    const missingStatus = structuredClone(liveConfig());
    Reflect.deleteProperty(missingStatus, "siteStatus");
    const mismatchedSeller = structuredClone(liveConfig());
    mismatchedSeller.adsTxt.line = mismatchedSeller.adsTxt.line.replace(
      sellerId,
      ["pub", "9".repeat(16)].join("-"),
    );
    const duplicatePlacement = structuredClone(liveConfig());
    duplicatePlacement.placements[1]!.placement = "article-after-intro";
    const unready = structuredClone(liveConfig());
    unready.siteStatus.status = "getting-ready" as "ready";

    for (const invalid of [
      missingStatus,
      mismatchedSeller,
      duplicatePlacement,
      unready,
      { mode: "live" },
    ]) {
      expect(() => monetization.defineMonetizationConfig?.(invalid)).toThrow(
        /monetization/i,
      );
    }
  });

  it("requires a certified TCF CMP or a reviewed non-applicability rationale", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("defineMonetizationConfig");
    if (!monetization.defineMonetizationConfig) return;

    const required = structuredClone(liveConfig());
    required.cmpDecision.googleCertified = false as true;
    expect(() => monetization.defineMonetizationConfig?.(required)).toThrow(
      /monetization/i,
    );

    const notApplicable = structuredClone(liveConfig()) as Record<
      string,
      unknown
    >;
    notApplicable.cmpDecision = {
      decision: "not-applicable",
      reason:
        "Owner-recorded jurisdiction and legal review concluded that this launch does not serve affected traffic.",
      reviewedOn: "2026-08-25",
    };
    expect(() =>
      monetization.defineMonetizationConfig?.(notApplicable),
    ).not.toThrow();

    notApplicable.cmpDecision = {
      decision: "not-applicable",
      reason: "Not needed",
      reviewedOn: "2026-08-25",
    };
    expect(() =>
      monetization.defineMonetizationConfig?.(notApplicable),
    ).toThrow(/monetization/i);
  });
});

describe("future placement and public-copy safety", () => {
  it("wires every conditional public surface to the shared validated state", () => {
    const baseLayout = readFileSync(
      new URL("../../src/layouts/BaseLayout.astro", import.meta.url),
      "utf8",
    );
    const adSlot = readFileSync(
      new URL("../../src/components/AdSlot.astro", import.meta.url),
      "utf8",
    );
    const privacy = readFileSync(
      new URL("../../src/pages/privacy.astro", import.meta.url),
      "utf8",
    );
    const disclosure = readFileSync(
      new URL("../../src/pages/advertising-disclosure.astro", import.meta.url),
      "utf8",
    );

    expect(baseLayout).toMatch(
      /verificationMetaFor\(\s*site\.integrations\.monetization,?\s*\)/,
    );
    expect(baseLayout).toMatch(
      /adScriptUrlFor\(\s*site\.integrations\.monetization,?\s*\)/,
    );
    expect(adSlot).toMatch(
      /resolveAdUnit\(\s*site\.integrations\.monetization/,
    );
    expect(privacy).toMatch(
      /monetizationPublicCopy\(\s*site\.integrations\.monetization,?\s*\)/,
    );
    expect(disclosure).toMatch(
      /monetizationPublicCopy\(\s*site\.integrations\.monetization,?\s*\)/,
    );
  });

  it("allowlists only two article placements", async () => {
    const monetization = await loadMonetization();

    expect(monetization.AD_PLACEMENTS).toEqual([
      "article-after-intro",
      "article-before-sources",
    ]);
  });

  it("permits configured units only on sufficiently long published guides", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("resolveAdUnit");
    expect(monetization).toHaveProperty("MINIMUM_AD_ARTICLE_WORDS");
    if (
      !monetization.defineMonetizationConfig ||
      !monetization.resolveAdUnit ||
      !monetization.MINIMUM_AD_ARTICLE_WORDS
    )
      return;

    const config = monetization.defineMonetizationConfig(liveConfig());
    const eligible = {
      articleStatus: "published" as const,
      articleWordCount: monetization.MINIMUM_AD_ARTICLE_WORDS,
      placement: "article-after-intro" as const,
      surface: "article" as const,
    };

    expect(monetization.resolveAdUnit(config, eligible)).toEqual({
      placement: "article-after-intro",
      publisherId,
      slotId: "1".repeat(10),
    });
    expect(
      monetization.resolveAdUnit(config, {
        ...eligible,
        articleStatus: "review",
      }),
    ).toBeNull();
    expect(
      monetization.resolveAdUnit(config, {
        ...eligible,
        articleWordCount: monetization.MINIMUM_AD_ARTICLE_WORDS - 1,
      }),
    ).toBeNull();
    expect(
      monetization.resolveAdUnit(config, {
        ...eligible,
        surface: "toolkit",
      }),
    ).toBeNull();
    expect(
      monetization.resolveAdUnit(
        monetization.defineMonetizationConfig({ mode: "off" }),
        eligible,
      ),
    ).toBeNull();
  });

  it.each([
    {
      mode: "meta verification",
      verification: {
        method: "meta" as const,
        ownerAuthorized: true as const,
        value: publisherId,
      },
    },
    {
      mode: "ads.txt verification",
      verification: {
        line: adsTxtLine,
        method: "ads-txt" as const,
        ownerAuthorized: true as const,
        reviewed: true as const,
      },
    },
  ])("never resolves an ad unit in $mode", async ({ verification }) => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("resolveAdUnit");
    if (!monetization.defineMonetizationConfig || !monetization.resolveAdUnit)
      return;

    const config = monetization.defineMonetizationConfig({
      mode: "verification",
      provider: "google-adsense",
      verification,
    });

    expect(
      monetization.resolveAdUnit(config, {
        articleStatus: "published",
        articleWordCount: 2_000,
        placement: "article-after-intro",
        surface: "article",
      }),
    ).toBeNull();
  });

  it("derives factual public copy from the validated mode", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("monetizationPublicCopy");
    if (
      !monetization.defineMonetizationConfig ||
      !monetization.monetizationPublicCopy ||
      !monetization.adScriptUrlFor
    )
      return;

    const copy = monetization.monetizationPublicCopy(
      monetization.defineMonetizationConfig({ mode: "off" }),
    );

    expect(copy.mode).toBe("off");
    expect(`${copy.privacyState} ${copy.disclosureState}`).toMatch(
      /no (?:analytics or advertising|advertising)/i,
    );
    expect(copy.approvalBoundary).toMatch(/Google alone decides/i);
    expect(copy.approvalBoundary).toMatch(/no approval claim/i);
    expect(copy.disclosureState).toMatch(/^No advertising integration/i);
    expect(copy.privacyState).toMatch(/includes no analytics or advertising/i);
    expect(
      monetization.adScriptUrlFor(
        monetization.defineMonetizationConfig({ mode: "off" }),
      ),
    ).toBeNull();
  });

  it("derives exact verification and live public copy from validated state", async () => {
    const monetization = await loadMonetization();

    expect(monetization).toHaveProperty("monetizationPublicCopy");
    if (
      !monetization.defineMonetizationConfig ||
      !monetization.monetizationPublicCopy
    )
      return;

    const verificationCopy = monetization.monetizationPublicCopy(
      monetization.defineMonetizationConfig({
        mode: "verification",
        provider: "google-adsense",
        verification: {
          method: "meta",
          ownerAuthorized: true,
          value: publisherId,
        },
      }),
    );
    const liveCopy = monetization.monetizationPublicCopy(
      monetization.defineMonetizationConfig(liveConfig()),
    );

    expect(verificationCopy).toEqual({
      approvalBoundary:
        "Google alone decides whether a site is approved for AdSense; this configuration makes no approval claim.",
      disclosureState:
        "An owner-authorized AdSense site-verification marker is present. No advertising script or display unit is active, and verification does not mean approval.",
      mode: "verification",
      privacyState:
        "The configured AdSense site-verification marker does not itself serve advertising or add advertising cookies or browser storage.",
    });
    expect(liveCopy).toEqual({
      approvalBoundary:
        "Google alone decides whether a site is approved for AdSense; this configuration makes no approval claim.",
      disclosureState:
        "Owner-authorized Google AdSense display advertising is configured only for eligible published guides and labeled placements.",
      mode: "live",
      privacyState:
        "Google AdSense advertising and the recorded consent decision are active; advertising may process device, request, storage, consent, and usage data according to the configured integration and applicable policies.",
    });
  });
});
