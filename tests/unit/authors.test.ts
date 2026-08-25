import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createVerifiedAuthorRegistry,
  getVerifiedAuthor,
  publicationByline,
  validateVerifiedAuthorRecord,
  verifiedAuthors,
  type VerifiedAuthorRecord,
} from "../../src/data/authors";

const verificationDate = "2026-08-25";

function validAuthor(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "verified-editor",
    kind: "person",
    displayName: "Verified Editor",
    role: "Editor",
    shortBio: "A concise biography backed by owner-supplied public evidence.",
    profilePath: "/authors/verified-editor/",
    photo: {
      src: "/images/authors/verified-editor.webp",
      alt: "Portrait of the verified editor.",
      credit: "Owner-provided credit",
      rightsBasis: "Owner-provided publication authorization",
    },
    credentials: [
      {
        label: "HTTPS evidence record",
        evidenceUrl: "https://www.nist.gov/",
      },
    ],
    sameAs: ["https://www.cisa.gov/"],
    ownerVerifiedAt: verificationDate,
    ...overrides,
  };
}

describe("verified author boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the publication-name byline separate from an empty author registry", () => {
    expect(publicationByline).toBe("Everyday Tech Insight");
    expect(verifiedAuthors).toEqual({});
    expect(Object.isFrozen(verifiedAuthors)).toBe(true);
    expect(getVerifiedAuthor("verified-editor")).toBeUndefined();
    expect(getVerifiedAuthor("Everyday Tech Insight")).toBeUndefined();
    expect(getVerifiedAuthor("toString")).toBeUndefined();
    expect(getVerifiedAuthor("constructor")).toBeUndefined();
    const typedRegistry: Readonly<Record<string, VerifiedAuthorRecord>> =
      verifiedAuthors;
    expect(typedRegistry).toBe(verifiedAuthors);
  });

  it("accepts the exact future person record and returns an immutable copy", () => {
    const record = validateVerifiedAuthorRecord(validAuthor());

    expect(record).toMatchObject({
      id: "verified-editor",
      kind: "person",
      profilePath: "/authors/verified-editor/",
      ownerVerifiedAt: verificationDate,
    });
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.photo)).toBe(true);
    expect(Object.isFrozen(record.credentials)).toBe(true);
    expect(Object.isFrozen(record.sameAs)).toBe(true);
  });

  it.each([
    ["nonperson kind", { kind: "organization" }],
    ["uppercase identifier", { id: "Verified-Editor" }],
    ["path traversal identifier", { id: "../verified-editor" }],
    ["mismatched profile path", { profilePath: "/authors/other-editor/" }],
    ["profile query", { profilePath: "/authors/verified-editor/?draft=1" }],
    [
      "unsafe photo path",
      {
        photo: {
          src: "/images/authors/../private.webp",
          alt: "Portrait",
          credit: "Owner credit",
          rightsBasis: "Owner authorization",
        },
      },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      validateVerifiedAuthorRecord(validAuthor(overrides)),
    ).toThrow();
  });

  it.each(["alt", "credit", "rightsBasis"])(
    "rejects a photo missing its %s rights tuple value",
    (field) => {
      const photo = {
        src: "/images/authors/verified-editor.webp",
        alt: "Portrait",
        credit: "Owner credit",
        rightsBasis: "Owner authorization",
        [field]: "",
      };

      expect(() =>
        validateVerifiedAuthorRecord(validAuthor({ photo })),
      ).toThrow();
    },
  );

  it.each([
    [
      "credential evidence",
      { credentials: [{ label: "Credential", evidenceUrl: "http://unsafe" }] },
    ],
    ["same-as URL", { sameAs: ["http://unsafe"] }],
    [
      "credential URL credentials",
      {
        credentials: [
          {
            label: "Credential",
            evidenceUrl: "https://user:secret@www.nist.gov/record",
          },
        ],
      },
    ],
    [
      "same-as URL fragment",
      {
        sameAs: ["https://www.cisa.gov/#private"],
      },
    ],
  ])("rejects unsafe %s", (_label, overrides) => {
    expect(() =>
      validateVerifiedAuthorRecord(validAuthor(overrides)),
    ).toThrow();
  });

  it.each([
    "https://identity.invalid/record",
    "https://identity.test/record",
    "https://identity.example/record",
    "https://localhost/record",
    "https://subdomain.example.com/record",
    "https://127.0.0.1/record",
    "https://10.0.0.1/record",
    "https://[::1]/record",
    "https://example.com./record",
    "https://localhost./record",
    "https://identity.invalid./record",
  ])(
    "rejects reserved, loopback, or private evidence host %s",
    (evidenceUrl) => {
      expect(() =>
        validateVerifiedAuthorRecord(
          validAuthor({
            credentials: [{ label: "HTTPS evidence record", evidenceUrl }],
          }),
        ),
      ).toThrow();
    },
  );

  it.each([
    ["placeholder name", { displayName: "TBD" }],
    ["placeholder role", { role: "Unknown" }],
    ["placeholder biography", { shortBio: "TODO" }],
    [
      "placeholder evidence host",
      {
        credentials: [
          { label: "Credential", evidenceUrl: "https://example.com/proof" },
        ],
      },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      validateVerifiedAuthorRecord(validAuthor(overrides)),
    ).toThrow();
  });

  it.each(["not-a-date", "2026-02-30", "2026-08-26"])(
    "rejects invalid, impossible, or future verification date %s",
    (ownerVerifiedAt) => {
      expect(() =>
        validateVerifiedAuthorRecord(validAuthor({ ownerVerifiedAt })),
      ).toThrow();
    },
  );

  it("rejects duplicate author identities and duplicate evidence", () => {
    expect(() =>
      createVerifiedAuthorRegistry([validAuthor(), validAuthor()]),
    ).toThrow(/duplicate/i);

    expect(() =>
      validateVerifiedAuthorRecord(
        validAuthor({
          sameAs: ["https://www.cisa.gov/", "https://www.cisa.gov/"],
        }),
      ),
    ).toThrow(/duplicate/i);
  });

  it.each([
    [
      "publication identifier",
      {
        id: "everyday-tech-insight",
        profilePath: "/authors/everyday-tech-insight/",
      },
    ],
    ["publication display name", { displayName: "Everyday Tech Insight" }],
    [
      "normalized publication display name",
      { displayName: "  Everyday—Tech   Insight  ".trim() },
    ],
  ])("never accepts the %s as a person identity", (_label, overrides) => {
    expect(() => validateVerifiedAuthorRecord(validAuthor(overrides))).toThrow(
      /publication-name/i,
    );
  });

  it.each([
    ["to be determined", { displayName: "To be determined" }],
    ["pending verification", { role: "Pending verification" }],
    ["pending approval", { shortBio: "Pending approval" }],
    ["coming soon", { shortBio: "Coming soon" }],
    ["placeholder", { displayName: "Placeholder author" }],
    ["not applicable", { role: "N/A" }],
    ["dummy", { displayName: "Dummy Person" }],
    ["test", { role: "Test" }],
    ["John Doe", { displayName: "John Doe" }],
    ["Jane Doe", { displayName: "Jane Doe" }],
    ["embedded TBD", { shortBio: "TBD biography will be supplied later" }],
    [
      "embedded pending approval",
      { shortBio: "Pending approval from the owner" },
    ],
    ["embedded coming soon", { shortBio: "Coming soon biography" }],
    ["suffix coming soon", { shortBio: "Biography coming soon" }],
    ["short suffix coming soon", { shortBio: "Bio coming soon" }],
    ["profile coming soon", { shortBio: "Profile coming soon" }],
    ["suffix pending approval", { shortBio: "Biography pending approval" }],
    ["qualified unknown", { displayName: "Unknown author" }],
    ["embedded placeholder", { role: "Lead placeholder role" }],
    [
      "photo alternative text",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Coming soon",
          credit: "Owner-supplied credit",
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    [
      "photo source filename",
      {
        photo: {
          src: "/images/authors/placeholder.webp",
          alt: "Portrait of the verified editor.",
          credit: "Owner-supplied credit",
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    [
      "photo credit",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: "Pending approval",
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    [
      "photo rights basis",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: "Owner-supplied credit",
          rightsBasis: "Unknown",
        },
      },
    ],
    [
      "reversed photo approval",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: "Owner-supplied credit",
          rightsBasis: "Approval pending",
        },
      },
    ],
    [
      "embedded photo approval",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: "Owner-supplied credit",
          rightsBasis: "Rights pending approval",
        },
      },
    ],
    [
      "photo credit coming soon",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: "Credit coming soon",
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    [
      "credential label",
      {
        credentials: [
          { label: "Placeholder", evidenceUrl: "https://www.nist.gov/" },
        ],
      },
    ],
    [
      "credential evidence path",
      {
        credentials: [
          {
            label: "HTTPS evidence record",
            evidenceUrl: "https://www.nist.gov/placeholder",
          },
        ],
      },
    ],
  ])("rejects normalized placeholder text in %s", (_label, overrides) => {
    expect(() => validateVerifiedAuthorRecord(validAuthor(overrides))).toThrow(
      /placeholder/i,
    );
  });

  it.each([
    ["display name", { displayName: "Verified\nEditor" }],
    ["role", { role: "Editor\tLead" }],
    ["biography", { shortBio: "Biography\u0000with a control." }],
    [
      "photo metadata",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait\rtext",
          credit: "Owner-supplied credit",
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    [
      "credential metadata",
      {
        credentials: [
          {
            label: "Evidence\u007frecord",
            evidenceUrl: "https://www.nist.gov/",
          },
        ],
      },
    ],
  ])("rejects control characters in %s", (_label, overrides) => {
    expect(() => validateVerifiedAuthorRecord(validAuthor(overrides))).toThrow(
      /control/i,
    );
  });

  it.each([
    [
      "GitHub token in biography",
      { shortBio: `Public biography contains ghp_${"A".repeat(36)}` },
    ],
    [
      "Bearer credential in photo credit",
      {
        photo: {
          src: "/images/authors/verified-editor.webp",
          alt: "Portrait of the verified editor.",
          credit: `Bearer ${"A".repeat(32)}`,
          rightsBasis: "Owner-supplied authorization",
        },
      },
    ],
    ["email address in role", { role: "owner@real-looking-domain.com" }],
    [
      "secret-bearing URL in biography",
      {
        shortBio:
          "Evidence at https://www.nist.gov/record?client_secret=secret-value",
      },
    ],
  ])("rejects secret-like public text in %s", (_label, overrides) => {
    expect(() => validateVerifiedAuthorRecord(validAuthor(overrides))).toThrow(
      /sensitive|credential|secret|public/i,
    );
  });

  it("accepts only own-data plain records and arrays without extra properties", () => {
    const inherited = Object.create(validAuthor()) as Record<string, unknown>;
    expect(() => validateVerifiedAuthorRecord(inherited)).toThrow(/own-data/i);

    const accessor = validAuthor();
    Object.defineProperty(accessor, "displayName", {
      enumerable: true,
      get: () => "Accessor Editor",
    });
    expect(() => validateVerifiedAuthorRecord(accessor)).toThrow(/own-data/i);

    const customPhoto = Object.assign(Object.create({ inherited: true }), {
      src: "/images/authors/verified-editor.webp",
      alt: "Portrait of the verified editor.",
      credit: "Owner-supplied credit",
      rightsBasis: "Owner-supplied authorization",
    });
    expect(() =>
      validateVerifiedAuthorRecord(validAuthor({ photo: customPhoto })),
    ).toThrow(/own-data/i);

    const credentials = [
      {
        label: "HTTPS evidence record",
        evidenceUrl: "https://www.nist.gov/",
      },
    ] as Array<Record<string, unknown>> & { note?: string };
    credentials.note = "unexpected";
    expect(() =>
      validateVerifiedAuthorRecord(validAuthor({ credentials })),
    ).toThrow(/own-data/i);

    const symbolKeyed = validAuthor();
    Object.defineProperty(symbolKeyed, Symbol("unexpected"), {
      enumerable: true,
      value: "unexpected",
    });
    expect(() => validateVerifiedAuthorRecord(symbolKeyed)).toThrow(
      /unexpected/i,
    );

    const proxy = new Proxy(validAuthor(), {});
    expect(() => validateVerifiedAuthorRecord(proxy)).toThrow(/own-data/i);
  });

  it.each([
    " https://www.nist.gov/",
    "https://www.nist.gov/ ",
    "https://www.nist.gov/?access_token=secret-value",
    "https://www.nist.gov/?api_key=secret-value",
    "https://www.nist.gov/?client_secret=secret-value",
    "https://www.nist.gov/?refresh_token=secret-value",
    "https://www.nist.gov/?X-Amz-Signature=secret-value",
    "https://-invalid.nist.gov/",
    "https://invalid..nist.gov/",
  ])("rejects unsafe or nonlexical HTTPS evidence %s", (evidenceUrl) => {
    expect(() =>
      validateVerifiedAuthorRecord(
        validAuthor({
          credentials: [{ label: "HTTPS evidence record", evidenceUrl }],
        }),
      ),
    ).toThrow();
  });

  it("normalizes equivalent URLs before duplicate comparison", () => {
    expect(() =>
      validateVerifiedAuthorRecord(
        validAuthor({
          sameAs: ["https://www.cisa.gov", "https://www.cisa.gov/"],
        }),
      ),
    ).toThrow(/duplicate/i);
  });

  it("uses the actual UTC clock and ignores any caller-controlled future-date seam", () => {
    vi.setSystemTime(new Date("2026-08-25T23:59:59.000Z"));
    const callWithLegacyOptions = validateVerifiedAuthorRecord as unknown as (
      input: unknown,
      options: { buildDate: string },
    ) => VerifiedAuthorRecord;

    expect(() =>
      callWithLegacyOptions(validAuthor({ ownerVerifiedAt: "2026-08-26" }), {
        buildDate: "2099-01-01",
      }),
    ).toThrow(/UTC date/i);

    vi.setSystemTime(new Date("2026-08-26T00:00:00.000Z"));
    expect(
      validateVerifiedAuthorRecord(
        validAuthor({ ownerVerifiedAt: "2026-08-26" }),
      ).ownerVerifiedAt,
    ).toBe("2026-08-26");
  });
});
