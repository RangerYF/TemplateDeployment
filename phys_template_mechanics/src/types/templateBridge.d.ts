interface EdumindTemplateBridge {
  getDefaultSnapshot: () => unknown
  getSnapshot: () => unknown
  loadSnapshot: (snapshot: unknown) => { ok: boolean; errors: string[] }
  validateSnapshot: (snapshot: unknown) => { ok: boolean; errors: string[] }
}

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: EdumindTemplateBridge
    __EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?: () => void
  }
}

export {}
