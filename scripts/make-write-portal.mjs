#!/usr/bin/env node
/**
 * Regenerates public/write-portal.ps1 from the current working tree.
 *
 *   node scripts/make-write-portal.mjs
 *
 * The generated PowerShell script recreates the whole project on the OneDrive
 * Desktop path, overwriting code only and never touching data/academic.db or
 * data/uploads. File bodies are embedded as base64 so each file is restored
 * byte-for-byte (UTF-8 preserved, no BOM, no here-string escaping hazards).
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "write-portal.ps1");

const TARGET = String.raw`C:\Users\User\OneDrive\Attachments\Desktop\VIT-Academic-Monitoring-Portal-LIVE`;

/** Directories that are never part of the shipped code. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "data",
  "out",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel"
]);

/** Files written explicitly by the script rather than embedded in the payload. */
const SKIP_FILES = new Set(["write-portal.ps1", ".env"]);

const SKIP_EXT = new Set([".tsbuildinfo", ".log", ".db", ".db-journal", ".db-wal"]);

/** Chunk width for base64 continuation lines. */
const CHUNK = 200;

/* ------------------------------------------------------------------ walk */

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(abs, relPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (SKIP_EXT.has(path.extname(entry.name))) continue;
    if (entry.name.startsWith(".") && entry.name.endsWith(".local")) continue;
    out.push(relPath);
  }
  return out;
}

const files = walk(ROOT).sort();

/* ---------------------------------------------------------------- payload */

const lines = [];
let bytes = 0;

for (const rel of files) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  bytes += buf.length;
  const b64 = buf.toString("base64");
  const chunks = [];
  for (let i = 0; i < b64.length; i += CHUNK) chunks.push(b64.slice(i, i + CHUNK));
  lines.push(`${rel}|${chunks[0]}`);
  for (let i = 1; i < chunks.length; i++) lines.push(`~${chunks[i]}`);
}

const payload = lines.join("\n");
const nonAscii = files.filter((f) => /[^\x00-\x7F]/.test(f));
if (nonAscii.length) throw new Error(`Non-ASCII path(s): ${nonAscii.join(", ")}`);

/* ----------------------------------------------------------------- .env */

// Kept readable and editable; ASCII-only so the script needs no BOM.
const ENV_TEXT = [
  "# Academic Monitoring Portal",
  'DATABASE_URL="postgresql://postgres:Nandu%40123@127.0.0.1:5432/academic_monitoring_db"',
  "",
  'JWT_SECRET="academic-monitoring-portal-change-me"',
  'NEXT_PUBLIC_APP_NAME="Academic Monitoring Portal"',
  "",
  "# Gmail - parent alerts (App Password, spaces removed)",
  'SMTP_HOST="smtp.gmail.com"',
  'SMTP_PORT="587"',
  'SMTP_USER="sasuu7392@gmail.com"',
  'SMTP_PASS="lpexsmjitfgydqbh"',
  'SMTP_FROM="Academic Portal <sasuu7392@gmail.com>"',
  ""
].join("\n");

/* ------------------------------------------------------------ ps1 script */

