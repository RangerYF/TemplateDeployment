UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5175/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'chem06',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '电化学演示台，支持通过结构化 operations 选择原电池/电解池模型、切换充放电场景、筛选模型库、控制播放进度/速度、显示离子标签，并载入典型电化学教学场景。',
    'supportedIntents', JSON_ARRAY(
      'select-electrochem-model',
      'set-scenario',
      'set-model-filter',
      'set-playback',
      'set-progress',
      'step-forward',
      'set-keyframe',
      'reset-animation',
      'set-display-options',
      'load-electrochem-preset',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'selectElectrochemModel',
        'description', '选择电化学模型。payload: { modelId?: string, id?: string, title?: string, name?: string, family?: "galvanic"|"electrolytic", subtype?: string }。',
        'payloadSchema', JSON_OBJECT('modelId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'title', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'family', JSON_OBJECT('type', 'string'), 'subtype', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示锌铜原电池、铅蓄电池、燃料电池、锂离子电池、电解水、电解食盐水、铜精炼、熔盐电解、电镀等模型。',
        'doNotUseWhen', '用户只要求切换当前模型的放电/充电场景时使用 setScenario。'
      ),
      JSON_OBJECT(
        'type', 'setScenario',
        'description', '切换当前或指定模型的场景。payload: { scenarioId?: string, id?: string, label?: string, modelId?: string }。常见 scenarioId: standard、discharge、charge。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string'), 'modelId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换放电、充电、发电、电解等同一模型下的演示过程。',
        'doNotUseWhen', '用户要求完整课堂主题时优先使用 loadTeachingScenario 或 loadElectrochemPreset。'
      ),
      JSON_OBJECT(
        'type', 'setModelFilter',
        'description', '设置模型库筛选。payload: { searchQuery?: string, query?: string, familyFilter?: "all"|"galvanic"|"electrolytic", family?: string }。',
        'payloadSchema', JSON_OBJECT('searchQuery', JSON_OBJECT('type', 'string'), 'query', JSON_OBJECT('type', 'string'), 'familyFilter', JSON_OBJECT('type', 'string'), 'family', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求筛选原电池、电解池、燃料电池、工业电解等模型列表。',
        'doNotUseWhen', '用户要求直接展示某个模型时使用 selectElectrochemModel。'
      ),
      JSON_OBJECT(
        'type', 'setPlayback',
        'description', '控制动画播放。payload: { playing?: boolean, speed?: 0.5|1|2 }。',
        'payloadSchema', JSON_OBJECT('playing', JSON_OBJECT('type', 'boolean'), 'speed', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求播放、暂停或调整演示速度。',
        'doNotUseWhen', '用户要求跳到某个进度或关键步骤时使用 setProgress/stepForward。'
      ),
      JSON_OBJECT(
        'type', 'setProgress',
        'description', '设置演示进度。payload: { progress: number }，范围 0-1。',
        'payloadSchema', JSON_OBJECT('progress', JSON_OBJECT('type', 'number'), 'value', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求跳到开始、中间、结束或某个百分比进度。',
        'doNotUseWhen', '用户只是要求播放/暂停时使用 setPlayback。'
      ),
      JSON_OBJECT(
        'type', 'stepForward',
        'description', '前进到下一个关键帧。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求下一步、下一阶段、逐步演示。',
        'doNotUseWhen', '用户要求连续播放时使用 setPlayback。'
      ),
      JSON_OBJECT(
        'type', 'setKeyframe',
        'description', '跳转到当前场景的指定关键帧并暂停。payload: { keyframeIndex?: number, index?: number, title?: string, keyframeTitle?: string, focus?: "wire"|"solution"|"electrode"|"equation"|"trend" }。',
        'payloadSchema', JSON_OBJECT('keyframeIndex', JSON_OBJECT('type', 'number'), 'index', JSON_OBJECT('type', 'number'), 'title', JSON_OBJECT('type', 'string'), 'keyframeTitle', JSON_OBJECT('type', 'string'), 'focus', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求跳到盐桥补偿、阴极析氢、阳极竞争、pH 分区、电子流动等当前场景内的具体阶段。',
        'doNotUseWhen', '用户只说下一步时使用 stepForward；用户给出百分比时使用 setProgress。'
      ),
      JSON_OBJECT(
        'type', 'resetAnimation',
        'description', '重置当前动画到起点并暂停。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求重置、从头开始、回到初始状态。',
        'doNotUseWhen', '用户要求切换模型时使用 selectElectrochemModel。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '设置显示项。payload: { showIonLabels?: boolean, ionLabelFontSize?: number }。',
        'payloadSchema', JSON_OBJECT('showIonLabels', JSON_OBJECT('type', 'boolean'), 'ionLabelFontSize', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求显示/隐藏离子标签、电子/离子文字，或调整标签大小。',
        'doNotUseWhen', '不要用它修改模型、场景或播放状态。'
      ),
      JSON_OBJECT(
        'type', 'loadElectrochemPreset',
        'description', '载入典型电化学预设。payload: { presetId: "zn-cu-single"|"zn-cu-salt-bridge"|"lead-acid-discharge"|"lead-acid-charge"|"acid-fuel-cell"|"alkaline-fuel-cell"|"lithium-ion-discharge"|"lithium-ion-charge"|"concentration-cell"|"water-electrolysis"|"brine-electrolysis"|"copper-refining"|"molten-nacl"|"alumina-electrolysis"|"electroplating" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求快速载入标准电化学模型或明确说某个典型装置。',
        'doNotUseWhen', '用户要求保留当前模型并只改播放/显示项时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "basic-galvanic-cell"|"salt-bridge-migration"|"lead-acid-discharge"|"lead-acid-charge"|"fuel-cell-acid-vs-alkaline"|"lithium-ion-charge-discharge"|"concentration-cell-trend"|"water-electrolysis-ph"|"chlor-alkali-process"|"copper-electrorefining"|"molten-salt-electrolysis"|"aluminum-smelting"|"electroplating" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解原电池、电解池、盐桥、充放电、燃料电池、氯碱工业、铜精炼、熔盐电解、炼铝或电镀等课堂主题。',
        'doNotUseWhen', '用户明确给出模型和局部控制项时使用 selectElectrochemModel + set operations。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'chem06', JSON_OBJECT(
        'type', 'object',
        'description', 'C06 电化学演示台快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'electrochem', JSON_OBJECT('type', 'object', 'description', '当前模型、场景、模型筛选、播放进度、速度和离子标签显示。AI 应通过 operations 修改。', 'risk', 'high')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 electrochem 状态树。',
      'C06 只处理电化学演示台，不要输出 C02/C05/C08/M 系列相关 payload 或 operation。',
      '电极反应、总反应、电子方向、电流方向、离子迁移、pH 趋势和关键帧由 C06 内置模型数据提供；AI 不应编造派生结果。',
      '选择模型必须来自 aiContext.modelLibrary；无法唯一识别时返回 warnings。',
      '选择场景必须属于目标模型的 scenarios；铅蓄电池、锂离子电池等充放电模型应明确使用 discharge 或 charge。',
      '播放进度 progress 必须在 0-1；播放速度只支持 0.5、1、2。',
      '跳转关键帧时必须基于 aiContext.activeScenario.keyframes 中存在的标题、focus 或索引；匹配不唯一时返回 warnings。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示锌铜双液原电池和盐桥离子迁移。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'salt-bridge-migration')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入 Zn-Cu 双液原电池盐桥迁移场景。'
      ),
      JSON_OBJECT(
        'instruction', '切到铅蓄电池充电过程，并显示离子标签。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadElectrochemPreset', 'presetId', 'lead-acid-charge'),
          JSON_OBJECT('type', 'setDisplayOptions', 'showIonLabels', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入铅蓄电池充电场景并显示离子标签。'
      ),
      JSON_OBJECT(
        'instruction', '播放电解饱和食盐水，速度调成 2 倍。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadElectrochemPreset', 'presetId', 'brine-electrolysis'),
          JSON_OBJECT('type', 'setPlayback', 'playing', CAST('true' AS JSON), 'speed', 2)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入氯碱工业电解食盐水模型并开始 2 倍速播放。'
      ),
      JSON_OBJECT(
        'instruction', '把当前动画跳到下一步。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'stepForward')),
        'patch', JSON_OBJECT(),
        'explanation', '已前进到下一个关键帧。'
      ),
      JSON_OBJECT(
        'instruction', '跳到电解食盐水的阳极竞争阶段。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadElectrochemPreset', 'presetId', 'brine-electrolysis'),
          JSON_OBJECT('type', 'setKeyframe', 'title', '阳极竞争')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入电解饱和食盐水模型并跳到阳极竞争关键帧。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于模型选择、场景切换、模型筛选、播放控制、进度控制、显示项还是典型教学场景。',
      '典型课堂需求优先使用 loadTeachingScenario 或 loadElectrochemPreset；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如播放且调速时不要只选择模型。',
      '用户要求跳到某个化学阶段时优先使用 setKeyframe，不要手写近似 progress。',
      '涉及反应式、电子/电流方向、离子迁移和 pH 趋势时只输出模型/场景控制项，派生信息由 C06 数据提供。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'chem06';
