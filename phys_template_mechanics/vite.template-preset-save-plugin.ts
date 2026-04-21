import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'

const PRESET_SAVE_PATH = '/__template/preset/save'
const MAX_REQUEST_BYTES = 2 * 1024 * 1024
const TEMPLATE_ID_PATTERN = /^[A-Za-z0-9-]+$/

interface SavePresetRequest {
  templateId: string
  scene: unknown
}

class HttpError extends Error {
  readonly status: number

  constructor(
    status: number,
    message: string,
  ) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

export function templatePresetSavePlugin(): Plugin {
  return {
    name: 'template-preset-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0]
        if (pathname !== PRESET_SAVE_PATH) {
          next()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: '仅支持 POST 请求。' })
          return
        }

        try {
          const payload = await readSavePresetRequest(req)
          const templateId = payload.templateId.trim()
          if (!TEMPLATE_ID_PATTERN.test(templateId)) {
            throw new HttpError(400, `非法模板 ID：${templateId}`)
          }
          if (!isScene(payload.scene)) {
            throw new HttpError(400, '请求体中的 scene 结构无效。')
          }

          const root = server.config.root
          const templatesCatalogPath = resolve(root, 'src/templates/catalog-data/templates.json')
          const sceneJsonPath = `/templates/scenes/${templateId}.json`
          const sceneFilePath = resolve(root, `public${sceneJsonPath}`)

          const templatesCatalog = await readTemplatesCatalog(templatesCatalogPath)
          const nextTemplatesCatalog = patchTemplateCatalog(templatesCatalog, templateId, sceneJsonPath)

          await writeJsonAtomic(sceneFilePath, payload.scene)
          await writeJsonAtomic(templatesCatalogPath, nextTemplatesCatalog)

          sendJson(res, 200, {
            ok: true,
            templateId,
            sceneSource: 'manual',
            presetPath: relative(root, templatesCatalogPath),
            scenePath: relative(root, sceneFilePath),
          })
        } catch (error) {
          if (error instanceof HttpError) {
            sendJson(res, error.status, { ok: false, error: error.message })
            return
          }
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}

async function readSavePresetRequest(req: IncomingMessage): Promise<SavePresetRequest> {
  const raw = await readRawBody(req)
  if (!raw.trim()) {
    throw new HttpError(400, '请求体为空。')
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON。')
  }

  if (!isRecord(payload)) {
    throw new HttpError(400, '请求体必须是对象。')
  }
  if (typeof payload.templateId !== 'string' || !payload.templateId.trim()) {
    throw new HttpError(400, '缺少 templateId。')
  }

  return {
    templateId: payload.templateId,
    scene: payload.scene,
  }
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    total += buffer.length
    if (total > MAX_REQUEST_BYTES) {
      throw new HttpError(413, '请求体过大。')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function readTemplatesCatalog(catalogPath: string): Promise<unknown[]> {
  const raw = await readFile(catalogPath, 'utf8')
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`JSON 解析失败：${relative(process.cwd(), catalogPath)}`)
  }
  if (!Array.isArray(payload)) {
    throw new Error(`templates catalog 结构无效：${relative(process.cwd(), catalogPath)}`)
  }
  return payload
}

function patchTemplateCatalog(
  templatesCatalog: unknown[],
  templateId: string,
  sceneJsonPath: string,
): unknown[] {
  const now = new Date().toISOString()
  let found = false

  const nextCatalog = templatesCatalog.map((entry) => {
    if (!isRecord(entry)) return entry
    const meta = entry.meta
    if (!isRecord(meta)) return entry
    if (meta.id !== templateId) return entry
    found = true

    return {
      ...entry,
      meta: {
        ...meta,
        status: 'ready',
      },
      sceneSource: 'manual',
      sceneJsonPath,
      updatedAt: now,
    }
  })

  if (!found) {
    throw new HttpError(404, `未在 catalog 中找到模板：${templateId}`)
  }
  return nextCatalog
}

async function writeJsonAtomic(filePath: string, payload: unknown): Promise<void> {
  const dir = dirname(filePath)
  await mkdir(dir, { recursive: true })
  const tempPath = join(
    dir,
    `.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
  )
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(`${JSON.stringify(payload)}\n`)
}

function isScene(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.name !== 'string') return false
  if (!Array.isArray(value.bodies) || !Array.isArray(value.joints) || !Array.isArray(value.forces)) {
    return false
  }
  if (!isRecord(value.settings) || !isVec2(value.settings.gravity)) {
    return false
  }

  return value.bodies.every(isSceneBody) && value.joints.every(isSceneJoint) && value.forces.every(isSceneForce)
}

function isSceneBody(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (!isVec2(value.position)) return false
  if (typeof value.angle !== 'number') return false
  if (typeof value.isStatic !== 'boolean') return false
  if (typeof value.fixedRotation !== 'boolean') return false
  if (typeof value.mass !== 'number') return false
  if (typeof value.friction !== 'number') return false
  if (typeof value.restitution !== 'number') return false
  if (!isVec2(value.initialVelocity)) return false
  if (!isVec2(value.initialAcceleration)) return false
  return true
}

function isSceneJoint(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (typeof value.bodyIdA !== 'string') return false
  if (typeof value.bodyIdB !== 'string') return false
  if (!isVec2(value.anchorA)) return false
  if (!isVec2(value.anchorB)) return false
  return true
}

function isSceneForce(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.targetBodyId !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (typeof value.magnitude !== 'number') return false
  if (typeof value.direction !== 'number') return false
  if (typeof value.visible !== 'boolean') return false
  if (typeof value.decompose !== 'boolean') return false
  if (typeof value.decomposeAngle !== 'number') return false
  return true
}

function isVec2(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