const ps = [
  "# ============================================================================",
  "#  Academic Monitoring Portal - full project writer",
  "#  Generated: " + new Date().toISOString(),
  "#  Files: " + files.length + "   Content: " + (bytes / 1024).toFixed(1) + " KB",
  "#",
  "#  Writes the complete current project to:",
  "#    " + TARGET,
  "#  (OneDrive Desktop, not C:\\Users\\User\\Desktop). If that path does not",
  "#  exist, it falls back to the real Desktop folder automatically.",
  "#",
  "#  Writes both .env (ready to run) and .env.example.",
  "#",
  "#  SAFETY: overwrites code only. It never deletes or overwrites",
  "#          data\\academic.db or data\\uploads - your portal data survives.",
  "#",
  "#  Payload is base64 so every file is restored byte-for-byte (UTF-8, no BOM).",
  "#",
  "#  USAGE",
  "#    Right-click this file  ->  Run with PowerShell",
  "#    or:  powershell -ExecutionPolicy Bypass -File .\\write-portal.ps1",
  "#",
  "#  OPTIONAL SWITCHES",
  "#    -Install   run npm.cmd install after writing",
  "#    -Run       start the dev server on 0.0.0.0:3000 after installing",
  "# ============================================================================",
  "",
  "[CmdletBinding()]",
  "param(",
  "  [string]$Target = '',",
  "  [switch]$Install,",
  "  [switch]$Run",
  ")",
  "",
  "$ErrorActionPreference = 'Stop'",
  "",
  "# --- destination: OneDrive Desktop first, real Desktop as fallback ---------",
  "if (-not $Target) {",
  "  $desktop = '" + TARGET.replace("\\VIT-Academic-Monitoring-Portal-LIVE", "") + "'",
  "  if (-not (Test-Path -LiteralPath $desktop)) { $desktop = [Environment]::GetFolderPath('Desktop') }",
  "  if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = [Environment]::GetFolderPath('UserProfile') }",
  "  if ([string]::IsNullOrWhiteSpace($desktop)) { $desktop = (Get-Location).Path }",
  "  $Target = Join-Path $desktop 'VIT-Academic-Monitoring-Portal-LIVE'",
  "}",
  "",
  "Write-Host ''",
  "Write-Host '  Academic Monitoring Portal - full project writer' -ForegroundColor Magenta",
  "Write-Host '  ================================================' -ForegroundColor DarkGray",
  "Write-Host ('  Target : {0}' -f $Target) -ForegroundColor DarkGray",
  "Write-Host ('  Files  : {0}' -f " + files.length + ") -ForegroundColor DarkGray",
  "Write-Host ''",
  "",
  "# --- protected: existing local data is never deleted or overwritten --------",
  "$protected = @('data\\academic.db', 'data\\uploads')",
  "",
  "$dbPath = Join-Path $Target 'data\\academic.db'",
  "$dbBefore = $null",
  "if (Test-Path $dbPath) { $dbBefore = (Get-Item $dbPath).Length }",
  "",
  "[void](New-Item -ItemType Directory -Force -Path $Target)",
  "[void](New-Item -ItemType Directory -Force -Path (Join-Path $Target 'data'))",
  "[void](New-Item -ItemType Directory -Force -Path (Join-Path $Target 'data\\uploads'))",
  "[void](New-Item -ItemType File -Force -Path (Join-Path $Target 'data\\.gitkeep'))",
  "",
  "$payload = @'",
  payload,
  "'@",
  "",
  "# --- parse the base64 payload ---------------------------------------------",
  "$entries = New-Object System.Collections.ArrayList",
  "$rel = $null",
  "$sb = New-Object System.Text.StringBuilder",
  "",
  "foreach ($raw in ($payload -split \"`r?`n\")) {",
  "  $line = $raw.Trim()",
  "  if ($line.Length -eq 0) { continue }",
  "  if ($line[0] -eq '~') { [void]$sb.Append($line.Substring(1)); continue }",
  "  if ($rel) { [void]$entries.Add(@($rel, $sb.ToString())) }",
  "  $i = $line.IndexOf('|')",
  "  $rel = $line.Substring(0, $i)",
  "  [void]$sb.Clear()",
  "  [void]$sb.Append($line.Substring($i + 1))",
  "}",
  "if ($rel) { [void]$entries.Add(@($rel, $sb.ToString())) }",
  "",
  "# --- write every file ------------------------------------------------------",
  "$written = 0",
  "$totalBytes = 0",
  "",
  "foreach ($entry in $entries) {",
  "  $r = [string]$entry[0]",
  "  $b64 = [string]$entry[1]",
  "  $norm = $r -replace '/', '\\'",
  "",
  "  $isProtected = $false",
  "  foreach ($p in $protected) { if ($norm -like ($p + '*')) { $isProtected = $true } }",
  "  if ($isProtected) {",
  "    Write-Host ('    keeping local data: {0}' -f $norm) -ForegroundColor Yellow",
  "    continue",
  "  }",
  "",
  "  $dest = Join-Path $Target $norm",
  "  $dir = Split-Path -Parent $dest",
  "  if ($dir -and -not (Test-Path $dir)) { [void](New-Item -ItemType Directory -Force -Path $dir) }",
  "",
  "  $data = [Convert]::FromBase64String($b64)",
  "  [System.IO.File]::WriteAllBytes($dest, $data)",
  "  Write-Host ('    {0}' -f $norm) -ForegroundColor DarkGray",
  "  $written++",
  "  $totalBytes += $data.Length",
  "}",
  "",
  "# --- .env ------------------------------------------------------------------",
  "$envPath = Join-Path $Target '.env'",
  "$envText = @'",
  ENV_TEXT + "'@",
  "",
  "$envFull = $envText.TrimEnd() + [Environment]::NewLine",
  "[System.IO.File]::WriteAllText($envPath, $envFull, (New-Object System.Text.UTF8Encoding($false)))",
  "Write-Host '    wrote .env (DATABASE_URL, JWT_SECRET, SMTP)' -ForegroundColor DarkGray",
  "",
  "# --- summary ---------------------------------------------------------------",
  "Write-Host ''",
  "Write-Host ('  Wrote {0} files ({1:N1} KB of code)' -f $written, ($totalBytes / 1KB)) -ForegroundColor Green",
  "",
  "if (Test-Path $dbPath) {",
  "  $after = (Get-Item $dbPath).Length",
  "  if ($dbBefore -ne $null -and $after -eq $dbBefore) {",
  "    Write-Host ('  data\\academic.db preserved ({0:N2} MB, unchanged)' -f ($after / 1MB)) -ForegroundColor Green",
  "  } else {",
  "    Write-Host ('  data\\academic.db present ({0:N2} MB)' -f ($after / 1MB)) -ForegroundColor Green",
  "  }",
  "} else {",
  "  Write-Host '  No local database found - a fresh one is seeded on first run.' -ForegroundColor Yellow",
  "}",
  "Write-Host '  data\\uploads preserved.' -ForegroundColor Green",
  "",
  "# --- optional install / run ------------------------------------------------",
  "Set-Location $Target",
  "",
  "if ($Install -or $Run) {",
  "  Write-Host ''",
  "  Write-Host '  npm.cmd install ...' -ForegroundColor Cyan",
  "  & npm.cmd install",
  "  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }",
  "}",
  "",
  "if ($Run) {",
  "  Write-Host ''",
  "  Write-Host '  Starting the portal on http://localhost:3000 (0.0.0.0:3000) ...' -ForegroundColor Cyan",
  "  Write-Host '  Leave this window open. Ctrl+C to stop.' -ForegroundColor DarkGray",
  "  & npm.cmd run dev",
  "} else {",
  "  Write-Host ''",
  "  Write-Host '  Next steps' -ForegroundColor Magenta",
  "  Write-Host ('    cd \"{0}\"' -f $Target)",
  "  Write-Host '    npm.cmd install'",
  "  Write-Host '    npm.cmd run dev'",
  "  Write-Host '    open http://localhost:3000'",
  "  Write-Host ''",
  "  Write-Host '  Or re-run with:  .\\write-portal.ps1 -Install -Run' -ForegroundColor DarkGray",
  "}",
  "Write-Host ''"
].join("\n");

/* ------------------------------------------------------------------ write */

const asBuffer = Buffer.from(ps, "utf8");
const offenders = [...ps].filter((ch) => ch.charCodeAt(0) > 127);
if (offenders.length) {
  throw new Error(`Generated script contains non-ASCII: ${[...new Set(offenders)].join(" ")}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, asBuffer);

console.log(`write-portal.ps1 -> ${path.relative(ROOT, OUT)}`);
console.log(`  entries      : ${files.length}`);
console.log(`  content      : ${(bytes / 1024).toFixed(1)} KB`);
console.log(`  script size  : ${(asBuffer.length / 1024).toFixed(1)} KB`);
console.log(`  payload lines: ${lines.length}`);
