import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
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
const defaultSocialDirectory = path.join(repositoryRoot, "public", "social");
const defaultAppleIconPath = path.join(
  repositoryRoot,
  "public",
  "apple-touch-icon.png",
);
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
    accent: "#0f746c",
    name: "AI & Automation",
    slug: "ai-automation",
  },
  {
    accent: "#315f98",
    name: "Business Software & SaaS",
    slug: "business-software",
  },
  {
    accent: "#a83d3a",
    name: "Cybersecurity & Data Protection",
    slug: "cybersecurity-data-protection",
  },
  {
    accent: "#397143",
    name: "Digital Operations & Productivity",
    slug: "digital-operations",
  },
  {
    accent: "#9a5b13",
    name: "Technology Decisions & Strategy",
    slug: "technology-strategy",
  },
];

const categoryBySlug = new Map(
  categoryRecords.map((category) => [category.slug, category]),
);

function loadPublishedArticleRecords() {
  return readdirSync(articleDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const source = readFileSync(
        path.join(articleDirectory, entry.name),
        "utf8",
      );
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!frontmatter) {
        throw new Error(`Missing YAML frontmatter in ${entry.name}.`);
      }
      const data = loadYaml(frontmatter[1]);
      if (!data || typeof data !== "object") {
        throw new Error(`Invalid YAML frontmatter in ${entry.name}.`);
      }
      return data;
    })
    .filter(({ status }) => status === "published")
    .map(({ category, slug, title, visual }) => {
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
      return {
        accent: categoryRecord.accent,
        alt: `Social preview for “${title}” in ${categoryRecord.name}.`,
        categoryName: categoryRecord.name,
        fileName: `article-${slug}.png`,
        kind: "article",
        title,
        visualKey: visual.key,
      };
    });
}

export const SOCIAL_IMAGE_RECORDS = Object.freeze(
  [
    {
      accent: "#d84a2f",
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
    <rect x="750" y="102" width="372" height="426" rx="28" fill="#f4efe4" stroke="#171918" stroke-width="3"/>
    <path d="${pathData}" fill="none" stroke="${escapeXml(accent)}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    ${points
      .map(
        ({ x, y }, index) =>
          `<circle cx="${x}" cy="${y}" r="${18 + (bytes[index + 10] % 13)}" fill="${index % 2 === 0 ? escapeXml(accent) : "#fffdf8"}" stroke="#171918" stroke-width="3"/>`,
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
  <rect width="1200" height="630" fill="#fffdf8"/>
  <rect width="18" height="630" fill="${escapeXml(record.accent)}"/>
  <path d="M78 84 H690" stroke="#171918" stroke-width="3"/>
  <text x="78" y="62" fill="#171918" font-size="27" font-weight="750" letter-spacing="1.4">EVERYDAY TECH INSIGHT</text>
  <text x="78" y="150" fill="${escapeXml(record.accent)}" font-size="25" font-weight="720" letter-spacing="1">${escapeXml(record.categoryName)}</text>
  <text x="78" y="232" fill="#171918" font-size="${titleSize}" font-weight="730">${titleMarkup}</text>
  <text x="78" y="564" fill="#4b514e" font-size="23">Practical guidance for small-business technology decisions</text>
  ${visualGeometry(record.visualKey, record.accent)}
</svg>`;
}

function renderAppleIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="32" fill="#fffdf8"/>
  <rect x="18" y="18" width="144" height="144" rx="18" fill="none" stroke="#171918" stroke-width="10"/>
  <rect x="18" y="18" width="22" height="144" rx="8" fill="#d84a2f"/>
  <path d="M61 62h68M61 90h52M61 118h68" fill="none" stroke="#171918" stroke-width="12" stroke-linecap="square"/>
</svg>`;
}

async function writePng(svg, outputPath, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height, { fit: "fill" })
    .png({ adaptiveFiltering: false, compressionLevel: 9, palette: false })
    .toFile(outputPath);
}

function safeOutputTargets(socialDir, appleIconPath) {
  const resolvedSocialDir = path.resolve(socialDir);
  const resolvedAppleIconPath = path.resolve(appleIconPath);
  const parentDirectory = path.dirname(resolvedSocialDir);
  const filesystemRoot = path.parse(resolvedSocialDir).root;

  if (
    path.basename(resolvedSocialDir).toLowerCase() !== "social" ||
    resolvedSocialDir === filesystemRoot ||
    parentDirectory === filesystemRoot ||
    resolvedSocialDir === repositoryRoot
  ) {
    throw new Error(
      "The social directory must be a narrowly scoped directory named social below a non-root parent.",
    );
  }
  if (
    resolvedAppleIconPath !== path.join(parentDirectory, "apple-touch-icon.png")
  ) {
    throw new Error(
      "The Apple touch icon must be the apple-touch-icon.png sibling of the social directory.",
    );
  }

  return { resolvedAppleIconPath, resolvedSocialDir };
}

export async function generateSocialImages({
  appleIconPath = defaultAppleIconPath,
  socialDir = defaultSocialDirectory,
} = {}) {
  const { resolvedAppleIconPath, resolvedSocialDir } = safeOutputTargets(
    socialDir,
    appleIconPath,
  );
  mkdirSync(resolvedSocialDir, { recursive: true });
  mkdirSync(path.dirname(resolvedAppleIconPath), { recursive: true });

  const expectedNames = new Set(
    SOCIAL_IMAGE_RECORDS.map(({ fileName }) => fileName),
  );
  for (const entry of readdirSync(resolvedSocialDir, { withFileTypes: true })) {
    if (entry.isFile() && !expectedNames.has(entry.name)) {
      unlinkSync(path.join(resolvedSocialDir, entry.name));
    }
  }

  for (const record of SOCIAL_IMAGE_RECORDS) {
    await writePng(
      renderSocialSvg(record),
      path.join(resolvedSocialDir, record.fileName),
      SOCIAL_IMAGE_WIDTH,
      SOCIAL_IMAGE_HEIGHT,
    );
  }
  await writePng(renderAppleIconSvg(), resolvedAppleIconPath, 180, 180);

  return {
    appleIconPath: resolvedAppleIconPath,
    socialImagePaths: SOCIAL_IMAGE_RECORDS.map(({ fileName }) =>
      path.join(resolvedSocialDir, fileName),
    ),
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
