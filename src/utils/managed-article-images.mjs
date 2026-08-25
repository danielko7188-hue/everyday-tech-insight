import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { lstat, open, readdir, realpath } from "node:fs/promises";

import { fromMarkdown } from "mdast-util-from-markdown";
import sharp from "sharp";

import { visitTreeIterative } from "./managed-image-ast.mjs";

export const MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT = "/images/articles";
export const MANAGED_ARTICLE_IMAGE_SOURCE_ROOT = path.join(
  "src",
  "content-assets",
  "articles",
);
export const LEGACY_MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT = path.join(
  "public",
  "images",
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

async function assertSafeRegularFile(
  repositoryRoot,
  sourceRoot,
  sourcePath,
  { label = "Managed image" } = {},
) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedSourcePath = path.resolve(sourcePath);
  if (
    !isPathInside(resolvedRepositoryRoot, resolvedSourceRoot) ||
    !isPathInside(resolvedSourceRoot, resolvedSourcePath)
  ) {
    throw new Error(`${label} path escapes its lexical boundary.`);
  }

  const repositoryDetails = await lstat(resolvedRepositoryRoot);
  if (repositoryDetails.isSymbolicLink()) {
    throw new Error(
      `${label} paths cannot use a symbolic link or junction as the repository root: ${resolvedRepositoryRoot}`,
    );
  }
  if (!repositoryDetails.isDirectory()) {
    throw new Error(
      `${label} repository root must be a directory: ${resolvedRepositoryRoot}`,
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
        `${label} file is missing or unreadable: ${currentPath}`,
        { cause: error },
      );
    }
    if (details.isSymbolicLink()) {
      throw new Error(
        `${label} paths cannot contain a symbolic link or junction: ${currentPath}`,
      );
    }
    const isLast = index === relativeSegments.length - 1;
    if (isLast ? !details.isFile() : !details.isDirectory()) {
      throw new Error(
        isLast
          ? `${label} must be a regular file: ${currentPath}`
          : `${label} ancestor must be a directory: ${currentPath}`,
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
    throw new Error(`${label} path escapes its canonical boundary.`);
  }

  return canonicalSourcePath;
}

function stableFileIdentityMatches(before, after) {
  return ["dev", "ino", "size", "mtimeNs", "ctimeNs"].every(
    (field) => before?.[field] === after?.[field],
  );
}

async function readStableRegularFile(
  { repositoryRoot, boundaryRoot, filePath, label = "Managed image", maxBytes },
  { afterInitialStat, afterRead, onReadProgress } = {},
) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error(`${label} requires a safe nonnegative read limit.`);
  }
  const canonicalBefore = await assertSafeRegularFile(
    repositoryRoot,
    boundaryRoot,
    filePath,
    { label },
  );
  const noFollow = fsConstants.O_NOFOLLOW;
  const flags =
    fsConstants.O_RDONLY |
    (typeof noFollow === "number" && Number.isSafeInteger(noFollow)
      ? noFollow
      : 0);
  let handle;
  try {
    handle = await open(path.resolve(filePath), flags);
  } catch (error) {
    throw new Error(`${label} could not be opened safely: ${filePath}`, {
      cause: error,
    });
  }

  let before;
  let after;
  let bytes;
  try {
    before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      throw new Error(`${label} must remain a regular file: ${filePath}`);
    }
    const byteLength = Number(before.size);
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new Error(`${label} has an unsafe byte length: ${filePath}`);
    }
    if (byteLength > maxBytes) {
      throw new Error(
        `${label} exceeds the ${maxBytes.toLocaleString("en-US")}-byte limit: ${filePath}`,
      );
    }
    if (typeof afterInitialStat === "function") await afterInitialStat();
    const readLimit = Math.min(maxBytes + 1, byteLength + 1);
    const readBuffer = Buffer.allocUnsafe(readLimit);
    let totalBytesRead = 0;
    while (totalBytesRead < readLimit) {
      const { bytesRead } = await handle.read(
        readBuffer,
        totalBytesRead,
        readLimit - totalBytesRead,
        totalBytesRead,
      );
      if (bytesRead === 0) break;
      totalBytesRead += bytesRead;
      if (typeof onReadProgress === "function") {
        await onReadProgress({ readLimit, totalBytesRead });
      }
    }
    bytes = readBuffer.subarray(0, totalBytesRead);
    if (bytes.byteLength !== byteLength) {
      throw new Error(`${label} changed while it was being read: ${filePath}`);
    }
    if (typeof afterRead === "function") await afterRead();
    after = await handle.stat({ bigint: true });
    if (!after.isFile() || !stableFileIdentityMatches(before, after)) {
      throw new Error(`${label} changed while it was being read: ${filePath}`);
    }
  } finally {
    await handle.close();
  }

  const canonicalAfter = await assertSafeRegularFile(
    repositoryRoot,
    boundaryRoot,
    filePath,
    { label },
  );
  const pathAfter = await lstat(path.resolve(filePath), { bigint: true });
  if (
    canonicalAfter !== canonicalBefore ||
    !pathAfter.isFile() ||
    !stableFileIdentityMatches(after, pathAfter)
  ) {
    throw new Error(`${label} changed while it was being read: ${filePath}`);
  }

  return { bytes, canonicalPath: canonicalAfter };
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

