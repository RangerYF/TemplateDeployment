/**
 * 2D化学式数据导出工具
 * 运行: node scripts/export2D.js
 * 
 * 输出: data/2D/结构简式/*.json, data/2D/电子式/*.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入项目核心模块 (这些模块本身是TypeScript，但.ts文件在ESM下会被转译)
import { ALL_MOLECULES } from '../src/data/moleculeMetadata.js';
import { MOLECULE_DATA_MAP } from '../src/data/molecules.js';
import { SDF_DATA } from '../src/data/sdfData.js';
import { FALLBACK_MAP } from '../src/data/moleculeFallbacks.js';
import { getElement } from '../src/data/elements.js';
import { generateLayout2D } from '../src/engine/layout2d.js';
import { buildProjected2DFromPositions } from '../src/engine/projection2d.js';
import { parseSdf } from '../src/engine/sdfParser.js';

// ==================== 工具函数 ====================

/** 从 SDF 或 fallback 构建完整分子数据 */
function buildMoleculeModel(meta) {
  // 尝试从 SDF 数据构建
  const sdfText = SDF_DATA[meta.id];
  if (sdfText) {
    try {
      const sdf = parseSdf(sdfText);
      return buildFromSdf(sdf, meta);
    } catch (e) {
      console.warn(`  [警告] ${meta.id} SDF解析失败，尝试fallback`);
    }
  }
  
  // 回退到手动定义的数据
  const fallback = FALLBACK_MAP.get(meta.id);
  if (fallback) {
    return buildFromFallback(fallback);
  }
  
  return null;
}

function buildFromSdf(sdf, meta) {
  const atoms = sdf.atoms.map((a, i) => ({
    index: i,
    element: a.element,
    position: [0, 0, 0],
    formalCharge: meta.formalChargeOverrides?.[i] ?? 0,
  }));
  
  const bonds = sdf.bonds.map(b => ({
    from: b.from,
    to: b.to,
    order: b.order === 4 ? 1 : b.order,
    type: b.type,
    length: 100,
  }));
  
  // 计算孤电子对
  const lonePairs = computeLonePairs(atoms, bonds);
  
  return { atoms, bonds, lonePairs };
}

function buildFromFallback(fallback) {
  const atoms = fallback.atoms.map((a, i) => ({
    index: i,
    element: a.element,
    position: [0, 0, 0],
  }));
  
  const bonds = fallback.bonds.map(b => ({
    from: b.from,
    to: b.to,
    order: b.order,
    type: b.type,
    length: b.length,
  }));
  
  const lonePairs = computeLonePairs(atoms, bonds);
  
  return { atoms, bonds, lonePairs };
}

/** 计算孤电子对数量 */
function computeLonePairs(atoms, bonds) {
  const VALENCE = {
    H: 1, B: 3, C: 4, N: 5, O: 6, F: 7,
    Al: 3, Si: 4, P: 5, S: 6, Cl: 7,
    Se: 6, Br: 7, I: 7, Xe: 8,
    Mn: 7,
  };
  
  const bondOrderSum = new Array(atoms.length).fill(0);
  const bondCount = new Array(atoms.length).fill(0);
  
  for (const b of bonds) {
    bondOrderSum[b.from] += b.order;
    bondOrderSum[b.to] += b.order;
    bondCount[b.from]++;
    bondCount[b.to]++;
  }
  
  const lonePairs = [];
  
  for (let i = 0; i < atoms.length; i++) {
    const ve = VALENCE[atoms[i].element];
    if (ve === undefined) continue;
    if (bondCount[i] === 0) continue;
    
    const lpCount = Math.max(0, Math.floor((ve - bondOrderSum[i]) / 2));
    for (let j = 0; j < lpCount; j++) {
      lonePairs.push({ centerAtomIndex: i });
    }
  }
  
  return lonePairs;
}

// ==================== 2D数据生成 ====================

