UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5193/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'c04',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '元素周期表交互平台，支持通过结构化 operations 切换配色模式、选择元素、打开元素详情、打开元素分类说明、清除选择并载入典型元素教学场景。',
    'supportedIntents', JSON_ARRAY(
      'set-color-mode',
      'select-element',
      'open-element-detail',
      'open-category-detail',
      'clear-selection',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setColorMode',
        'description', '切换周期表配色模式。payload: { colorMode: "category"|"state"|"electronegativity" }。',
        'payloadSchema', JSON_OBJECT('colorMode', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求按元素分类、常温状态或电负性显示周期表。',
        'doNotUseWhen', '用户要求查看具体元素详情时使用 openElementDetail。'
      ),
      JSON_OBJECT(
        'type', 'selectElement',
        'description', '选中元素但不强制打开详情。payload: { atomicNumber?: number, symbol?: string, name?: string }。',
        'payloadSchema', JSON_OBJECT('atomicNumber', JSON_OBJECT('type', 'number'), 'number', JSON_OBJECT('type', 'number'), 'z', JSON_OBJECT('type', 'number'), 'symbol', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'element', JSON_OBJECT('type', 'string'), 'nameZh', JSON_OBJECT('type', 'string'), 'nameEn', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求定位或选中某个元素。',
        'doNotUseWhen', '用户要求查看性质、用途、电子构型等详情时使用 openElementDetail。'
      ),
      JSON_OBJECT(
        'type', 'openElementDetail',
        'description', '打开元素详情。payload: { atomicNumber?: number, symbol?: string, name?: string }。',
        'payloadSchema', JSON_OBJECT('atomicNumber', JSON_OBJECT('type', 'number'), 'number', JSON_OBJECT('type', 'number'), 'z', JSON_OBJECT('type', 'number'), 'symbol', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'element', JSON_OBJECT('type', 'string'), 'nameZh', JSON_OBJECT('type', 'string'), 'nameEn', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求查看钠、氯、铁、氧等具体元素的性质、用途、电子构型、氧化态或教学关联。',
        'doNotUseWhen', '用户要求查看整类元素规律时使用 openCategoryDetail。'
      ),
      JSON_OBJECT(
        'type', 'openCategoryDetail',
        'description', '打开元素分类说明。payload: { category: "alkali-metal"|"alkaline-earth-metal"|"transition-metal"|"post-transition-metal"|"metalloid"|"nonmetal"|"halogen"|"noble-gas"|"lanthanide"|"actinide" }，也可用中文分类名。',
        'payloadSchema', JSON_OBJECT('category', JSON_OBJECT('type', 'string'), 'categoryId', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解碱金属、卤素、稀有气体、过渡金属等分类规律。',
        'doNotUseWhen', '用户要求查看单个元素时使用 openElementDetail。'
      ),
      JSON_OBJECT(
        'type', 'clearSelection',
        'description', '清除当前选中元素和弹窗。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求关闭详情、清除选中或回到纯周期表视图。',
        'doNotUseWhen', '不要用它切换配色模式。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "alkali-metal-trend"|"halogen-trend"|"noble-gas-stability"|"room-temperature-state"|"electronegativity-trend"|"sodium-water-reaction"|"aluminum-amphoteric"|"iron-copper-transition"|"carbon-allotropes" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解元素周期律、碱金属递变、卤素活泼性、稀有气体稳定性、常温状态、电负性趋势或典型元素性质。',
        'doNotUseWhen', '用户明确给出元素和显示模式时使用具体 set/open operation。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'c04', JSON_OBJECT(
        'type', 'object',
        'description', 'C04 元素周期表快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'view', JSON_OBJECT('type', 'object', 'description', '周期表配色模式。AI 应通过 setColorMode 修改。', 'risk', 'low'),
          'selection', JSON_OBJECT('type', 'object', 'description', '当前选中元素。AI 应通过 selectElement/openElementDetail/clearSelection 修改。', 'risk', 'medium'),
          'overlay', JSON_OBJECT('type', 'object', 'description', '元素详情或分类说明弹窗。AI 应通过 openElementDetail/openCategoryDetail/clearSelection 修改。', 'risk', 'medium')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 view、selection 或 overlay 状态树。',
      'C04 只处理元素周期表，不要输出 C03/C07/C09/C02/C05/C06/M 系列相关 payload 或 operation。',
      '元素详情、分类说明、电子构型、氧化态、物理性质和教学关联由 C04 元素库提供；AI 不应编造元素数据。',
      '选择元素必须来自 aiContext.libraries.elements；无法唯一识别时返回 warnings。',
      '选择分类必须来自 aiContext.libraries.categories；用户用中文分类名时可映射到对应 category id。',
      '用户要求趋势/规律时优先切换到合适 colorMode 或分类详情；不要用 patch 手写说明文本。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '按电负性给周期表上色。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setColorMode', 'colorMode', 'electronegativity')),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到电负性配色模式。'
      ),
      JSON_OBJECT(
        'instruction', '查看钠元素的性质。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'openElementDetail', 'symbol', 'Na')),
        'patch', JSON_OBJECT(),
        'explanation', '已打开钠元素详情。'
      ),
      JSON_OBJECT(
        'instruction', '讲解卤素的递变规律。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'halogen-trend')),
        'patch', JSON_OBJECT(),
        'explanation', '已打开卤素分类说明并切换到分类配色。'
      ),
      JSON_OBJECT(
        'instruction', '显示常温下哪些元素是气体。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setColorMode', 'colorMode', 'state')),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到常温状态配色模式。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于配色模式、单个元素、元素分类、教学场景还是清除选择。',
      '用户要求具体元素性质时使用 openElementDetail；只要求定位元素时使用 selectElement。',
      '用户要求一类元素规律时使用 openCategoryDetail 或 loadTeachingScenario。',
      '用户要求常温状态、电负性或分类分布时使用 setColorMode。',
      '涉及元素数据、周期律说明和分类说明时只输出控制项，具体文本由 C04 元素库展示。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'c04';
