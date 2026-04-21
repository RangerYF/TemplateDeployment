import type { TemplateCommandProgram } from './schema'

const presetFiles = import.meta.glob('../presets/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

export const templateCommandPrograms: Record<string, TemplateCommandProgram> = Object.fromEntries(
  Object.values(presetFiles)
    .flatMap((payload) => {
      if (!isRecord(payload)) return []
      const meta = payload.meta
      const commandProgram = payload.commandProgram
      if (!isRecord(meta) || typeof meta.id !== 'string') return []
      if (!isTemplateCommandProgram(commandProgram)) return []
      return [[meta.id, commandProgram] as const]
    }),
)

export function getTemplateCommandProgram(templateId: string): TemplateCommandProgram | undefined {
  return templateCommandPrograms[templateId]
}

function isTemplateCommandProgram(value: unknown): value is TemplateCommandProgram {
  if (!isRecord(value)) return false
  if (typeof value.templateId !== 'string') return false
  if (typeof value.sceneName !== 'string') return false
  if (value.version !== '1.0') return false
  if (!Array.isArray(value.commands)) return false
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
