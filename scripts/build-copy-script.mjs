import fs from "fs";
import path from "path";

const root = process.cwd();
const skipDir = new Set(["node_modules", ".next", ".git", ".arena", "uploads"]);
const skipFile = new Set([
  "write-portal.ps1",
  "academic.db",
  "academic.db-wal",
  "academic.db-shm",
  "academic.db-journal",
  "tsconfig.tsbuildinfo",
  "crest.png",
  "hero-campus.jpg"
]);

function walk(dir, rel = "") {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (skipDir.has(name)) continue;
    const p = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p, r));
    else {
      if (skipFile.has(name)) continue;
      if (name.endsWith(".db") || name.endsWith(".db-wal") || name.endsWith(".db-shm")) continue;
      out.push(r);
    }
  }
  return out;
}

const files = walk(root);
const lines = [];
lines.push(`$ErrorActionPreference = 'Stop'`);
lines.push(`$desktop = 'C:\\Users\\User\\OneDrive\\Attachments\\Desktop'`);
lines.push(`if (-not (Test-Path -LiteralPath $desktop)) { $desktop = [Environment]::GetFolderPath('Desktop') }`);
lines.push(`$root = Join-Path $desktop 'VIT-Academic-Monitoring-Portal-LIVE'`);
lines.push(`New-Item -ItemType Directory -Force -Path $root | Out-Null`);
lines.push(`Write-Host "Writing LATEST portal into $root"`);
lines.push(`Write-Host "Code is overwritten. data\\academic.db and data\\uploads are kept if they already exist."`);

for (const rel of files) {
  const abs = path.join(root, rel);
  const b64 = fs.readFileSync(abs).toString("base64");
  const win = rel.replace(/\//g, "\\");
  lines.push(`Write-Host ${JSON.stringify(win)}`);
  lines.push(`$rel = ${JSON.stringify(win)}`);
  lines.push(`$dest = Join-Path $root $rel`);
  lines.push(`$dir = Split-Path $dest`);
  lines.push(`if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }`);
  lines.push(`$b64 = '${b64}'`);
  lines.push(`$bytes = [Convert]::FromBase64String($b64)`);
  lines.push(`[IO.File]::WriteAllBytes($dest, $bytes)`);
}

lines.push(`$data = Join-Path $root 'data'`);
lines.push(`New-Item -ItemType Directory -Force -Path $data | Out-Null`);
lines.push(`New-Item -ItemType Directory -Force -Path (Join-Path $data 'uploads') | Out-Null`);
lines.push(`Write-Host ''`);
lines.push(`Write-Host 'DONE. Latest code written. Database file was NOT deleted.'`);
lines.push(`Write-Host "Folder: $root"`);
lines.push(`Write-Host 'Next (PowerShell):'`);
lines.push("Write-Host (\"  cd \"\"$root\"\"\")");
lines.push(`Write-Host '  npm.cmd install'`);
lines.push(`Write-Host '  npm.cmd run dev'`);
lines.push(`Write-Host 'Open http://localhost:3000'`);
lines.push(`Write-Host 'Postgres .env already points at academic_monitoring_db'`);

const out = path.join(root, "public", "write-portal.ps1");
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log("files", files.length, "bytes", fs.statSync(out).size);
