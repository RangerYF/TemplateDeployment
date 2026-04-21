// Import force type descriptors to trigger registration
import './external'

// Re-export registry API
export { registerForceType, getForceDescriptor, getAllForceDescriptors } from './registry'
export type { ForceTypeDescriptor } from './descriptor'
