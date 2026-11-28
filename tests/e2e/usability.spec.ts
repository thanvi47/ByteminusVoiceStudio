import { test, expect } from "@playwright/test";

test("draft survives refresh including blank text and autoplay preference", async ({ page }) => {
  await page.goto("/");
  const script = page.getByRole("textbox", { name: "Script", exact: true });
  await script.fill("আমার নতুন গল্প।");
  await page.getByLabel("Play automatically when ready").uncheck();
  await expect(page.getByText("Draft saved on this browser", { exact: true })).toBeVisible();
  await page.reload();
  await expect(script).toHaveValue("আমার নতুন গল্প।");
  await expect(page.getByLabel("Play automatically when ready")).not.toBeChecked();
  await script.fill("");
  await expect(page.getByText("Draft saved on this browser", { exact: true })).toBeVisible();
  await page.reload();
  await expect(script).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("progress reflects server percentage and cancellation waits for acknowledgment", async ({ page }) => {
  let finish: (() => void) | undefined;
  await page.route("**/api/tts/generate", async (route) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    await route.fulfill({ status: 499, json: { error: { message: "Generation cancelled." } } });
  });
  const measured = Date.now();
  await page.route("**/api/tts/progress?*", (route) => route.fulfill({ json: { status: "running", percent: 37, stage: "Rendering section 2 of 5", estimate: { low: 60, high: 180, samples: 2, updated: measured }, memory: { totalGB: 16, freeGB: 1.2, pressure: "high" } } }));
  await page.route("**/api/tts/cancel?*", (route) => route.fulfill({ json: { status: "cancelling" } }));
  await page.goto("/");
  await page.getByRole("button", { name: /Generate voice \+ SRT/ }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "37");
  await expect(page.getByText(/Approx\..*remaining/)).toBeVisible();
  await expect(page.getByText(/Server RAM: 1.2 GB free/)).toBeVisible();
  await expect(page.getByText(/Low free RAM: close unused apps/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel generation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelling…", exact: true })).toBeDisabled();
  finish?.();
  await expect(page.getByText("Generation cancelled. No partial recording was saved.")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
