/*
  図解スライド（HTML）を PDF にする。
  使い方: node tools/slides/topdf.js tools/slides/fe-10.html fe/terms/10.pdf
  （Playwright が入っている環境で動かす。1枚 960×540px）
*/
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const [src, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto("file://" + path.resolve(src));
  await page.waitForTimeout(500);
  await page.pdf({ path: out, width: "960px", height: "540px", printBackground: true });
  await browser.close();
})();
