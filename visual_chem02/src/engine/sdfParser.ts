/**
 * SDF/MOL V2000 格式解析器
 *
 * 解析流程：header(3行) → counts行 → atom block → bond block
 * SDF 坐标单位 Angstrom (1Å = 100pm)，与 PM_SCALE=1/100 的场景单位 1:1 对应
 */

import type { SdfAtom, SdfBond, SdfParseResult } from './types';

export function parseSdf(text: string): SdfParseResult {
  const lines = text.split(/\r?\n/);
  if (lines.length < 4) {
    throw new Error('SDF 文件格式错误：行数不足');
  }

  // Header: line 0 = molecule name, lines 1-2 = comments/program info
  const name = lines[0].trim();

  // Counts line (line 3): "aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv"
  // aaa = atom count, bbb = bond count (each 3 chars)
  const countsLine = lines[3];
  const atomCount = parseInt(countsLine.substring(0, 3).trim(), 10);
  const bondCount = parseInt(countsLine.substring(3, 6).trim(), 10);

  if (isNaN(atomCount) || isNaN(bondCount)) {
    throw new Error('SDF 文件格式错误：无法解析 counts 行');
  }

  // Atom block: lines 4 .. 4+atomCount-1
  // "xxxxx.xxxxyyyyy.yyyyzzzzz.zzzz aaaddcccssshhhbbbvvvHHHrrriiimmmnnneee"
  const atoms: SdfAtom[] = [];
  for (let i = 0; i < atomCount; i++) {
    const line = lines[4 + i];
    if (!line) throw new Error(`SDF 文件格式错误：原子行 ${i} 缺失`);
    const x = parseFloat(line.substring(0, 10).trim());
    const y = parseFloat(line.substring(10, 20).trim());
    const z = parseFloat(line.substring(20, 30).trim());
    const element = line.substring(31, 34).trim();
    if (isNaN(x) || isNaN(y) || isNaN(z) || !element) {
      throw new Error(`SDF 文件格式错误：原子行 ${i} 数据无效`);
    }
    atoms.push({ x, y, z, element });
  }

  // Bond block: lines 4+atomCount .. 4+atomCount+bondCount-1
  // "111222tttsssxxxrrrccc"
  // 111=first atom, 222=second atom, ttt=bond type (1-based indices)
  const bonds: SdfBond[] = [];
  const bondStart = 4 + atomCount;
  for (let i = 0; i < bondCount; i++) {
    const line = lines[bondStart + i];
    if (!line) throw new Error(`SDF 文件格式错误：键行 ${i} 缺失`);
    const from = parseInt(line.substring(0, 3).trim(), 10) - 1; // 转为 0-based
    const to = parseInt(line.substring(3, 6).trim(), 10) - 1;
    const order = parseInt(line.substring(6, 9).trim(), 10);
    if (isNaN(from) || isNaN(to) || isNaN(order)) {
      throw new Error(`SDF 文件格式错误：键行 ${i} 数据无效`);
    }
    bonds.push({ from, to, order });
  }

  // 解析 PUBCHEM_NONSTANDARDBOND 属性（配位键等 SDF 键表中缺失的键）
  // 格式："> <PUBCHEM_NONSTANDARDBOND>" 后每行 "atomIdx1  atomIdx2  bondType"（1-based，type 6=配位键）
  const propStart = bondStart + bondCount;
  let inNonstdBond = false;
  for (let i = propStart; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> <PUBCHEM_NONSTANDARDBOND>')) {
      inNonstdBond = true;
      continue;
    }
    if (inNonstdBond) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('> <') || trimmed === '$$$$') {
        break; // 属性块结束
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const from = parseInt(parts[0], 10) - 1;
        const to = parseInt(parts[1], 10) - 1;
        const bondType = parseInt(parts[2], 10);
        if (!isNaN(from) && !isNaN(to) && !isNaN(bondType)) {
          // 检查是否已存在（避免重复）
          const exists = bonds.some(b =>
            (b.from === from && b.to === to) || (b.from === to && b.to === from),
          );
          if (!exists) {
            // type 6 = 配位键，映射为 order 1
            bonds.push({ from, to, order: 1 });
          }
        }
      }
    }
  }

  return { name, atoms, bonds };
}
