/**
 * Generates all Microsoft Store / MSIX-required tile + splash assets
 * from the existing PWA source icon (public/app_icon-512.png).
 *
 * Produces scale-100/125/150/200/400 variants for each logo declared
 * in packaging/AppxManifest.xml, written to packaging/assets/.
 *
 * Uses sharp (already a devDependency).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const SOURCE_ICON = path.join(root, 'public', 'app_icon-512.png');
const OUT_DIR = path.join(root, 'packaging', 'assets');

// (logoBaseName, width, height) at scale-100
const LOGOS = [
  { name: 'Square44x44Logo', w: 44, h: 44 },
  { name: 'Square71x71Logo', w: 71, h: 71 },
  { name: 'Square150x150Logo', w: 150, h: 150 },
  { name: 'Square310x310Logo', w: 310, h: 310 },
  { name: 'StoreLogo', w: 50, h: 50 },
  // Non-square assets
  { name: 'Wide310x150Logo', w: 310, h: 150 },
  { name: 'SplashScreen', w: 620, h: 300 },
];

const SCALES = [100, 125, 150, 200, 400];

async function main() {
  if (!(await fileExists(SOURCE_ICON))) {
    throw new Error(`Source icon not found: ${SOURCE_ICON}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  // Clean previous PNGs in assets (keep .gitkeep)
  const existing = await fs.readdir(OUT_DIR);
  await Promise.all(
    existing
      .filter((f) => f.endsWith('.png'))
      .map((f) => fs.unlink(path.join(OUT_DIR, f)).catch(() => {}))
  );

  const source = sharp(SOURCE_ICON);
  let count = 0;

  for (const { name, w, h } of LOGOS) {
    for (const scale of SCALES) {
      const factor = scale / 100;
      const outW = Math.round(w * factor);
      const outH = Math.round(h * factor);
      const outFile = `${name}.scale-${scale}.png`;
      // cover (crop) so non-square tiles don't distort
      await source
        .clone()
        .resize(outW, outH, { fit: 'cover', position: 'centre' })
        .png()
        .toFile(path.join(OUT_DIR, outFile));
      count++;
      process.stdout.write(`  ✓ ${outFile} (${outW}x${outH})\n`);
    }
  }

  process.stdout.write(`\nGenerated ${count} icon assets in ${path.relative(root, OUT_DIR)}\n`);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});