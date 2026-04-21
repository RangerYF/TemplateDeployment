import { create } from 'zustand'
import type { Tool } from '@/core/tools/Tool'
import type { JointType } from '@/models/types'
import { SelectTool } from '@/core/tools/SelectTool'
import { JointTool } from '@/core/tools/JointTool'
import { ForceTool } from '@/core/tools/ForceTool'
import { PanTool } from '@/core/tools/PanTool'

export type ToolName = 'select' | 'joint' | 'force' | 'pan'

interface ToolState {
  activeTool: Tool
  activeToolName: ToolName
  /** 当前选中的约束子类型 */
  jointSubType: JointType
}

interface ToolActions {
  setTool: (name: ToolName) => void
  setJointSubType: (type: JointType) => void
}

function createTool(name: ToolName, jointType?: JointType): Tool {
  switch (name) {
    case 'select':
      return new SelectTool()
    case 'joint':
      return new JointTool(jointType)
    case 'force':
      return new ForceTool()
    case 'pan':
      return new PanTool()
    default:
      return new SelectTool()
  }
}

export const useToolStore = create<ToolState & ToolActions>()((set, get) => ({
  activeTool: new SelectTool(),
  activeToolName: 'select',
  jointSubType: 'rope' as JointType,

  setTool: (name) =>
    set({
      activeTool: createTool(name, get().jointSubType),
      activeToolName: name,
    }),

  setJointSubType: (type) => {
    set({ jointSubType: type })
    // If currently using JointTool, update it
    const current = get().activeTool
    if (current instanceof JointTool) {
      current.setJointType(type)
    }
  },
}))
