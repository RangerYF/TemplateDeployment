import type { ForceTypeDescriptor } from './descriptor'
import { registerForceType } from './registry'

const externalForceDescriptor: ForceTypeDescriptor = {
  type: 'external',
  label: '外力',
  icon: 'ArrowRight',
  color: '#ef4444',
  letterSymbol: 'F',
  chineseName: '外力',
  defaults: {
    magnitude: 10,
    direction: 0,
    visible: true,
    decompose: false,
    decomposeAngle: 0,
  },
}

registerForceType(externalForceDescriptor)
