import type { TemplateBridge } from '@/templates/snapshot'

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void
  }
}

export {}
