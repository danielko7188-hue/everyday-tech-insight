import { siteConfig } from "../../site.config.mjs";

export interface VerifiedAuthorRecord {
  id: string;
  kind: "person";
  displayName: string;
  role: string;
  shortBio: string;
  profilePath: `/authors/${string}/`;
  photo?: {
    src: `/images/authors/${string}`;
    alt: string;
    credit: string;
    rightsBasis: string;
  };
  credentials?: readonly {
    label: string;
    evidenceUrl: `https://${string}`;
  }[];
  sameAs?: readonly `https://${string}`[];
  ownerVerifiedAt: string;
}

interface ValidationOptions {
  buildDate?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PHOTO_PATH =
  /^\/images\/authors\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\.(?:avif|jpe?g|png|webp)$/;
const PLACEHOLDER_TEXT =
  /^(?:tbd|todo|unknown|n\/?a|none|placeholder|your(?:\s+.+)?|example(?:\s+.+)?)$/i;

export const publicationByline = siteConfig.publicationByline;

function publicationDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: siteConfig.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireText(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    PLACEHOLDER_TEXT.test(value)
  ) {
    throw new TypeError(`${field} must be a non-placeholder, trimmed string.`);
  }
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const unexpected = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );
  if (unexpected.length > 0) {
    throw new TypeError(`${label} has unexpected field ${unexpected[0]}.`);
  }
}

function requireRealDate(value: string, label: string): string {
  if (!ISO_DATE.test(value)) {
    throw new TypeError(`${label} must use YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`${label} must be a real calendar date.`);
  }
  return value;
}

function requireSafeHttpsUrl(
  value: unknown,
  label: string,
): `https://${string}` {
  if (typeof value !== "string" || !value.startsWith("https://")) {
    throw new TypeError(`${label} must be an HTTPS URL.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an HTTPS URL.`);
  }
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const reservedHostname =
    !hostname.includes(".") ||
    ["localhost", "example.com", "example.org", "example.net"].some(
      (reserved) => hostname === reserved || hostname.endsWith(`.${reserved}`),
    ) ||
    [
      ".invalid",
      ".test",
      ".example",
      ".localhost",
      ".local",
      ".internal",
      ".home.arpa",
    ].some((suffix) => hostname.endsWith(suffix));
  const addressLiteral =
    hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    !url.hostname ||
    reservedHostname ||
    addressLiteral
  ) {
    throw new TypeError(`${label} must be a safe, non-placeholder HTTPS URL.`);
  }
  return value as `https://${string}`;
}

function assertNoDuplicates(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} contains a duplicate value.`);
  }
}

export function validateVerifiedAuthorRecord(
  input: unknown,
  options: ValidationOptions = {},
): VerifiedAuthorRecord {
  if (!isPlainObject(input)) {
    throw new TypeError("Verified author must be an object.");
  }
  requireExactKeys(
    input,
    [
      "id",
      "kind",
      "displayName",
      "role",
      "shortBio",
      "profilePath",
      "photo",
      "credentials",
      "sameAs",
      "ownerVerifiedAt",
    ],
    "Verified author",
  );

  const id = requireText(input, "id");
  if (!SAFE_ID.test(id)) {
    throw new TypeError("id must be a lowercase stable slug.");
  }
  if (input.kind !== "person") {
    throw new TypeError('kind must be the literal "person".');
  }

  const displayName = requireText(input, "displayName");
  const role = requireText(input, "role");
  const shortBio = requireText(input, "shortBio");
  const profilePath = requireText(input, "profilePath");
  if (profilePath !== `/authors/${id}/`) {
    throw new TypeError("profilePath must be the canonical path for the id.");
  }

  let photo: VerifiedAuthorRecord["photo"];
  if (input.photo !== undefined) {
    if (!isPlainObject(input.photo)) {
      throw new TypeError("photo must be an object.");
    }
    requireExactKeys(
      input.photo,
      ["src", "alt", "credit", "rightsBasis"],
      "photo",
    );
    const src = requireText(input.photo, "src");
    if (!SAFE_PHOTO_PATH.test(src)) {
      throw new TypeError("photo.src must be a safe local author image path.");
    }
    photo = Object.freeze({
      src: src as `/images/authors/${string}`,
      alt: requireText(input.photo, "alt"),
      credit: requireText(input.photo, "credit"),
      rightsBasis: requireText(input.photo, "rightsBasis"),
    });
  }

  let credentials: VerifiedAuthorRecord["credentials"];
  if (input.credentials !== undefined) {
    if (!Array.isArray(input.credentials)) {
      throw new TypeError("credentials must be an array.");
    }
    credentials = Object.freeze(
      input.credentials.map((credential, index) => {
        if (!isPlainObject(credential)) {
          throw new TypeError(`credentials[${index}] must be an object.`);
        }
        requireExactKeys(
          credential,
          ["label", "evidenceUrl"],
          `credentials[${index}]`,
        );
        return Object.freeze({
          label: requireText(credential, "label"),
          evidenceUrl: requireSafeHttpsUrl(
            credential.evidenceUrl,
            `credentials[${index}].evidenceUrl`,
          ),
        });
      }),
    );
    assertNoDuplicates(
      credentials.map(({ evidenceUrl }) => evidenceUrl),
      "credentials",
    );
  }

  let sameAs: VerifiedAuthorRecord["sameAs"];
  if (input.sameAs !== undefined) {
    if (!Array.isArray(input.sameAs)) {
      throw new TypeError("sameAs must be an array.");
    }
    sameAs = Object.freeze(
      input.sameAs.map((url, index) =>
        requireSafeHttpsUrl(url, `sameAs[${index}]`),
      ),
    );
    assertNoDuplicates(sameAs, "sameAs");
  }

  const ownerVerifiedAt = requireRealDate(
    requireText(input, "ownerVerifiedAt"),
    "ownerVerifiedAt",
  );
  const buildDate = requireRealDate(
    options.buildDate ?? publicationDate(),
    "buildDate",
  );
  if (ownerVerifiedAt > buildDate) {
    throw new TypeError("ownerVerifiedAt cannot be later than the build date.");
  }

  return Object.freeze({
    id,
    kind: "person",
    displayName,
    role,
    shortBio,
    profilePath: profilePath as `/authors/${string}/`,
    ...(photo ? { photo } : {}),
    ...(credentials ? { credentials } : {}),
    ...(sameAs ? { sameAs } : {}),
    ownerVerifiedAt,
  });
}

export function createVerifiedAuthorRegistry(
  inputs: readonly unknown[],
  options: ValidationOptions = {},
): Readonly<Record<string, VerifiedAuthorRecord>> {
  const records = inputs.map((input) =>
    validateVerifiedAuthorRecord(input, options),
  );
  assertNoDuplicates(
    records.map(({ id }) => id),
    "Verified authors",
  );
  assertNoDuplicates(
    records.map(({ profilePath }) => profilePath),
    "Verified author profile paths",
  );

  const registry = Object.create(null) as Record<string, VerifiedAuthorRecord>;
  for (const record of records) registry[record.id] = record;
  return Object.freeze(registry);
}

export const verifiedAuthors: Readonly<Record<string, VerifiedAuthorRecord>> =
  createVerifiedAuthorRegistry([]);

export function getVerifiedAuthor(
  id: string,
): VerifiedAuthorRecord | undefined {
  return Object.hasOwn(verifiedAuthors, id) ? verifiedAuthors[id] : undefined;
}
