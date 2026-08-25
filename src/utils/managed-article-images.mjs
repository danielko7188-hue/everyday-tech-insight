import path from "node:path";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";

import { fromMarkdown } from "mdast-util-from-markdown";
import sharp from "sharp";

export const MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT = "/images/articles";
export const MANAGED_ARTICLE_IMAGE_SOURCE_ROOT = path.join(
  "src",
  "content-assets",
  "articles",
);
export const MANAGED_ARTICLE_IMAGE_MAX_BYTES = 1_500_000;
export const MANAGED_ARTICLE_IMAGE_MAX_DIMENSION = 3_200;

const MIME_TYPE_BY_EXTENSION = Object.freeze({
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
});
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseManagedArticleImageUrl(publicUrl, articleSlug) {
  if (
    typeof publicUrl !== "string" ||
    typeof articleSlug !== "string" ||
    !SLUG_PATTERN.test(articleSlug)
  ) {
    throw new Error("Expected an exact managed article image URL and slug.");
  }

  const expression = new RegExp(
    `^${escapeRegularExpression(MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT)}/${escapeRegularExpression(articleSlug)}-[a-z0-9]+(?:-[a-z0-9]+)*\\.(webp|png|jpg|jpeg)$`,
  );
  const match = publicUrl.match(expression);
  if (!match) {
    throw new Error(
      `Expected an exact managed article image URL owned by ${articleSlug}.`,
    );
  }

  const extension = match[1];
  return {
    extension,
    filename: publicUrl.slice(MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT.length + 1),
    mimeType: MIME_TYPE_BY_EXTENSION[extension],
    publicUrl,
  };
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

async function assertSafeRegularFile(repositoryRoot, sourceRoot, sourcePath) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedSourcePath = path.resolve(sourcePath);
  if (
    !isPathInside(resolvedRepositoryRoot, resolvedSourceRoot) ||
    !isPathInside(resolvedSourceRoot, resolvedSourcePath)
  ) {
    throw new Error("Managed image path escapes its lexical source boundary.");
  }

  const repositoryDetails = await lstat(resolvedRepositoryRoot);
  if (repositoryDetails.isSymbolicLink()) {
    throw new Error(
      `Managed image paths cannot use a symbolic link or junction as the repository root: ${resolvedRepositoryRoot}`,
    );
  }
  if (!repositoryDetails.isDirectory()) {
    throw new Error(
      `Managed image repository root must be a directory: ${resolvedRepositoryRoot}`,
    );
  }

  const relativeSegments = path
    .relative(resolvedRepositoryRoot, resolvedSourcePath)
    .split(path.sep)
    .filter(Boolean);
  let currentPath = resolvedRepositoryRoot;
  for (const [index, segment] of relativeSegments.entries()) {
    currentPath = path.join(currentPath, segment);
    let details;
    try {
      details = await lstat(currentPath);
    } catch (error) {
      throw new Error(
        `Managed image source is missing or unreadable: ${currentPath}`,
        { cause: error },
      );
    }
    if (details.isSymbolicLink()) {
      throw new Error(
        `Managed image paths cannot contain a symbolic link or junction: ${currentPath}`,
      );
    }
    const isLast = index === relativeSegments.length - 1;
    if (isLast ? !details.isFile() : !details.isDirectory()) {
      throw new Error(
        isLast
          ? `Managed image source must be a regular file: ${currentPath}`
          : `Managed image ancestor must be a directory: ${currentPath}`,
      );
    }
  }

  const [canonicalRepositoryRoot, canonicalSourceRoot, canonicalSourcePath] =
    await Promise.all([
      realpath(resolvedRepositoryRoot),
      realpath(resolvedSourceRoot),
      realpath(resolvedSourcePath),
    ]);
  if (
    !isPathInside(canonicalRepositoryRoot, canonicalSourceRoot) ||
    !isPathInside(canonicalSourceRoot, canonicalSourcePath)
  ) {
    throw new Error(
      "Managed image path escapes its canonical source boundary.",
    );
  }

  return canonicalSourcePath;
}

