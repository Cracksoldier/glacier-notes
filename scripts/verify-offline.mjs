import * as fs from 'node:fs';
import * as path from 'node:path';

const root = process.cwd();
const files = [
  path.join(root, 'src', 'index.html'),
  path.join(root, 'dist', 'glacier-notes', 'browser', 'index.html'),
];
const stylesDir = path.join(root, 'dist', 'glacier-notes', 'browser');

if (fs.existsSync(stylesDir)) {
  for (const entry of fs.readdirSync(stylesDir)) {
    if (entry.endsWith('.css')) files.push(path.join(stylesDir, entry));
  }
}

const checks = [
  {
    label: 'remote HTML resource',
    pattern: /<(?:script|link|img)\b[^>]*(?:src|href)\s*=\s*["'](?:https?:)?\/\//gi,
  },
  {
    label: 'remote CSS import or URL',
    pattern: /(?:@import\s+|url\(\s*)["']?(?:https?:)?\/\//gi,
  },
];

const failures = [];
for (const file of files) {
  if (!fs.existsSync(file)) {
    failures.push(`Missing build input: ${path.relative(root, file)}`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf-8');
  for (const check of checks) {
    const matches = [...source.matchAll(check.pattern)];
    for (const match of matches) {
      failures.push(
        `${path.relative(root, file)}: ${check.label}: ${match[0].replace(/\s+/g, ' ')}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Offline verification failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Offline verification passed for ${files.length} production resource files.`);
}
