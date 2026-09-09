import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

it("distributes the exact Instrument Sans copyright notice and font license", async () => {
  const bundledLicense = await readFile(
    "node_modules/@fontsource-variable/instrument-sans/LICENSE",
    "utf8",
  );
  const publicLicense = await readFile(
    "public/fonts/LICENSE-instrument-sans.txt",
    "utf8",
  );
  expect(publicLicense).toBe(bundledLicense);
});
