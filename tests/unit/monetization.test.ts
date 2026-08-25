import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  defineIntegrationsConfig,
  defineMonetizationConfig,
  integrationPublicCopy,
} from "../../src/utils/monetization";
import * as monetizationModule from "../../src/utils/monetization";

const OFF_INTEGRATIONS = {
  monetization: { mode: "off" },
  analytics: { enabled: false, provider: null },
  consentManagementPlatform: { enabled: false, provider: null },
} as const;

function productionSourceFiles(): string[] {
  const files: string[] = [];
  const visit = (target: string) => {
    for (const entry of readdirSync(target)) {
      const absolute = join(target, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (/\.(?:astro|css|html|js|json|mjs|svg|ts|txt|xml)$/.test(entry))
        files.push(absolute);
    }
  };
  visit(fileURLToPath(new URL("../../src", import.meta.url)));
  visit(fileURLToPath(new URL("../../public", import.meta.url)));
  files.push(fileURLToPath(new URL("../../site.config.mjs", import.meta.url)));
  return files.sort();
}

describe("advertising-off runtime configuration", () => {
  it("exposes no runtime capability beyond off-state validation and copy", () => {
    expect(Object.keys(monetizationModule).sort()).toEqual([
      "defineIntegrationsConfig",
      "defineMonetizationConfig",
      "integrationPublicCopy",
      "integrationsConfigSchema",
      "monetizationConfigSchema",
    ]);
  });

  it("accepts and freezes only the exact advertising-off object", () => {
    const config = defineMonetizationConfig({ mode: "off" });

    expect(config).toEqual({ mode: "off" });
    expect(Object.keys(config)).toEqual(["mode"]);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    ["missing config", undefined],
    ["null config", null],
    ["empty config", {}],
    ["array config", [{ mode: "off" }]],
    ["verification mode", { mode: "verification" }],
    ["live mode", { mode: "live" }],
    ["unknown future mode", { mode: "paused" }],
    ["provider", { mode: "off", provider: "google-adsense" }],
    ["publisher field", { mode: "off", publisherId: "owner-value" }],
    ["verification field", { mode: "off", verification: {} }],
    ["seller-file field", { mode: "off", adsTxt: {} }],
    ["placement field", { mode: "off", placements: [] }],
    ["consent field", { mode: "off", cmpDecision: {} }],
    ["feature switch", { mode: "off", enabled: false }],
  ])("rejects %s", (_name, input) => {
    expect(() => defineMonetizationConfig(input)).toThrow(
      /Invalid monetization configuration/,
    );
  });

  it("validates and deeply freezes the complete disabled integration state", () => {
    const integrations = defineIntegrationsConfig(OFF_INTEGRATIONS);

    expect(integrations).toEqual(OFF_INTEGRATIONS);
    expect(Object.isFrozen(integrations)).toBe(true);
    expect(Object.isFrozen(integrations.monetization)).toBe(true);
    expect(Object.isFrozen(integrations.analytics)).toBe(true);
    expect(Object.isFrozen(integrations.consentManagementPlatform)).toBe(true);
  });

  it.each([
    [
      "analytics enabled",
      {
        ...OFF_INTEGRATIONS,
        analytics: { enabled: true, provider: "analytics-provider" },
      },
    ],
    [
      "consent platform enabled",
      {
        ...OFF_INTEGRATIONS,
        consentManagementPlatform: {
          enabled: true,
          provider: "consent-provider",
        },
      },
    ],
    [
      "an extra integration",
      { ...OFF_INTEGRATIONS, embeds: { enabled: false } },
    ],
  ])("rejects complete state with %s", (_name, input) => {
    expect(() => defineIntegrationsConfig(input)).toThrow(
      /Invalid integration configuration/,
    );
  });
});

describe("advertising-off public and source safety", () => {
  it("derives narrow public statements from the complete validated state", () => {
    const copy = integrationPublicCopy(
      defineIntegrationsConfig(OFF_INTEGRATIONS),
    );

    expect(copy).toEqual({
      approvalBoundary:
        "Google alone decides whether a site is approved for AdSense; this release makes no approval claim.",
      disclosureState:
        "Display advertising is disabled. No advertising integration, publisher identifier, verification marker, seller file, or display unit is active in this release.",
      privacyState:
        "The publication's validated integration state disables both analytics and advertising. Its site code does not load analytics or advertising services.",
    });
    expect(Object.isFrozen(copy)).toBe(true);
    expect(`${copy.privacyState} ${copy.disclosureState}`).not.toMatch(
      /(?:cookie|browser storage|personal data|legal consent)/i,
    );
  });

  it("contains no dormant advertising implementation in production source", () => {
    const adSlotPath = fileURLToPath(
      new URL("../../src/components/AdSlot.astro", import.meta.url),
    );
    expect(existsSync(adSlotPath)).toBe(false);

    const productionSource = productionSourceFiles()
      .map((file) => `${file}\n${readFileSync(file, "utf8")}`)
      .join("\n");

    for (const forbidden of [
      /\.ad-slot\b/i,
      /google-adsense-account/i,
      /pagead2\.googlesyndication/i,
      /adsbygoogle/i,
      /data-ad-(?:client|slot|placement)/i,
      /<ins\b/i,
      /(?:ca-)?pub-\d{10,}/i,
      /\b(?:adUnit|adsTxt|publisherId|slotId)\b/,
      /\b(?:verificationMetaFor|adsTextFor|adScriptUrlFor|resolveAdUnit)\b/,
      /\b(?:AD_PLACEMENTS|MINIMUM_AD_ARTICLE_WORDS)\b/,
      /mode\s*:\s*["'](?:verification|live)["']/,
    ]) {
      expect(productionSource).not.toMatch(forbidden);
    }
  });
});
