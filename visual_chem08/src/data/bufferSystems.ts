export interface BufferSystem {
  id: string;
  name: string;
  components: [string, string];
  formulas: [string, string];
  targetPH: number;
  pKa: number;
  description: string;
}

export const BUFFER_SYSTEMS: BufferSystem[] = [
  {
    id: 'acetate',
    name: '醋酸-醋酸钠',
    components: ['醋酸', '醋酸钠'],
    formulas: ['CH₃COOH', 'CH₃COONa'],
    targetPH: 4.75,
    pKa: 4.75,
    description:
      '弱酸及其共轭碱组成的缓冲体系。加入少量酸时，CH₃COO⁻ + H⁺ → CH₃COOH，消耗 H⁺；加入少量碱时，CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O，消耗 OH⁻。',
  },
  {
    id: 'ammonia',
    name: '氨-氯化铵',
    components: ['氨水', '氯化铵'],
    formulas: ['NH₃·H₂O', 'NH₄Cl'],
    targetPH: 9.25,
    pKa: 9.25,
    description:
      '弱碱及其共轭酸组成的缓冲体系。加入少量酸时，NH₃·H₂O + H⁺ → NH₄⁺ + H₂O；加入少量碱时，NH₄⁺ + OH⁻ → NH₃·H₂O。',
  },
  {
    id: 'blood',
    name: '血液缓冲',
    components: ['碳酸', '碳酸氢钠'],
    formulas: ['H₂CO₃', 'NaHCO₃'],
    targetPH: 7.4,
    pKa: 6.35,
    description:
      '人体血液中最重要的缓冲体系，维持血液 pH 在 7.35–7.45 之间。H₂CO₃ ⇌ H⁺ + HCO₃⁻，多余的 CO₂ 通过呼吸排出，实现动态平衡。',
  },
];

export const BUFFER_OPTIONS = BUFFER_SYSTEMS.map((b) => ({
  value: b.id,
  label: b.name,
}));

export function getBuffer(id: string): BufferSystem {
  return BUFFER_SYSTEMS.find((b) => b.id === id)!;
}