export function validateManagedArticleImageMetadata(
  metadata,
  extension,
  byteLength,
) {
  validateManagedArticleImageByteLength(byteLength);

  const expectedFormat = extension === "jpg" ? "jpeg" : extension;
  if (metadata?.format !== expectedFormat) {
    throw new Error(
      `Decoded image format ${JSON.stringify(metadata?.format)} does not match the .${extension} extension.`,
    );
  }
  if (typeof metadata.pages === "number" && metadata.pages !== 1) {
    throw new Error(
      "Managed images must be single-frame, single-page rasters.",
    );
  }

  let width = metadata?.width;
  let height = metadata?.height;
  if (
    !Number.isSafeInteger(width) ||
    width <= 0 ||
    !Number.isSafeInteger(height) ||
    height <= 0
  ) {
    throw new Error("Managed images must have positive decoded dimensions.");
  }
  if ([5, 6, 7, 8].includes(metadata.orientation)) {
    [width, height] = [height, width];
  }
  if (
    width > MANAGED_ARTICLE_IMAGE_MAX_DIMENSION ||
    height > MANAGED_ARTICLE_IMAGE_MAX_DIMENSION
  ) {
    throw new Error(
      `Managed image dimensions cannot exceed ${MANAGED_ARTICLE_IMAGE_MAX_DIMENSION.toLocaleString("en-US")} pixels.`,
    );
  }

  return { format: expectedFormat, width, height };
}

function validateManagedArticleImageByteLength(byteLength) {
  if (
    !Number.isSafeInteger(byteLength) ||
    byteLength <= 0 ||
    byteLength > MANAGED_ARTICLE_IMAGE_MAX_BYTES
  ) {
    throw new Error(
      `Managed images must contain 1-${MANAGED_ARTICLE_IMAGE_MAX_BYTES.toLocaleString("en-US")} bytes.`,
    );
  }
}

export async function inspectManagedArticleImage({
  articleSlug,
  publicUrl,
  repositoryRoot = process.cwd(),
}) {
  const parsed = parseManagedArticleImageUrl(publicUrl, articleSlug);
  const sourceRoot = path.join(
    path.resolve(repositoryRoot),
    MANAGED_ARTICLE_IMAGE_SOURCE_ROOT,
  );
  const sourcePath = path.join(sourceRoot, parsed.filename);
  const canonicalSourcePath = await assertSafeRegularFile(
    repositoryRoot,
    sourceRoot,
    sourcePath,
  );
  const preReadDetails = await lstat(canonicalSourcePath);
  validateManagedArticleImageByteLength(preReadDetails.size);
  const bytes = await readFile(canonicalSourcePath);
  if (bytes.byteLength !== preReadDetails.size) {
    throw new Error(
      `Managed image changed while it was being inspected: ${parsed.filename}`,
    );
  }

  let metadata;
  try {
    metadata = await sharp(bytes, {
      animated: true,
      failOn: "error",
    }).metadata();
  } catch (error) {
    throw new Error(`Managed image could not be decoded: ${parsed.filename}`, {
      cause: error,
    });
  }
  const dimensions = validateManagedArticleImageMetadata(
    metadata,
    parsed.extension,
    bytes.byteLength,
  );

  return {
    ...parsed,
    ...dimensions,
    byteLength: bytes.byteLength,
    bytes,
    sourcePath: canonicalSourcePath,
  };
}

