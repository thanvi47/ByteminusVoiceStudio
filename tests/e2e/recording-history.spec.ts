import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/clones", (route) => route.fulfill({ json: { installed: true, profiles: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Test voice", duration: 8, language: "en" },
  ] } }));
});

function waveFixture() {
  const samples = Buffer.alloc(4800 * 2 + 44);
  samples.write("RIFF", 0); samples.writeUInt32LE(samples.length - 8, 4); samples.write("WAVEfmt ", 8);
  samples.writeUInt32LE(16, 16); samples.writeUInt16LE(1, 20); samples.writeUInt16LE(1, 22);
  samples.writeUInt32LE(24000, 24); samples.writeUInt32LE(48000, 28); samples.writeUInt16LE(2, 32); samples.writeUInt16LE(16, 34);
  samples.write("data", 36); samples.writeUInt32LE(samples.length - 44, 40);
  return samples;
}

test("saved audio survives reload with a script title and can be downloaded and deleted", async ({ page }) => {
  const samples = waveFixture();
  await page.route("**/api/tts/generate", (route) => route.fulfill({ status: 200, contentType: "audio/wav", body: samples,
    headers: { "X-Audio-Duration": "0.2", "X-Audio-Peaks": "[]" } }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Script", exact: true }).fill("আজ একটি নতুন দিন।");
  await page.getByRole("button", { name: /Generate voice \+ SRT/ }).click();
  await expect(page.getByRole("heading", { name: "আজ একটি নতুন দিন bn", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "আজ একটি নতুন দিন bn", exact: true })).toBeVisible();
  await page.locator("audio").last().evaluate(async (audio: HTMLAudioElement) => { await audio.play(); });
  await page.reload();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "আজ একটি নতুন দিন bn", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download voice", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("আজ একটি নতুন দিন bn.wav");
  const subtitles = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download SRT", exact: true }).click();
  expect((await subtitles).suggestedFilename()).toBe("আজ একটি নতুন দিন bn.srt");
  await page.getByRole("button", { name: "Delete আজ একটি নতুন দিন bn", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved recordings yet." })).toBeVisible();
});

test("playground direction and cloned results are included in persistent history", async ({ page }) => {
  const directions: string[] = [];
  await page.route(/\/api\/(tts|clones)\/generate$/, (route) => {
    directions.push(route.request().postDataJSON().style ?? "");
    return route.fulfill({ status: 200, contentType: "audio/wav", body: waveFixture(),
    headers: { "X-Audio-Duration": "0.2", "X-Audio-Peaks": "[]" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Voice playground", exact: true }).click();
  await page.getByRole("textbox", { name: "Playground script", exact: true }).fill("A mature voice for our story.");
  await page.getByRole("button", { name: /^Mature, warm & confident/ }).click();
  await expect(page.getByRole("textbox", { name: "Direction Voice affect", exact: true })).toHaveValue(/Mature/);
  await page.getByRole("button", { name: "Generate a take", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A mature voice for our story en", exact: true })).toBeVisible();
  expect(directions[0]).toContain("rich vocal texture");
  await page.getByRole("button", { name: "Voice cloning", exact: true }).click();
  await page.getByRole("textbox", { name: "Your script", exact: true }).fill("My saved cloned voice.");
  await page.getByRole("button", { name: "Generate cloned voice + SRT", exact: true }).click();
  await expect(page.getByText(/My saved cloned voice en · Test voice/)).toBeVisible();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A mature voice for our story en", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My saved cloned voice en", exact: true })).toBeVisible();
});
