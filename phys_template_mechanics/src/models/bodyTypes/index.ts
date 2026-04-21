// Import all body type descriptors to trigger registration
import './block'
import './ball'
import './slope'
import './wall'
import './anchor'
import './pulleyMount'
import './conveyor'
import './hemisphere'
import './halfSphere'
import './groove'
import './ground'

// Re-export registry API
export { registerBodyType, getBodyDescriptor, getAllDescriptors, getDescriptorsByCategory } from './registry'
export type { BodyTypeDescriptor, PropertyDef, InteractionCapability, ResolvedInteraction, LocalBBox, ResizeMode } from './descriptor'
export { getInteraction } from './descriptor'