export function findCaseFoldedDuplicateBasenames(fileNames) {
  const groups = new Map();
  for (const fileName of fileNames) {
    const folded = fileName.toLocaleLowerCase("en-US");
    const group = groups.get(folded) ?? [];
    group.push(fileName);
    groups.set(folded, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function normalizeReferenceIdentifier(identifier) {
  return identifier.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function finding(code, location, message) {
  return { code, location, message };
}

function normalizedWords(value) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isMeaningfulManagedImageAlt(alt, filename) {
  if (typeof alt !== "string") return false;
  const normalizedAlt = normalizedWords(alt);
  if (normalizedAlt.length < 10 || normalizedAlt.split(/\s+/).length < 2) {
    return false;
  }
  if (
    /^(?:image|photo|picture|graphic|diagram|screenshot|illustration|article image|hero image)$/.test(
      normalizedAlt,
    )
  ) {
    return false;
  }
  const genericWords = new Set([
    "a",
    "an",
    "and",
    "article",
    "graphic",
    "guide",
    "hero",
    "illustration",
    "image",
    "of",
    "photo",
    "picture",
    "screen",
    "screenshot",
    "software",
    "the",
  ]);
  const descriptiveWords = normalizedAlt
    .split(/\s+/)
    .filter((word) => !genericWords.has(word));
  if (descriptiveWords.length < 2) return false;
  const extension = path.extname(filename);
  const normalizedFilename = normalizedWords(
    path.basename(filename, extension),
  );
  return normalizedAlt !== normalizedFilename;
}

function walkTree(node, visit) {
  visit(node);
  if (Array.isArray(node?.children)) {
    for (const child of node.children) walkTree(child, visit);
  }
}

export function scanManagedImagesInMarkdown(
  body,
  { articleSlug, fileName = `${articleSlug}.md` },
) {
  const findings = [];
  const references = [];
  let tree;
  try {
    tree = fromMarkdown(body);
  } catch (error) {
    return {
      findings: [
        finding(
          "markdown-image-parse",
          fileName,
          `Markdown could not be parsed for managed images: ${error instanceof Error ? error.message : error}`,
        ),
      ],
      references,
    };
  }

  const definitions = new Map();
  const duplicateDefinitions = new Set();
  walkTree(tree, (node) => {
    if (node.type === "definition") {
      const identifier = normalizeReferenceIdentifier(node.identifier);
      if (definitions.has(identifier)) {
        duplicateDefinitions.add(identifier);
      } else {
        definitions.set(identifier, node.url);
      }
    }
  });

  walkTree(tree, (node) => {
    if (
      (node.type === "raw" || node.type === "html") &&
      /<(?:img|picture|source)\b/i.test(node.value ?? "")
    ) {
      findings.push(
        finding(
          "raw-image-html",
          fileName,
          "Raw HTML img, picture, and source elements are not allowed in article Markdown.",
        ),
      );
      return;
    }
    if (node.type === "text" && /!\[[^\]\r\n]*\]/.test(node.value ?? "")) {
      const startOffset = node.position?.start?.offset;
      const endOffset = node.position?.end?.offset;
      const sourceText =
        Number.isSafeInteger(startOffset) && Number.isSafeInteger(endOffset)
          ? body.slice(startOffset, endOffset)
          : node.value;
      for (const match of sourceText.matchAll(
        /!\[([^\]\r\n]*)\](?:\[([^\]\r\n]*)\])?/g,
      )) {
        let precedingSlashes = 0;
        for (
          let index = (match.index ?? 0) - 1;
          sourceText[index] === "\\";
          index--
        ) {
          precedingSlashes += 1;
        }
        if (precedingSlashes % 2 === 1) continue;
        const identifier = match[2] || match[1];
        if (!definitions.has(normalizeReferenceIdentifier(identifier ?? ""))) {
          findings.push(
            finding(
              "unresolved-image-reference",
              fileName,
              `Image reference ${JSON.stringify(identifier)} has no definition.`,
            ),
          );
        }
      }
      return;
    }
    if (node.type !== "image" && node.type !== "imageReference") return;

    let publicUrl;
    if (node.type === "image") {
      publicUrl = node.url;
    } else {
      const identifier = normalizeReferenceIdentifier(node.identifier);
      if (duplicateDefinitions.has(identifier)) {
        findings.push(
          finding(
            "duplicate-image-definition",
            fileName,
            `Image reference ${JSON.stringify(node.label ?? node.identifier)} has more than one definition.`,
          ),
        );
      }
      publicUrl = definitions.get(identifier);
      if (typeof publicUrl !== "string") {
        findings.push(
          finding(
            "unresolved-image-reference",
            fileName,
            `Image reference ${JSON.stringify(node.label ?? node.identifier)} has no definition.`,
          ),
        );
        return;
      }
    }

    let parsed;
    try {
      parsed = parseManagedArticleImageUrl(publicUrl, articleSlug);
    } catch (error) {
      findings.push(
        finding(
          "managed-image-url",
          fileName,
          error instanceof Error
            ? error.message
            : "Article image URL is invalid.",
        ),
      );
      return;
    }
    if (!isMeaningfulManagedImageAlt(node.alt, parsed.filename)) {
      findings.push(
        finding(
          "body-image-alt",
          fileName,
          `Body image ${parsed.filename} requires meaningful, non-generic alternative text that is not its filename.`,
        ),
      );
    }
    references.push({
      ...parsed,
      alt: node.alt,
      kind: "body",
    });
  });

  return { findings, references };
}

function collectHeroReference(article, findings) {
  const { data, fileName } = article;
  const heroFields = [
    "heroImageAlt",
    "heroImageDecorative",
    "heroImageCaption",
    "heroImageCredit",
    "heroImageSourceUrl",
    "heroImageLicense",
  ];
  if (data.heroImage === undefined) {
    if (heroFields.some((field) => data[field] !== undefined)) {
      findings.push(
        finding(
          "hero-image-pair",
          fileName,
          "Hero metadata cannot be supplied without heroImage.",
        ),
      );
    }
    return undefined;
  }

  let parsed;
  try {
    parsed = parseManagedArticleImageUrl(data.heroImage, data.slug);
  } catch (error) {
    findings.push(
      finding(
        "managed-image-url",
        fileName,
        error instanceof Error ? error.message : "Hero image URL is invalid.",
      ),
    );
    return undefined;
  }

  const decorative = data.heroImageDecorative;
  const alt = data.heroImageAlt;
  const validDecorativeAlt = decorative === true && alt === "";
  const validInformativeAlt =
    decorative === false && isMeaningfulManagedImageAlt(alt, parsed.filename);
  if (!validDecorativeAlt && !validInformativeAlt) {
    findings.push(
      finding(
        "hero-image-alt",
        fileName,
        "Decorative heroes require empty alternative text; informative heroes require meaningful, non-generic alternative text.",
      ),
    );
  }

  return { ...parsed, alt, decorative, kind: "hero" };
}

async function inspectManagedSourceDirectory(repositoryRoot) {
  const sourceRoot = path.join(
    path.resolve(repositoryRoot),
    MANAGED_ARTICLE_IMAGE_SOURCE_ROOT,
  );
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const repositoryDetails = await lstat(resolvedRepositoryRoot);
  if (repositoryDetails.isSymbolicLink()) {
    throw new Error(
      `Managed image paths cannot use a symbolic link or junction as the repository root: ${resolvedRepositoryRoot}`,
    );
  }
  if (!repositoryDetails.isDirectory()) {
    throw new Error(
      `Managed image repository root must be a directory: ${resolvedRepositoryRoot}`,
    );
  }
  const relativeSegments = path
    .relative(resolvedRepositoryRoot, sourceRoot)
    .split(path.sep)
    .filter(Boolean);
  let currentPath = resolvedRepositoryRoot;
  for (const segment of relativeSegments) {
    currentPath = path.join(currentPath, segment);
    let details;
    try {
      details = await lstat(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { exists: false, sourceRoot, entries: [] };
      }
      throw error;
    }
    if (details.isSymbolicLink()) {
      throw new Error(
        `Managed image source paths cannot contain a symbolic link or junction: ${currentPath}`,
      );
    }
    if (!details.isDirectory()) {
      throw new Error(
        `Managed image source ancestor must be a directory: ${currentPath}`,
      );
    }
  }
  const [canonicalRepositoryRoot, canonicalSourceRoot] = await Promise.all([
    realpath(resolvedRepositoryRoot),
    realpath(sourceRoot),
  ]);
  if (!isPathInside(canonicalRepositoryRoot, canonicalSourceRoot)) {
    throw new Error("Managed image source root escapes the repository.");
  }
  return {
    exists: true,
    sourceRoot,
    entries: await readdir(sourceRoot, { withFileTypes: true }),
  };
}

export async function auditManagedArticleImages(
  articles,
  { repositoryRoot = process.cwd() } = {},
) {
  const findings = [];
  const referencesByUrl = new Map();

  for (const article of articles) {
    const articleSlug = article?.data?.slug;
    const status = article?.data?.status;
    if (!SLUG_PATTERN.test(articleSlug ?? "")) {
      findings.push(
        finding(
          "managed-image-article-slug",
          article?.fileName ?? "unknown article",
          "Managed image auditing requires a canonical article slug.",
        ),
      );
      continue;
    }

    const markdown = scanManagedImagesInMarkdown(article.body ?? "", {
      articleSlug,
      fileName: article.fileName,
    });
    findings.push(...markdown.findings);
    const hero = collectHeroReference(article, findings);
    const articleReferences = hero
      ? [hero, ...markdown.references]
      : markdown.references;
    for (const reference of articleReferences) {
      const current = referencesByUrl.get(reference.publicUrl);
      if (current) {
        current.published ||= status === "published";
        current.usages.push({
          fileName: article.fileName,
          kind: reference.kind,
          status,
        });
      } else {
        referencesByUrl.set(reference.publicUrl, {
          ...reference,
          articleSlug,
          published: status === "published",
          usages: [
            { fileName: article.fileName, kind: reference.kind, status },
          ],
        });
      }
    }
  }

  let sourceDirectory;
  try {
    sourceDirectory = await inspectManagedSourceDirectory(repositoryRoot);
  } catch (error) {
    findings.push(
      finding(
        "unsafe-managed-source-root",
        MANAGED_ARTICLE_IMAGE_SOURCE_ROOT,
        error instanceof Error ? error.message : String(error),
      ),
    );
    return { findings, publishedImages: [], referencedImages: [] };
  }

  const rasterFileNames = [];
  for (const entry of sourceDirectory.entries) {
    if (entry.name === ".gitkeep" && entry.isFile()) {
      const marker = await lstat(
        path.join(sourceDirectory.sourceRoot, entry.name),
      );
      if (marker.size !== 0) {
        findings.push(
          finding(
            "invalid-source-marker",
            entry.name,
            "The managed image directory marker must remain an empty regular file.",
          ),
        );
      }
      continue;
    }
    if (entry.isSymbolicLink()) {
      findings.push(
        finding(
          "unsafe-source-entry",
          entry.name,
          "Managed image source entries cannot be symbolic links or junctions.",
        ),
      );
    } else if (!entry.isFile()) {
      findings.push(
        finding(
          "nonregular-source-entry",
          entry.name,
          "Managed image source entries must be regular files in one flat directory.",
        ),
      );
    } else if (!/\.(?:webp|png|jpg|jpeg)$/.test(entry.name)) {
      findings.push(
        finding(
          "unsupported-source-entry",
          entry.name,
          "Managed image source contains a nonapproved file.",
        ),
      );
    } else {
      rasterFileNames.push(entry.name);
    }
  }

  for (const duplicateGroup of findCaseFoldedDuplicateBasenames(
    rasterFileNames,
  )) {
    findings.push(
      finding(
        "case-folded-image-duplicate",
        duplicateGroup.join(", "),
        "Managed image basenames must remain unique when case is ignored.",
      ),
    );
  }

  const referencedFileNames = new Set(
    [...referencesByUrl.values()].map(({ filename }) => filename),
  );
  for (const fileName of rasterFileNames) {
    if (!referencedFileNames.has(fileName)) {
      findings.push(
        finding(
          "orphan-managed-image",
          fileName,
          "Managed source image is not referenced by any article lifecycle state.",
        ),
      );
    }
  }

  const referencedImages = [];
  for (const reference of referencesByUrl.values()) {
    try {
      const inspected = await inspectManagedArticleImage({
        articleSlug: reference.articleSlug,
        publicUrl: reference.publicUrl,
        repositoryRoot,
      });
      referencedImages.push({
        ...inspected,
        articleSlug: reference.articleSlug,
        usages: reference.usages,
      });
    } catch (error) {
      findings.push(
        finding(
          "missing-or-invalid-managed-image",
          reference.publicUrl,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const publishedUrls = new Set(
    [...referencesByUrl.values()]
      .filter(({ published }) => published)
      .map(({ publicUrl }) => publicUrl),
  );
  return {
    findings,
    publishedImages: referencedImages.filter(({ publicUrl }) =>
      publishedUrls.has(publicUrl),
    ),
    referencedImages,
  };
}

export function createPublishedManagedImagePaths(audit) {
  if (audit.findings.length > 0) {
    const details = audit.findings
      .map(({ code, location, message }) => `[${code}] ${location}: ${message}`)
      .join("\n");
    throw new Error(`Managed article image audit failed:\n${details}`);
  }

  const routesByFileName = new Map();
  for (const image of audit.publishedImages) {
    const route = {
      params: { filename: image.filename },
      props: {
        articleSlug: image.articleSlug,
        publicUrl: image.publicUrl,
      },
    };
    const existing = routesByFileName.get(image.filename);
    if (
      existing &&
      (existing.props.articleSlug !== route.props.articleSlug ||
        existing.props.publicUrl !== route.props.publicUrl)
    ) {
      throw new Error(
        `Published managed image route collision: ${image.filename}`,
      );
    }
    routesByFileName.set(image.filename, route);
  }
  return [...routesByFileName.values()].sort((left, right) =>
    left.params.filename.localeCompare(right.params.filename),
  );
}

export function createManagedArticleImageResponse(image) {
  return new Response(image.bytes, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Length": String(image.byteLength),
      "Content-Type": image.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function resolveManagedArticleHeroImage(
  articleData,
  { repositoryRoot = process.cwd() } = {},
) {
  if (articleData.heroImage === undefined) return undefined;

  const inspected = await inspectManagedArticleImage({
    articleSlug: articleData.slug,
    publicUrl: articleData.heroImage,
    repositoryRoot,
  });
  const decorative = articleData.heroImageDecorative;
  const alt = articleData.heroImageAlt;
  const validDecorativeAlt = decorative === true && alt === "";
  const validInformativeAlt =
    decorative === false &&
    isMeaningfulManagedImageAlt(alt, inspected.filename);
  if (!validDecorativeAlt && !validInformativeAlt) {
    throw new Error(
      `Managed hero image ${inspected.filename} has invalid alternative text or decorative semantics.`,
    );
  }

  return {
    ...inspected,
    alt,
    caption: articleData.heroImageCaption,
    credit: articleData.heroImageCredit,
    decorative,
    license: articleData.heroImageLicense,
    sourceUrl: articleData.heroImageSourceUrl,
  };
}
