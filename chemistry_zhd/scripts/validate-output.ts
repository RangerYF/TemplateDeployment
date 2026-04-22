import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

const htmlFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.html'));

if (htmlFiles.length === 0) {
  console.error('No HTML files found in dist/');
  process.exit(1);
}

let hasError = false;

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(distDir, file), 'utf-8');
  const issues: string[] = [];

  // Check for external script references
  const extScripts = content.match(/<script[^>]+src=["']https?:\/\//gi);
  if (extScripts) {
    issues.push(`External scripts found: ${extScripts.length}`);
  }

  // Check for external stylesheet references
  const extStyles = content.match(/<link[^>]+href=["']https?:\/\//gi);
  if (extStyles) {
    issues.push(`External stylesheets found: ${extStyles.length}`);
  }

  // Check for external image references
  const extImages = content.match(/src=["']https?:\/\/[^"']+\.(png|jpg|svg|gif)/gi);
  if (extImages) {
    issues.push(`External images found: ${extImages.length}`);
  }

  const sizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(0);
  const sizeMB = (Buffer.byteLength(content, 'utf-8') / (1024 * 1024)).toFixed(2);

  if (issues.length > 0) {
    console.error(`FAIL ${file} (${sizeKB}KB):`);
    issues.forEach(i => console.error(`  - ${i}`));
    hasError = true;
  } else {
    console.log(`PASS ${file} (${sizeMB}MB) - self-contained`);
  }
}

process.exit(hasError ? 1 : 0);
