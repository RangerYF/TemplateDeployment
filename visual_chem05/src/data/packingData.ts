import type { PackingType } from '@/engine/types';

export interface PackingInfo {
  type: PackingType;
  name: string;
  nameCn: string;
  layerSequence: string;
  coordinationNumber: number;
  packingEfficiency: number;
  /** 代表性原子半径（pm），用于计算可容纳最大离子半径 */
  sphereRadiusPm: number;
  voidInfo: {
    tetrahedral: { count: string; rRatio: string };
    octahedral: { count: string; rRatio: string };
  };
  examples: string[];
  description: string;
}

export const PACKING_DATA: PackingInfo[] = [
  {
    type: 'SC',
    name: 'Simple Cubic',
    nameCn: '简单立方堆积',
    layerSequence: 'AAAA...',
    coordinationNumber: 6,
    packingEfficiency: 0.5236,
    sphereRadiusPm: 167, // Po（钋）原子半径
    voidInfo: {
      tetrahedral: {
        count: '不存在标准四面体空隙',
        rRatio: '—',
      },
      octahedral: {
        count: '每个晶胞含 1 个立方体空隙（体心位置）',
        rRatio: 'r/R = 0.732',
      },
    },
    examples: ['Po（钋）'],
    description:
      '每个球与上下左右前后共 6 个球相切，配位数为 6。' +
      '堆积效率仅 52.36%，是所有常见堆积方式中最低的。' +
      '自然界中仅钋（Po）在常温下采用此结构。',
  },
  {
    type: 'BCC',
    name: 'Body-Centered Cubic',
    nameCn: '体心立方堆积',
    layerSequence: 'ABAB...',
    coordinationNumber: 8,
    packingEfficiency: 0.6802,
    sphereRadiusPm: 126, // Fe（α-铁）原子半径
    voidInfo: {
      tetrahedral: {
        count: '每个晶胞含 24 个四面体空隙（每个面 4 个）',
        rRatio: 'r/R = 0.291',
      },
      octahedral: {
        count: '每个晶胞含 6 个八面体空隙（棱心位置，扁八面体）',
        rRatio: 'r/R = 0.155',
      },
    },
    examples: ['Fe（α-铁）', 'Cr（铬）', 'W（钨）', 'Na（钠）', 'K（钾）'],
    description:
      '体心原子与 8 个顶点原子等距相切，配位数为 8。' +
      '堆积效率 68.02%，介于简单立方与面心立方之间。' +
      '碱金属和许多过渡金属采用此结构，如 α-Fe、W、Na 等。',
  },
  {
    type: 'FCC',
    name: 'Face-Centered Cubic (CCP)',
    nameCn: '面心立方最密堆积（立方最密堆积）',
    layerSequence: 'ABCABC...',
    coordinationNumber: 12,
    packingEfficiency: 0.7405,
    sphereRadiusPm: 128, // Cu（铜）原子半径
    voidInfo: {
      tetrahedral: {
        count: '每个晶胞含 8 个四面体空隙（体对角线 1/4 处）',
        rRatio: 'r/R = 0.225',
      },
      octahedral: {
        count: '每个晶胞含 4 个八面体空隙（体心 1 个 + 棱心 12×1/4 = 3 个）',
        rRatio: 'r/R = 0.414',
      },
    },
    examples: ['Cu（铜）', 'Ag（银）', 'Au（金）', 'Al（铝）', 'γ-Fe'],
    description:
      '三层球按 ABCABC 顺序循环堆积，每个球与同层 6 个、上下各 3 个共 12 个球相切。' +
      '堆积效率 74.05%，与 HCP 并列为最密堆积。' +
      '又称立方最密堆积（CCP），常见于 Cu、Ag、Au、Al 等金属。',
  },
  {
    type: 'HCP',
    name: 'Hexagonal Close-Packed',
    nameCn: '六方最密堆积',
    layerSequence: 'ABABAB...',
    coordinationNumber: 12,
    packingEfficiency: 0.7405,
    sphereRadiusPm: 160, // Mg（镁）原子半径
    voidInfo: {
      tetrahedral: {
        count: '每个晶胞含 4 个四面体空隙（2 个朝上 + 2 个朝下）',
        rRatio: 'r/R = 0.225',
      },
      octahedral: {
        count: '每个晶胞含 2 个八面体空隙',
        rRatio: 'r/R = 0.414',
      },
    },
    examples: ['Mg（镁）', 'Zn（锌）', 'Ti（钛）', 'Co（钴）'],
    description:
      '两层球按 ABABAB 顺序交替堆积，每个球同样与 12 个球相切。' +
      '堆积效率 74.05%，与 FCC 同为最密堆积。' +
      '六方晶胞中含 2 个等效原子（顶点 + 体内），c/a 理想比值为 √(8/3) ≈ 1.633。' +
      '常见于 Mg、Zn、Ti 等金属。',
  },
];
