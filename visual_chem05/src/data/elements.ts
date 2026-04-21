/**
 * Element data with CPK (Jmol) colors, covalent radii, van der Waals radii,
 * and ionic radii for common crystal-forming elements.
 *
 * Color source: Jmol CPK color convention
 * Radii source: standard crystallographic references (Shannon ionic radii, Cordero covalent, Bondi vdW)
 * All radii in Angstroms.
 */

export interface ElementData {
  symbol: string;
  name: string;
  nameCn: string;
  atomicNumber: number;
  color: string;          // CPK hex color (Jmol convention)
  covalentRadius: number; // Angstroms
  vdwRadius: number;      // Angstroms
  ionicRadii?: Record<string, number>; // charge -> radius in Angstroms, e.g. "+1": 1.02
}

export const ELEMENTS: Record<string, ElementData> = {
  H: {
    symbol: 'H',
    name: 'Hydrogen',
    nameCn: '氢',
    atomicNumber: 1,
    color: '#FFFFFF',
    covalentRadius: 0.31,
    vdwRadius: 1.20,
    ionicRadii: {
      '+1': 0.10,  // essentially a bare proton; effective in crystals ~0.10
      '-1': 1.54,  // hydride
    },
  },
  C: {
    symbol: 'C',
    name: 'Carbon',
    nameCn: '碳',
    atomicNumber: 6,
    color: '#909090',
    covalentRadius: 0.76,
    vdwRadius: 1.70,
    ionicRadii: {
      '+4': 0.16,
      '-4': 2.60,
    },
  },
  N: {
    symbol: 'N',
    name: 'Nitrogen',
    nameCn: '氮',
    atomicNumber: 7,
    color: '#3050F8',
    covalentRadius: 0.71,
    vdwRadius: 1.55,
    ionicRadii: {
      '+3': 0.16,
      '+5': 0.13,
      '-3': 1.46,
    },
  },
  O: {
    symbol: 'O',
    name: 'Oxygen',
    nameCn: '氧',
    atomicNumber: 8,
    color: '#FF0D0D',
    covalentRadius: 0.66,
    vdwRadius: 1.52,
    ionicRadii: {
      '-2': 1.40,
      '-1': 1.32,  // peroxide
    },
  },
  F: {
    symbol: 'F',
    name: 'Fluorine',
    nameCn: '氟',
    atomicNumber: 9,
    color: '#90E050',
    covalentRadius: 0.57,
    vdwRadius: 1.47,
    ionicRadii: {
      '-1': 1.33,
    },
  },
  Na: {
    symbol: 'Na',
    name: 'Sodium',
    nameCn: '钠',
    atomicNumber: 11,
    color: '#AB5CF2',
    covalentRadius: 1.66,
    vdwRadius: 2.27,
    ionicRadii: {
      '+1': 1.02,
    },
  },
  Mg: {
    symbol: 'Mg',
    name: 'Magnesium',
    nameCn: '镁',
    atomicNumber: 12,
    color: '#8AFF00',
    covalentRadius: 1.41,
    vdwRadius: 1.73,
    ionicRadii: {
      '+2': 0.72,
    },
  },
  Si: {
    symbol: 'Si',
    name: 'Silicon',
    nameCn: '硅',
    atomicNumber: 14,
    color: '#F0C8A0',
    covalentRadius: 1.11,
    vdwRadius: 2.10,
    ionicRadii: {
      '+4': 0.40,
      '-4': 2.71,
    },
  },
  S: {
    symbol: 'S',
    name: 'Sulfur',
    nameCn: '硫',
    atomicNumber: 16,
    color: '#FFFF30',
    covalentRadius: 1.05,
    vdwRadius: 1.80,
    ionicRadii: {
      '+4': 0.37,
      '+6': 0.29,
      '-2': 1.84,
    },
  },
  Cl: {
    symbol: 'Cl',
    name: 'Chlorine',
    nameCn: '氯',
    atomicNumber: 17,
    color: '#1FF01F',
    covalentRadius: 1.02,
    vdwRadius: 1.75,
    ionicRadii: {
      '+5': 0.12,
      '+7': 0.27,
      '-1': 1.81,
    },
  },
  Ca: {
    symbol: 'Ca',
    name: 'Calcium',
    nameCn: '钙',
    atomicNumber: 20,
    color: '#3DFF00',
    covalentRadius: 1.76,
    vdwRadius: 2.31,
    ionicRadii: {
      '+2': 1.00,
    },
  },
  Ti: {
    symbol: 'Ti',
    name: 'Titanium',
    nameCn: '钛',
    atomicNumber: 22,
    color: '#BFC2C7',
    covalentRadius: 1.60,
    vdwRadius: 2.15,
    ionicRadii: {
      '+2': 0.86,
      '+3': 0.67,
      '+4': 0.605,
    },
  },
  Fe: {
    symbol: 'Fe',
    name: 'Iron',
    nameCn: '铁',
    atomicNumber: 26,
    color: '#E06633',
    covalentRadius: 1.52,
    vdwRadius: 2.04,
    ionicRadii: {
      '+2': 0.78,  // high-spin octahedral
      '+3': 0.645, // high-spin octahedral
    },
  },
  Cu: {
    symbol: 'Cu',
    name: 'Copper',
    nameCn: '铜',
    atomicNumber: 29,
    color: '#C88033',
    covalentRadius: 1.32,
    vdwRadius: 1.40,
    ionicRadii: {
      '+1': 0.77,
      '+2': 0.73,
    },
  },
  Zn: {
    symbol: 'Zn',
    name: 'Zinc',
    nameCn: '锌',
    atomicNumber: 30,
    color: '#7D80B0',
    covalentRadius: 1.22,
    vdwRadius: 1.39,
    ionicRadii: {
      '+2': 0.74,
    },
  },
  Ga: {
    symbol: 'Ga',
    name: 'Gallium',
    nameCn: '镓',
    atomicNumber: 31,
    color: '#C28F8F',
    covalentRadius: 1.22,
    vdwRadius: 1.87,
    ionicRadii: {
      '+3': 0.62,
    },
  },
  Y: {
    symbol: 'Y',
    name: 'Yttrium',
    nameCn: '钇',
    atomicNumber: 39,
    color: '#94FFFF',
    covalentRadius: 1.90,
    vdwRadius: 2.32,
    ionicRadii: {
      '+3': 0.90,
    },
  },
  Cd: {
    symbol: 'Cd',
    name: 'Cadmium',
    nameCn: '镉',
    atomicNumber: 48,
    color: '#FFD98F',
    covalentRadius: 1.44,
    vdwRadius: 1.58,
    ionicRadii: {
      '+2': 0.95,
    },
  },
  I: {
    symbol: 'I',
    name: 'Iodine',
    nameCn: '碘',
    atomicNumber: 53,
    color: '#940094',
    covalentRadius: 1.39,
    vdwRadius: 1.98,
    ionicRadii: {
      '+5': 0.95,
      '+7': 0.53,
      '-1': 2.20,
    },
  },
  Cs: {
    symbol: 'Cs',
    name: 'Cesium',
    nameCn: '铯',
    atomicNumber: 55,
    color: '#57178F',
    covalentRadius: 2.44,
    vdwRadius: 3.43,
    ionicRadii: {
      '+1': 1.67,
    },
  },
  Ba: {
    symbol: 'Ba',
    name: 'Barium',
    nameCn: '钡',
    atomicNumber: 56,
    color: '#00C900',
    covalentRadius: 2.15,
    vdwRadius: 2.68,
    ionicRadii: {
      '+2': 1.35,
    },
  },
};

/**
 * Get element data with fallback for unknown elements.
 */
export function getElement(symbol: string): ElementData {
  return ELEMENTS[symbol] ?? {
    symbol,
    name: symbol,
    nameCn: symbol,
    atomicNumber: 0,
    color: '#FF1493', // hot pink for unknown
    covalentRadius: 1.0,
    vdwRadius: 1.5,
  };
}

/**
 * Get the ionic radius for an element in a given charge state.
 * Falls back to covalent radius if the charge state is not found.
 */
export function getIonicRadius(symbol: string, charge: string): number {
  const el = getElement(symbol);
  return el.ionicRadii?.[charge] ?? el.covalentRadius;
}
