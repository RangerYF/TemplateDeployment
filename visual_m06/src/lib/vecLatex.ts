const PH_E1 = String.fromCodePoint(0xE001);
const PH_E2 = String.fromCodePoint(0xE002);

export function toVecLatex(label: string): string | null {
  if (/[一-鿿]/.test(label)) return null;
  if (label === 'proj') return '\\text{proj}';
  let s = label;
  s = s.replace(/e₁/g, PH_E1);
  s = s.replace(/e₂/g, PH_E2);
  s = s.replace(/(-?)([a-z])('?)/g, '$1\\vec{$2}$3');
  s = s.replace(/·/g, '\\cdot ');
  s = s.replace(new RegExp(PH_E1, 'g'), '\\vec{e}_1');
  s = s.replace(new RegExp(PH_E2, 'g'), '\\vec{e}_2');
  return s;
}
