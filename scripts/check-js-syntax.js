'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'coverage', 'backups', 'uploads']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

async function main() {
  walk(ROOT);
  const concurrency = Math.max(2, Math.min(16, Number(process.env.SYNTAX_CHECK_CONCURRENCY || 8)));
  const failures = [];
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= files.length) return;
      const file = files[index];
      try {
        await execFileAsync(process.execPath, ['--check', file], {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024
        });
      } catch (error) {
        failures.push({
          file,
          output: String(error.stderr || error.stdout || error.message || '')
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));

  for (const failure of failures) {
    console.error(`SYNTAX_FAIL ${path.relative(ROOT, failure.file)}`);
    console.error(failure.output);
  }
  if (failures.length) process.exitCode = 1;
  else console.log(`SYNTAX_OK ${files.length} JavaScript files`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
