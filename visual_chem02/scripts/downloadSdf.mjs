/**
 * 批量从 PubChem 下载 71 个分子的 3D SDF 文件
 *
 * 用法：node scripts/downloadSdf.mjs
 * 输出：public/sdf/MOL-001.sdf ~ MOL-071.sdf
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'sdf');

const MOLECULES = [
  { id: 'MOL-001', name: 'Hydrogen', hasSdf: true },
  { id: 'MOL-002', name: 'Oxygen', hasSdf: true },
  { id: 'MOL-003', name: 'Nitrogen', hasSdf: true },
  { id: 'MOL-004', name: 'Chlorine', hasSdf: true },
  { id: 'MOL-005', name: 'Hydrogen chloride', hasSdf: true },
  { id: 'MOL-006', name: 'Hydrogen fluoride', hasSdf: true },
  { id: 'MOL-007', name: 'Hydrogen bromide', hasSdf: true },
  { id: 'MOL-008', name: 'Hydrogen iodide', hasSdf: true },
  { id: 'MOL-009', name: 'Carbon monoxide', hasSdf: true },
  { id: 'MOL-010', name: 'Nitric oxide', hasSdf: true },
  { id: 'MOL-011', name: 'Fluorine', hasSdf: true },
  { id: 'MOL-012', name: 'Water', hasSdf: true },
  { id: 'MOL-013', name: 'Carbon dioxide', hasSdf: true },
  { id: 'MOL-014', name: 'Sulfur dioxide', hasSdf: true },
  { id: 'MOL-015', name: 'Nitrogen dioxide', hasSdf: true },
  { id: 'MOL-016', name: 'Hydrogen sulfide', hasSdf: true },
  { id: 'MOL-017', name: 'Carbon disulfide', hasSdf: true },
  { id: 'MOL-018', name: 'Ozone', hasSdf: true },
  { id: 'MOL-019', name: 'Ammonia', hasSdf: true },
  { id: 'MOL-020', name: 'Nitrogen trifluoride', hasSdf: true },
  { id: 'MOL-021', name: 'Phosphorus trichloride', hasSdf: true },
  { id: 'MOL-022', name: 'Boron trifluoride', hasSdf: true },
  { id: 'MOL-023', name: 'Boron trichloride', hasSdf: true },
  { id: 'MOL-024', name: 'Sulfur trioxide', hasSdf: true },
  { id: 'MOL-025', name: 'Aluminium chloride', hasSdf: true },
  { id: 'MOL-026', name: 'Methane', hasSdf: true },
  { id: 'MOL-027', name: 'Carbon tetrachloride', hasSdf: true },
  { id: 'MOL-028', name: 'Silane', hasSdf: true },
  { id: 'MOL-029', name: 'Silicon tetrafluoride', hasSdf: true },
  { id: 'MOL-030', name: 'Ammonium', hasSdf: false },        // 离子
  { id: 'MOL-031', name: 'Phosphorus pentachloride', hasSdf: true },
  { id: 'MOL-032', name: 'Sulfur hexafluoride', hasSdf: true },
  { id: 'MOL-033', name: 'Iodine pentafluoride', hasSdf: true },
  { id: 'MOL-034', name: 'Xenon difluoride', hasSdf: true },
  { id: 'MOL-035', name: 'Xenon tetrafluoride', hasSdf: true },
  { id: 'MOL-036', name: 'Carbonate', hasSdf: false },        // 离子
  { id: 'MOL-037', name: 'Sulfate', hasSdf: false },           // 离子
  { id: 'MOL-038', name: 'Nitrate', hasSdf: false },           // 离子
  { id: 'MOL-039', name: 'Perchlorate', hasSdf: false },       // 离子
  { id: 'MOL-040', name: 'Phosphate', hasSdf: false },         // 离子
  { id: 'MOL-041', name: 'Permanganate', hasSdf: false },      // 离子
  { id: 'MOL-042', name: 'Hydroxide', hasSdf: false },         // 离子
  { id: 'MOL-043', name: 'Methane', hasSdf: true },
  { id: 'MOL-044', name: 'Ethane', hasSdf: true },
  { id: 'MOL-045', name: 'Propane', hasSdf: true },
  { id: 'MOL-046', name: 'Butane', hasSdf: true },
  { id: 'MOL-047', name: 'Isobutane', hasSdf: true },
  { id: 'MOL-048', name: 'Pentane', hasSdf: true },
  { id: 'MOL-049', name: 'Ethylene', hasSdf: true },
  { id: 'MOL-050', name: 'Propylene', hasSdf: true },
  { id: 'MOL-051', name: '1-Butene', hasSdf: true },
  { id: 'MOL-052', name: '2-Butene', hasSdf: true },
  { id: 'MOL-053', name: 'Acetylene', hasSdf: true },
  { id: 'MOL-054', name: 'Propyne', hasSdf: true },
  { id: 'MOL-055', name: 'Benzene', hasSdf: true },
  { id: 'MOL-056', name: 'Toluene', hasSdf: true },
  { id: 'MOL-057', name: 'Naphthalene', hasSdf: true },
  { id: 'MOL-058', name: 'Methanol', hasSdf: true },
  { id: 'MOL-059', name: 'Ethanol', hasSdf: true },
  { id: 'MOL-060', name: 'Formaldehyde', hasSdf: true },
  { id: 'MOL-061', name: 'Acetaldehyde', hasSdf: true },
  { id: 'MOL-062', name: 'Formic acid', hasSdf: true },
  { id: 'MOL-063', name: 'Acetic acid', hasSdf: true },
  { id: 'MOL-064', name: 'Ethyl acetate', hasSdf: true },
  { id: 'MOL-065', name: 'Methylamine', hasSdf: true },
  { id: 'MOL-066', name: 'Aniline', hasSdf: true },
  { id: 'MOL-067', name: 'Nitromethane', hasSdf: true },
  { id: 'MOL-068', name: 'Urea', hasSdf: true },
  { id: 'MOL-069', name: 'Vinyl chloride', hasSdf: true },
  { id: 'MOL-070', name: 'Tetrafluoroethylene', hasSdf: true },
  { id: 'MOL-071', name: 'Glucose', hasSdf: true },
];

const DELAY_MS = 250;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadSdf(name) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/SDF?record_type=3d`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.text();
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const success = [];
  const failed = [];
  const skipped = [];

  for (const mol of MOLECULES) {
    if (!mol.hasSdf) {
      skipped.push(mol.id);
      console.log(`[SKIP] ${mol.id} ${mol.name} (离子/无3D数据)`);
      continue;
    }

    const outPath = join(OUT_DIR, `${mol.id}.sdf`);
    if (existsSync(outPath)) {
      success.push(mol.id);
      console.log(`[EXIST] ${mol.id} ${mol.name}`);
      continue;
    }

    try {
      console.log(`[DOWNLOAD] ${mol.id} ${mol.name}...`);
      const sdfText = await downloadSdf(mol.name);
      await writeFile(outPath, sdfText, 'utf-8');
      success.push(mol.id);
      console.log(`  ✓ ${mol.id} saved (${sdfText.length} bytes)`);
    } catch (err) {
      failed.push({ id: mol.id, name: mol.name, error: err.message });
      console.error(`  ✗ ${mol.id} ${mol.name}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log('\n========== 下载报告 ==========');
  console.log(`成功: ${success.length}`);
  console.log(`失败: ${failed.length}`);
  console.log(`跳过: ${skipped.length}`);
  if (failed.length > 0) {
    console.log('\n失败清单:');
    for (const f of failed) {
      console.log(`  ${f.id} ${f.name}: ${f.error}`);
    }
  }
}

main().catch(console.error);
