const PUBLIC_SAFETY_PATTERNS = [
  ["publisher identifier", /\b(?:ca-)?pub-[a-z0-9][a-z0-9_-]{7,}\b/gi],
  [
    "email address",
    /\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi,
  ],
  ["GitHub token", /\bgh[pousr]_[a-z0-9]{20,}\b/gi],
  ["Google API token", /\bAIza[a-z0-9_-]{30,}\b/gi],
  ["Bearer credential", /\bBearer\s+[a-z0-9._~+/-]{12,}={0,2}\b/gi],
  ["JWT credential", /\b[a-z0-9_-]{16,}\.[a-z0-9_-]{16,}\.[a-z0-9_-]{16,}\b/gi],
  ["Slack token", /\bxox[baprs]-[a-z0-9-]{20,}\b/gi],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["private key material", /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g],
  [
    "assigned credential",
    /\b(?:access[_-]?token|api[_-]?key|authorization|password|private[_-]?key|secret|token)\s*[:=]\s*["']?[a-z0-9_+/=-]{12,}/gi,
  ],
];

const SECRET_QUERY_KEY =
  /^(?:accesskey|accesstoken|apikey|authorization|authorizationcode|auth|clientsecret|code|consumerkey|consumersecret|credential|idtoken|jwt|key|password|passwd|privatekey|refreshtoken|sastoken|secret|session|signature|sig|token|webhooksecret|xamzcredential|xamzsecuritytoken|xamzsignature)$/;

export function isSecretLikeQueryKey(value) {
  return (
    typeof value === "string" &&
    SECRET_QUERY_KEY.test(
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
    )
  );
}

export function findPublicSafetyIssues(text, label = "text") {
  if (typeof text !== "string") {
    return [{ label, kind: "invalid input", value: "non-string" }];
  }

  const issues = [];
  for (const [kind, pattern] of PUBLIC_SAFETY_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) issues.push({ label, kind, value: match[0] });
  }

  for (const match of text.matchAll(/https:\/\/[^\s<>"'`\])}]+/g)) {
    const lexical = match[0].replace(/[.,;:!?]+$/, "");
    try {
      const url = new URL(lexical);
      if (url.username || url.password) {
        issues.push({
          label,
          kind: "credential-bearing URL",
          value: `${url.protocol}//…@${url.host}${url.pathname}`,
        });
      }
      const unsafeKey = [...url.searchParams.keys()].find(isSecretLikeQueryKey);
      if (unsafeKey) {
        issues.push({
          label,
          kind: "secret-bearing URL",
          value: `${url.origin}${url.pathname}?${unsafeKey}=…`,
        });
      }
    } catch {
      // Field-specific validators own malformed URL handling.
    }
  }

  return issues;
}
