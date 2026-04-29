UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5177/m04',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'm04',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '三角函数演示台，支持通过结构化 operations 控制单位圆角度与显示项、三角函数图像类型与参数变换、视窗、五点法、辅助角公式演示，以及三角形解算。',
    'supportedIntents', JSON_ARRAY(
      'set-app-mode',
      'set-unit-circle-angle',
      'set-unit-circle-display',
      'set-trig-function',
      'set-trig-transform',
      'set-function-graph-options',
      'set-viewport',
      'reset-viewport',
      'load-preset-scene',
      'set-five-point-step',
      'set-auxiliary-angle-demo',
      'set-triangle-solver',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setAppMode',
        'description', '切换 M04 主模式。payload: { mode: "trig"|"triangle" }。',
        'payloadSchema', JSON_OBJECT('mode', JSON_OBJECT('type', 'string'), 'appMode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到三角函数图像/单位圆演示，或切换到三角形解算。',
        'doNotUseWhen', '不要用它修改角度、函数参数或三角形输入。'
      ),
      JSON_OBJECT(
        'type', 'setUnitCircleAngle',
        'description', '设置单位圆角度，并同步函数图像 traceX。payload: { angleRad?: number, angleDeg?: number, piMultiple?: number, snap?: boolean }。',
        'payloadSchema', JSON_OBJECT(
          'angleRad', JSON_OBJECT('type', 'number'),
          'angleDeg', JSON_OBJECT('type', 'number'),
          'piMultiple', JSON_OBJECT('type', 'number'),
          'anglePiMultiple', JSON_OBJECT('type', 'number'),
          'snap', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求把单位圆角度设为 30°、π/3、2π/3 等，或观察某角的三角函数值。',
        'doNotUseWhen', '只修改函数相位 φ 时使用 setTrigTransform。'
      ),
      JSON_OBJECT(
        'type', 'setUnitCircleDisplay',
        'description', '切换单位圆显示项。payload 可包含 showProjections、showAngleArc、showLabels、showQuadrantHints、snapEnabled。',
        'payloadSchema', JSON_OBJECT(
          'showProjections', JSON_OBJECT('type', 'boolean'),
          'showAngleArc', JSON_OBJECT('type', 'boolean'),
          'showLabels', JSON_OBJECT('type', 'boolean'),
          'showQuadrantHints', JSON_OBJECT('type', 'boolean'),
          'snapEnabled', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求显示/隐藏投影、角弧、标签、象限提示或特殊角吸附。',
        'doNotUseWhen', '不要用它调整函数图像显示项。'
      ),
      JSON_OBJECT(
        'type', 'setTrigFunction',
        'description', '设置函数图像类型。payload: { fnType: "sin"|"cos"|"tan" }。',
        'payloadSchema', JSON_OBJECT('fnType', JSON_OBJECT('type', 'string'), 'functionType', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换或生成正弦、余弦、正切函数图像。',
        'doNotUseWhen', '修改振幅、频率、相位或竖直平移时使用 setTrigTransform。'
      ),
      JSON_OBJECT(
        'type', 'setTrigTransform',
        'description', '设置三角函数变换参数 y=A·fn(ωx+φ)+k。payload: { transform?: {A?, omega?, phi?, phiDeg?, phiPiMultiple?, k?}, A?, omega?, phi?, phiDeg?, phiPiMultiple?, k? }。',
        'payloadSchema', JSON_OBJECT(
          'transform', JSON_OBJECT('type', 'object'),
          'A', JSON_OBJECT('type', 'number'),
          'omega', JSON_OBJECT('type', 'number'),
          'phi', JSON_OBJECT('type', 'number'),
          'phiDeg', JSON_OBJECT('type', 'number'),
          'phiPiMultiple', JSON_OBJECT('type', 'number'),
          'k', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求设置振幅、周期/角频率、相位或上下平移，例如 y=2sin(3x+π/4)-1。',
        'doNotUseWhen', '设置单位圆当前角度时使用 setUnitCircleAngle。'
      ),
      JSON_OBJECT(
        'type', 'setFunctionGraphOptions',
        'description', '设置函数图像显示项。payload: { showReference?: boolean, clearHistory?: boolean, traceX?: number }。',
        'payloadSchema', JSON_OBJECT(
          'showReference', JSON_OBJECT('type', 'boolean'),
          'clearHistory', JSON_OBJECT('type', 'boolean'),
          'traceX', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求显示/隐藏参考曲线、清空轨迹或移动函数图像追踪点。',
        'doNotUseWhen', '不要用它修改函数类型或变换参数。'
      ),
      JSON_OBJECT(
        'type', 'setViewport',
        'description', '设置视窗。payload: { target?: "unitCircle"|"functionGraph"|"trigA"|"trigB", xMin: number, xMax: number, yMin: number, yMax: number }。',
        'payloadSchema', JSON_OBJECT(
          'target', JSON_OBJECT('type', 'string'),
          'xMin', JSON_OBJECT('type', 'number'),
          'xMax', JSON_OBJECT('type', 'number'),
          'yMin', JSON_OBJECT('type', 'number'),
          'yMax', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求调整单位圆或函数图像坐标范围。',
        'doNotUseWhen', '不要用它修改函数本身。'
      ),
      JSON_OBJECT(
        'type', 'resetViewport',
        'description', '重置视窗。payload: { target?: "unitCircle"|"functionGraph"|"trigA"|"trigB"|"all" }。',
        'payloadSchema', JSON_OBJECT('target', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求恢复默认视窗、重新居中、看完整单位圆或函数图像。',
        'doNotUseWhen', '用户明确给出坐标范围时使用 setViewport。'
      ),
      JSON_OBJECT(
        'type', 'loadTrigPresetScene',
        'description', '载入 M04 典型教学场景。payload: { presetId: "standard-sine"|"phase-shift"|"amplitude-frequency"|"unit-circle-special-angle"|"five-point-sine"|"auxiliary-angle"|"triangle-345" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到标准正弦、相位平移、振幅频率、特殊角、五点法、辅助角或 3-4-5 三角形等典型演示场景。',
        'doNotUseWhen', '用户要求在当前场景上做局部修改时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'setFivePointStep',
        'description', '设置五点法步骤。payload: { step: 0|1|2|3|4|5 }。',
        'payloadSchema', JSON_OBJECT('step', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求演示三角函数五点作图法的某一步或逐步展示关键点。',
        'doNotUseWhen', '不是五点法教学需求时不要输出。'
      ),
      JSON_OBJECT(
        'type', 'setAuxiliaryAngleDemo',
        'description', '配置辅助角公式 a·sin x + b·cos x = R·sin(x+φ) 演示。payload: { enabled?: boolean, a?: number, b?: number, showC1?: boolean, showC2?: boolean, showCR?: boolean }。',
        'payloadSchema', JSON_OBJECT(
          'enabled', JSON_OBJECT('type', 'boolean'),
          'showAuxiliary', JSON_OBJECT('type', 'boolean'),
          'a', JSON_OBJECT('type', 'number'),
          'b', JSON_OBJECT('type', 'number'),
          'showC1', JSON_OBJECT('type', 'boolean'),
          'showC2', JSON_OBJECT('type', 'boolean'),
          'showCR', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求演示或配置辅助角公式、合成 a sin x + b cos x。',
        'doNotUseWhen', '普通三角函数变换使用 setTrigTransform。'
      ),
      JSON_OBJECT(
        'type', 'setTriangleSolver',
        'description', '设置并解算三角形。payload: { mode: "SSS"|"SAS"|"ASA"|"AAS"|"SSA", inputs?: object, solve?: boolean }。角度输入使用度数，由 M04 计算解。',
        'payloadSchema', JSON_OBJECT(
          'mode', JSON_OBJECT('type', 'string'),
          'inputs', JSON_OBJECT('type', 'object'),
          'a', JSON_OBJECT('type', 'number'),
          'b', JSON_OBJECT('type', 'number'),
          'c', JSON_OBJECT('type', 'number'),
          'A', JSON_OBJECT('type', 'number'),
          'B', JSON_OBJECT('type', 'number'),
          'C', JSON_OBJECT('type', 'number'),
          'solve', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求根据 SSS/SAS/ASA/AAS/SSA 解三角形。',
        'doNotUseWhen', 'AI 不要手写三角形求解结果；边角不完整时返回 warnings。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'm04', JSON_OBJECT(
        'type', 'object',
        'description', 'M04 三角函数演示台快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'ui', JSON_OBJECT('type', 'object', 'description', '当前主模式 trig/triangle。', 'risk', 'low'),
          'unitCircle', JSON_OBJECT('type', 'object', 'description', '单位圆角度、特殊角吸附、显示项和视窗。AI 应通过 setUnitCircleAngle/Display/Viewport 修改。', 'risk', 'high'),
          'functionGraph', JSON_OBJECT('type', 'object', 'description', '函数类型、变换参数、追踪点、参考曲线、五点法和辅助角演示。', 'risk', 'high'),
          'triangleSolver', JSON_OBJECT('type', 'object', 'description', '解三角形模式、输入和计算结果。AI 通过 setTriangleSolver 输入边角，由 M04 计算结果。', 'risk', 'high'),
          'trig', JSON_OBJECT('type', 'object', 'description', '旧双图对比状态。当前主界面优先使用 functionGraph，AI 第一阶段不主动修改 trig。', 'risk', 'low')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 ui、unitCircle、functionGraph、triangleSolver 或 trig 实体树。',
      'M04 只处理三角函数演示台，不要输出 M02/M03 相关 payload 或 operation。',
      '单位圆精确值、特殊角吸附、函数图像采样和三角形解算结果由 M04 计算；AI 不应手写采样点、sin/cos/tan 精确表或三角形 result。',
      '角度可用 angleDeg、angleRad 或 piMultiple，优先用用户表达最明确的单位；不要同时输出互相矛盾的角度字段。',
      '三角形解算必须提供 mode 所需的全部输入；缺少边角时返回 warnings，不要猜测。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '切换到标准正弦函数演示场景。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTrigPresetScene', 'presetId', 'standard-sine')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入标准正弦函数演示场景。'
      ),
      JSON_OBJECT(
        'instruction', '把单位圆角度设为 60°，显示投影和角弧。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setAppMode', 'mode', 'trig'),
          JSON_OBJECT('type', 'setUnitCircleAngle', 'angleDeg', 60, 'snap', CAST('true' AS JSON)),
          JSON_OBJECT('type', 'setUnitCircleDisplay', 'showProjections', CAST('true' AS JSON), 'showAngleArc', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已设置单位圆角度并开启投影与角弧显示。'
      ),
      JSON_OBJECT(
        'instruction', '画 y=2sin(3x+π/4)-1。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setAppMode', 'mode', 'trig'),
          JSON_OBJECT('type', 'setTrigFunction', 'fnType', 'sin'),
          JSON_OBJECT('type', 'setTrigTransform', 'A', 2, 'omega', 3, 'phiPiMultiple', 0.25, 'k', -1)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已设置正弦函数及其振幅、角频率、相位和竖直平移。'
      ),
      JSON_OBJECT(
        'instruction', '用五点法演示到第 3 步。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setAppMode', 'mode', 'trig'),
          JSON_OBJECT('type', 'setFivePointStep', 'step', 3)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到函数图像模式并展示五点法第 3 步。'
      ),
      JSON_OBJECT(
        'instruction', '恢复默认视窗。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'resetViewport', 'target', 'all')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已恢复 M04 默认视窗。'
      ),
      JSON_OBJECT(
        'instruction', '演示 3sinx+4cosx 的辅助角公式。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setAppMode', 'mode', 'trig'),
          JSON_OBJECT('type', 'setAuxiliaryAngleDemo', 'enabled', CAST('true' AS JSON), 'a', 3, 'b', 4, 'showC1', CAST('true' AS JSON), 'showC2', CAST('true' AS JSON), 'showCR', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已开启辅助角公式演示并设置 a=3、b=4。'
      ),
      JSON_OBJECT(
        'instruction', '用 SSS 解三角形，三边分别是 3、4、5。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setTriangleSolver', 'mode', 'SSS', 'inputs', JSON_OBJECT('a', 3, 'b', 4, 'c', 5))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到三角形解算并由 M04 计算 3-4-5 三角形。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于三角函数联动、函数变换、五点法、辅助角公式还是三角形解算。',
      '每个可见目标必须映射为确定 operation；例如设置角度并显示投影时不要只设置角度。',
      '普通三角函数图像优先使用 setTrigFunction + setTrigTransform；单位圆当前角度使用 setUnitCircleAngle。',
      '典型教学场景可优先使用 loadTrigPresetScene；局部修改使用具体 set operation。',
      '三角形解算只提供 mode 和输入边角，结果由 M04 计算。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'm04';
