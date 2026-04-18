import sharp from "sharp";
import { writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

const SRC = "public/ima-logo.png";
const OUT_ICON = "src/app/icon.png";
const OUT_APPLE = "src/app/apple-icon.png";
const OLD_FAVICON = "src/app/favicon.ico";
const TINT = "#2563EB"; // ima-primary

// Detected glyph box in the source lockup
const CROP = { left: 41, top: 60, width: 168, height: 147 };

const square = Math.max(CROP.width, CROP.height);
const padX = Math.floor((square - CROP.width) / 2);
const padY = Math.floor((square - CROP.height) / 2);

// 1) Crop glyph, pad to square transparent canvas
const glyphSquare = await sharp(SRC)
  .extract(CROP)
  .extend({
    top: padY,
    bottom: square - CROP.height - padY,
    left: padX,
    right: square - CROP.width - padX,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

async function renderFavicon(size, outerPad) {
  const inner = size - outerPad * 2;
  // Resize glyph to `inner` preserving aspect (already square)
  const glyphSized = await sharp(glyphSquare)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Use its alpha as a mask on top of a solid TINT canvas → recolor without mixing
  const tintedGlyph = await sharp({
    create: { width: inner, height: inner, channels: 4, background: TINT },
  })
    .composite([{ input: glyphSized, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Place on transparent favicon canvas with outer padding
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: tintedGlyph, left: outerPad, top: outerPad }])
    .png()
    .toBuffer();
}

const icon512 = await renderFavicon(512, 48);
await writeFile(OUT_ICON, icon512);

const apple = await renderFavicon(180, 20);
await writeFile(OUT_APPLE, apple);

if (existsSync(OLD_FAVICON)) {
  await unlink(OLD_FAVICON);
  console.log("removed:", OLD_FAVICON);
}

console.log("wrote:", OUT_ICON, OUT_APPLE);
