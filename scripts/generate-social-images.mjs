import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { load as loadYaml } from "js-yaml";
import { create as createFont } from "fontkitten";
import sharp from "sharp";

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_MANIFEST_SCHEMA_VERSION = 1;

const SOCIAL_IMAGE_RASTER_RECIPE = Object.freeze({
  adaptiveFiltering: false,
  compressionLevel: 9,
  fit: "fill",
  format: "png",
  palette: false,
});

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const articleDirectory = path.join(
  repositoryRoot,
  "src",
  "content",
  "articles",
);
const defaultOutputRoot = path.join(repositoryRoot, "public");
export const SOCIAL_IMAGE_MANIFEST_PATH = path.join(
  repositoryRoot,
  "scripts",
  "social-images.manifest.json",
);
const fontData = readFileSync(
  path.join(
    repositoryRoot,
    "scripts",
    "assets",
    "fonts",
    "source-sans-3-variable-english.ttf",
  ),
);
const sourceFont = createFont(fontData);
const fontSourceSha256 = createHash("sha256").update(fontData).digest("hex");
const fontWeights = new Map();

function fontAtWeight(weight) {
  if (!fontWeights.has(weight)) {
    fontWeights.set(weight, sourceFont.getVariation({ wght: weight }));
  }
  return fontWeights.get(weight);
}

function glyphsForText(text, font) {
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0);
    // The local English subset omits nonbreaking hyphen; its visible glyph
    // is identical to the bundled hyphen while the accessible text stays exact.
    const glyphCodePoint = codePoint === 0x2011 ? 0x2d : codePoint;
    if (!font.hasGlyphForCodePoint(glyphCodePoint)) {
      throw new Error(
        `The bundled social font has no glyph for U+${codePoint.toString(16).toUpperCase()}.`,
      );
    }
    return font.glyphForCodePoint(glyphCodePoint);
  });
}

function textMetrics(text, fontSize, weight, letterSpacing = 0) {
  const font = fontAtWeight(weight);
  const scale = fontSize / font.unitsPerEm;
  let advance = 0;
  let inkLeft = 0;
  let inkRight = 0;
  const glyphs = glyphsForText(text, font).map((glyph) => {
    const position = advance;
    if (Number.isFinite(glyph.bbox.minX)) {
      inkLeft = Math.min(inkLeft, position + glyph.bbox.minX * scale);
      inkRight = Math.max(inkRight, position + glyph.bbox.maxX * scale);
    }
    advance += glyph.advanceWidth * scale + letterSpacing;
    return { glyph, position };
  });
  return {
    glyphs,
    inkLeft,
    inkRight: inkRight - inkLeft,
    scale,
    width: Math.max(inkRight, advance - letterSpacing) - inkLeft,
  };
}

function outlinedText(
  text,
  { x, y, fontSize, weight, fill, letterSpacing = 0, headline = false },
) {
  const metrics = textMetrics(text, fontSize, weight, letterSpacing);
  const paths = metrics.glyphs
    .map(
      ({ glyph, position }) =>
        `<path transform="translate(${x + position - metrics.inkLeft} ${y}) scale(${metrics.scale} ${-metrics.scale})" d="${glyph.path.toSVG()}"/>`,
    )
    .join("");
  return `<g data-glyph-font="Source Sans 3" data-font-weight="${weight}"${headline ? ' data-headline-line="true"' : ""} data-line-width="${metrics.width}" data-ink-left="${x}" data-ink-right="${x + metrics.inkRight}" aria-label="${escapeXml(text)}" fill="${escapeXml(fill)}">${paths}</g>`;
}

const categoryRecords = [
  {
    accent: "#6e3cbc",
    name: "AI & Automation",
    slug: "ai-automation",
  },
  {
    accent: "#0066cc",
    name: "Business Software & SaaS",
    slug: "business-software",
  },
  {
    accent: "#216e4e",
    name: "Cybersecurity & Data Protection",
    slug: "cybersecurity-data-protection",
  },
  {
    accent: "#9a4a00",
    name: "Digital Operations & Productivity",
    slug: "digital-operations",
  },
  {
    accent: "#4141a5",
    name: "Technology Decisions & Strategy",
    slug: "technology-strategy",
  },
];

const canonicalSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertCanonicalSlug(value, kind) {
  if (typeof value !== "string" || !canonicalSlugPattern.test(value)) {
    throw new Error(
      `Expected a canonical ${kind} slug using lowercase letters, numbers, and single hyphens; received ${JSON.stringify(value)}.`,
    );
  }
}

for (const category of categoryRecords) {
  assertCanonicalSlug(category.slug, "category");
}

const categoryBySlug = new Map(
  categoryRecords.map((category) => [category.slug, category]),
);

