import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  SOCIAL_IMAGE_MANIFEST_PATH,
  createSocialImageSourceManifest,
} from "./generate-social-images.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultPublicRoot = path.join(repositoryRoot, "public");
const FULL_SHA256_PATTERN = /^[a-f\d]{64}$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_IEND = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertNoSymbolicLinkInPath(candidate, label) {
  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const segment of resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, segment);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic link: ${current}`);
    }
  }
}

function requireRegularFile(filePath, label, containmentRoot) {
  assertNoSymbolicLinkInPath(filePath, label);
  let stats;
  try {
    stats = lstatSync(filePath);
  } catch (cause) {
    throw new Error(`Missing committed ${label}: ${filePath}`, { cause });
  }
  if (!stats.isFile()) {
    throw new Error(`Committed ${label} must be a regular file: ${filePath}`);
  }
  const canonicalRoot = realpathSync(containmentRoot);
  const canonicalFile = realpathSync(filePath);
  const relative = path.relative(canonicalRoot, canonicalFile);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Committed ${label} escapes its expected root.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expected)) {
    throw new Error(`${label} has an invalid schema.`);
  }
}

function readCommittedManifest(manifestPath) {
  requireRegularFile(
    manifestPath,
    "social image manifest",
    path.dirname(manifestPath),
  );
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (cause) {
    throw new Error("The committed social image manifest is not valid JSON.", {
      cause,
    });
  }
  assertExactKeys(
    manifest,
    [
      "assets",
      "generatorSourceSha256",
      "rasterRecipe",
      "schemaVersion",
      "sharpVersion",
    ],
    "Social image manifest",
  );
  if (!Array.isArray(manifest.assets)) {
    throw new Error("Social image manifest assets must be an array.");
  }
  for (const [index, asset] of manifest.assets.entries()) {
    assertExactKeys(
      asset,
      ["height", "kind", "path", "pngSha256", "sourceSha256", "width"],
      `Social image manifest asset ${index}`,
    );
    if (!FULL_SHA256_PATTERN.test(asset.pngSha256)) {
      throw new Error(
        `Social image manifest asset ${index} has an invalid PNG SHA-256.`,
      );
    }
  }
  return manifest;
}

function sourceOnlyManifest(manifest) {
  return {
    assets: manifest.assets.map(
      ({ height, kind, path: assetPath, sourceSha256, width }) => ({
        height,
        kind,
        path: assetPath,
        sourceSha256,
        width,
      }),
    ),
    generatorSourceSha256: manifest.generatorSourceSha256,
    rasterRecipe: manifest.rasterRecipe,
    schemaVersion: manifest.schemaVersion,
    sharpVersion: manifest.sharpVersion,
  };
}

function resolveAssetPath(publicRoot, assetPath) {
  if (
    typeof assetPath !== "string" ||
    assetPath.startsWith("/") ||
    assetPath.includes("\\")
  ) {
    throw new Error(
      `Invalid committed social asset path: ${String(assetPath)}`,
    );
  }
  const resolvedRoot = path.resolve(publicRoot);
  const resolvedAsset = path.resolve(resolvedRoot, ...assetPath.split("/"));
  const relative = path.relative(resolvedRoot, resolvedAsset);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Committed social asset escapes public/: ${assetPath}`);
  }
  return resolvedAsset;
}

function assertExactSocialInventory(publicRoot, expectedAssets) {
  const socialDirectory = path.join(publicRoot, "social");
  assertNoSymbolicLinkInPath(socialDirectory, "Social image directory");
  let entries;
  try {
    entries = readdirSync(socialDirectory, { withFileTypes: true });
  } catch (cause) {
    throw new Error("Missing committed social image directory.", { cause });
  }
  const actualNames = entries.map((entry) => entry.name).sort();
  const expectedNames = expectedAssets
    .filter(({ path: assetPath }) => assetPath.startsWith("social/"))
    .map(({ path: assetPath }) => assetPath.slice("social/".length))
    .sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `Committed social image inventory differs from the manifest; expected ${JSON.stringify(expectedNames)}, received ${JSON.stringify(actualNames)}. Run npm run generate:social.`,
    );
  }
  for (const entry of entries) {
    if (!entry.isFile()) {
      throw new Error(
        `Committed social image inventory contains a non-regular entry: ${entry.name}`,
      );
    }
  }
}

async function validatePngAsset(publicRoot, asset) {
  const assetPath = resolveAssetPath(publicRoot, asset.path);
  requireRegularFile(assetPath, "social PNG", publicRoot);
  const bytes = readFileSync(assetPath);
  if (
    bytes.length < PNG_SIGNATURE.length + PNG_IEND.length ||
    !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    !bytes.subarray(-PNG_IEND.length).equals(PNG_IEND)
  ) {
    throw new Error(
      `Committed social asset is not a complete PNG: ${asset.path}`,
    );
  }
  if (sha256(bytes) !== asset.pngSha256) {
    throw new Error(
      `Committed social asset bytes do not match the manifest SHA-256: ${asset.path}`,
    );
  }
  let metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch (cause) {
    throw new Error(`Unable to decode committed social PNG: ${asset.path}`, {
      cause,
    });
  }
  if (
    metadata.format !== "png" ||
    metadata.width !== asset.width ||
    metadata.height !== asset.height
  ) {
    throw new Error(
      `Committed social PNG dimensions must be ${asset.width}x${asset.height}: ${asset.path}`,
    );
  }
}

export async function validateCommittedSocialImages({
  manifestPath = SOCIAL_IMAGE_MANIFEST_PATH,
  publicRoot = defaultPublicRoot,
} = {}) {
  const resolvedPublicRoot = path.resolve(publicRoot);
  const resolvedManifestPath = path.resolve(manifestPath);
  assertNoSymbolicLinkInPath(resolvedPublicRoot, "Public asset root");
  const manifest = readCommittedManifest(resolvedManifestPath);
  const expectedSourceManifest = createSocialImageSourceManifest();
  if (
    JSON.stringify(sourceOnlyManifest(manifest)) !==
    JSON.stringify(expectedSourceManifest)
  ) {
    throw new Error(
      "Committed social image source manifest is stale. Run npm run generate:social and review the resulting PNGs.",
    );
  }
  assertExactSocialInventory(resolvedPublicRoot, manifest.assets);
  for (const asset of manifest.assets) {
    await validatePngAsset(resolvedPublicRoot, asset);
  }
  const socialImages = manifest.assets.filter(({ path: assetPath }) =>
    assetPath.startsWith("social/"),
  ).length;
  const appleTouchIcons = manifest.assets.filter(
    ({ path: assetPath }) => assetPath === "apple-touch-icon.png",
  ).length;
  if (appleTouchIcons !== 1) {
    throw new Error(
      "The social image manifest must contain one Apple touch icon.",
    );
  }
  return {
    appleTouchIcons,
    socialImages,
    totalAssets: manifest.assets.length,
  };
}

async function main() {
  const result = await validateCommittedSocialImages();
  console.log(
    `Social image QA: PASS (${result.socialImages} social images; ${result.appleTouchIcons} Apple touch icon; immutable manifest/source parity verified).`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
