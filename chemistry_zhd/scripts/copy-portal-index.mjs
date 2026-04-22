import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const src = path.join(rootDir, 'portal', 'index.html');
const destDir = path.join(rootDir, 'dist');
const dest = path.join(destDir, 'index.html');

if (!fs.existsSync(src)) {
  console.error(`Portal entry not found: ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied portal index to ${dest}`);
