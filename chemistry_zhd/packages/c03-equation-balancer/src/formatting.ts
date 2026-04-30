import type { ParsedEquation } from './parser/types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFormulaBody(body: string): string {
  let html = '';
  for (const char of body) {
    if (/\d/.test(char)) {
      html += `<sub>${char}</sub>`;
    } else {
      html += escapeHtml(char);
    }
  }
  return html;
}

function formatChargeText(magnitude: string, sign: string): string {
  const prefix = magnitude ? escapeHtml(magnitude) : '';
  return `${prefix}${sign === '+' ? '+' : '−'}`;
}

function shouldUseTrailingDigitAsCharge(formulaNoState: string, digitPart: string): boolean {
  if (/\d\d[+-]$/.test(formulaNoState)) return true;
  const upperCount = (formulaNoState.match(/[A-Z]/g) ?? []).length;
  if (upperCount <= 1) return true;
  const body = formulaNoState.slice(0, -digitPart.length - 1);
  return body.startsWith('(') && body.endsWith(')');
}

export function formatFormulaForDisplay(formula: string): string {
  const stateMatch = /(\(s\)|\(g\)|\(l\)|\(aq\)|↑|↓)$/.exec(formula);
  const state = stateMatch ? stateMatch[0] : '';
  const formulaWithoutState = stateMatch
    ? formula.slice(0, -stateMatch[0].length)
    : formula;

  const chargeMatch = /([1-9]?)([+-])$/.exec(formulaWithoutState);
  let body = formulaWithoutState;
  let chargeHtml = '';

  if (chargeMatch) {
    const [, digitPart, signPart] = chargeMatch;
    const digitIsCharge = digitPart && shouldUseTrailingDigitAsCharge(formulaWithoutState, digitPart);
    body = formulaWithoutState.slice(0, digitIsCharge ? -chargeMatch[0].length : -1);
    chargeHtml = `<sup>${formatChargeText(digitIsCharge ? digitPart : '', signPart)}</sup>`;
  }

  const stateHtml = state
    ? `<span class="formula-state">${escapeHtml(state)}</span>`
    : '';

  return `<span class="formula-token">${formatFormulaBody(body)}${chargeHtml}${stateHtml}</span>`;
}

export function formatEquation(
  eq: ParsedEquation,
  coeffs: number[],
  options: { showUnitCoefficient?: boolean } = {},
): string {
  const { showUnitCoefficient = false } = options;
  const reactantCount = eq.reactants.length;

  const formatTerm = (formula: string, coefficient: number): string => {
    const coefficientHtml = coefficient === 1 && !showUnitCoefficient
      ? ''
      : `<span class="coeff">${coefficient}</span>`;
    return `<span class="equation-term">${coefficientHtml}${formatFormulaForDisplay(formula)}</span>`;
  };

  const left = eq.reactants
    .map((mol, index) => formatTerm(mol.rawFormula, coeffs[index]))
    .join(' + ');
  const right = eq.products
    .map((mol, index) => formatTerm(mol.rawFormula, coeffs[reactantCount + index]))
    .join(' + ');

  return `${left} = ${right}`;
}

export { escapeHtml };
