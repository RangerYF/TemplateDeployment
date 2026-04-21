export type TitrationType =
  | 'strongAcid_strongBase'
  | 'strongBase_strongAcid'
  | 'strongBase_weakAcid'
  | 'strongAcid_weakBase';

export interface TitrationPreset {
  type: TitrationType;
  label: string;
  titrant: string;
  analyte: string;
  titrantFormula: string;
  analyteFormula: string;
  recommendedIndicators: string[];
  pKa?: number;
}

export const TITRATION_PRESETS: TitrationPreset[] = [
  {
    type: 'strongAcid_strongBase',
    label: '强酸滴强碱',
    titrant: '盐酸（已标定）',
    analyte: 'NaOH',
    titrantFormula: 'HCl',
    analyteFormula: 'NaOH',
    recommendedIndicators: ['phenolphthalein', 'methylOrange'],
  },
  {
    type: 'strongBase_strongAcid',
    label: '强碱滴强酸',
    titrant: 'NaOH（已标定）',
    analyte: '盐酸',
    titrantFormula: 'NaOH',
    analyteFormula: 'HCl',
    recommendedIndicators: ['phenolphthalein', 'methylOrange'],
  },
  {
    type: 'strongBase_weakAcid',
    label: '强碱滴弱酸',
    titrant: 'NaOH（已标定）',
    analyte: '醋酸',
    titrantFormula: 'NaOH',
    analyteFormula: 'CH₃COOH',
    recommendedIndicators: ['phenolphthalein'],
    pKa: 4.75,
  },
  {
    type: 'strongAcid_weakBase',
    label: '强酸滴弱碱',
    titrant: '盐酸（已标定）',
    analyte: '氨水',
    titrantFormula: 'HCl',
    analyteFormula: 'NH₃·H₂O',
    recommendedIndicators: ['methylOrange'],
    pKa: 9.25,
  },
];

export const TITRATION_TYPE_OPTIONS = TITRATION_PRESETS.map((p) => ({
  value: p.type,
  label: p.label,
}));

export const REFERENCE_STANDARDS = {
  forAcid: {
    name: 'Na₂CO₃（碳酸钠）',
    description: '用于标定酸的基准物质，纯度高、稳定、易称量',
  },
  forBase: {
    name: 'H₂C₂O₄（草酸）',
    description: '用于标定碱的基准物质',
  },
};

export function getPreset(type: TitrationType): TitrationPreset {
  return TITRATION_PRESETS.find((p) => p.type === type)!;
}
