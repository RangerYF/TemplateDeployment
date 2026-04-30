UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5173/#P04-CIR-EXP001-voltammetry-internal',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'p04',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', 'P04 电路实验控制器，基于 phys_template_p01 的电路实验预设，支持通过结构化 operations 切换伏安法内接/外接、测电源电动势和内阻，设置电源、电阻、仪表量程、开关、滑动变阻器参数，并载入典型实验教学场景。',
    'supportedIntents', JSON_ARRAY(
      'load-circuit-preset',
      'load-teaching-scenario',
      'set-circuit-param',
      'set-circuit-params',
      'set-switch-state',
      'set-meter-range',
      'set-viewport',
      'reset-simulation',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'loadCircuitPreset',
        'description', '载入 P04 电路实验预设。payload: { presetId: "P04-CIR-EXP001-voltammetry-internal"|"P04-CIR-EXP002-voltammetry-external"|"P04-CIR-EXP004-measure-emf-r" }。也可用 id/experiment。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'experiment', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到伏安法内接法、伏安法外接法、测电源电动势和内阻等具体 P04 实验。',
        'doNotUseWhen', '用户只要求调节当前实验参数时使用 setCircuitParam/setCircuitParams。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "voltammetry-internal"|"internal-method-error-high"|"voltammetry-external"|"external-method-error-low"|"measure-emf-r"|"emf-internal-resistance"|"ui-linear-relation" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解伏安法内接偏大、外接偏小、测电源电动势和内阻、U-I 线性关系等课堂场景。',
        'doNotUseWhen', '用户明确给出某个实验预设编号时使用 loadCircuitPreset。'
      ),
      JSON_OBJECT(
        'type', 'setCircuitParam',
        'description', '设置当前实验的单个参数。payload: { key: string, value: number|boolean|string }。常见 key: emf、r、Rx、rA、rV、ammeterRange、voltmeterRange、switchClosed、maxR、sliderRatio。',
        'payloadSchema', JSON_OBJECT('key', JSON_OBJECT('type', 'string'), 'paramKey', JSON_OBJECT('type', 'string'), 'value', JSON_OBJECT('type', 'any')),
        'useWhen', '用户要求修改电动势、内阻、被测电阻、仪表内阻、量程、滑片位置等单个参数。',
        'doNotUseWhen', '一次修改多个参数时使用 setCircuitParams。'
      ),
      JSON_OBJECT(
        'type', 'setCircuitParams',
        'description', '批量设置当前实验参数。payload: { params: { [key]: value } }。仅允许当前实验 paramSchemas 中存在的参数。',
        'payloadSchema', JSON_OBJECT('params', JSON_OBJECT('type', 'object')),
        'useWhen', '用户一次性要求设置电源、电阻、仪表或滑动变阻器的多个参数。',
        'doNotUseWhen', '不要用它写电流、电压、误差等派生量。'
      ),
      JSON_OBJECT(
        'type', 'setSwitchState',
        'description', '设置开关状态。payload: { closed: boolean }。',
        'payloadSchema', JSON_OBJECT('closed', JSON_OBJECT('type', 'boolean'), 'switchClosed', JSON_OBJECT('type', 'boolean'), 'value', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求闭合或断开电路开关。',
        'doNotUseWhen', '不要用它设置其他电路参数。'
      ),
      JSON_OBJECT(
        'type', 'setMeterRange',
        'description', '设置仪表量程。payload: { meter: "ammeter"|"voltmeter", range: number }。',
        'payloadSchema', JSON_OBJECT('meter', JSON_OBJECT('type', 'string'), 'target', JSON_OBJECT('type', 'string'), 'range', JSON_OBJECT('type', 'number'), 'value', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求调整电流表或电压表量程。',
        'doNotUseWhen', '用户要求调整仪表内阻时使用 setCircuitParam，key 为 rA 或 rV。'
      ),
      JSON_OBJECT(
        'type', 'setViewport',
        'description', '设置视图。payload: { viewport: "circuit" }。P04 当前只支持 circuit 视图。',
        'payloadSchema', JSON_OBJECT('viewport', JSON_OBJECT('type', 'string'), 'primary', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求回到电路图、电路视图或查看电路连接。',
        'doNotUseWhen', '不要输出 P08/P13 的 force、field、motion 视图。'
      ),
      JSON_OBJECT(
        'type', 'resetSimulation',
        'description', '重置当前实验。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求重置当前实验或恢复到起点。',
        'doNotUseWhen', '用户要求切换实验时使用 loadCircuitPreset/loadTeachingScenario。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'p04', JSON_OBJECT(
        'type', 'object',
        'description', 'P04 电路实验快照。结构性修改优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'activePresetId', JSON_OBJECT('type', 'string', 'description', '当前电路实验预设 ID。AI 应通过 loadCircuitPreset/loadTeachingScenario 修改。', 'risk', 'high'),
          'paramValues', JSON_OBJECT('type', 'object', 'description', '当前实验输入参数。AI 应通过 setCircuitParam/setCircuitParams 修改。', 'risk', 'high'),
          'viewport', JSON_OBJECT('type', 'object', 'description', '视图状态。P04 只支持 circuit。', 'risk', 'low')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 p04 状态树。',
      'P04 只处理电路实验控制器，不要输出 P08/P13/P01/P02/P05/P06/P12/P14 或化学/数学模板相关 payload 或 operation。',
      'P04 当前不是自由电路搭建器，只支持伏安法内接法、伏安法外接法、测电源电动势和内阻三个真实实验预设。',
      '电流表读数、电压表读数、端电压、R测/R真、误差、U-I 关系等派生量由 P04 solver 计算；AI 不应手写派生结果。',
      '设置参数必须基于 aiContext.paramSchemas 中存在的 key；当前预设不支持的参数不要输出，必要时先切换实验预设。',
      '数值参数必须落在 paramSchemas 的 min/max 范围内；超出时应取合理范围内的目标值或返回 warnings。',
      '开关状态使用 setSwitchState 或 setCircuitParam key=switchClosed。',
      '测电源电动势和内阻实验使用 maxR 与 sliderRatio 设置滑动变阻器，不要使用 Rx。',
      '伏安法内/外接实验使用 Rx 设置被测电阻，不要使用 maxR/sliderRatio。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示伏安法内接法测电阻。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'voltammetry-internal')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入伏安法内接法实验。'
      ),
      JSON_OBJECT(
        'instruction', '切到伏安法外接法，并把被测电阻调成 20Ω。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'voltammetry-external'),
          JSON_OBJECT('type', 'setCircuitParam', 'key', 'Rx', 'value', 20)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到外接法并设置被测电阻。'
      ),
      JSON_OBJECT(
        'instruction', '测电源电动势和内阻，电动势 4.5V、内阻 0.8Ω，滑片调到 0.3。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'measure-emf-r'),
          JSON_OBJECT('type', 'setCircuitParams', 'params', JSON_OBJECT('emf', 4.5, 'r', 0.8, 'sliderRatio', 0.3))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入测电源电动势和内阻实验并设置输入参数。'
      ),
      JSON_OBJECT(
        'instruction', '断开开关。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setSwitchState', 'closed', CAST('false' AS JSON))),
        'patch', JSON_OBJECT(),
        'explanation', '已断开当前电路开关。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于实验预设切换、教学场景、参数设置、开关控制、仪表量程还是重置。',
      '典型课堂需求优先使用 loadTeachingScenario；明确实验编号时使用 loadCircuitPreset。',
      '每个可见目标必须映射为确定 operation；例如切换外接法并设置 Rx 时不要遗漏参数设置。',
      '当前预设不支持某参数时，先切换到支持该参数的实验预设，再设置参数。',
      '涉及电流、电压、测量误差和 U-I 图像结论时只输出输入控制项，派生数据由 P04 自动计算展示。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'p04';
