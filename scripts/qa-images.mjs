import path from "node:path";
import { pathToFileURL } from "node:url";

import { auditManagedArticleImages } from "../src/utils/managed-article-images.mjs";
import { readArticleRecords } from "./qa-content.mjs";

export async function runImageQa({ repositoryRoot = process.cwd() } = {}) {
  const articles = await readArticleRecords(
    path.join(repositoryRoot, "src", "content", "articles"),
  );
  return auditManagedArticleImages(articles, { repositoryRoot });
}

export function printImageFindings(findings) {
  if (findings.length === 0) {
    console.log("IMAGE QA PASS");
    return;
  }
  console.error(
    `IMAGE QA FAIL (${findings.length} finding${findings.length === 1 ? "" : "s"})`,
  );
  for (const issue of findings) {
    console.error(`- [${issue.code}] ${issue.location}: ${issue.message}`);
  }
}

async function main() {
  const { findings } = await runImageQa();
  printImageFindings(findings);
  if (findings.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(
      `IMAGE QA ERROR\n${error instanceof Error ? error.stack : error}`,
    );
    process.exitCode = 1;
  });
}
