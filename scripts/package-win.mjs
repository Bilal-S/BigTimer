/**
 * Builds a fully self-contained MSIX package for the Microsoft Store / local install
 * from the BigTimer PWA.
 *
 * Flow:
 *  1. Read packaging/package.config.json (gitignored) — real identity.
 *  2. Run `vite build` to produce a fresh dist/ (local web content).
 *  3. Ensure icon assets exist (calls generate-icons.mjs if missing).
 *  4. Substitute placeholders in packaging/AppxManifest.xml.
 *  5. Stage the package layout under packaging/build/stage/:
 *     - AppxManifest.xml
 *     - assets/   (Store-required tile/splash icons)
 *     - dist/ contents copied to the stage root (index.html, JS, CSS, fonts, SW, ...)
 *  6. Run MakeAppx.exe pack → packaging/build/<Identity>_<version>_x64.msix
 *
 * The package is UNSIGNED. Install locally with:
 *   Add-AppxPackage -Path "<...>.msix" -AllowUnsigned
 *
 * For Store submission, upload the unsigned MSIX via Partner Center; Microsoft re-signs it.
 *
 * Requires Windows SDK tools on PATH or at the standard install location.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const PKG_DIR = path.join(root, 'packaging');
const CONFIG_PATH = path.join(PKG_DIR, 'package.config.json');
const MANIFEST_TEMPLATE = path.join(PKG_DIR, 'AppxManifest.xml');
const BUILD_DIR = path.join(PKG_DIR, 'build');
const STAGE_DIR = path.join(BUILD_DIR, 'stage');
const ASSETS_DIR = path.join(PKG_DIR, 'assets');
const STAGE_ASSETS_DIR = path.join(STAGE_DIR, 'assets');
const DIST_DIR = path.join(root, 'dist');

const PACKAGE_JSON = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8')
);

// ---------- helpers ----------

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    log(
      `✗ Missing ${path.relative(root, CONFIG_PATH)}.\n` +
        `  Copy packaging/package.config.example.json → package.config.json\n` +
        `  and fill in your Partner Center identity.`
    );
    process.exit(1);
  }
  const raw = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

async function findSdkTool(exeName) {
  // 1. On PATH
  const which = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(which, [exeName], { encoding: 'utf8' });
    if (r.status === 0) {
      const found = r.stdout.trim().split(/\r?\n/)[0];
      if (found && existsSync(found)) return found;
    }
  } catch {
    /* ignore */
  }

  // 2. Windows Kits install dirs
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const kitsRoots = [
    path.join(programFilesX86, 'Windows Kits', '10', 'bin'),
  ];
  if (process.env.WindowsSdkBinPath) kitsRoots.push(process.env.WindowsSdkBinPath);

  for (const root0 of kitsRoots) {
    if (!existsSync(root0)) continue;
    let archs = [];
    try {
      archs = (await fs.readdir(root0)).filter((d) => /^10\./.test(d));
    } catch {
      continue;
    }
    // newest first
    archs.sort((a, b) => (a < b ? 1 : -1));
    for (const sdkVer of archs) {
      // Prefer the host arch subdir (x64 host is standard)
      for (const host of ['x64', 'x86']) {
        const candidate = path.join(root0, sdkVer, host, exeName);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

function run(toolPath, args, opts = {}) {
  const cmd = `"${toolPath}" ${args.join(' ')}`;
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function runNpm(scriptName) {
  const cmd = `npm run ${scriptName}`;
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root });
}

async function substituteManifest(config) {
  const tpl = await fs.readFile(MANIFEST_TEMPLATE, 'utf8');
  const version = (config.version || `${PACKAGE_JSON.version}.0`).replace(/-\d+$/, '');
  const out = tpl
    .replaceAll('{{IDENTITY_NAME}}', config.identity.name)
    .replaceAll('{{IDENTITY_PUBLISHER}}', config.identity.publisher)
    .replaceAll('{{VERSION}}', version)
    .replaceAll('{{APP_NAME}}', config.properties.appName)
    .replaceAll('{{PUBLISHER_DISPLAY_NAME}}', config.properties.displayName)
    .replaceAll('{{START_PAGE}}', config.startPage)
    .replaceAll('{{APP_DESCRIPTION}}', config.properties.appName);
  return { content: out, version };
}

async function ensureAssets() {
  const hasIcons =
    existsSync(path.join(ASSETS_DIR, 'StoreLogo.scale-100.png')) &&
    existsSync(path.join(ASSETS_DIR, 'Square150x150Logo.scale-100.png'));
  if (!hasIcons) {
    log('• Required icons missing — generating via scripts/generate-icons.mjs ...');
    run(process.execPath, [path.join(__dirname, 'generate-icons.mjs')]);
  }
}

/** Recursively copy a directory's contents into a destination directory. */
async function copyDirContents(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirContents(s, d);
    } else {
      await fs.copyFile(s, d);
    }
  }
}

