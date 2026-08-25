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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PHOTO_PATH =
  /^\/images\/authors\/[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?\.(?:avif|jpe?g|png|webp)$/;
const RESERVED_HOST_SUFFIXES = [
  ".invalid",
  ".test",
  ".example",
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
] as const;
const RESERVED_HOSTS = [
  "localhost",
  "example.com",
  "example.org",
  "example.net",
] as const;
const SECRET_QUERY_KEY =
  /^(?:accesskey|accesstoken|apikey|authorization|authorizationcode|auth|clientsecret|code|consumerkey|consumersecret|credential|idtoken|jwt|key|password|passwd|privatekey|refreshtoken|sastoken|secret|session|signature|sig|token|webhooksecret|xamzcredential|xamzsecuritytoken|xamzsignature)$/;
const SENSITIVE_PUBLIC_TEXT_PATTERNS = [
  /\b(?:ca-)?pub-[a-z0-9][a-z0-9_-]{7,}\b/i,
  /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/i,
  /\bgh[pousr]_[a-z0-9]{20,}\b/i,
  /\bAIza[a-z0-9_-]{30,}\b/i,
  /\bBearer\s+[a-z0-9._~+/-]{12,}={0,2}\b/i,
  /\b[a-z0-9_-]{16,}\.[a-z0-9_-]{16,}\.[a-z0-9_-]{16,}\b/i,
  /\bxox[baprs]-[a-z0-9-]{20,}\b/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/,
  /\b(?:access[_-]?token|api[_-]?key|authorization|password|private[_-]?key|secret|token)\s*[:=]\s*["']?[a-z0-9_+/=-]{12,}/i,
] as const;

export const publicationByline = siteConfig.publicationByline;

function normalizeWords(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function containsSensitivePublicText(value: string): boolean {
  if (SENSITIVE_PUBLIC_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
    return true;
  }
  for (const match of value.matchAll(/https:\/\/[^\s<>"]+/g)) {
    try {
      const url = new URL(match[0].replace(/[.,;:!?]+$/, ""));
      if (url.username || url.password) return true;
      if (
        [...url.searchParams.keys()].some((key) =>
          SECRET_QUERY_KEY.test(
            key
              .normalize("NFKC")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, ""),
          ),
        )
      ) {
        return true;
      }
    } catch {
      // URL-shape validation is owned by the field-specific validator.
    }
  }
  return false;
}

const NORMALIZED_PUBLICATION_BYLINE = normalizeWords(publicationByline);
const PLACEHOLDER_PATTERNS = [
  /\b(?:tbd|todo|to be determined|pending (?:verification|approval)|(?:verification|approval) pending|coming soon|placeholder)\b/,
  /^(?:unknown|none|not applicable|n a)(?:\b.*)?$/,
  /^dummy(?:\b.*)?$/,
  /^test(?:$|\s+(?:author|bio|biography|credit|editor|image|name|person|record|role|text|value)(?:\b.*)?$)/,
  /^(?:john|jane) doe(?:\b.*)?$/,
] as const;

function isPlaceholderText(value: string): boolean {
  const normalized = normalizeWords(value);
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function rejectPlaceholderPathSegments(value: string, label: string) {
  for (const lexicalSegment of value.split("/").filter(Boolean)) {
    let segment: string;
    try {
      segment = decodeURIComponent(lexicalSegment).replace(/\.[a-z0-9]+$/i, "");
    } catch {
      throw new TypeError(`${label} must contain valid URL encoding.`);
    }
    if (isPlaceholderText(segment)) {
      throw new TypeError(`${label} cannot contain a placeholder segment.`);
    }
  }
}

function ownDataRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an own-data plain record.`);
  }

  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${label} must be an own-data plain record.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be an own-data plain record.`);
  }
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new TypeError(`${label} has an unexpected symbol field.`);
    }
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label} must contain own-data fields only.`);
    }
  }

  try {
    structuredClone(value);
  } catch {
    throw new TypeError(`${label} must be an own-data plain record.`);
  }
  return value as Record<string, unknown>;
}

function ownArrayValues(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an own-data array.`);
  }

  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as PropertyDescriptorMap;
  } catch {
    throw new TypeError(`${label} must be an own-data array.`);
  }
  if (prototype !== Array.prototype) {
    throw new TypeError(`${label} must be an own-data array.`);
  }

  const expectedKeys = new Set([
    "length",
    ...Array.from({ length: value.length }, (_, index) => String(index)),
  ]);
  if (
    keys.some((key) => typeof key !== "string" || !expectedKeys.has(key)) ||
    expectedKeys.size !== keys.length
  ) {
    throw new TypeError(`${label} must be an own-data array without extras.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError(`${label} must contain own-data items only.`);
    }
  }
  try {
    structuredClone(value);
  } catch {
    throw new TypeError(`${label} must be an own-data array.`);
  }

  return Array.from(
    { length: value.length },
    (_, index) => Object.getOwnPropertyDescriptor(value, String(index))!.value,
  );
}

function ownValue(record: Record<string, unknown>, field: string): unknown {
  return Object.getOwnPropertyDescriptor(record, field)?.value;
}

function requireText(record: Record<string, unknown>, field: string): string {
  const value = ownValue(record, field);
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new TypeError(`${field} must be a non-placeholder, trimmed string.`);
  }
  if (containsControlCharacter(value)) {
    throw new TypeError(`${field} cannot contain control characters.`);
  }
  if (containsSensitivePublicText(value)) {
    throw new TypeError(
      `${field} cannot contain sensitive or credential-like public text.`,
    );
  }
  if (isPlaceholderText(value)) {
    throw new TypeError(`${field} must be a non-placeholder, trimmed string.`);
  }
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  label: string,
) {
  const unexpected = Reflect.ownKeys(value).find(
    (key) => typeof key !== "string" || !allowedKeys.includes(key),
  );
  if (unexpected !== undefined) {
    throw new TypeError(`${label} has an unexpected field.`);
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

function actualUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizedUrlForComparison(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.searchParams.sort();
  return url.href;
}

function requireSafeHttpsUrl(
  value: unknown,
  label: string,
): `https://${string}` {
  if (
    typeof value !== "string" ||
    !value.startsWith("https://") ||
    value.trim() !== value
  ) {
    throw new TypeError(`${label} must be a lexical HTTPS URL.`);
  }
  if (containsControlCharacter(value)) {
    throw new TypeError(`${label} cannot contain control characters.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an HTTPS URL.`);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const labels = hostname.split(".");
  const validDnsName =
    !url.hostname.endsWith(".") &&
    labels.length >= 2 &&
    labels.every(
      (part) =>
        part.length >= 1 &&
        part.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(part),
    ) &&
    /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(labels.at(-1)!);
  const reservedHostname =
    RESERVED_HOSTS.some(
      (reserved) => hostname === reserved || hostname.endsWith(`.${reserved}`),
    ) || RESERVED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  const addressLiteral =
    hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const hasSecretQuery = [...url.searchParams.keys()].some((key) =>
    SECRET_QUERY_KEY.test(normalizeWords(key).replaceAll(" ", "")),
  );
  rejectPlaceholderPathSegments(url.pathname, label);
  if ([...url.searchParams.values()].some(isPlaceholderText)) {
    throw new TypeError(`${label} cannot contain a placeholder query value.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.port ||
    !validDnsName ||
    reservedHostname ||
    addressLiteral ||
    hasSecretQuery
  ) {
    throw new TypeError(`${label} must be a safe public HTTPS URL.`);
  }
  return value as `https://${string}`;
}

function assertNoDuplicates(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new TypeError(`${label} contains a duplicate value.`);
  }
}

function assertNoDuplicateUrls(values: readonly string[], label: string) {
  assertNoDuplicates(values.map(normalizedUrlForComparison), label);
}

export function validateVerifiedAuthorRecord(
  input: unknown,
): VerifiedAuthorRecord {
  const record = ownDataRecord(input, "Verified author");
  requireExactKeys(
    record,
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

  const id = requireText(record, "id");
  if (!SAFE_ID.test(id)) {
    throw new TypeError("id must be a lowercase stable slug.");
  }
  if (ownValue(record, "kind") !== "person") {
    throw new TypeError('kind must be the literal "person".');
  }

  const displayName = requireText(record, "displayName");
  if (
    normalizeWords(id) === NORMALIZED_PUBLICATION_BYLINE ||
    normalizeWords(displayName) === NORMALIZED_PUBLICATION_BYLINE
  ) {
    throw new TypeError(
      "The publication-name byline cannot be registered as a person.",
    );
  }
  const role = requireText(record, "role");
  const shortBio = requireText(record, "shortBio");
  const profilePath = requireText(record, "profilePath");
  if (profilePath !== `/authors/${id}/`) {
    throw new TypeError("profilePath must be the canonical path for the id.");
  }

  let photo: VerifiedAuthorRecord["photo"];
  const photoInput = ownValue(record, "photo");
  if (photoInput !== undefined) {
    const photoRecord = ownDataRecord(photoInput, "photo");
    requireExactKeys(
      photoRecord,
      ["src", "alt", "credit", "rightsBasis"],
      "photo",
    );
    const src = requireText(photoRecord, "src");
    if (!SAFE_PHOTO_PATH.test(src)) {
      throw new TypeError("photo.src must be a safe local author image path.");
    }
    rejectPlaceholderPathSegments(src, "photo.src");
    photo = Object.freeze({
      src: src as `/images/authors/${string}`,
      alt: requireText(photoRecord, "alt"),
      credit: requireText(photoRecord, "credit"),
      rightsBasis: requireText(photoRecord, "rightsBasis"),
    });
  }

  let credentials: VerifiedAuthorRecord["credentials"];
  const credentialInput = ownValue(record, "credentials");
  if (credentialInput !== undefined) {
    const credentialItems = ownArrayValues(credentialInput, "credentials");
    credentials = Object.freeze(
      credentialItems.map((credential, index) => {
        const credentialRecord = ownDataRecord(
          credential,
          `credentials[${index}]`,
        );
        requireExactKeys(
          credentialRecord,
          ["label", "evidenceUrl"],
          `credentials[${index}]`,
        );
        return Object.freeze({
          label: requireText(credentialRecord, "label"),
          evidenceUrl: requireSafeHttpsUrl(
            ownValue(credentialRecord, "evidenceUrl"),
            `credentials[${index}].evidenceUrl`,
          ),
        });
      }),
    );
    assertNoDuplicates(
      credentials.map(({ label }) => normalizeWords(label)),
      "credential labels",
    );
    assertNoDuplicateUrls(
      credentials.map(({ evidenceUrl }) => evidenceUrl),
      "credentials",
    );
  }

  let sameAs: VerifiedAuthorRecord["sameAs"];
  const sameAsInput = ownValue(record, "sameAs");
  if (sameAsInput !== undefined) {
    sameAs = Object.freeze(
      ownArrayValues(sameAsInput, "sameAs").map((url, index) =>
        requireSafeHttpsUrl(url, `sameAs[${index}]`),
      ),
    );
    assertNoDuplicateUrls(sameAs, "sameAs");
  }

  const ownerVerifiedAt = requireRealDate(
    requireText(record, "ownerVerifiedAt"),
    "ownerVerifiedAt",
  );
  if (ownerVerifiedAt > actualUtcDate()) {
    throw new TypeError(
      "ownerVerifiedAt cannot be later than the actual UTC date.",
    );
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
): Readonly<Record<string, VerifiedAuthorRecord>> {
  const records = ownArrayValues(inputs, "Verified authors").map((input) =>
    validateVerifiedAuthorRecord(input),
  );
  assertNoDuplicates(
    records.map(({ id }) => id),
    "Verified authors",
  );
  assertNoDuplicates(
    records.map(({ displayName }) => normalizeWords(displayName)),
    "Verified author display names",
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
