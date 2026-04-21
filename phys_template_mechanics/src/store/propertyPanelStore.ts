import { create } from 'zustand'

export type PropertyPanelTab = 'props' | 'forces' | 'motion'
export const DEFAULT_PROPERTY_PANEL_TAB: PropertyPanelTab = 'props'

interface PropertyPanelState {
  activeTab: PropertyPanelTab
  setActiveTab: (tab: PropertyPanelTab) => void
}

export const usePropertyPanelStore = create<PropertyPanelState>((set) => ({
  activeTab: DEFAULT_PROPERTY_PANEL_TAB,
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
