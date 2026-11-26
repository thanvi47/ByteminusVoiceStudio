import { test, expect } from "@playwright/test";
test("creates real audio and a download", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bring your words to life." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Script", exact: true })
    .fill("আমি বাংলা বলি।");
  await page.getByRole("button", { name: /Generate speech/ }).click();
  await expect(
    page.getByRole("button", { name: "Download WAV", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download WAV", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.wav$/);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
test("restores a saved project", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Script", exact: true })
    .fill("A story worth saving.");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByText("A story worth saving.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Script", exact: true }),
  ).toHaveValue("A story worth saving.");
});
