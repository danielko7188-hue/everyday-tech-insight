import { expect, test } from "@playwright/test";

test("ISSUE-005 links the evidence source count and withholds unverified review dates", async ({
  page,
}) => {
  await page.goto("/articles/evaluate-saas-with-a-practical-checklist/");

  const evidence = page.getByRole("region", { name: "Article evidence" });
  await expect(
    evidence.getByRole("link", { name: /cited sources/ }),
  ).toHaveAttribute("href", "#sources");
  await expect(evidence).not.toContainText(/reviewed/i);
});
