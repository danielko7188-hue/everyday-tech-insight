import { expect, test } from "@playwright/test";

test("ISSUE-004 marks Guides as the current mobile section on article routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/articles/run-a-30-day-business-technology-pilot/");

  const menu = page.locator(".site-header__mobile-menu");
  await menu.locator("summary").click();
  await expect(
    menu.getByRole("link", { name: "Guides", exact: true }),
  ).toHaveAttribute("aria-current", "location");
});
