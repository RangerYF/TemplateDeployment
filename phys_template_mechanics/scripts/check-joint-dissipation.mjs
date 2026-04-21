import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const root = '/root/phys_template_mechanics'
const requireFromRoot = createRequire(path.join(root, 'package.json'))
const { createServer } = await import(requireFromRoot.resolve('vite'))

const DT = 1 / 60
const DURATION_SEC = 6
const STEPS = Math.round(DURATION_SEC / DT)
const EPS = 1e-6
const SLACK_EPS = 1e-4

const SCENARIOS = [
  {
    id: 'FM-043',
    scenePath: 'public/templates/scenes/FM-043.json',
    acceptance: {
      maxEndDriftPct: 12,
      maxSlackFrameRatioPct: 5,
      maxSlackDepth: 0.1,
      minBottomRetentionPct: 85,
    },
  },
  {
    id: 'FM-044',
    scenePath: 'public/templates/scenes/FM-044.json',
    acceptance: {
      maxEndDriftPct: 7,
      maxSlackFrameRatioPct: 0,
      maxSlackDepth: 0,
      minBottomRetentionPct: 88,
    },
  },
  {
    id: 'MOT-033',
    scenePath: 'public/templates/scenes/MOT-033.json',
    acceptance: {
      maxEndDriftPct: 12,
      maxSlackFrameRatioPct: 5,
      maxSlackDepth: 0.1,
      minBottomRetentionPct: 85,
    },
  },
]

function wrapDelta(delta) {
  if (delta > Math.PI) return delta - Math.PI * 2
  if (delta < -Math.PI) return delta + Math.PI * 2
  return delta
}

function lerp(a, b, alpha) {
  return a + (b - a) * alpha
}

function getDynamicBody(scene) {
  const bodies = scene.bodies.filter((body) => !body.isStatic)
  if (bodies.length !== 1) {
    throw new Error(`expected exactly 1 dynamic body, got ${bodies.length}`)
  }
  return bodies[0]
}

function getGroundY(scene) {
  return scene.bodies.find((body) => body.type === 'ground')?.position.y ?? 0
}

function getSingleJoint(scene) {
  if (scene.joints.length !== 1) {
    throw new Error(`expected exactly 1 joint, got ${scene.joints.length}`)
  }
  return scene.joints[0]
}

function buildFrame({ t, bodyState, jointState, sceneBody, groundY, gravityY, targetLength, isRope, unwrappedAngle }) {
  const vx = Math.abs(bodyState.linearVelocity.x) < 1e-9 ? 0 : bodyState.linearVelocity.x
  const vy = Math.abs(bodyState.linearVelocity.y) < 1e-9 ? 0 : bodyState.linearVelocity.y
  const speed = Math.hypot(vx, vy)
  const ek = 0.5 * sceneBody.mass * speed * speed
  const epGravity = sceneBody.mass * gravityY * (bodyState.position.y - groundY)
  const eMech = ek + epGravity

  const dx = jointState.anchorB.x - jointState.anchorA.x
  const dy = jointState.anchorB.y - jointState.anchorA.y
  const actualLength = Math.hypot(dx, dy)
  const jointError = actualLength - targetLength
  const ropeSlack = isRope && actualLength < targetLength - SLACK_EPS

  return {
    t,
    speed,
    ek,
    epGravity,
    eMech,
    actualLength,
    jointError,
    ropeSlack,
    unwrappedAngle,
  }
}

function interpolateFrame(prev, curr, targetAngle) {
  const angleSpan = curr.unwrappedAngle - prev.unwrappedAngle
  const alpha = Math.abs(angleSpan) < EPS ? 0 : (targetAngle - prev.unwrappedAngle) / angleSpan
  return {
    t: lerp(prev.t, curr.t, alpha),
    speed: lerp(prev.speed, curr.speed, alpha),
    eMech: lerp(prev.eMech, curr.eMech, alpha),
    jointError: lerp(prev.jointError, curr.jointError, alpha),
    ropeSlack: prev.ropeSlack || curr.ropeSlack,
  }
}

function summarizeFrames(frames) {
  const initialEnergy = frames[0].eMech
  const finalEnergy = frames.at(-1).eMech
  let maxAbsJointError = 0
  let slackFrames = 0
  let maxSlackDepth = 0

  for (const frame of frames) {
    maxAbsJointError = Math.max(maxAbsJointError, Math.abs(frame.jointError))
    if (frame.ropeSlack) {
      slackFrames += 1
      maxSlackDepth = Math.max(maxSlackDepth, Math.max(0, -frame.jointError))
    }
  }

  return {
    endDriftPct: ((finalEnergy - initialEnergy) / initialEnergy) * 100,
    maxAbsJointError,
    slackFrameRatioPct: (slackFrames / frames.length) * 100,
    maxSlackDepth,
  }
}

function evaluateAcceptance(summary, initialBottom, firstReturnBottom, acceptance) {
  const bottomRetentionPct = firstReturnBottom
    ? (firstReturnBottom.speed / initialBottom.speed) * 100
    : 0

  const failures = []
  if (Math.abs(summary.endDriftPct) > acceptance.maxEndDriftPct) {
    failures.push(`endDriftPct=${summary.endDriftPct.toFixed(2)}% > ${acceptance.maxEndDriftPct}%`)
  }
  if (summary.slackFrameRatioPct > acceptance.maxSlackFrameRatioPct + EPS) {
    failures.push(`slackFrameRatioPct=${summary.slackFrameRatioPct.toFixed(2)}% > ${acceptance.maxSlackFrameRatioPct}%`)
  }
  if (summary.maxSlackDepth > acceptance.maxSlackDepth + EPS) {
    failures.push(`maxSlackDepth=${summary.maxSlackDepth.toFixed(4)}m > ${acceptance.maxSlackDepth}m`)
  }
  if (!firstReturnBottom) {
    failures.push('firstReturnBottom missing')
  } else if (bottomRetentionPct < acceptance.minBottomRetentionPct - EPS) {
    failures.push(`bottomRetentionPct=${bottomRetentionPct.toFixed(2)}% < ${acceptance.minBottomRetentionPct}%`)
  }

  return {
    passed: failures.length === 0,
    bottomRetentionPct,
    failures,
  }
}

