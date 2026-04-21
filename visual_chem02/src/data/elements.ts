/**
 * 元素属性数据 — CPK 配色 + 共价半径
 * 数据来源：Wikipedia Covalent radius / NIST / CRC Handbook
 */

export interface ElementData {
  symbol: string;
  name_cn: string;
  name_en: string;
  covalentRadius: number;            // pm
  covalentRadiusUncertainty: number;  // pm
  vdwRadius: number;                  // pm (Van der Waals)
  cpkColor: string;                   // CPK 配色 hex
  ballRadius: number;                 // 球棍模型球体半径（归一化，0.2~0.5）
  spaceFillRadius: number;            // 空间填充模型半径（Å = vdwRadius / 100）
  electronegativity: number;          // Pauling 电负性
}

export const ELEMENTS: Record<string, ElementData> = {
  H:  { symbol: 'H',  name_cn: '氢',  name_en: 'Hydrogen',   covalentRadius: 31,  covalentRadiusUncertainty: 5,  vdwRadius: 120, cpkColor: '#FFFFFF', ballRadius: 0.25, spaceFillRadius: 1.20, electronegativity: 2.20 },
  C:  { symbol: 'C',  name_cn: '碳',  name_en: 'Carbon',     covalentRadius: 76,  covalentRadiusUncertainty: 1,  vdwRadius: 170, cpkColor: '#333333', ballRadius: 0.35, spaceFillRadius: 1.70, electronegativity: 2.55 },
  N:  { symbol: 'N',  name_cn: '氮',  name_en: 'Nitrogen',   covalentRadius: 71,  covalentRadiusUncertainty: 1,  vdwRadius: 155, cpkColor: '#3050F8', ballRadius: 0.35, spaceFillRadius: 1.55, electronegativity: 3.04 },
  O:  { symbol: 'O',  name_cn: '氧',  name_en: 'Oxygen',     covalentRadius: 66,  covalentRadiusUncertainty: 2,  vdwRadius: 152, cpkColor: '#FF0D0D', ballRadius: 0.35, spaceFillRadius: 1.52, electronegativity: 3.44 },
  F:  { symbol: 'F',  name_cn: '氟',  name_en: 'Fluorine',   covalentRadius: 57,  covalentRadiusUncertainty: 3,  vdwRadius: 147, cpkColor: '#90E050', ballRadius: 0.30, spaceFillRadius: 1.47, electronegativity: 3.98 },
  Cl: { symbol: 'Cl', name_cn: '氯',  name_en: 'Chlorine',   covalentRadius: 102, covalentRadiusUncertainty: 4,  vdwRadius: 175, cpkColor: '#1FF01F', ballRadius: 0.40, spaceFillRadius: 1.75, electronegativity: 3.16 },
  Br: { symbol: 'Br', name_cn: '溴',  name_en: 'Bromine',    covalentRadius: 120, covalentRadiusUncertainty: 3,  vdwRadius: 185, cpkColor: '#A62929', ballRadius: 0.45, spaceFillRadius: 1.85, electronegativity: 2.96 },
  I:  { symbol: 'I',  name_cn: '碘',  name_en: 'Iodine',     covalentRadius: 139, covalentRadiusUncertainty: 3,  vdwRadius: 198, cpkColor: '#940094', ballRadius: 0.48, spaceFillRadius: 1.98, electronegativity: 2.66 },
  S:  { symbol: 'S',  name_cn: '硫',  name_en: 'Sulfur',     covalentRadius: 105, covalentRadiusUncertainty: 3,  vdwRadius: 180, cpkColor: '#FFFF30', ballRadius: 0.40, spaceFillRadius: 1.80, electronegativity: 2.58 },
  P:  { symbol: 'P',  name_cn: '磷',  name_en: 'Phosphorus', covalentRadius: 107, covalentRadiusUncertainty: 3,  vdwRadius: 180, cpkColor: '#FF8000', ballRadius: 0.40, spaceFillRadius: 1.80, electronegativity: 2.19 },
  Si: { symbol: 'Si', name_cn: '硅',  name_en: 'Silicon',    covalentRadius: 111, covalentRadiusUncertainty: 2,  vdwRadius: 210, cpkColor: '#F0C8A0', ballRadius: 0.42, spaceFillRadius: 2.10, electronegativity: 1.90 },
  B:  { symbol: 'B',  name_cn: '硼',  name_en: 'Boron',      covalentRadius: 84,  covalentRadiusUncertainty: 3,  vdwRadius: 192, cpkColor: '#FFB5B5', ballRadius: 0.35, spaceFillRadius: 1.92, electronegativity: 2.04 },
  Al: { symbol: 'Al', name_cn: '铝',  name_en: 'Aluminium',  covalentRadius: 121, covalentRadiusUncertainty: 4,  vdwRadius: 184, cpkColor: '#BFA6A6', ballRadius: 0.45, spaceFillRadius: 1.84, electronegativity: 1.61 },
  Na: { symbol: 'Na', name_cn: '钠',  name_en: 'Sodium',     covalentRadius: 166, covalentRadiusUncertainty: 9,  vdwRadius: 227, cpkColor: '#AB5CF2', ballRadius: 0.50, spaceFillRadius: 2.27, electronegativity: 0.93 },
  K:  { symbol: 'K',  name_cn: '钾',  name_en: 'Potassium',  covalentRadius: 203, covalentRadiusUncertainty: 12, vdwRadius: 275, cpkColor: '#8F40D4', ballRadius: 0.55, spaceFillRadius: 2.75, electronegativity: 0.82 },
  Fe: { symbol: 'Fe', name_cn: '铁',  name_en: 'Iron',       covalentRadius: 132, covalentRadiusUncertainty: 3,  vdwRadius: 194, cpkColor: '#E06633', ballRadius: 0.45, spaceFillRadius: 1.94, electronegativity: 1.83 },
  Cu: { symbol: 'Cu', name_cn: '铜',  name_en: 'Copper',     covalentRadius: 132, covalentRadiusUncertainty: 4,  vdwRadius: 140, cpkColor: '#C88033', ballRadius: 0.45, spaceFillRadius: 1.40, electronegativity: 1.90 },
  Zn: { symbol: 'Zn', name_cn: '锌',  name_en: 'Zinc',       covalentRadius: 122, covalentRadiusUncertainty: 4,  vdwRadius: 139, cpkColor: '#7D80B0', ballRadius: 0.45, spaceFillRadius: 1.39, electronegativity: 1.65 },
  Mg: { symbol: 'Mg', name_cn: '镁',  name_en: 'Magnesium',  covalentRadius: 141, covalentRadiusUncertainty: 7,  vdwRadius: 173, cpkColor: '#8AFF00', ballRadius: 0.48, spaceFillRadius: 1.73, electronegativity: 1.31 },
  Ca: { symbol: 'Ca', name_cn: '钙',  name_en: 'Calcium',    covalentRadius: 176, covalentRadiusUncertainty: 10, vdwRadius: 231, cpkColor: '#3DFF00', ballRadius: 0.52, spaceFillRadius: 2.31, electronegativity: 1.00 },
  Mn: { symbol: 'Mn', name_cn: '锰',  name_en: 'Manganese',  covalentRadius: 139, covalentRadiusUncertainty: 5,  vdwRadius: 197, cpkColor: '#9C7AC7', ballRadius: 0.45, spaceFillRadius: 1.97, electronegativity: 1.55 },
  Xe: { symbol: 'Xe', name_cn: '氙',  name_en: 'Xenon',      covalentRadius: 140, covalentRadiusUncertainty: 9,  vdwRadius: 216, cpkColor: '#429EB0', ballRadius: 0.48, spaceFillRadius: 2.16, electronegativity: 2.60 },
};

/** 获取元素数据，未知元素返回默认灰色 */
export function getElement(symbol: string): ElementData {
  return ELEMENTS[symbol] ?? {
    symbol,
    name_cn: symbol,
    name_en: symbol,
    covalentRadius: 100,
    covalentRadiusUncertainty: 0,
    vdwRadius: 170,
    cpkColor: '#808080',
    ballRadius: 0.35,
    spaceFillRadius: 1.70,
    electronegativity: 2.0,
  };
}
