// ショート動画のページを1コマずつ撮って、音声と合わせて縦型 mp4 にする
// 使い方：サイトを http://localhost:8123/ で配信したうえで
//   node tools/short/record.mjs ap/video/short/signature.html [fps=30]
//   node tools/short/record.mjs ap/video/short/signature.html --still 3,10,20   （確かめ用の静止画だけ）
// ページは ?record で開き、window.renderAt(t) で t 秒の絵にしてから撮る。音声はページの data-audio の mp3
import { createRequire } from "module";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const page0 = process.argv[2];
const stillArg = process.argv.indexOf("--still");
const fps = Number(process.argv.find((a) => /^\d+$/.test(a)) || 30);
const base = process.env.SITE || "http://localhost:8123/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(base + page0 + "?record", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__shortReady);
await page.evaluate(() => document.fonts.ready);
const meta = await page.evaluate(async () => {
  const st = document.querySelector(".short-stage");
  const tl = await (await fetch(st.dataset.timeline)).json();
  return { total: tl.total, audio: new URL(st.dataset.audio, location.href).pathname };
});
const outBase = page0.replace(/\.html$/, "");

if (stillArg > 0) {
  for (const t of process.argv[stillArg + 1].split(",").map(Number)) {
    await page.evaluate((t) => window.renderAt(t), t);
    await page.screenshot({ path: `${process.env.OUT || os.tmpdir()}/still-${t}.png` });
  }
  await browser.close();
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "short-"));
const n = Math.ceil(meta.total * fps);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.renderAt(t), i / fps);
  await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.png`) });
  if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)} / ${meta.total.toFixed(0)} 秒`);
}
await browser.close();
const audio = path.join(process.cwd(), decodeURIComponent(meta.audio).replace(/^\//, ""));
execFileSync("ffmpeg", ["-y", "-v", "error", "-framerate", String(fps), "-i", path.join(dir, "%05d.png"), "-i", audio,
  "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
  "-shortest", "-movflags", "+faststart", `${outBase}.mp4`]);
fs.rmSync(dir, { recursive: true });
console.log(`\n${outBase}.mp4`);