const server = await createServer({
  configFile: false,
  root,
  appType: 'custom',
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  server: {
    middlewareMode: true,
    hmr: false,
  },
  optimizeDeps: {
    noDiscovery: true,
    entries: [],
  },
})

try {
  const { PhysicsBridge } = await server.ssrLoadModule('/src/engine/PhysicsBridge.ts')
  const { syncSceneToWorld } = await server.ssrLoadModule('/src/engine/sceneSync.ts')

  const reports = []

  for (const scenario of SCENARIOS) {
    const scene = JSON.parse(
      await fs.readFile(path.join(root, scenario.scenePath), 'utf8'),
    )

    const dynamicBody = getDynamicBody(scene)
    const joint = getSingleJoint(scene)
    const isRope = joint.type === 'rope'
    const targetLength = isRope ? joint.maxLength : joint.length
    const groundY = getGroundY(scene)
    const gravityY = Math.abs(scene.settings.gravity.y)

    const bridge = new PhysicsBridge()
    syncSceneToWorld(scene, bridge)

    const frames = []
    let state = bridge.getBodyStates().find((body) => body.id === dynamicBody.id)
    let jointState = bridge.getJointStates()[0]
    if (!state || !jointState) {
      throw new Error(`failed to initialize states for ${scenario.id}`)
    }

    let rawAngle = Math.atan2(
      jointState.anchorB.y - jointState.anchorA.y,
      jointState.anchorB.x - jointState.anchorA.x,
    )
    let unwrappedAngle = rawAngle

    let frame = buildFrame({
      t: 0,
      bodyState: state,
      jointState,
      sceneBody: dynamicBody,
      groundY,
      gravityY,
      targetLength,
      isRope,
      unwrappedAngle,
    })
    frames.push(frame)

    const bottomEvents = [{
      t: frame.t,
      speed: frame.speed,
      eMech: frame.eMech,
      jointError: frame.jointError,
      ropeSlack: frame.ropeSlack,
    }]
    let nextBottomAngle = unwrappedAngle + Math.PI * 2

    for (let stepIndex = 1; stepIndex <= STEPS; stepIndex++) {
      bridge.stepFrame(scene, DT)
      state = bridge.getBodyStates().find((body) => body.id === dynamicBody.id)
      jointState = bridge.getJointStates()[0]
      if (!state || !jointState) {
        throw new Error(`state missing at step ${stepIndex} for ${scenario.id}`)
      }

      const nextRawAngle = Math.atan2(
        jointState.anchorB.y - jointState.anchorA.y,
        jointState.anchorB.x - jointState.anchorA.x,
      )
      unwrappedAngle += wrapDelta(nextRawAngle - rawAngle)
      rawAngle = nextRawAngle

      const nextFrame = buildFrame({
        t: stepIndex * DT,
        bodyState: state,
        jointState,
        sceneBody: dynamicBody,
        groundY,
        gravityY,
        targetLength,
        isRope,
        unwrappedAngle,
      })

      if (nextFrame.unwrappedAngle > frame.unwrappedAngle) {
        while (nextBottomAngle <= nextFrame.unwrappedAngle + EPS) {
          bottomEvents.push(interpolateFrame(frame, nextFrame, nextBottomAngle))
          nextBottomAngle += Math.PI * 2
        }
      }

      frames.push(nextFrame)
      frame = nextFrame
    }

    const summary = summarizeFrames(frames)
    const initialBottom = bottomEvents[0]
    const firstReturnBottom = bottomEvents[1] ?? null
    const acceptance = evaluateAcceptance(summary, initialBottom, firstReturnBottom, scenario.acceptance)

    reports.push({
      scenarioId: scenario.id,
      substeps: bridge.getJointReactionInvDt() === 60 ? 1 : Math.round(bridge.getJointReactionInvDt() / 60),
      summary,
      initialBottom,
      firstReturnBottom,
      acceptance,
    })
  }

  let hasFailure = false
  for (const report of reports) {
    const { scenarioId, summary, initialBottom, firstReturnBottom, acceptance } = report
    if (!acceptance.passed) hasFailure = true
    console.log(JSON.stringify({
      scenarioId,
      endDriftPct: +summary.endDriftPct.toFixed(2),
      maxAbsJointError: +summary.maxAbsJointError.toFixed(4),
      slackFrameRatioPct: +summary.slackFrameRatioPct.toFixed(2),
      maxSlackDepth: +summary.maxSlackDepth.toFixed(4),
      bottom0: +initialBottom.speed.toFixed(3),
      bottom1: firstReturnBottom ? +firstReturnBottom.speed.toFixed(3) : null,
      bottomRetentionPct: +acceptance.bottomRetentionPct.toFixed(2),
      passed: acceptance.passed,
      failures: acceptance.failures,
    }))
  }

  if (hasFailure) {
    process.exitCode = 1
  }
} finally {
  await server.close()
}
