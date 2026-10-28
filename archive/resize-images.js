const sharp = require('sharp');
const path = require('path');
// Store requirement: 1280x800 or 640x400, JPEG or 24-bit PNG (no alpha)
const W = 1280;
const H = 800;
const OUT_DIR = path.resolve(__dirname, '../local/legacy-resized');

async function resize(file) {
  const name = path.basename(file, path.extname(file)) + '_1280x800.png';
  const outPath = path.join(OUT_DIR, name);
  await sharp(file)
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .flatten({ background: { r: 30, g: 30, b: 40 } }) // no alpha = 24-bit PNG
    .png()
    .toFile(outPath);
  console.log(path.basename(file), '->', name);
}

async function main() {
  const files = [
    path.resolve(__dirname, '../screenshots/legacy/Screenshot 2026-03-06 184239.png'),
    path.resolve(__dirname, '../screenshots/legacy/exemplev2.png')
  ];
  const fs = require('fs');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of files) {
    try {
      if (fs.existsSync(f)) await resize(f);
      else console.error('Not found:', f);
    } catch (e) {
      console.error(f, e.message);
    }
  }
  console.log('Done. Output in', OUT_DIR);
}
main();
