// 午後（科目B）演習の画像を作る。Node と ImageMagick（convert）だけを使う。
// 使い方：node tools/pm/images.mjs ap/pm/2024r06a-1.json [素材のフォルダ]
//   素材のフォルダの既定は /mnt/project-files/ipa-kakomon/ap-pm/{回}/（p-NN.png がある所）
// 作るもの：
//   1. 図の切り出し  ap/pm/img/{key}-{fig id}.webp   … JSON の figures[].crop（page・x・y・w・h）どおり
//   2. 原本のページ  ap/pm/img/{回}-pNN.webp         … JSON の pages の番号
// どちらもグレーの非可逆 WebP。細かい字が潰れるので縮小はしない（設計書 1-3）。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error("使い方：node tools/pm/images.mjs ap/pm/{key}.json [素材のフォルダ]");
  process.exit(1);
}
const q = JSON.parse(readFileSync(jsonPath, "utf8"));
const src = process.argv[3] || `/mnt/project-files/ipa-kakomon/ap-pm/${q.exam}/`;
const outDir = join(dirname(resolve(jsonPath)), "img");
mkdirSync(outDir, { recursive: true });

const page = (n) => join(src, `p-${String(n).padStart(2, "0")}.png`);
const webp = ["-colorspace", "Gray", "-define", "webp:lossless=false", "-define", "webp:method=6"];

const made = [];
for (const fig of q.figures || []) {
  const c = fig.crop;
  const out = join(dirname(resolve(jsonPath)), fig.file);
  execFileSync("convert", [page(c.page), "-crop", `${c.w}x${c.h}+${c.x}+${c.y}`, "+repage", ...webp, "-quality", "85", out]);
  made.push(out);
}
for (const n of q.pages || []) {
  const out = join(outDir, `${q.exam}-p${String(n).padStart(2, "0")}.webp`);
  // この版の convert は -quality を変えても大きさが変わらない。400KB に収まらない問だけ、
  // JSON の pageTargetKB（1ページの目安の KB）で webp:target-size を指定して小さくする（無ければ今までどおり）
  const target = q.pageTargetKB ? ["-define", `webp:target-size=${q.pageTargetKB * 1024}`] : [];
  execFileSync("convert", [page(n), ...webp, ...target, "-quality", "70", out]);
  made.push(out);
}
let total = 0;
for (const f of made) {
  const size = existsSync(f) ? statSync(f).size : 0;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  合計`);