/** 生成结构简式数据 */
function generateStructuralFormula(model, meta) {
  const positions = generateLayout2D(meta.id, model, false);
  if (!positions) return null;
  
  const projected = buildProjected2DFromPositions(positions, model, 'all', false);
  
  return {
    id: meta.id,
    name_cn: meta.name_cn,
    name_en: meta.name_en,
    formula: meta.formula,
    category: meta.category,
    atoms: projected.atoms,
    bonds: projected.bonds,
  };
}

/** 生成电子式数据 */
function generateElectronFormula(model, meta) {
  // 跳过不支持电子式的分子
  if (meta.skipElectronFormula) return null;
  
  const positions = generateLayout2D(meta.id, model, true);
  if (!positions) return null;
  
  // 电子式使用 'none' 合并模式，不合并H
  // 但仍然需要显示孤电子对
  const projected = buildProjected2DFromPositions(positions, model, 'none', false, meta.lewisFormalCharges);
  
  // 添加孤电子对信息
  const lpCount = new Array(model.atoms.length).fill(0);
  for (const lp of model.lonePairs) {
    lpCount[lp.centerAtomIndex]++;
  }
  
  // 更新atoms中的lonePairs
  const atoms = projected.atoms.map((a, i) => ({
    ...a,
    lonePairs: lpCount[i] || a.lonePairs,
  }));
  
  return {
    id: meta.id,
    name_cn: meta.name_cn,
    name_en: meta.name_en,
    formula: meta.formula,
    category: meta.category,
    atoms,
    bonds: projected.bonds,
  };
}

// ==================== 主程序 ====================

async function main() {
  console.log('开始导出2D化学式数据...\n');
  
  // 创建输出目录
  const baseDir = path.join(__dirname, '..', 'data', '2D');
  const structuralDir = path.join(baseDir, '结构简式');
  const electronDir = path.join(baseDir, '电子式');
  
  fs.mkdirSync(structuralDir, { recursive: true });
  fs.mkdirSync(electronDir, { recursive: true });
  
  console.log(`输出目录: ${baseDir}`);
  console.log(`  - 结构简式: ${structuralDir}`);
  console.log(`  - 电子式: ${electronDir}\n`);
  
  let successStructural = 0;
  let successElectron = 0;
  let skipElectron = 0;
  let errorCount = 0;
  
  for (const meta of ALL_MOLECULES) {
    process.stdout.write(`处理 ${meta.id} (${meta.name_cn})...`);
    
    try {
      // 构建分子模型
      const model = buildMoleculeModel(meta);
      if (!model) {
        console.log(' [跳过 - 无数据]');
        errorCount++;
        continue;
      }
      
      // 生成结构简式
      const structural = generateStructuralFormula(model, meta);
      if (structural) {
        const outPath = path.join(structuralDir, `${meta.id}.json`);
        fs.writeFileSync(outPath, JSON.stringify(structural, null, 2), 'utf-8');
        successStructural++;
        process.stdout.write(' 成功');
      } else {
        process.stdout.write(' 失败');
      }
      
      // 生成电子式
      if (meta.skipElectronFormula) {
        console.log(' (跳过电子式)');
        skipElectron++;
      } else {
        const electron = generateElectronFormula(model, meta);
        if (electron) {
          const outPath = path.join(electronDir, `${meta.id}.json`);
          fs.writeFileSync(outPath, JSON.stringify(electron, null, 2), 'utf-8');
          successElectron++;
          console.log(' 成功');
        } else {
          console.log(' 失败');
        }
      }
    } catch (e) {
      console.log(` [错误: ${e.message || e}]`);
      errorCount++;
    }
  }
  
  console.log('\n========== 导出完成 ==========');
  console.log(`结构简式: ${successStructural} 个`);
  console.log(`电子式: ${successElectron} 个`);
  console.log(`跳过(不支持电子式): ${skipElectron} 个`);
  console.log(`错误: ${errorCount} 个`);
  console.log(`总计: ${ALL_MOLECULES.length} 个分子`);
}

main().catch(console.error);
