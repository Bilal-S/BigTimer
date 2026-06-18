/**
 * Builds an MSIX package for the Microsoft Store from the BigTimer PWA.
 *
 * Flow:
 *  1. Read packaging/package.config.json (gitignored) — real identity.
 *  2. Substitute placeholders in packaging/AppxManifest.xml → packaging/build/AppxManifest.xml.
 *  3. Ensure icon assets exist (calls generate-icons.mjs if missing).
 *  4. Stage the package layout (manifest + assets/) under packaging/build/stage/.
 *  5. Run MakeAppx.exe pack → packaging/build/<Identity>_<version>_x64.msix.
 *  6. Optional local install testing:
 *     - --sign-local: MakeCert + signtool with a self-signed cert (gitignored),
 *       plus prints the cert-install steps. Store submission does NOT need this.
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
    .replaceAll('{{APP_DESCRIPTION}}', PACKAGE_JSON.title || config.properties.appName);
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

async function stagePackage(config) {
  await fs.rm(BUILD_DIR, { recursive: true, force: true });
  await fs.mkdir(STAGE_DIR, { recursive: true });
  await fs.mkdir(STAGE_ASSETS_DIR, { recursive: true });

  const { content, version } = await substituteManifest(config);
  await fs.writeFile(path.join(STAGE_DIR, 'AppxManifest.xml'), content, 'utf8');

  // copy assets
  const files = await fs.readdir(ASSETS_DIR);
  await Promise.all(
    files
      .filter((f) => f.endsWith('.png'))
      .map((f) => fs.copyFile(path.join(ASSETS_DIR, f), path.join(STAGE_ASSETS_DIR, f)))
  );
  return { version };
}

// ---------- signing (local testing only) ----------

async function signLocal(msixPath, config) {
  const makeCert = await findSdkTool('MakeCert.exe');
  const signtool = await findSdkTool('signtool.exe');
  if (!makeCert || !signtool) {
    log(
      '⚠ MakeCert.exe or signtool.exe not found. Skipping local signing.\n' +
        '  Install the Windows SDK. The MSIX is still built (unsigned) at:\n  ' +
        path.relative(root, msixPath)
    );
    return;
  }

  const certName = config.identity.name;
  const pfxPath = path.join(PKG_DIR, `${certName}.pfx`);
  const cerPath = path.join(PKG_DIR, `${certName}.cer`);
  const password = 'bigtimer-local'; // local-testing only; pfx is gitignored

  log('\n🔐 Creating local self-signed certificate (gitignored)...');
  run(makeCert, [
    '/n', `"CN=${certName}"`,
    '/r',
    '/h', '0',
    '/eku', '1.3.6.1.5.5.7.3.3',
    '/pe',
    `/sv`, `"${pfxPath}"`,
    `"${cerPath}"`,
  ].concat(password ? ['/pv', password] : []), { cwd: PKG_DIR });

  log('\n✍️  Signing MSIX with signtool ...');
  run(signtool, [
    'sign',
    '/fd', 'SHA256',
    '/f', `"${pfxPath}"`,
    password ? ['/p', password] : [],
    `"${msixPath}"`,
  ].flat());

  log(`\n✓ Signed. For local install, run in an admin PowerShell:\n` +
      `  Import-Certificate -FilePath "${path.resolve(cerPath)}" -CertStoreLocation Cert:\\LocalMachine\\Root\n` +
      `  Add-AppxPackage -Path "${path.resolve(msixPath)}"`);
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2);
  const signLocalFlag = argv.includes('--sign-local');

  log('==> Loading package config ...');
  const config = await loadConfig();
  log(`    Identity : ${config.identity.name}`);
  log(`    Publisher: ${config.identity.publisher}`);
  log(`    StartPage: ${config.startPage}`);

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

  if (signLocalFlag) {
    await signLocal(msixPath, config);
  } else {
    log(
      '\nℹ️  Unsigned build. For Store submission, upload this MSIX via Partner Center\n' +
        '   (Microsoft re-signs it). For local install testing, re-run with --sign-local.'
    );
  }
}

main().catch((err) => {
  console.error('\n✗ Packaging failed:', err);
  process.exit(1);
});