export async function inspectManagedArticleImage(
  { articleSlug, publicUrl, repositoryRoot = process.cwd() },
  inspectionHooks = {},
) {
  const parsed = parseManagedArticleImageUrl(publicUrl, articleSlug);
  const sourceRoot = path.join(
    path.resolve(repositoryRoot),
    MANAGED_ARTICLE_IMAGE_SOURCE_ROOT,
  );
  const sourcePath = path.join(sourceRoot, parsed.filename);
  const { bytes, canonicalPath: canonicalSourcePath } =
    await readStableRegularFile(
      {
        repositoryRoot,
        boundaryRoot: sourceRoot,
        filePath: sourcePath,
        label: "Managed image source",
        maxBytes: MANAGED_ARTICLE_IMAGE_MAX_BYTES,
      },
      inspectionHooks,
    );
  validateManagedArticleImageByteLength(bytes.byteLength);

  let metadata;
  try {
    metadata = await sharp(bytes, {
      animated: true,
      failOn: "warning",
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
  try {
    await sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels:
        MANAGED_ARTICLE_IMAGE_MAX_DIMENSION *
        MANAGED_ARTICLE_IMAGE_MAX_DIMENSION,
    })
      .raw()
      .toBuffer();
  } catch (error) {
    throw new Error(
      `Managed image pixel data could not be fully decoded: ${parsed.filename}`,
      { cause: error },
    );
  }

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

export function classifyManagedArticleSourceFileNames(fileNames) {
  const mediaPattern = /\.(?:webp|png|jpg|jpeg)$/;
  return {
    duplicateGroups: findCaseFoldedDuplicateBasenames(fileNames),
    rasterFileNames: fileNames.filter((fileName) =>
      mediaPattern.test(fileName),
    ),
    unsupportedFileNames: fileNames.filter(
      (fileName) => fileName !== ".gitkeep" && !mediaPattern.test(fileName),
    ),
  };
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
  visitTreeIterative(tree, (node) => {
    if (node.type === "definition") {
      const identifier = normalizeReferenceIdentifier(node.identifier);
      if (definitions.has(identifier)) {
        duplicateDefinitions.add(identifier);
      } else {
        definitions.set(identifier, node.url);
      }
    }
  });

  visitTreeIterative(tree, (node) => {
    if (node.type === "raw" || node.type === "html") {
      findings.push(
        finding(
          "raw-html",
          fileName,
          "Raw HTML is not allowed in article Markdown; use reviewed Markdown structures instead.",
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

async function findLegacyPublicMediaRoot(repositoryRoot) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const legacyRoot = path.join(
    resolvedRepositoryRoot,
    LEGACY_MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT,
  );
  const segments = path
    .relative(resolvedRepositoryRoot, legacyRoot)
    .split(path.sep)
    .filter(Boolean);
  let currentPath = resolvedRepositoryRoot;
  for (const [index, segment] of segments.entries()) {
    currentPath = path.join(currentPath, segment);
    let details;
    try {
      details = await lstat(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
    const isLast = index === segments.length - 1;
    if (details.isSymbolicLink()) {
      return finding(
        "legacy-public-media-root",
        LEGACY_MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT,
        `The legacy public managed-media path must be absent; a symbolic link or junction exists at ${currentPath}.`,
      );
    }
    if (!isLast && !details.isDirectory()) return undefined;
    if (isLast) {
      return finding(
        "legacy-public-media-root",
        LEGACY_MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT,
        "The legacy public managed-media root must be absent in every form; managed sources belong only under src/content-assets/articles.",
      );
    }
  }
  return undefined;
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
        current.usages.push({
          fileName: article.fileName,
          kind: reference.kind,
          status,
        });
        if (current.articleSlug !== articleSlug) {
          if (!current.ambiguous) {
            findings.push(
              finding(
                "ambiguous-managed-image-owner",
                reference.publicUrl,
                `Managed image URL is claimed by distinct article slugs: ${current.articleSlug} and ${articleSlug}.`,
              ),
            );
          }
          current.ambiguous = true;
        } else {
          current.published ||= status === "published";
        }
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

  try {
    const legacyFinding = await findLegacyPublicMediaRoot(repositoryRoot);
    if (legacyFinding) findings.push(legacyFinding);
  } catch (error) {
    findings.push(
      finding(
        "legacy-public-media-root",
        LEGACY_MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT,
        error instanceof Error ? error.message : String(error),
      ),
    );
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

  const regularFileNames = [];
  for (const entry of sourceDirectory.entries) {
    if (entry.isFile()) regularFileNames.push(entry.name);
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
    }
  }

  const { duplicateGroups, rasterFileNames, unsupportedFileNames } =
    classifyManagedArticleSourceFileNames(regularFileNames);
  for (const unsupportedFileName of unsupportedFileNames) {
    findings.push(
      finding(
        "unsupported-source-entry",
        unsupportedFileName,
        "Managed image source contains a nonapproved file.",
      ),
    );
  }
  for (const duplicateGroup of duplicateGroups) {
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
    if (reference.ambiguous) continue;
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
      .filter(({ ambiguous }) => !ambiguous)
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

async function inspectSafeDirectoryBoundary(
  repositoryRoot,
  directoryPath,
  { label = "Managed image output" } = {},
) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const resolvedDirectoryPath = path.resolve(directoryPath);
  if (!isPathInside(resolvedRepositoryRoot, resolvedDirectoryPath)) {
    throw new Error(`${label} escapes its lexical repository boundary.`);
  }

  const repositoryDetails = await lstat(resolvedRepositoryRoot);
  if (repositoryDetails.isSymbolicLink()) {
    throw new Error(
      `${label} cannot use a symbolic link or junction as the repository root: ${resolvedRepositoryRoot}`,
    );
  }
  if (!repositoryDetails.isDirectory()) {
    throw new Error(
      `${label} repository root must be a directory: ${resolvedRepositoryRoot}`,
    );
  }

  const segments = path
    .relative(resolvedRepositoryRoot, resolvedDirectoryPath)
    .split(path.sep)
    .filter(Boolean);
  let currentPath = resolvedRepositoryRoot;
  for (const segment of segments) {
    currentPath = path.join(currentPath, segment);
    let details;
    try {
      details = await lstat(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return {
          canonicalDirectory: undefined,
          canonicalRepositoryRoot: await realpath(resolvedRepositoryRoot),
          exists: false,
          resolvedDirectoryPath,
        };
      }
      throw error;
    }
    if (details.isSymbolicLink()) {
      throw new Error(
        `${label} cannot contain a symbolic link or junction: ${currentPath}`,
      );
    }
    if (!details.isDirectory()) {
      throw new Error(`${label} ancestor must be a directory: ${currentPath}`);
    }
  }

  const [canonicalRepositoryRoot, canonicalDirectory] = await Promise.all([
    realpath(resolvedRepositoryRoot),
    realpath(resolvedDirectoryPath),
  ]);
  if (!isPathInside(canonicalRepositoryRoot, canonicalDirectory)) {
    throw new Error(`${label} escapes its canonical repository boundary.`);
  }
  return {
    canonicalDirectory,
    canonicalRepositoryRoot,
    exists: true,
    resolvedDirectoryPath,
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedRelativePath(parentPath, childPath) {
  return path.relative(parentPath, childPath).split(path.sep).join("/");
}

export async function auditManagedArticleImageBuildFilesystem({
  audit,
  repositoryRoot = process.cwd(),
  distDirectory = path.join(repositoryRoot, "dist"),
}) {
  const findings = [];
  if (!audit || !Array.isArray(audit.findings)) {
    return [
      finding(
        "managed-image-source-audit",
        MANAGED_ARTICLE_IMAGE_SOURCE_ROOT,
        "Built-output verification requires a completed managed image source audit.",
      ),
    ];
  }
  if (audit.findings.length > 0) {
    return audit.findings.map((issue) =>
      finding(
        "managed-image-source-audit",
        issue.location,
        `[${issue.code}] ${issue.message}`,
      ),
    );
  }

  const expectedByFileName = new Map();
  for (const image of audit.publishedImages ?? []) {
    const existing = expectedByFileName.get(image.filename);
    if (
      existing &&
      (existing.articleSlug !== image.articleSlug ||
        existing.publicUrl !== image.publicUrl)
    ) {
      findings.push(
        finding(
          "managed-image-output-collision",
          image.filename,
          "Published managed image manifest contains conflicting owners.",
        ),
      );
      continue;
    }
    expectedByFileName.set(image.filename, image);
  }

  for (const [fileName, image] of expectedByFileName) {
    try {
      const current = await inspectManagedArticleImage({
        articleSlug: image.articleSlug,
        publicUrl: image.publicUrl,
        repositoryRoot,
      });
      if (
        current.byteLength !== image.byteLength ||
        sha256(current.bytes) !== sha256(image.bytes)
      ) {
        findings.push(
          finding(
            "managed-image-source-changed",
            fileName,
            "Private source bytes changed after the lifecycle audit.",
          ),
        );
      }
      expectedByFileName.set(fileName, { ...image, bytes: current.bytes });
    } catch (error) {
      findings.push(
        finding(
          "managed-image-source-changed",
          fileName,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  const resolvedDistDirectory = path.resolve(distDirectory);
  const managedOutputRoot = path.join(
    resolvedDistDirectory,
    MANAGED_ARTICLE_IMAGE_PUBLIC_ROOT.slice(1),
  );
  let outputBoundary;
  try {
    outputBoundary = await inspectSafeDirectoryBoundary(
      repositoryRoot,
      managedOutputRoot,
    );
  } catch (error) {
    findings.push(
      finding(
        "unsafe-managed-output",
        normalizedRelativePath(repositoryRoot, managedOutputRoot),
        error instanceof Error ? error.message : String(error),
      ),
    );
    return findings;
  }

  if (!outputBoundary.exists) {
    if (expectedByFileName.size > 0) {
      findings.push(
        finding(
          "managed-image-output-set",
          normalizedRelativePath(repositoryRoot, managedOutputRoot),
          `Missing published managed images: ${[...expectedByFileName.keys()].sort().join(", ")}.`,
        ),
      );
    }
    return findings;
  }

  const actualPaths = new Set();
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizedRelativePath(
        outputBoundary.resolvedDirectoryPath,
        absolutePath,
      );
      actualPaths.add(relativePath);
      let details;
      try {
        details = await lstat(absolutePath);
      } catch (error) {
        findings.push(
          finding(
            "unsafe-managed-output",
            relativePath,
            `Managed output became unreadable: ${error instanceof Error ? error.message : error}`,
          ),
        );
        continue;
      }
      if (details.isSymbolicLink()) {
        findings.push(
          finding(
            "unsafe-managed-output",
            relativePath,
            "Managed output cannot contain a symbolic link or junction.",
          ),
        );
        continue;
      }

      let canonicalPath;
      try {
        canonicalPath = await realpath(absolutePath);
      } catch (error) {
        findings.push(
          finding(
            "unsafe-managed-output",
            relativePath,
            `Managed output canonical path is unreadable: ${error instanceof Error ? error.message : error}`,
          ),
        );
        continue;
      }
      if (
        !isPathInside(outputBoundary.canonicalRepositoryRoot, canonicalPath) ||
        !isPathInside(outputBoundary.canonicalDirectory, canonicalPath)
      ) {
        findings.push(
          finding(
            "unsafe-managed-output",
            relativePath,
            "Managed output escapes its canonical output boundary.",
          ),
        );
        continue;
      }

      if (details.isDirectory()) {
        findings.push(
          finding(
            "nonregular-managed-output",
            relativePath,
            "Managed output must contain regular files in one flat directory.",
          ),
        );
        continue;
      }
      if (!details.isFile()) {
        findings.push(
          finding(
            "nonregular-managed-output",
            relativePath,
            "Managed output entries must be regular files.",
          ),
        );
        continue;
      }

      let outputBytes;
      try {
        ({ bytes: outputBytes } = await readStableRegularFile({
          repositoryRoot,
          boundaryRoot: outputBoundary.resolvedDirectoryPath,
          filePath: absolutePath,
          label: "Managed image output",
          maxBytes: MANAGED_ARTICLE_IMAGE_MAX_BYTES,
        }));
      } catch (error) {
        findings.push(
          finding(
            "unsafe-managed-output",
            relativePath,
            error instanceof Error ? error.message : String(error),
          ),
        );
        continue;
      }

      const expected = expectedByFileName.get(relativePath);
      if (
        expected &&
        (outputBytes.byteLength !== expected.bytes.byteLength ||
          sha256(outputBytes) !== sha256(expected.bytes))
      ) {
        findings.push(
          finding(
            "managed-image-output-bytes",
            relativePath,
            "Built managed image bytes do not match the validated private source.",
          ),
        );
      }
    }
  }
  await walk(outputBoundary.resolvedDirectoryPath);
  try {
    const recheckedBoundary = await inspectSafeDirectoryBoundary(
      repositoryRoot,
      managedOutputRoot,
    );
    if (
      !recheckedBoundary.exists ||
      recheckedBoundary.canonicalDirectory !==
        outputBoundary.canonicalDirectory ||
      recheckedBoundary.canonicalRepositoryRoot !==
        outputBoundary.canonicalRepositoryRoot
    ) {
      throw new Error(
        "Managed image output root changed while it was being inspected.",
      );
    }
  } catch (error) {
    findings.push(
      finding(
        "unsafe-managed-output",
        normalizedRelativePath(repositoryRoot, managedOutputRoot),
        error instanceof Error ? error.message : String(error),
      ),
    );
  }

  const expectedPaths = new Set(expectedByFileName.keys());
  const missing = [...expectedPaths]
    .filter((fileName) => !actualPaths.has(fileName))
    .sort();
  const extra = [...actualPaths]
    .filter((fileName) => !expectedPaths.has(fileName))
    .sort();
  if (missing.length > 0 || extra.length > 0) {
    findings.push(
      finding(
        "managed-image-output-set",
        normalizedRelativePath(repositoryRoot, managedOutputRoot),
        `missing [${missing.join(", ") || "none"}]; extra [${extra.join(", ") || "none"}].`,
      ),
    );
  }
  return findings;
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
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "CDN-Cache-Control":
        "public, max-age=86400, stale-while-revalidate=604800",
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
