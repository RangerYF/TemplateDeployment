import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourceFile = path.join(rootDir, 'c07_c09_chemistry_tool.html');
const distDir = path.join(rootDir, 'dist');

const OUTPUTS = {
  c07: {
    title: 'C-07 化学反应速率与平衡模拟器',
    fileName: 'C-07-reaction-rate-equilibrium.html',
    tabCss: '.tabs{display:none!important}#tab-c07{display:block!important}#tab-c09{display:none!important}#c09Tooltip{display:none!important}',
  },
  c09: {
    title: 'C-09 有机化学反应路径图',
    fileName: 'C-09-organic-pathways.html',
    tabCss: '.tabs{display:none!important}#tab-c07{display:none!important}#tab-c09{display:block!important}',
  },
};

function ensureSource() {
  if (!fs.existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    process.exit(1);
  }
}

function buildPage(sourceHtml, target) {
  let html = sourceHtml;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${target.title}</title>`
  );

  html = html.replace(
    '</style>',
    `${target.tabCss}</style>`
  );

  if (target === OUTPUTS.c09) {
    html = html
      .replace(
        '<button class="tab-button active" data-tab="c07">C-07 化学反应速率与平衡模拟器</button>',
        '<button class="tab-button" data-tab="c07">C-07 化学反应速率与平衡模拟器</button>'
      )
      .replace(
        '<button class="tab-button" data-tab="c09">C-09 有机化学反应路径图（简化版）</button>',
        '<button class="tab-button active" data-tab="c09">C-09 有机化学反应路径图（简化版）</button>'
      )
      .replace(
        '<section class="tab-page active" id="tab-c07">',
        '<section class="tab-page" id="tab-c07">'
      )
      .replace(
        '<section class="tab-page" id="tab-c09">',
        '<section class="tab-page active" id="tab-c09">'
      );
  }

  return html;
}

ensureSource();
fs.mkdirSync(distDir, { recursive: true });

const sourceHtml = fs.readFileSync(sourceFile, 'utf8');

for (const target of Object.values(OUTPUTS)) {
  const outputFile = path.join(distDir, target.fileName);
  fs.writeFileSync(outputFile, buildPage(sourceHtml, target), 'utf8');
  console.log(`Built ${outputFile}`);
}

const legacyCombined = path.join(distDir, 'C-07-C-09-化学专题工具.html');
if (fs.existsSync(legacyCombined)) {
  fs.unlinkSync(legacyCombined);
  console.log(`Removed legacy artifact ${legacyCombined}`);
}
