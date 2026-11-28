import { test, expect } from "@playwright/test";
test("creates real audio and a download", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bring your words to life." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Script", exact: true })
    .fill("আমি বাংলা বলি।");
  await page.getByRole("button", { name: /Generate voice \+ SRT/ }).click();
  await expect(
    page.getByRole("button", { name: "Download WAV", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(
    page.getByRole("button", { name: "Download SRT", exact: true }),
  ).toBeEnabled();
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
test("saved voice samples play without synthesis requests", async ({
  page,
}) => {
  let synthesisRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/tts/generate")) synthesisRequests++;
  });
  await page.goto("/");
  const preview = page.getByRole("button", {
    name: "Preview voice",
    exact: true,
  });
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(preview).toHaveAttribute("aria-pressed", "true");
  expect(synthesisRequests).toBe(0);
  await preview.click();
  await page.reload();
  await expect(preview).toBeEnabled();
  await preview.click();
  await expect(preview).toHaveAttribute("aria-pressed", "true");
  expect(synthesisRequests).toBe(0);
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
    page.getByText("A story worth saving en", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Script", exact: true }),
  ).toHaveValue("A story worth saving.");
});
