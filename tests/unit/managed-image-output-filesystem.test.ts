import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
  auditManagedArticleImageBuildFilesystem,
  auditManagedArticleImages,
} from "../../src/utils/managed-article-images.mjs";

const temporaryDirectories: string[] = [];

function isLinkPrivilegeError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    ["EPERM", "EACCES"].includes(String((error as NodeJS.ErrnoException).code))
  );
}

function findingCodes(findings: Array<{ code: string }>) {
  return findings.map(({ code }) => code);
}

async function rasterBuffer(width = 12) {
  return sharp({
    create: {
      width,
      height: 8,
      channels: 3,
      background: "#6d28d9",
    },
  })
    .png()
    .toBuffer();
}

async function sourceFixture() {
  const repositoryRoot = await mkdtemp(
    path.join(os.tmpdir(), "eti-managed-output-"),
  );
  temporaryDirectories.push(repositoryRoot);
  const sourceRoot = path.join(
    repositoryRoot,
    "src",
    "content-assets",
    "articles",
  );
  await mkdir(sourceRoot, { recursive: true });
  const filename = "published-guide-decision-flow.png";
  const bytes = await rasterBuffer();
  await writeFile(path.join(sourceRoot, filename), bytes);
  const articles = [
    {
      fileName: "published-guide.md",
      data: { slug: "published-guide", status: "published" },
      body: `![Decision workflow with approval and review steps](/images/articles/${filename})`,
    },
  ];
  const audit = await auditManagedArticleImages(articles, { repositoryRoot });
  expect(audit.findings).toEqual([]);
  return {
    audit,
    bytes,
    distDirectory: path.join(repositoryRoot, "dist"),
    filename,
    repositoryRoot,
  };
}

async function writeExpectedOutput(
  fixture: Awaited<ReturnType<typeof sourceFixture>>,
) {
  const managedRoot = path.join(fixture.distDirectory, "images", "articles");
  await mkdir(managedRoot, { recursive: true });
  await writeFile(path.join(managedRoot, fixture.filename), fixture.bytes);
  return managedRoot;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("managed image built-output filesystem boundary", () => {
  it("accepts only byte-identical published output", async () => {
    const fixture = await sourceFixture();
    await writeExpectedOutput(fixture);

    await expect(
      auditManagedArticleImageBuildFilesystem(fixture),
    ).resolves.toEqual([]);
  });

  it("rejects output whose bytes or hash differ from the validated repository-tracked source", async () => {
    const fixture = await sourceFixture();
    const managedRoot = await writeExpectedOutput(fixture);
    const alteredBytes = Buffer.from(fixture.bytes);
    alteredBytes[alteredBytes.length - 1] =
      (alteredBytes[alteredBytes.length - 1] ?? 0) ^ 0xff;
    expect(alteredBytes.byteLength).toBe(fixture.bytes.byteLength);
    await writeFile(path.join(managedRoot, fixture.filename), alteredBytes);

    expect(
      findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
    ).toContain("managed-image-output-bytes");
  });

  it("rejects an extra managed output file", async () => {
    const fixture = await sourceFixture();
    const managedRoot = await writeExpectedOutput(fixture);
    await writeFile(
      path.join(managedRoot, "draft-guide-private-flow.png"),
      fixture.bytes,
    );

    expect(
      findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
    ).toContain("managed-image-output-set");
  });

  it("rejects a repository-tracked source that changes after the lifecycle audit", async () => {
    const fixture = await sourceFixture();
    await writeExpectedOutput(fixture);
    await writeFile(
      path.join(
        fixture.repositoryRoot,
        "src",
        "content-assets",
        "articles",
        fixture.filename,
      ),
      await rasterBuffer(13),
    );

    expect(
      findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
    ).toContain("managed-image-source-changed");
  });

  it("allows zero published media with no output path", async () => {
    const repositoryRoot = await mkdtemp(
      path.join(os.tmpdir(), "eti-managed-output-empty-"),
    );
    temporaryDirectories.push(repositoryRoot);

    await expect(
      auditManagedArticleImageBuildFilesystem({
        audit: { findings: [], publishedImages: [], referencedImages: [] },
        distDirectory: path.join(repositoryRoot, "dist"),
        repositoryRoot,
      }),
    ).resolves.toEqual([]);
  });

  it("rejects a directory where a published image file must be", async () => {
    const fixture = await sourceFixture();
    await mkdir(
      path.join(fixture.distDirectory, "images", "articles", fixture.filename),
      { recursive: true },
    );

    expect(
      findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
    ).toContain("nonregular-managed-output");
  });

  for (const [label, segments] of [
    ["dist root", ["dist"]],
    ["dist ancestor", ["dist", "images"]],
    ["managed root", ["dist", "images", "articles"]],
  ] as const) {
    it(`rejects a linked ${label}`, async (context) => {
      const fixture = await sourceFixture();
      const linkPath = path.join(fixture.repositoryRoot, ...segments);
      const target = path.join(
        fixture.repositoryRoot,
        `real-${segments.join("-")}`,
      );
      await mkdir(target, { recursive: true });
      await mkdir(path.dirname(linkPath), { recursive: true });
      try {
        await symlink(target, linkPath, "junction");
      } catch (error) {
        if (isLinkPrivilegeError(error)) return context.skip();
        throw error;
      }

      expect(
        findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
      ).toContain("unsafe-managed-output");
    });
  }

  it("rejects a linked managed output file", async (context) => {
    const fixture = await sourceFixture();
    const managedRoot = path.join(fixture.distDirectory, "images", "articles");
    const target = path.join(fixture.repositoryRoot, "outside-output.png");
    await mkdir(managedRoot, { recursive: true });
    await writeFile(target, fixture.bytes);
    try {
      await symlink(target, path.join(managedRoot, fixture.filename), "file");
    } catch (error) {
      if (isLinkPrivilegeError(error)) return context.skip();
      throw error;
    }

    expect(
      findingCodes(await auditManagedArticleImageBuildFilesystem(fixture)),
    ).toContain("unsafe-managed-output");
  });

  it.each(["ENOSYS", "UNKNOWN", "EINVAL"])(
    "does not treat %s as a link-privilege skip",
    (code) => {
      expect(
        isLinkPrivilegeError(Object.assign(new Error(code), { code })),
      ).toBe(false);
    },
  );
});
