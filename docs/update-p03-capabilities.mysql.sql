UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5173/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'p03',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '光学实验台，支持通过结构化 operations 切换折射/全反射、透镜成像、双缝干涉、衍射和薄膜干涉实验，设置介质折射率、入射角、透镜物距焦距、波长、缝宽、屏距、薄膜参数、显示项和视觉样式，并载入典型光学教学场景。',
    'supportedIntents', JSON_ARRAY(
      'set-active-module',
      'load-optics-experiment',
      'load-teaching-scenario',
      'set-module-params',
      'set-refraction-media',
      'set-lens-object',
      'set-wave-parameters',
      'set-display-options',
      'set-presentation-options',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setActiveModule',
        'description', '切换 P03 主模块。payload: { moduleId: "refraction"|"lens"|"doubleslit"|"diffraction"|"thinfilm" }。',
        'payloadSchema', JSON_OBJECT('moduleId', JSON_OBJECT('type', 'string'), 'activeModule', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到折射、透镜、双缝、衍射或薄膜干涉模块。',
        'doNotUseWhen', '用户要求典型实验或课堂场景时优先使用 loadOpticsExperiment 或 loadTeachingScenario。'
      ),
      JSON_OBJECT(
        'type', 'loadOpticsExperiment',
        'description', '载入 P03 标准实验。payload: { experimentId: "opt-001"|"opt-002"|"opt-003"|"opt-004"|"opt-005"|"opt-006"|"opt-011"|"opt-012"|"opt-021"|"opt-031"|"opt-032"|"opt-041"|"opt-042"|"opt-043" }。',
        'payloadSchema', JSON_OBJECT('experimentId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'params', JSON_OBJECT('type', 'object')),
        'useWhen', '用户给出 OPT 编号，或要求载入平行界面折射、玻璃砖、光导纤维、透镜、双缝、衍射、牛顿环等标准实验。',
        'doNotUseWhen', '只修改当前实验参数时使用 setModuleParams 或对应专项 operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "parallel-interface-refraction"|"total-internal-reflection"|"glass-slab-offset"|"fiber-total-reflection"|"apparent-depth"|"snell-window"|"convex-lens-real-image"|"convex-lens-magnifier"|"concave-lens-virtual-image"|"young-double-slit"|"white-light-double-slit"|"single-slit-diffraction"|"circular-aperture-airy"|"soap-film-colors"|"wedge-film-fringes"|"newton-rings" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户用自然语言要求讲解某个光学主题，例如全反射、视深、放大镜、白光干涉、艾里斑或牛顿环。',
        'doNotUseWhen', '用户明确给出具体实验编号时使用 loadOpticsExperiment。'
      ),
      JSON_OBJECT(
        'type', 'setModuleParams',
        'description', '设置当前或指定模块参数。payload: { moduleId?: string, params: { [key]: number|boolean|string } }。参数必须来自 aiContext.currentModuleSettings 或实验 params。',
        'payloadSchema', JSON_OBJECT('moduleId', JSON_OBJECT('type', 'string'), 'params', JSON_OBJECT('type', 'object'), 'experimentId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求修改当前实验的任意合法参数，如入射角、折射率、焦距、物距、缝宽、屏距、膜厚等。',
        'doNotUseWhen', '不要用它写临界角、像距、条纹间距等派生结果。'
      ),
      JSON_OBJECT(
        'type', 'setRefractionMedia',
        'description', '设置折射模块介质和入射角。payload: { medium1N?: number, medium2N?: number, n1?: number, n2?: number, theta1Deg?: number, material?: string }。注意：P03 画布内部用 sourceAngleDeg 表示光源方向；用户说的入射角 theta1Deg 会由 bridge 自动换算。',
        'payloadSchema', JSON_OBJECT('medium1N', JSON_OBJECT('type', 'number'), 'medium2N', JSON_OBJECT('type', 'number'), 'n1', JSON_OBJECT('type', 'number'), 'n2', JSON_OBJECT('type', 'number'), 'theta1Deg', JSON_OBJECT('type', 'number'), 'incidentAngleDeg', JSON_OBJECT('type', 'number'), 'material', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求修改折射率、入射角、从玻璃到空气或水到空气等介质组合。用户说“入射角 30 度”时优先输出 theta1Deg: 30，不要直接猜 sourceAngleDeg。',
        'doNotUseWhen', '光导纤维、玻璃砖等完整场景优先用 loadTeachingScenario 或 loadOpticsExperiment。'
      ),
      JSON_OBJECT(
        'type', 'setLensObject',
        'description', '设置透镜成像参数。payload: { lensType?: "convex"|"concave", focalLength?: number, objectDistance?: number, objectHeight?: number, sourceType?: "object"|"point"|"parallel" }。',
        'payloadSchema', JSON_OBJECT('lensType', JSON_OBJECT('type', 'string'), 'focalLength', JSON_OBJECT('type', 'number'), 'objectDistance', JSON_OBJECT('type', 'number'), 'objectHeight', JSON_OBJECT('type', 'number'), 'sourceType', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求修改凸/凹透镜、焦距、物距、物高或光源类型。',
        'doNotUseWhen', '不要手写像距、放大率、虚实或正倒。'
      ),
      JSON_OBJECT(
        'type', 'setWaveParameters',
        'description', '设置波动光学参数。payload 可包含 moduleId、wavelength、screenDistance、slitSpacing、slitWidth、diameter、thickness、filmN、wedgeAngle、lensR、whiteLight。',
        'payloadSchema', JSON_OBJECT('moduleId', JSON_OBJECT('type', 'string'), 'wavelength', JSON_OBJECT('type', 'number'), 'screenDistance', JSON_OBJECT('type', 'number'), 'slitSpacing', JSON_OBJECT('type', 'number'), 'slitWidth', JSON_OBJECT('type', 'number'), 'diameter', JSON_OBJECT('type', 'number'), 'thickness', JSON_OBJECT('type', 'number'), 'filmN', JSON_OBJECT('type', 'number'), 'wedgeAngle', JSON_OBJECT('type', 'number'), 'lensR', JSON_OBJECT('type', 'number'), 'whiteLight', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求调整双缝、衍射或薄膜干涉中的波长、屏距、缝宽、孔径、膜厚、曲率半径或白光模式。',
        'doNotUseWhen', '几何折射和透镜物距焦距使用 setRefractionMedia 或 setLensObject。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '设置显示项。payload 可包含 showAngles、showNormals、showFormula、showColor、showIntensity、showRays、showScreen、whiteLight、compareMode。',
        'payloadSchema', JSON_OBJECT('moduleId', JSON_OBJECT('type', 'string'), 'showAngles', JSON_OBJECT('type', 'boolean'), 'showNormals', JSON_OBJECT('type', 'boolean'), 'showFormula', JSON_OBJECT('type', 'boolean'), 'showColor', JSON_OBJECT('type', 'boolean'), 'showIntensity', JSON_OBJECT('type', 'boolean'), 'showRays', JSON_OBJECT('type', 'boolean'), 'showScreen', JSON_OBJECT('type', 'boolean'), 'whiteLight', JSON_OBJECT('type', 'boolean'), 'compareMode', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求显示/隐藏法线、角度、公式、颜色、强度曲线、光线、像屏或对比模式。',
        'doNotUseWhen', '不要用它修改物理参数。'
      ),
      JSON_OBJECT(
        'type', 'setPresentationOptions',
        'description', '设置全局视觉样式。payload: { theme?: "light"|"dark"|"blueprint", rayThick?: number }。',
        'payloadSchema', JSON_OBJECT('theme', JSON_OBJECT('type', 'string'), 'rayThick', JSON_OBJECT('type', 'number'), 'lineWidth', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求切换视觉主题或调整光线粗细。',
        'doNotUseWhen', '不要用它修改实验内容。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'p03', JSON_OBJECT(
        'type', 'object',
        'description', 'P03 光学实验台快照。AI 助手必须通过 operations 修改；patch 仅允许为空对象。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'activeModule', JSON_OBJECT('type', 'string', 'description', '当前光学模块。AI 应通过 setActiveModule 或载入实验修改。', 'risk', 'medium'),
          'presentation', JSON_OBJECT('type', 'object', 'description', '主题和光线粗细。AI 应通过 setPresentationOptions 修改。', 'risk', 'low'),
          'modules', JSON_OBJECT('type', 'object', 'description', '五个模块的实验参数状态。AI 应通过 loadOpticsExperiment、loadTeachingScenario 和 set* operations 修改。', 'risk', 'high')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      'P03 必须使用 operations 修改场景；patch 必须为空对象，不要直接手写 activeModule、presentation 或 modules 状态树。',
      'P03 只处理光学实验台，不要输出 P04/P08/P13/P01/P02/P05/P06/P12/P14 或化学/数学模板相关 payload 或 operation。',
      '折射角、临界角、侧向位移、视深、像距、放大率、条纹间距、衍射角、干涉级次等派生结果由 P03 计算；AI 不应手写派生结果。',
      '实验编号必须来自 aiContext.experiments；无法识别时返回 warnings，不要猜测。',
      '参数 key 必须来自 aiContext.currentModuleSettings 或对应实验 params；未知参数不要输出。折射入射角优先通过 setRefractionMedia 的 theta1Deg 表达，由 bridge 换算到 sourceAngleDeg。',
      '数值参数必须为有限数字，并尽量落在实验 params 给出的 min/max 范围内。',
      '波长单位为 nm，缝宽/缝距/孔径单位遵循 P03 参数定义，不要混写派生单位。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示玻璃到空气的全反射，入射角 50 度。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'total-internal-reflection'),
          JSON_OBJECT('type', 'setRefractionMedia', 'medium1N', 1.5, 'medium2N', 1.0, 'theta1Deg', 50)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入全反射场景并设置玻璃到空气的入射条件。'
      ),
      JSON_OBJECT(
        'instruction', '展示凸透镜成倒立实像，焦距 10cm，物距 25cm。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'convex-lens-real-image'),
          JSON_OBJECT('type', 'setLensObject', 'lensType', 'convex', 'focalLength', 10, 'objectDistance', 25)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到凸透镜实像场景并设置焦距和物距。'
      ),
      JSON_OBJECT(
        'instruction', '演示白光双缝干涉。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'white-light-double-slit')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入白光双缝干涉场景。'
      ),
      JSON_OBJECT(
        'instruction', '切到圆孔衍射，孔径 100 微米，波长 650 nm。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadOpticsExperiment', 'experimentId', 'opt-032'),
          JSON_OBJECT('type', 'setWaveParameters', 'moduleId', 'diffraction', 'diameter', 100, 'wavelength', 650)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入圆孔衍射并设置孔径与波长。'
      ),
      JSON_OBJECT(
        'instruction', '演示牛顿环，并显示公式。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'newton-rings'),
          JSON_OBJECT('type', 'setDisplayOptions', 'moduleId', 'thinfilm', 'showFormula', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入牛顿环场景并显示公式。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于折射/全反射、透镜成像、双缝干涉、衍射、薄膜干涉、显示项还是视觉样式。',
      '典型课堂主题优先使用 loadTeachingScenario；明确 OPT 编号或标准实验时使用 loadOpticsExperiment。',
      '每个可见目标必须映射为确定 operation；例如白光双缝不要只切换模块，还要启用 whiteLight。',
      '局部参数修改使用 setRefractionMedia、setLensObject、setWaveParameters 或 setModuleParams。',
      '涉及临界角、像距、条纹间距和干涉/衍射强度时只输出输入参数，派生信息由 P03 自动计算。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'p03';
