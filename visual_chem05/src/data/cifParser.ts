import type { AtomSite, LatticeParams } from '@/engine/types';

export interface ParsedCifStructure {
  lattice: LatticeParams;
  atomSites: AtomSite[];
  spaceGroup?: string;
  spaceGroupNumber?: number;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function tokenize(line: string): string[] {
  const matches = line.match(/'[^']*'|"[^"]*"|\S+/g);
  return matches ?? [];
}

function parseNumeric(raw: string): number {
  const cleaned = stripQuotes(raw).replace(/\(.+\)$/, '');
  if (cleaned.includes('/')) {
    const [num, den] = cleaned.split('/').map(Number);
    return den ? num / den : Number.NaN;
  }
  return Number(cleaned);
}

function parseElementSymbol(rawType: string, fallbackLabel: string): string {
  const raw = stripQuotes(rawType || fallbackLabel);
  const match = raw.match(/[A-Z][a-z]?/);
  return match?.[0] ?? raw;
}

export function parseCif(raw: string): ParsedCifStructure {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const scalarFields = new Map<string, string>();
  let atomSites: AtomSite[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== 'loop_') {
      if (line.startsWith('_')) {
        const [key, ...rest] = tokenize(line);
        scalarFields.set(key, rest.join(' '));
      }
      continue;
    }

    const headers: string[] = [];
    const rows: string[][] = [];

    let cursor = i + 1;
    while (cursor < lines.length && lines[cursor].startsWith('_')) {
      headers.push(lines[cursor]);
      cursor += 1;
    }
    while (
      cursor < lines.length &&
      lines[cursor] !== 'loop_' &&
      !lines[cursor].startsWith('_') &&
      !lines[cursor].startsWith('data_')
    ) {
      rows.push(tokenize(lines[cursor]));
      cursor += 1;
    }
    i = cursor - 1;

    if (
      headers.includes('_atom_site_fract_x') &&
      headers.includes('_atom_site_fract_y') &&
      headers.includes('_atom_site_fract_z')
    ) {
      const labelIdx = headers.findIndex((h) => h === '_atom_site_label');
      const typeIdx = headers.findIndex((h) => h === '_atom_site_type_symbol');
      const xIdx = headers.findIndex((h) => h === '_atom_site_fract_x');
      const yIdx = headers.findIndex((h) => h === '_atom_site_fract_y');
      const zIdx = headers.findIndex((h) => h === '_atom_site_fract_z');

      atomSites = rows.map((row, rowIndex) => {
        const label = row[labelIdx] ?? `Site${rowIndex + 1}`;
        const typeSymbol = row[typeIdx] ?? label;
        return {
          element: parseElementSymbol(typeSymbol, label),
          label: stripQuotes(label),
          fracCoords: [
            parseNumeric(row[xIdx] ?? '0'),
            parseNumeric(row[yIdx] ?? '0'),
            parseNumeric(row[zIdx] ?? '0'),
          ],
        };
      });
    }
  }

  const lattice: LatticeParams = {
    a: parseNumeric(scalarFields.get('_cell_length_a') ?? '0') * 100,
    b: parseNumeric(scalarFields.get('_cell_length_b') ?? '0') * 100,
    c: parseNumeric(scalarFields.get('_cell_length_c') ?? '0') * 100,
    alpha: parseNumeric(scalarFields.get('_cell_angle_alpha') ?? '90'),
    beta: parseNumeric(scalarFields.get('_cell_angle_beta') ?? '90'),
    gamma: parseNumeric(scalarFields.get('_cell_angle_gamma') ?? '90'),
  };

  const spaceGroup =
    stripQuotes(scalarFields.get('_space_group_name_H-M_alt') ?? '') ||
    stripQuotes(scalarFields.get('_symmetry_space_group_name_H-M') ?? '') ||
    undefined;

  const sgNumberRaw =
    scalarFields.get('_space_group_IT_number') ??
    scalarFields.get('_symmetry_Int_Tables_number');
  const spaceGroupNumber = sgNumberRaw ? parseNumeric(sgNumberRaw) : undefined;

  return {
    lattice,
    atomSites,
    spaceGroup,
    spaceGroupNumber,
  };
}
