import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { load as loadYaml } from "js-yaml";
import sharp from "sharp";

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

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
const fontData = readFileSync(
  path.join(
    repositoryRoot,
    "public",
    "fonts",
    "source-sans-3-variable-english.woff2",
  ),
).toString("base64");

const categoryRecords = [
  {
    accent: "#6d28d9",
    name: "AI & Automation",
    slug: "ai-automation",
  },
  {
    accent: "#4338ca",
    name: "Business Software & SaaS",
    slug: "business-software",
  },
  {
    accent: "#a21caf",
    name: "Cybersecurity & Data Protection",
    slug: "cybersecurity-data-protection",
  },
  {
    accent: "#5b21b6",
    name: "Digital Operations & Productivity",
    slug: "digital-operations",
  },
  {
    accent: "#be185d",
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
      accent: "#7c3aed",
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

function wrapText(value, lineLength, maximumLines) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= lineLength || current === "") {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  if (lines.length <= maximumLines) return lines;

  const visible = lines.slice(0, maximumLines);
  visible[maximumLines - 1] =
    `${visible[maximumLines - 1].replace(/[.\s]+$/, "")}…`;
  return visible;
}

function visualGeometry(visualKey, accent) {
  const bytes = createHash("sha256").update(visualKey).digest();
  const points = Array.from({ length: 5 }, (_unused, index) => ({
    x: 785 + ((bytes[index] * 13) % 305),
    y: 150 + ((bytes[index + 5] * 11) % 330),
  }));
  const pathData = points
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  return `<g data-visual-key="${escapeXml(visualKey)}">
    <rect x="750" y="102" width="372" height="426" rx="28" fill="#24143d" stroke="#756884" stroke-width="3"/>
    <path d="${pathData}" fill="none" stroke="${escapeXml(accent)}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    ${points
      .map(
        ({ x, y }, index) =>
          `<circle cx="${x}" cy="${y}" r="${18 + (bytes[index + 10] % 13)}" fill="${index % 2 === 0 ? escapeXml(accent) : "#faf8ff"}" stroke="#c4b5fd" stroke-width="3"/>`,
      )
      .join("\n    ")}
  </g>`;
}

export function renderSocialSvg(record) {
  const titleLines = wrapText(record.title, 20, 4);
  const titleSize = titleLines.length > 3 ? 52 : 60;
  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<tspan x="78" dy="${index === 0 ? 0 : 68}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" viewBox="0 0 ${SOCIAL_IMAGE_WIDTH} ${SOCIAL_IMAGE_HEIGHT}">
  <style>
    @font-face { font-family: "ETI Source"; src: url("data:font/woff2;base64,${fontData}") format("woff2"); font-weight: 200 900; }
    text { font-family: "ETI Source"; }
  </style>
  <defs>
    <linearGradient id="signal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7c3aed"/>
      <stop offset="1" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0d0618"/>
  <rect width="18" height="630" fill="url(#signal)"/>
  <path d="M78 84 H690" stroke="#3a2e51" stroke-width="3"/>
  <text x="78" y="62" fill="#faf8ff" font-size="27" font-weight="750" letter-spacing="1.4">EVERYDAY TECH INSIGHT</text>
  <text x="78" y="150" fill="#c4b5fd" font-size="25" font-weight="720" letter-spacing="1">${escapeXml(record.categoryName)}</text>
  <text x="78" y="232" fill="#faf8ff" font-size="${titleSize}" font-weight="730">${titleMarkup}</text>
  <text x="78" y="564" fill="#c9c3d8" font-size="23">Practical guidance for small-business technology decisions</text>
  ${visualGeometry(record.visualKey, record.accent)}
</svg>`;
}

function renderAppleIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs><linearGradient id="signal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#d946ef"/></linearGradient></defs>
  <rect width="180" height="180" rx="32" fill="#0d0618"/>
  <rect x="18" y="18" width="144" height="144" rx="18" fill="none" stroke="#756884" stroke-width="8"/>
  <rect x="18" y="18" width="18" height="144" rx="8" fill="url(#signal)"/>
  <text x="58" y="108" fill="#faf8ff" font-family="sans-serif" font-size="48" font-weight="800" letter-spacing="2">ETI</text>
</svg>`;
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
  assertNoSymbolicLinkInPath(resolvedOutputRoot);
  assertNoSymbolicLinkInPath(resolvedSocialDir);
  assertNoSymbolicLinkInPath(resolvedAppleIconPath);
  assertNoSymbolicLinksBelow(resolvedOutputRoot);

  return { resolvedAppleIconPath, resolvedSocialDir };
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
  const { resolvedAppleIconPath, resolvedSocialDir } =
    safeOutputTargets(outputRoot);
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

  return {
    appleIconPath: resolvedAppleIconPath,
    socialImagePaths: outputRecords.map(({ outputPath }) => outputPath),
  };
}

async function main() {
  const result = await generateSocialImages();
  console.log(
    `Generated ${result.socialImagePaths.length} social images and one Apple touch icon.`,
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
