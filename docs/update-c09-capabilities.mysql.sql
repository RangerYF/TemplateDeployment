UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5195/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'c09',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '有机化学反应路径图与同分异构体查询工具，支持通过结构化 operations 设置有机物转化起终点、筛选学段和反应类型、选择路径/步骤、播放路径动画、显示操作提示、查询同分异构体并载入典型教学场景。',
    'supportedIntents', JSON_ARRAY(
      'set-path-endpoints',
      'set-level-filter',
      'set-reaction-type-filter',
      'clear-path-selection',
      'select-path',
      'select-reaction-step',
      'set-path-playback',
      'step-path-forward',
      'reset-path',
      'set-map-hint',
      'set-isomer-query',
      'load-formula-preset',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setPathEndpoints',
        'description', '设置有机物转化路径的起点和终点。payload: { startNodeId?: string, endNodeId?: string, start?: string, end?: string }。',
        'payloadSchema', JSON_OBJECT('startNodeId', JSON_OBJECT('type', 'string'), 'endNodeId', JSON_OBJECT('type', 'string'), 'start', JSON_OBJECT('type', 'string'), 'end', JSON_OBJECT('type', 'string'), 'from', JSON_OBJECT('type', 'string'), 'to', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求寻找烷烃到羧酸、烯烃到酯、芳香烃到酚等有机转化路线。',
        'doNotUseWhen', '用户要求查询某分子式的同分异构体时使用 setIsomerQuery。'
      ),
      JSON_OBJECT(
        'type', 'setLevelFilter',
        'description', '设置路径学段筛选。payload: { levels?: ["[高中必修]","[高中选修]"], includeRequired?: boolean, includeElective?: boolean }。',
        'payloadSchema', JSON_OBJECT('levels', JSON_OBJECT('type', 'array'), 'levelFilter', JSON_OBJECT('type', 'array'), 'includeRequired', JSON_OBJECT('type', 'boolean'), 'includeElective', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求只看必修、只看选修或放宽/收紧学段筛选。',
        'doNotUseWhen', '按反应类型筛选时使用 setReactionTypeFilter。'
      ),
      JSON_OBJECT(
        'type', 'setReactionTypeFilter',
        'description', '设置反应类型筛选。payload: { reactionType: "全部"|"取代"|"水解"|"消去"|"加成"|"氧化"|"酯化"|... }。',
        'payloadSchema', JSON_OBJECT('reactionType', JSON_OBJECT('type', 'string'), 'typeValue', JSON_OBJECT('type', 'string'), 'filter', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求只看取代、水解、加成、氧化、酯化等路径边。',
        'doNotUseWhen', '选择具体路径起终点时使用 setPathEndpoints。'
      ),
      JSON_OBJECT(
        'type', 'clearPathSelection',
        'description', '清空路径起终点和当前路径选择。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求清空起终点、重新选择路径。',
        'doNotUseWhen', '不要用它清空同分异构体查询。'
      ),
      JSON_OBJECT(
        'type', 'selectPath',
        'description', '选择当前已搜索出的某条路径。payload: { pathIndex: number }。',
        'payloadSchema', JSON_OBJECT('pathIndex', JSON_OBJECT('type', 'number'), 'index', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求切换到第 N 条路径、备选路径或推荐路径。',
        'doNotUseWhen', '用户要求选中路径中的某一步时使用 selectReactionStep。'
      ),
      JSON_OBJECT(
        'type', 'selectReactionStep',
        'description', '高亮当前路径中的某一步反应。payload: { edgeId?: string, stepIndex?: number, reactionType?: string }。',
        'payloadSchema', JSON_OBJECT('edgeId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'stepIndex', JSON_OBJECT('type', 'number'), 'reactionType', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求查看路径中的水解、氧化、酯化、消去等某一步条件和方程式。',
        'doNotUseWhen', '用户要求整条路径播放时使用 setPathPlayback。'
      ),
      JSON_OBJECT(
        'type', 'setPathPlayback',
        'description', '控制路径动画播放。payload: { playing?: boolean, speed?: 0.5|1|2 }。',
        'payloadSchema', JSON_OBJECT('playing', JSON_OBJECT('type', 'boolean'), 'speed', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求播放、暂停路径动画或调整速度。',
        'doNotUseWhen', '用户要求单步前进时使用 stepPathForward。'
      ),
      JSON_OBJECT(
        'type', 'stepPathForward',
        'description', '路径动画前进一步并暂停。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求逐步查看路径中的下一步反应。',
        'doNotUseWhen', '用户要求连续播放时使用 setPathPlayback。'
      ),
      JSON_OBJECT(
        'type', 'resetPath',
        'description', '回到推荐路径起点并暂停动画。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求回到推荐路径或重置路径动画。',
        'doNotUseWhen', '用户要求清空起终点时使用 clearPathSelection。'
      ),
      JSON_OBJECT(
        'type', 'setMapHint',
        'description', '显示或隐藏路径图操作提示。payload: { showMapHint?: boolean, visible?: boolean }。',
        'payloadSchema', JSON_OBJECT('showMapHint', JSON_OBJECT('type', 'boolean'), 'visible', JSON_OBJECT('type', 'boolean'), 'enabled', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求显示/隐藏操作提示或新手引导。',
        'doNotUseWhen', '不要用它修改路径起终点。'
      ),
      JSON_OBJECT(
        'type', 'setIsomerQuery',
        'description', '查询同分异构体。payload: { formula: string, ringHint?: "auto"|"noRing"|"benzene"|"oxygen"|"halogen"|"nitrogen" }。',
        'payloadSchema', JSON_OBJECT('formula', JSON_OBJECT('type', 'string'), 'formulaInput', JSON_OBJECT('type', 'string'), 'molecularFormula', JSON_OBJECT('type', 'string'), 'ringHint', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求查询 C4H10、C2H6O、C4H8、C7H8O 等分子式的同分异构体。',
        'doNotUseWhen', '用户要求寻找有机转化路线时使用 setPathEndpoints。'
      ),
      JSON_OBJECT(
        'type', 'loadFormulaPreset',
        'description', '载入内置分子式预设并查询同分异构体。payload: { formula: string, ringHint?: string }。',
        'payloadSchema', JSON_OBJECT('formula', JSON_OBJECT('type', 'string'), 'ringHint', JSON_OBJECT('type', 'string')),
        'useWhen', '用户明确要求查看某个内置分子式预设。',
        'doNotUseWhen', '路径转换任务不要使用。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "alkane-to-carboxylic"|"alkene-to-ester"|"aromatic-to-phenol"|"haloalkane-hydrolysis"|"alcohol-oxidation"|"esterification"|"isomer-alkane"|"isomer-functional-group"|"aromatic-position-isomer"|"halogen-position-isomer" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户用自然语言要求讲解有机转化主线、卤代烃水解、醇氧化、酯化或典型同分异构体。',
        'doNotUseWhen', '用户明确给出起终点或分子式时使用具体 operation。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'c09', JSON_OBJECT(
        'type', 'object',
        'description', 'C09 有机化学反应路径图快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'editor', JSON_OBJECT('type', 'object', 'description', '路径起终点、筛选、路径选择和播放设置。AI 应通过路径 operations 修改。', 'risk', 'high'),
          'isomerQuery', JSON_OBJECT('type', 'object', 'description', '同分异构体分子式和边界提示。AI 应通过 setIsomerQuery 修改。', 'risk', 'medium')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 editor 或 isomerQuery 状态树。',
      'C09 只处理有机转化路径图与同分异构体查询，不要输出 C03/C04/C07/C02/C05/C06/C08/M 系列相关 payload 或 operation。',
      '路径搜索、可达路径、反应条件、方程式、同分异构体列表和边界提示由 C09 内置数据提供；AI 不应编造新路径或新结构。',
      '路径节点必须来自 aiContext.organicNodes；无法唯一识别时返回 warnings。',
      '反应类型筛选必须来自 aiContext.supportedReactionTypes。',
      '同分异构体查询仅展示 aiContext.supportedFormulaList 中已收录的课堂示例；未收录分子式应返回 warnings 或让 C09 展示未收录提示。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '寻找烷烃到羧酸的推荐转化路线。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setPathEndpoints', 'startNodeId', 'alkane', 'endNodeId', 'carboxylic')),
        'patch', JSON_OBJECT(),
        'explanation', '已设置烷烃到羧酸的路径起终点，路线由 C09 搜索。'
      ),
      JSON_OBJECT(
        'instruction', '只看必修范围内从烯烃到酯的路径。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setLevelFilter', 'levels', JSON_ARRAY('[高中必修]')),
          JSON_OBJECT('type', 'setPathEndpoints', 'startNodeId', 'alkene', 'endNodeId', 'ester')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已限制为必修路径并搜索烯烃到酯的转化。'
      ),
      JSON_OBJECT(
        'instruction', '查看 C4H10 的同分异构体。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setIsomerQuery', 'formula', 'C4H10', 'ringHint', 'noRing')),
        'patch', JSON_OBJECT(),
        'explanation', '已查询 C4H10 的课堂常见同分异构体。'
      ),
      JSON_OBJECT(
        'instruction', '高亮当前路径中的水解步骤。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'selectReactionStep', 'reactionType', '水解')),
        'patch', JSON_OBJECT(),
        'explanation', '已在当前路径中高亮水解步骤。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于有机转化路径、筛选、路径播放、步骤高亮、同分异构体查询还是典型教学场景。',
      '路径问题优先使用 setPathEndpoints；分子式问题优先使用 setIsomerQuery，不要混用。',
      '用户要求只看某类反应或学段时先设置筛选，再搜索路径。',
      '涉及路径条件、方程式和同分异构体结构时只输出输入控制项，结果由 C09 内置数据展示。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'c09';
