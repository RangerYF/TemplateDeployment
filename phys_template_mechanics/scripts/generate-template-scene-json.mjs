import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const root = process.cwd()
const presetsRoot = path.resolve(root, 'src/templates/presets')
const templatesCatalogPath = path.resolve(root, 'src/templates/catalog-data/templates.json')
const outputRoot = path.resolve(root, 'public')

async function main() {
  const server = await createServer({
    root,
    logLevel: 'error',
    appType: 'custom',
    server: {
      middlewareMode: true,
      hmr: false,
    },
  })

  try {
    const { executeTemplateCommandProgram } = await server.ssrLoadModule('/src/templates/commands/executor.ts')
    const { validateProgramAgainstScene, validateSceneSanity, formatSceneDiffs, formatSceneSanityIssues } =
      await server.ssrLoadModule('/src/templates/commands/validator.ts')

    if (typeof executeTemplateCommandProgram !== 'function') {
      throw new Error('executeTemplateCommandProgram is not available from executor.ts')
    }
    if (
      typeof validateProgramAgainstScene !== 'function'
      || typeof validateSceneSanity !== 'function'
      || typeof formatSceneDiffs !== 'function'
      || typeof formatSceneSanityIssues !== 'function'
    ) {
      throw new Error('template validator APIs are not available from validator.ts')
    }

    const templatesCatalog = await loadTemplatesCatalog()
    const commandPrograms = await loadCommandProgramsFromPresets()

    const entries = templatesCatalog
      .filter((template) => template.meta.status === 'ready' && template.sceneSource === 'command')
      .sort((a, b) => a.meta.id.localeCompare(b.meta.id))

    let generatedCount = 0
    let skippedManualCount = 0
    for (const template of templatesCatalog) {
      if (template.meta.status === 'ready' && template.sceneSource === 'manual') {
        skippedManualCount += 1
      }
    }

    for (const template of entries) {
      const templateId = template.meta.id
      const sceneJsonPath = template.sceneJsonPath
      if (!sceneJsonPath) {
        throw new Error(`[template-json] ready command template missing sceneJsonPath: ${templateId}`)
      }
      const program = commandPrograms.get(templateId)
      if (!program) {
        throw new Error(`[template-json] ready command template missing commandProgram in presets: ${templateId}`)
      }

      const scene = executeTemplateCommandProgram(program)
      const sanity = validateSceneSanity(scene, {
        allowNonZeroInitialVelocity: Boolean(program.allowNonZeroInitialVelocity),
        allowCustomBodySize: Boolean(program.allowCustomBodySize),
      })
      if (!sanity.ok) {
        const summary = formatSceneSanityIssues(sanity.issues)
        throw new Error(`[template-json] sanity check failed for ${templateId}\n${summary}`)
      }

      const validation = validateProgramAgainstScene(program, scene)
      if (!validation.ok) {
        const summary = formatSceneDiffs(validation.diffs)
        throw new Error(`[template-json] self validation failed for ${templateId}\n${summary}`)
      }

      const targetPath = resolveSceneOutputPath(sceneJsonPath)
      await mkdir(path.dirname(targetPath), { recursive: true })
      await writeFile(targetPath, `${JSON.stringify(scene, null, 2)}\n`, 'utf8')
      generatedCount += 1
      console.log(`[template-json] generated ${path.relative(root, targetPath)}`)
    }

    console.log(`[template-json] generated ready command templates: ${generatedCount}`)
    console.log(`[template-json] skipped ready manual templates (protected): ${skippedManualCount}`)
  } finally {
    await server.close()
  }
}

async function loadTemplatesCatalog() {
  const raw = await readFile(templatesCatalogPath, 'utf8')
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('failed to parse src/templates/catalog-data/templates.json')
  }
  if (!Array.isArray(payload)) {
    throw new Error('templates catalog must be an array')
  }
  return payload.map((item, index) => parseTemplateCatalogEntry(item, index))
}

async function loadCommandProgramsFromPresets() {
  const map = new Map()
  const moduleEntries = await readdir(presetsRoot, { withFileTypes: true })
  for (const moduleEntry of moduleEntries) {
    if (!moduleEntry.isDirectory()) continue
    const moduleDir = path.resolve(presetsRoot, moduleEntry.name)
    const files = await readdir(moduleDir, { withFileTypes: true })
    for (const file of files) {
      if (!file.isFile()) continue
      if (!file.name.endsWith('.json') || file.name === 'module.json') continue
      const presetPath = path.resolve(moduleDir, file.name)
      const raw = await readFile(presetPath, 'utf8')
      let payload
      try {
        payload = JSON.parse(raw)
      } catch {
        throw new Error(`failed to parse preset json: ${path.relative(root, presetPath)}`)
      }
      if (!isRecord(payload)) continue
      const meta = payload.meta
      const program = payload.commandProgram
      if (!isRecord(meta) || typeof meta.id !== 'string') continue
      if (!isTemplateCommandProgram(program)) continue
      map.set(meta.id, program)
    }
  }
  return map
}

function parseTemplateCatalogEntry(value, index) {
  const pathHint = `templates.json[${index}]`
  if (!isRecord(value)) {
    throw new Error(`invalid template catalog entry: ${pathHint}`)
  }
  const meta = value.meta
  if (!isRecord(meta) || typeof meta.id !== 'string' || typeof meta.status !== 'string') {
    throw new Error(`invalid template meta: ${pathHint}`)
  }
  const sceneSource = value.sceneSource
  if (sceneSource !== 'command' && sceneSource !== 'manual') {
    throw new Error(`invalid sceneSource: ${pathHint}`)
  }
  const sceneJsonPath = value.sceneJsonPath
  if (sceneJsonPath !== undefined && typeof sceneJsonPath !== 'string') {
    throw new Error(`invalid sceneJsonPath: ${pathHint}`)
  }

  return {
    meta: {
      id: meta.id,
      status: meta.status,
    },
    sceneSource,
    sceneJsonPath,
  }
}

function resolveSceneOutputPath(sceneJsonPath) {
  if (!sceneJsonPath.startsWith('/')) {
    throw new Error(`[template-json] sceneJsonPath must start with '/': ${sceneJsonPath}`)
  }
  if (!sceneJsonPath.startsWith('/templates/scenes/')) {
    throw new Error(`[template-json] sceneJsonPath must be under /templates/scenes/: ${sceneJsonPath}`)
  }
  if (!sceneJsonPath.endsWith('.json')) {
    throw new Error(`[template-json] sceneJsonPath must end with .json: ${sceneJsonPath}`)
  }
  return path.resolve(outputRoot, `.${sceneJsonPath}`)
}

function isTemplateCommandProgram(value) {
  if (!isRecord(value)) return false
  if (typeof value.templateId !== 'string') return false
  if (typeof value.sceneName !== 'string') return false
  if (value.version !== '1.0') return false
  if (!Array.isArray(value.commands)) return false
  if (value.allowNonZeroInitialVelocity !== undefined && typeof value.allowNonZeroInitialVelocity !== 'boolean') {
    return false
  }
  if (value.allowCustomBodySize !== undefined && typeof value.allowCustomBodySize !== 'boolean') {
    return false
  }
  return true
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

main().catch((error) => {
  console.error('[template-json] generation failed')
  console.error(error)
  process.exit(1)
})
