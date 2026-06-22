# Packaging Big Timer for the Microsoft Store (MSIX)

This repo supports two paths to produce an MSIX package for the Microsoft Store:

1. **Local build** (`npm run package:win`) — reproducible, lives in this repo.
2. **PWA Builder** (https://www.pwabuilder.com) — Microsoft's official generator, the fastest path.

Both start from the same prerequisite: **the PWA must be deployed to a public HTTPS URL.** Big Timer is hosted at `https://bigtimer.boncode.net/`.

---

## What's in this repo

| Path | Purpose | Committed? |
|------|---------|------------|
| `packaging/AppxManifest.xml` | MSIX manifest template (placeholders) | ✅ |
| `packaging/package.config.example.json` | Config template (placeholders) | ✅ |
| `packaging/package.config.json` | Your real Partner Center identity | ❌ gitignored |
| `packaging/assets/` | Generated Store tile/splash PNGs | ❌ gitignored |
| `packaging/build/` | MSIX build output | ❌ gitignored |
| `packaging/*.pfx`, `*.cer` | Local test signing cert | ❌ gitignored |
| `scripts/generate-icons.mjs` | Generates scaled icons via `sharp` | ✅ |
| `scripts/package-win.mjs` | Orchestrates the local MSIX build | ✅ |

### Secret vs. public
The **Package Identity Name** and **Publisher** string are public (they ship inside every MSIX), but we keep them in a gitignored config file to keep the repo clean and CI-overridable. The **`.pfx` signing key** is a true secret — never committed.

---

## Prerequisites

1. **Microsoft Partner Center account** ($19 one-time) — reserve your app to get:
   - `Package/Identity/Name` → e.g. `BonCode.BigTimer`
   - `Package/Identity/Publisher` → e.g. `CN=6A41398C-...`
   - `Package/Properties/PublisherDisplayName` → e.g. `BonCode`
2. **Windows SDK 10/11** — provides `MakeAppx.exe`, `signtool.exe`, `MakeCert.exe`.
   - Install via Visual Studio Installer (".NET desktop", "MSIX packaging tools") or the standalone Windows SDK.
   - The build script auto-discovers them under `C:\Program Files (x86)\Windows Kits\10\bin\<ver>\x64\`.
3. **Node.js 18+** and dependencies installed (`npm install`).
4. Deploy the latest `dist/` to `https://bigtimer.boncode.net/` (`npm run build`).

---

## Path A — Local build (recommended for CI)

### One-time setup
```bash
# Create your real config from the example
cp packaging/package.config.example.json packaging/package.config.json
# Then edit packaging/package.config.json with your Partner Center identity.
```
`package.config.json` is already filled in for BonCode.BigTimer — only touch it to change version/identity.

### Build the MSIX (unsigned, Store-ready)
```bash
npm run package:win
```
Produces: `packaging/build/BonCode.BigTimer_<version>_x64.msix`

This is **all you need for Store submission** — Partner Center re-signs the package with a Microsoft certificate.

### Build + self-sign for local install testing
```bash
npm run package:win:signed
```
This additionally creates a self-signed `.pfx`/`.cer` in `packaging/` (gitignored) and signs the MSIX. Then, in an **admin PowerShell**:

```powershell
Import-Certificate -FilePath "packaging\BonCode.BigTimer.cer" -CertStoreLocation Cert:\LocalMachine\Root
Add-AppxPackage -Path "packaging\build\BonCode.BigTimer_<version>_x64.msix"
```

### Regenerate icons only
```bash
npm run icons:gen
```
Rebuilds all Store-required tile/splash scales (100/125/150/200/400) from `public/app_icon-512.png` into `packaging/assets/`. `package:win` runs this automatically if assets are missing.

### Versioning
The MSIX version is read from `package.config.json` (`version` field, default `"1.0.2.0"`). MSIX requires a 4-part `Major.Minor.Build.Revision`. Bump it in the config (and `package.json`) for each Store submission.

---

## Path B — PWA Builder (fastest, no SDK install)

1. Ensure `https://bigtimer.boncode.net/` is live and up to date.
2. Go to https://www.pwabuilder.com → enter the URL → review the manifest score.
3. Click **Package for Stores → Windows → Generate**.
4. Fill in:
   - **Package ID / Identity Name:** `BonCode.BigTimer`
   - **Publisher:** `CN=6A41398C-286A-45C1-A8DF-76B4217CB918`
   - **Display name:** `BigTimer`
   - **Version:** `1.0.2.0`
5. Download the generated `.zip` — contains `appx/` and `msix/`.
6. For local testing, install the included test cert to `Trusted People`, then `Add-AppxPackage` the MSIX.
7. Submit the MSIX via Partner Center (see below).

---

## Submitting to the Microsoft Store

1. Sign in at https://partner.microsoft.com.
2. Open the reserved **BigTimer** product → **Start submission**.
3. Under **Packages**, upload `packaging/build/BonCode.BigTimer_<version>_x64.msix` (or the PWA Builder MSIX).
4. Complete Store listing, age ratings, availability, and **Submit**.
5. Certification typically takes hours to a few days. Microsoft re-signs the package — **you do not need your own signing certificate for Store distribution.**

### Notes / troubleshooting
- **Min Windows version:** the manifest targets `10.0.17763.0` (Win 10 1809) — required for hosted-app MSIX.
- **AppUriHandler / web registration:** the manifest registers `bigtimer.boncode.net`; for full App URI handling you may optionally publish a `windows-app-web-link` `JSON-LD` relation on the site (not required for Store install).
- **MakeAppx not found:** open "Developer Command Prompt for VS" or set `WindowsSdkBinPath` env var to the SDK `bin\<ver>\x64` folder.
- **Architectures:** this template builds `x64`. For Store reach, also produce `arm64` and `x86` (PWA Builder generates all three automatically; for local builds, run `package:win` per arch by editing `architecture` and the manifest).