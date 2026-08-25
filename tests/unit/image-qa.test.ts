import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { printImageFindings, runImageQa } from "../../scripts/qa-images.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

describe("article image QA command", () => {
  it("audits the real repository across every article lifecycle state", async () => {
    await expect(runImageQa({ repositoryRoot })).resolves.toMatchObject({
      findings: [],
      publishedImages: [],
      referencedImages: [],
    });
  });

  it("prints the exact success sentinel without overstating rights review", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    printImageFindings([]);

    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith("IMAGE QA PASS");
    expect(log.mock.calls.flat().join(" ")).not.toMatch(
      /rights|license|credit/i,
    );
    log.mockRestore();
  });

  it("prints actionable failures and no success sentinel", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    printImageFindings([
      {
        code: "orphan-managed-image",
        location: "guide-orphan.png",
        message: "Source image is unreferenced.",
      },
    ]);

    expect(error.mock.calls.flat().join(" ")).toContain("IMAGE QA FAIL");
    expect(error.mock.calls.flat().join(" ")).toContain("orphan-managed-image");
    expect(error.mock.calls.flat().join(" ")).not.toContain("IMAGE QA PASS");
    error.mockRestore();
  });

  it("exposes the focused script in the integrated QA pipeline", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    );

    expect(packageJson.scripts["check:images"]).toBe(
      "node scripts/qa-images.mjs",
    );
    expect(packageJson.scripts.qa).toContain("npm run check:images");
    expect(
      packageJson.scripts.qa.indexOf("npm run check:content"),
    ).toBeLessThan(packageJson.scripts.qa.indexOf("npm run check:images"));
    expect(packageJson.scripts.qa.indexOf("npm run check:images")).toBeLessThan(
      packageJson.scripts.qa.indexOf("npm run check:seo"),
    );
  });
});
