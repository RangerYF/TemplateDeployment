UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5176/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'chem08',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '酸碱滴定与 pH 模拟器，支持通过结构化 operations 切换滴定曲线、设置浓度/体积、选择指示剂、对比滴定类型、配置缓冲体系和载入典型教学场景。',
    'supportedIntents', JSON_ARRAY(
      'set-active-tab',
      'set-titration-type',
      'set-titration-parameters',
      'set-indicators',
      'set-comparison-types',
      'set-buffer-system',
      'set-buffer-addition',
      'set-buffer-display-mode',
      'load-titration-preset',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setActiveTab',
        'description', '切换主视图。payload: { tab: "curve"|"comparison"|"buffer" }。',
        'payloadSchema', JSON_OBJECT('tab', JSON_OBJECT('type', 'string'), 'activeTab', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到滴定曲线、曲线对比或缓冲液页面。',
        'doNotUseWhen', '载入完整教学场景时优先使用 loadTeachingScenario。'
      ),
      JSON_OBJECT(
        'type', 'setTitrationType',
        'description', '设置滴定类型。payload: { titrationTypeId: "strongAcid_strongBase"|"strongBase_strongAcid"|"strongBase_weakAcid"|"strongAcid_weakBase" }。',
        'payloadSchema', JSON_OBJECT('titrationTypeId', JSON_OBJECT('type', 'string'), 'type', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示强酸强碱、强碱强酸、强碱滴弱酸或强酸滴弱碱滴定曲线。',
        'doNotUseWhen', '用户要求对比多条曲线时使用 setComparisonTypes。'
      ),
      JSON_OBJECT(
        'type', 'setTitrationParameters',
        'description', '设置滴定参数。payload: { titrantConc?: number, analyteConc?: number, analyteVol?: number }。',
        'payloadSchema', JSON_OBJECT(
          'titrantConc', JSON_OBJECT('type', 'number'),
          'titrantConcentration', JSON_OBJECT('type', 'number'),
          'analyteConc', JSON_OBJECT('type', 'number'),
          'analyteConcentration', JSON_OBJECT('type', 'number'),
          'analyteVol', JSON_OBJECT('type', 'number'),
          'analyteVolume', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求修改滴定剂浓度、被测液浓度或被测液体积。',
        'doNotUseWhen', '不要用它切换滴定类型或指示剂。'
      ),
      JSON_OBJECT(
        'type', 'setIndicators',
        'description', '设置指示剂。payload: { indicatorIds: string[] }，可用 litmus、phenolphthalein、methylOrange、methylRed。',
        'payloadSchema', JSON_OBJECT('indicatorIds', JSON_OBJECT('type', 'array'), 'ids', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求选择酚酞、甲基橙、甲基红、石蕊等指示剂或比较变色范围。',
        'doNotUseWhen', '不要用它修改滴定参数。'
      ),
      JSON_OBJECT(
        'type', 'setComparisonTypes',
        'description', '设置曲线对比中的滴定类型集合。payload: { types: TitrationType[] }。',
        'payloadSchema', JSON_OBJECT('types', JSON_OBJECT('type', 'array'), 'titrationTypes', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求对比多种酸碱滴定曲线、突跃范围或等当点 pH。',
        'doNotUseWhen', '只展示单条曲线时使用 setTitrationType。'
      ),
      JSON_OBJECT(
        'type', 'setBufferSystem',
        'description', '设置缓冲体系。payload: { bufferId?: "acetate"|"ammonia"|"blood", name?: string }。',
        'payloadSchema', JSON_OBJECT('bufferId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示醋酸-醋酸钠、氨-氯化铵或血液缓冲体系。',
        'doNotUseWhen', '只修改加入酸/碱量时使用 setBufferAddition。'
      ),
      JSON_OBJECT(
        'type', 'setBufferAddition',
        'description', '设置缓冲液扰动。payload: { addType?: "acid"|"base", addedAmount?: number, bufferConc?: number, bufferVol?: number }。',
        'payloadSchema', JSON_OBJECT(
          'addType', JSON_OBJECT('type', 'string'),
          'addedAmount', JSON_OBJECT('type', 'number'),
          'amount', JSON_OBJECT('type', 'number'),
          'bufferConc', JSON_OBJECT('type', 'number'),
          'concentration', JSON_OBJECT('type', 'number'),
          'bufferVol', JSON_OBJECT('type', 'number'),
          'volume', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求向缓冲液加入少量酸/碱、改变缓冲液浓度或体积。',
        'doNotUseWhen', '不要用它选择滴定曲线。'
      ),
      JSON_OBJECT(
        'type', 'setBufferDisplayMode',
        'description', '设置缓冲图显示模式。payload: { displayMode: "delta"|"absolute" }。',
        'payloadSchema', JSON_OBJECT('displayMode', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求显示 pH 变化量或绝对 pH。',
        'doNotUseWhen', '不要用它修改缓冲体系或加酸加碱量。'
      ),
      JSON_OBJECT(
        'type', 'loadTitrationPreset',
        'description', '载入典型预设。payload: { presetId: "strong-acid-strong-base"|"strong-base-strong-acid"|"weak-acid-strong-base"|"weak-base-strong-acid"|"indicator-choice"|"titration-comparison"|"buffer-acetate"|"buffer-ammonia"|"blood-buffer" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求快速载入标准滴定、指示剂选择、曲线对比或缓冲体系示例。',
        'doNotUseWhen', '用户要求保留当前场景并局部修改时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "strong-acid-base-equivalence"|"weak-acid-strong-base"|"weak-base-strong-acid"|"indicator-selection"|"curve-comparison"|"buffer-capacity-acid"|"buffer-capacity-base"|"blood-buffer" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解滴定突跃、弱酸/弱碱滴定、指示剂选择、曲线对比、缓冲容量或血液缓冲。',
        'doNotUseWhen', '用户明确给出参数和指示剂时使用具体 operations。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'chem08', JSON_OBJECT(
        'type', 'object',
        'description', 'C08 酸碱滴定与 pH 模拟器快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'titration', JSON_OBJECT('type', 'object', 'description', '滴定类型、浓度、体积和指示剂。AI 应通过 setTitrationType、setTitrationParameters、setIndicators 修改。', 'risk', 'high'),
          'comparison', JSON_OBJECT('type', 'object', 'description', '曲线对比类型集合。AI 应通过 setComparisonTypes 修改。', 'risk', 'medium'),
          'buffer', JSON_OBJECT('type', 'object', 'description', '缓冲体系、加入酸碱量和显示模式。AI 应通过 setBufferSystem、setBufferAddition、setBufferDisplayMode 修改。', 'risk', 'high'),
          'ui', JSON_OBJECT('type', 'object', 'description', '当前视图页。AI 应通过 setActiveTab 修改。', 'risk', 'medium')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 titration、comparison、buffer 或 ui 状态树。',
      'C08 只处理酸碱滴定、指示剂、pH 曲线对比和缓冲体系，不要输出 C02/C05/C06/M 系列相关 payload 或 operation。',
      '等当点体积、等当点 pH、半等当点、突跃范围、指示剂误差方向、推荐指示剂和缓冲 pH 变化由 C08 计算；AI 不应编造派生结果。',
      '滴定类型必须来自 aiContext.libraries.titrationPresets；指示剂必须来自 aiContext.libraries.indicators；缓冲体系必须来自 aiContext.libraries.bufferSystems。',
      '浓度和体积必须为正数；缓冲液加入物质的量可以为 0 但不能为负数；无法确定具体数值时保留当前值或返回 warnings。',
      '用户要求多曲线对比时使用 setComparisonTypes；用户要求单条曲线时使用 setTitrationType。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示强酸滴强碱的滴定突跃，并显示酚酞和甲基橙。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTitrationPreset', 'presetId', 'strong-acid-strong-base')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入强酸滴强碱滴定曲线并显示常用指示剂范围。'
      ),
      JSON_OBJECT(
        'instruction', '把滴定剂浓度改成 0.2 mol/L，被测液体积改成 25 mL。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setTitrationParameters', 'titrantConc', 0.2, 'analyteVol', 25)),
        'patch', JSON_OBJECT(),
        'explanation', '已更新滴定参数，曲线由 C08 重新计算。'
      ),
      JSON_OBJECT(
        'instruction', '对比强酸强碱、强碱滴弱酸和强酸滴弱碱三条曲线。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setComparisonTypes', 'types', JSON_ARRAY('strongAcid_strongBase', 'strongBase_weakAcid', 'strongAcid_weakBase'))),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到曲线对比并展示三类滴定曲线。'
      ),
      JSON_OBJECT(
        'instruction', '演示醋酸缓冲液加入少量酸后的 pH 变化。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setBufferSystem', 'bufferId', 'acetate'),
          JSON_OBJECT('type', 'setBufferAddition', 'addType', 'acid', 'addedAmount', 0.001)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到醋酸-醋酸钠缓冲体系并设置加酸扰动。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于滴定曲线、滴定参数、指示剂、曲线对比、缓冲体系、缓冲扰动还是典型教学场景。',
      '典型课堂需求优先使用 loadTeachingScenario 或 loadTitrationPreset；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如要求缓冲液加酸时不要只切换 buffer 页面。',
      '涉及等当点、突跃范围、pH 变化量和误差方向时只输出输入控制项，派生数据由 C08 计算。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'chem08';