async function rmWithRetries(target, retries = 3, delayMs = 500) {
  // On Windows, rm can EPERM on locked files. Strategy:
  //  1. Try rm directly.
  //  2. If it fails, rename the locked dir aside and delete that asynchronously.
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === retries) {
        // Final fallback: move the locked dir aside, best-effort delete
        try {
          const moved = `${target}.stale-${Date.now()}`;
          await fs.rename(target, moved);
          fs.rm(moved, { recursive: true, force: true }).catch(() => {});
          return;
        } catch (err2) {
          throw err;
        }
      }
      log(`  ⚠ rm failed (attempt ${attempt}/${retries}): ${err.code} — retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function stagePackage(config) {
  // Fresh stage dir (retry on Windows file-lock issues)
  await rmWithRetries(BUILD_DIR);
  await fs.mkdir(STAGE_DIR, { recursive: true });
  await fs.mkdir(STAGE_ASSETS_DIR, { recursive: true });

  // 1. Manifest
  const { content, version } = await substituteManifest(config);
  await fs.writeFile(path.join(STAGE_DIR, 'AppxManifest.xml'), content, 'utf8');

  // 2. Store tile/splash assets → stage/assets/
  const assetFiles = await fs.readdir(ASSETS_DIR);
  await Promise.all(
    assetFiles
      .filter((f) => f.endsWith('.png'))
      .map((f) => fs.copyFile(path.join(ASSETS_DIR, f), path.join(STAGE_ASSETS_DIR, f)))
  );

  // 3. Local web content (dist/) → stage root
  if (!existsSync(DIST_DIR)) {
    log(`✗ dist/ not found at ${path.relative(root, DIST_DIR)}. Run "npm run build" first.`);
    process.exit(3);
  }
  log('• Copying dist/ (local web content) into package ...');
  await copyDirContents(DIST_DIR, STAGE_DIR);

  return { version };
}

// ---------- main ----------

async function main() {
  log('==> Loading package config ...');
  const config = await loadConfig();
  log(`    Identity : ${config.identity.name}`);
  log(`    Publisher: ${config.identity.publisher}`);
  log(`    StartPage: ${config.startPage}`);

  log('\n==> Building web assets (vite build) ...');
  runNpm('build');

  log('\n==> Ensuring icon assets ...');
  await ensureAssets();

  log('\n==> Staging package ...');
  const { version } = await stagePackage(config);

  const makeAppx = await findSdkTool('MakeAppx.exe');
  if (!makeAppx) {
    log(
      '\n✗ MakeAppx.exe not found.\n' +
        '  Install the Windows 10/11 SDK (Developer Command Prompt provides it).\n' +
        '  Or use the PWA Builder path documented in PACKAGING.md.'
    );
    process.exit(2);
  }

  const msixName = `${config.identity.name}_${version}_x64.msix`;
  const msixPath = path.join(BUILD_DIR, msixName);

  log('\n==> Packing MSIX ...');
  // Directory-based pack: MakeAppx auto-discovers AppxManifest.xml inside /d.
  // /o overwrites without prompting (safe for CI).
  run(makeAppx, [
    'pack',
    '/h', 'SHA256',
    '/o',
    '/d', `"${STAGE_DIR}"`,
    '/p', `"${msixPath}"`,
    '/v',
  ]);

  log(`\n✓ Built: ${path.relative(root, msixPath)}`);
  log(
    '\nℹ️  Unsigned build. Install locally (Developer Mode must be ON) with:\n' +
      `   Add-AppxPackage -Path "${path.resolve(msixPath)}" -AllowUnsigned\n\n` +
      '   For Store submission, upload this MSIX via Partner Center\n' +
      '   (Microsoft re-signs it).'
  );
}

main().catch((err) => {
  console.error('\n✗ Packaging failed:', err);
  process.exit(1);
});