export function listArticleSourceFiles(directory, relativeDirectory = "") {
  const files = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...listArticleSourceFiles(absolutePath, relativePath));
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push({ absolutePath, relativePath });
    }
  }
  return files;
}

function loadPublishedArticleRecords() {
  const records = listArticleSourceFiles(articleDirectory).map(
    ({ absolutePath, relativePath }) => {
      const source = readFileSync(absolutePath, "utf8");
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatter) {
        throw new Error(`Missing YAML frontmatter in ${relativePath}.`);
      }
      const data = loadYaml(frontmatter[1]);
      if (!data || typeof data !== "object") {
        throw new Error(`Invalid YAML frontmatter in ${relativePath}.`);
      }
      return data;
    },
  );

  return selectPublishedArticleFrontmatter(records).map(
    ({ category, slug, title, visual }) => {
      const categoryRecord = categoryBySlug.get(category);
      if (
        !categoryRecord ||
        typeof slug !== "string" ||
        typeof title !== "string" ||
        !visual ||
        typeof visual !== "object" ||
        typeof visual.key !== "string"
      ) {
        throw new Error(`Invalid social metadata for article ${String(slug)}.`);
      }
      assertCanonicalSlug(slug, "article");
      return {
        accent: categoryRecord.accent,
        alt: `Social preview for “${title}” in ${categoryRecord.name}.`,
        categoryName: categoryRecord.name,
        fileName: `article-${slug}.png`,
        kind: "article",
        title,
        visualKey: visual.key,
      };
    },
  );
}

export function selectPublishedArticleFrontmatter(records) {
  return records.filter((record) => record?.status === "published");
}

export const SOCIAL_IMAGE_RECORDS = Object.freeze(
  [
    {
      accent: "#0066cc",
      alt: "Everyday Tech Insight practical business technology guidance.",
      categoryName: "Practical business technology",
      fileName: "default.png",
      kind: "default",
      title: "Everyday Tech Insight",
      visualKey: "publication-default",
    },
    ...categoryRecords.map((category) => ({
      accent: category.accent,
      alt: `Social preview for the ${category.name} topic.`,
      categoryName: "Topic guide",
      fileName: `category-${category.slug}.png`,
      kind: "category",
      title: category.name,
      visualKey: `category-${category.slug}`,
    })),
    ...loadPublishedArticleRecords(),
  ].sort((left, right) => left.fileName.localeCompare(right.fileName)),
);

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, maximumWidth, fontSize) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (
      textMetrics(candidate, fontSize, 700, -1.4).width <= maximumWidth ||
      current === ""
    ) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

export function layoutSocialHeadline(title) {
  const width = 744;
  for (const fontSize of [64, 60, 56, 52, 48, 44, 40]) {
    const lines = wrapText(title, width, fontSize).map((text) => {
      const metrics = textMetrics(text, fontSize, 700, -1.4);
      return {
        text,
        width: metrics.width,
        inkLeft: 0,
        inkRight: metrics.inkRight,
      };
    });
    if (lines.length <= 4 && lines.every((line) => line.width <= width)) {
      return { fontSize, lineHeight: 66, lines, width, x: 72, y: 259 };
    }
  }
  throw new Error(
    "Social headline cannot fit completely inside its four-line copy column.",
  );
}

function visualGeometry(visualKey, accent) {
  const bytes = createHash("sha256").update(visualKey).digest();
  return `<g data-visual-key="${escapeXml(visualKey)}">
    <rect x="872" y="156" width="256" height="316" rx="24" fill="#f5f5f7"/>
    <rect x="904" y="190" width="192" height="248" rx="16" fill="#ffffff" stroke="#d2d2d7" stroke-width="2"/>
    <path d="M930 229H1070" stroke="#d2d2d7" stroke-width="2"/>
    ${Array.from({ length: 3 }, (_unused, index) => ({
      y: 270 + index * 56,
      lineWidth: 65 + (bytes[index] % 39),
    }))
      .map(
        ({ y, lineWidth }) =>
          `<circle cx="937" cy="${y}" r="9" fill="${escapeXml(accent)}"/>
    <path d="M964 ${y}H${964 + lineWidth}" stroke="#86868b" stroke-width="3" stroke-linecap="round"/>`,
      )
      .join("\n    ")}
  </g>`;
}

