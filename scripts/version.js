#!/usr/bin/env node
/**
 * ArcSign Version Sync Tool
 *
 * 同步所有設定檔的版本號
 *
 * Usage: node scripts/version.js <version>
 * Example: node scripts/version.js 1.0.0
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

// 驗證版本號格式
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('❌ Invalid version format');
  console.error('');
  console.error('Usage: node scripts/version.js <version>');
  console.error('Example: node scripts/version.js 1.0.0');
  console.error('');
  console.error('Version must follow SemVer format: MAJOR.MINOR.PATCH');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');

const files = [
  {
    path: 'dashboard/package.json',
    update: (content) => {
      const json = JSON.parse(content);
      json.version = version;
      return JSON.stringify(json, null, 2) + '\n';
    }
  },
  {
    path: 'dashboard/src-tauri/tauri.conf.json',
    update: (content) => {
      const json = JSON.parse(content);
      json.package.version = version;
      return JSON.stringify(json, null, 2) + '\n';
    }
  },
  {
    path: 'dashboard/src-tauri/Cargo.toml',
    update: (content) => {
      // 只替換 [package] 區塊中的 version
      return content.replace(
        /^(version\s*=\s*)"[^"]*"/m,
        `$1"${version}"`
      );
    }
  }
];

console.log(`\n🔄 Updating version to ${version}...\n`);

let success = true;

files.forEach(({ path: filePath, update }) => {
  const fullPath = path.join(rootDir, filePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${filePath}`);
      success = false;
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const updated = update(content);
    fs.writeFileSync(fullPath, updated);
    console.log(`✓ ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}: ${error.message}`);
    success = false;
  }
});

console.log('');

if (success) {
  console.log(`✅ Version updated to ${version}`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Update landing-page/changelog.html`);
  console.log(`  2. git add . && git commit -m "chore: release v${version}"`);
  console.log(`  3. git tag -a v${version} -m "Release v${version}"`);
  console.log(`  4. git push && git push --tags`);
} else {
  console.error('❌ Version update failed');
  process.exit(1);
}
