import { z } from "zod";

export const monetizationConfigSchema = z.strictObject({
  mode: z.literal("off"),
});

const disabledIntegrationSchema = z.strictObject({
  enabled: z.literal(false),
  provider: z.null(),
});

export const integrationsConfigSchema = z.strictObject({
  monetization: monetizationConfigSchema,
  analytics: disabledIntegrationSchema,
  consentManagementPlatform: disabledIntegrationSchema,
});

export type MonetizationConfig = z.infer<typeof monetizationConfigSchema>;
export type IntegrationsConfig = z.infer<typeof integrationsConfigSchema>;

export type IntegrationPublicCopy = Readonly<{
  approvalBoundary: string;
  disclosureState: string;
  privacyState: string;
}>;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function validationDetails(error: z.ZodError): string {
  return error.issues
    .map(({ message, path }) => `${path.join(".") || "config"}: ${message}`)
    .join("; ");
}

export function defineMonetizationConfig(input: unknown): MonetizationConfig {
  const result = monetizationConfigSchema.safeParse(input);
  if (!result.success) {
    throw new TypeError(
      `Invalid monetization configuration: ${validationDetails(result.error)}`,
    );
  }
  return deepFreeze(result.data) as MonetizationConfig;
}

export function defineIntegrationsConfig(input: unknown): IntegrationsConfig {
  const result = integrationsConfigSchema.safeParse(input);
  if (!result.success) {
    throw new TypeError(
      `Invalid integration configuration: ${validationDetails(result.error)}`,
    );
  }
  return deepFreeze(result.data) as IntegrationsConfig;
}

export function integrationPublicCopy(
  integrations: IntegrationsConfig,
): IntegrationPublicCopy {
  defineIntegrationsConfig(integrations);
  return Object.freeze({
    approvalBoundary:
      "Google alone decides AdSense approval. This website does not claim to have been approved.",
    disclosureState:
      "Display advertising is disabled. This website does not load advertising services or show ad units.",
    privacyState:
      "This website's own code does not load analytics or advertising services.",
  });
}