export function renderSocialSvg(record) {
  const headline = layoutSocialHeadline(record.title);
  const titleMarkup = headline.lines
    .map(({ text }, index) =>
      outlinedText(text, {
        x: headline.x,
        y: headline.y + index * headline.lineHeight,
        fontSize: headline.fontSize,
        weight: 700,
        fill: "#1d1d1f",
        letterSpacing: -1.4,
        headline: true,
      }),
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" viewBox="0 0 ${SOCIAL_IMAGE_WIDTH} ${SOCIAL_IMAGE_HEIGHT}" role="img" aria-labelledby="social-title social-description" data-font-sha256="${fontSourceSha256}">
  <title id="social-title">${escapeXml(record.title)}</title>
  <desc id="social-description">${escapeXml(record.alt)}</desc>
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="72" y="58" width="40" height="40" rx="11" fill="#0066cc"/>
  <path transform="translate(72 58) scale(.625)" d="M12 22H25V26H16V30H24V34H16V38H25V42H12ZM28 22H44V26H38V42H34V26H28ZM48 22H52V42H48Z" fill="#ffffff"/>
  ${outlinedText("Everyday Tech Insight", { x: 128, y: 86, fill: "#1d1d1f", fontSize: 29, weight: 650, letterSpacing: -0.5 })}
  ${outlinedText(record.categoryName, { x: 72, y: 177, fill: record.accent, fontSize: 25, weight: 650 })}
  ${titleMarkup}
  <path d="M72 532H1128" stroke="#d2d2d7" stroke-width="1"/>
  ${outlinedText("Practical guidance. Clearer technology decisions.", { x: 72, y: 578, fill: "#515154", fontSize: 23, weight: 400 })}
  ${visualGeometry(record.visualKey, record.accent)}
</svg>`;
}

function renderAppleIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="44" fill="#0066cc"/>
  <path d="M34 62H71V73H46V85H68V96H46V107H71V118H34ZM79 62H124V73H107V118H96V73H79ZM135 62H147V118H135Z" fill="#ffffff"/>
</svg>`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedGeneratorSourceSha256() {
  const source = readFileSync(fileURLToPath(import.meta.url), "utf8").replace(
    /\r\n?/g,
    "\n",
  );
  return sha256(source);
}

function requireSharpVersion() {
  const version = sharp.versions?.sharp;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("Unable to resolve the pinned Sharp version.");
  }
  return version;
}

function sourceAssetRecord({
  assetPath,
  generatorSourceSha256,
  height,
  kind,
  sharpVersion,
  svg,
  width,
}) {
  const sourceSha256 = sha256(
    JSON.stringify({
      assetPath,
      generatorSourceSha256,
      height,
      kind,
      rasterRecipe: SOCIAL_IMAGE_RASTER_RECIPE,
      sharpVersion,
      svgSha256: sha256(Buffer.from(svg)),
      width,
    }),
  );
  return {
    height,
    kind,
    path: assetPath,
    sourceSha256,
    width,
  };
}

export function createSocialImageSourceManifest() {
  const generatorSourceSha256 = normalizedGeneratorSourceSha256();
  const sharpVersion = requireSharpVersion();
  const assets = [
    sourceAssetRecord({
      assetPath: "apple-touch-icon.png",
      generatorSourceSha256,
      height: 180,
      kind: "apple-touch-icon",
      sharpVersion,
      svg: renderAppleIconSvg(),
      width: 180,
    }),
    ...SOCIAL_IMAGE_RECORDS.map((record) =>
      sourceAssetRecord({
        assetPath: `social/${record.fileName}`,
        generatorSourceSha256,
        height: SOCIAL_IMAGE_HEIGHT,
        kind: record.kind,
        sharpVersion,
        svg: renderSocialSvg(record),
        width: SOCIAL_IMAGE_WIDTH,
      }),
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));

  return {
    assets,
    generatorSourceSha256,
    rasterRecipe: { ...SOCIAL_IMAGE_RASTER_RECIPE },
    schemaVersion: SOCIAL_IMAGE_MANIFEST_SCHEMA_VERSION,
    sharpVersion,
  };
}

async function writePng(svg, outputPath, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
    .toFile(outputPath);
}

function existingPathIsSymbolicLink(candidate) {
  try {
    return lstatSync(candidate).isSymbolicLink();
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function assertNoSymbolicLinkInPath(candidate) {
  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  const segments = resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean);

  for (const segment of segments) {
    current = path.join(current, segment);
    if (existingPathIsSymbolicLink(current)) {
      throw new Error(
        `Refusing to use a symbolic link in the social image output path: ${current}`,
      );
    }
  }
}

function assertNoSymbolicLinksBelow(candidate) {
  let entries;
  try {
    entries = readdirSync(candidate, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(candidate, entry.name);
    const stats = lstatSync(entryPath);
    if (stats.isSymbolicLink()) {
      throw new Error(
        `Refusing to generate social images while a symbolic link exists below the output root: ${entryPath}`,
      );
    }
    if (stats.isDirectory()) {
      assertNoSymbolicLinksBelow(entryPath);
    }
  }
}

function safeOutputTargets(outputRoot) {
  const resolvedOutputRoot = path.resolve(outputRoot);
  const filesystemRoot = path.parse(resolvedOutputRoot).root;
  const resolvedTemporaryRoot = path.resolve(tmpdir());
  const temporaryRelative = path.relative(
    resolvedTemporaryRoot,
    resolvedOutputRoot,
  );
  const isOwnedTemporaryRoot =
    temporaryRelative !== "" &&
    temporaryRelative !== ".." &&
    !temporaryRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(temporaryRelative) &&
    path.basename(resolvedOutputRoot).startsWith("eti-social-");
  const isProductionRoot = resolvedOutputRoot === defaultOutputRoot;

  if (
    resolvedOutputRoot === filesystemRoot ||
    resolvedOutputRoot === repositoryRoot ||
    (!isProductionRoot && !isOwnedTemporaryRoot)
  ) {
    throw new Error(
      "The social image output root must be the repository public directory or an explicit owned ETI temporary root.",
    );
  }

  const resolvedSocialDir = path.join(resolvedOutputRoot, "social");
  const resolvedAppleIconPath = path.join(
    resolvedOutputRoot,
    "apple-touch-icon.png",
  );
  const resolvedManifestPath = isProductionRoot
    ? SOCIAL_IMAGE_MANIFEST_PATH
    : path.join(resolvedOutputRoot, "social-images.manifest.json");
  assertNoSymbolicLinkInPath(resolvedOutputRoot);
  assertNoSymbolicLinkInPath(resolvedSocialDir);
  assertNoSymbolicLinkInPath(resolvedAppleIconPath);
  assertNoSymbolicLinkInPath(resolvedManifestPath);
  assertNoSymbolicLinksBelow(resolvedOutputRoot);

  return {
    resolvedAppleIconPath,
    resolvedManifestPath,
    resolvedOutputRoot,
    resolvedSocialDir,
  };
}

function resolveDirectChild(parentDirectory, fileName) {
  if (
    typeof fileName !== "string" ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    throw new Error(
      `The social image output key must resolve to a direct child of the social directory: ${String(fileName)}`,
    );
  }
  const resolvedParent = path.resolve(parentDirectory);
  const resolvedCandidate = path.resolve(resolvedParent, fileName);
  if (
    path.dirname(resolvedCandidate) !== resolvedParent ||
    path.basename(resolvedCandidate) !== fileName
  ) {
    throw new Error(
      `The social image output key must resolve to a direct child of the social directory: ${String(fileName)}`,
    );
  }
  return resolvedCandidate;
}

export async function generateSocialImages({
  outputRoot = defaultOutputRoot,
} = {}) {
  const {
    resolvedAppleIconPath,
    resolvedManifestPath,
    resolvedOutputRoot,
    resolvedSocialDir,
  } = safeOutputTargets(outputRoot);
  const outputRecords = SOCIAL_IMAGE_RECORDS.map((record) => ({
    outputPath: resolveDirectChild(resolvedSocialDir, record.fileName),
    record,
  }));
  mkdirSync(resolvedSocialDir, { recursive: true });
  mkdirSync(path.dirname(resolvedAppleIconPath), { recursive: true });

  const expectedNames = new Set(
    outputRecords.map(({ outputPath }) => path.basename(outputPath)),
  );
  for (const entry of readdirSync(resolvedSocialDir, { withFileTypes: true })) {
    const entryPath = path.join(resolvedSocialDir, entry.name);
    if (!lstatSync(entryPath).isFile()) {
      throw new Error(
        `Refusing a non-regular entry in the social image output directory: ${entryPath}`,
      );
    }
    if (!expectedNames.has(entry.name)) {
      unlinkSync(entryPath);
    }
  }

  for (const { outputPath, record } of outputRecords) {
    assertNoSymbolicLinkInPath(outputPath);
    await writePng(
      renderSocialSvg(record),
      outputPath,
      SOCIAL_IMAGE_WIDTH,
      SOCIAL_IMAGE_HEIGHT,
    );
  }
  assertNoSymbolicLinkInPath(resolvedAppleIconPath);
  await writePng(renderAppleIconSvg(), resolvedAppleIconPath, 180, 180);

  const sourceManifest = createSocialImageSourceManifest();
  const manifest = {
    ...sourceManifest,
    assets: sourceManifest.assets.map((asset) => {
      const outputPath = path.join(
        resolvedOutputRoot,
        ...asset.path.split("/"),
      );
      return {
        ...asset,
        pngSha256: sha256(readFileSync(outputPath)),
      };
    }),
  };
  assertNoSymbolicLinkInPath(resolvedManifestPath);
  writeFileSync(
    resolvedManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    appleIconPath: resolvedAppleIconPath,
    manifestPath: resolvedManifestPath,
    socialImagePaths: outputRecords.map(({ outputPath }) => outputPath),
  };
}

async function main() {
  const result = await generateSocialImages();
  console.log(
    `Generated ${result.socialImagePaths.length} social images, one Apple touch icon, and the immutable source manifest.`,
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
