const RESERVED_HOST_SUFFIXES = [
  ".invalid",
  ".test",
  ".example",
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".onion",
];

const RESERVED_HOSTS = [
  "localhost",
  "example.com",
  "example.org",
  "example.net",
];

const SECRET_QUERY_KEY =
  /^(?:accesskey|accesstoken|apikey|authorization|authorizationcode|auth|clientsecret|code|consumerkey|consumersecret|credential|idtoken|jwt|key|password|passwd|privatekey|refreshtoken|sastoken|secret|session|signature|sig|token|webhooksecret|xamzcredential|xamzsecuritytoken|xamzsignature)$/;

function containsControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function normalizedQueryKey(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Returns a non-sensitive reason when a value is not suitable for a URL that
 * will be rendered publicly as evidence, otherwise returns null.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function publicEvidenceUrlIssue(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("https://") ||
    value.trim() !== value
  ) {
    return "it must be a trimmed lexical HTTPS URL";
  }
  if (containsControlCharacter(value)) {
    return "it cannot contain control characters";
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return "it must be a valid HTTPS URL";
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
    /^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(labels.at(-1));
  const reservedHostname =
    RESERVED_HOSTS.some(
      (reserved) => hostname === reserved || hostname.endsWith(`.${reserved}`),
    ) || RESERVED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  const addressLiteral =
    hostname.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const hasSecretQuery = [...url.searchParams.keys()].some((key) =>
    SECRET_QUERY_KEY.test(normalizedQueryKey(key)),
  );

  if (url.username || url.password) {
    return "credentials are not allowed";
  }
  if (hasSecretQuery) {
    return "secret-like query keys are not allowed";
  }
  if (!validDnsName || reservedHostname || addressLiteral) {
    return "the host must be a public DNS name";
  }
  if (url.protocol !== "https:" || url.port || url.hash) {
    return "ports and fragments are not allowed on the public HTTPS URL";
  }

  return null;
}

/** @param {unknown} value */
export function isPublicEvidenceUrl(value) {
  return publicEvidenceUrlIssue(value) === null;
}
