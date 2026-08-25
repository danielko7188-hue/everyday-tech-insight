import { describe, expect, it } from "vitest";

import {
  createVerifiedAuthorRegistry,
  getVerifiedAuthor,
  publicationByline,
  validateVerifiedAuthorRecord,
  verifiedAuthors,
  type VerifiedAuthorRecord,
} from "../../src/data/authors";

const buildDate = "2026-08-25";

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
        label: "Validation fixture evidence",
        evidenceUrl: "https://www.nist.gov/",
      },
    ],
    sameAs: ["https://www.cisa.gov/"],
    ownerVerifiedAt: "2026-08-25",
    ...overrides,
  };
}

describe("verified author boundary", () => {
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
    const record = validateVerifiedAuthorRecord(validAuthor(), { buildDate });

    expect(record).toMatchObject({
      id: "verified-editor",
      kind: "person",
      profilePath: "/authors/verified-editor/",
      ownerVerifiedAt: buildDate,
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
      validateVerifiedAuthorRecord(validAuthor(overrides), { buildDate }),
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
        validateVerifiedAuthorRecord(validAuthor({ photo }), { buildDate }),
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
      validateVerifiedAuthorRecord(validAuthor(overrides), { buildDate }),
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
            credentials: [{ label: "Validation fixture", evidenceUrl }],
          }),
          { buildDate },
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
      validateVerifiedAuthorRecord(validAuthor(overrides), { buildDate }),
    ).toThrow();
  });

  it.each(["not-a-date", "2026-02-30", "2026-08-26"])(
    "rejects invalid, impossible, or future verification date %s",
    (ownerVerifiedAt) => {
      expect(() =>
        validateVerifiedAuthorRecord(validAuthor({ ownerVerifiedAt }), {
          buildDate,
        }),
      ).toThrow();
    },
  );

  it("rejects duplicate author identities and duplicate evidence", () => {
    expect(() =>
      createVerifiedAuthorRegistry([validAuthor(), validAuthor()], {
        buildDate,
      }),
    ).toThrow(/duplicate/i);

    expect(() =>
      validateVerifiedAuthorRecord(
        validAuthor({
          sameAs: ["https://www.cisa.gov/", "https://www.cisa.gov/"],
        }),
        { buildDate },
      ),
    ).toThrow(/duplicate/i);
  });
});
