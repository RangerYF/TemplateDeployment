// Import joint type descriptors to trigger registration
import './rope'
import './rod'
import './spring'
import './pulley'

// Re-export registry API
export { registerJointType, getJointDescriptor, getAllJointDescriptors } from './registry'
export type { JointTypeDescriptor, JointPropertyDef } from './descriptor'
