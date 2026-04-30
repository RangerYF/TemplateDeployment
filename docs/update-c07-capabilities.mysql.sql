UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5194/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'c07',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '化学反应速率与平衡模拟器，支持通过结构化 operations 选择反应/预设、设置温度/浓度/体积/催化剂、播放或逐步推进模拟、施加扰动、切换图表、设置等效平衡比较与 K-T 坐标，并载入典型教学场景。',
    'supportedIntents', JSON_ARRAY(
      'select-reaction',
      'load-reaction-preset',
      'set-reaction-conditions',
      'set-catalyst',
      'set-playback',
      'step-forward',
      'reset-simulation',
      'apply-intervention',
      'set-chart-options',
      'set-comparison-case',
      'set-kt-axes',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'selectReaction',
        'description', '选择反应场景。payload: { reactionId?: "haber"|"so2"|"no2"|"hi"|"n2o4"|"pcl5", name?: string, equation?: string }。',
        'payloadSchema', JSON_OBJECT('reactionId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'equation', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示合成氨、SO2 氧化、NO 氧化、HI 平衡、N2O4/NO2 或 PCl5 分解等反应。',
        'doNotUseWhen', '用户明确要求某个预设条件时使用 loadReactionPreset。'
      ),
      JSON_OBJECT(
        'type', 'loadReactionPreset',
        'description', '载入某反应下的课堂预设。payload: { reactionId?: string, presetId: string }。',
        'payloadSchema', JSON_OBJECT('reactionId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求高温、高压、压缩、取消催化剂、提高初浓度等预设演示。',
        'doNotUseWhen', '用户只要求改变当前滑块时使用 setReactionConditions。'
      ),
      JSON_OBJECT(
        'type', 'setReactionConditions',
        'description', '设置反应条件。payload: { temperature?: number, concentrationScale?: number, volume?: number, catalyst?: boolean }。',
        'payloadSchema', JSON_OBJECT('temperature', JSON_OBJECT('type', 'number'), 'concentrationScale', JSON_OBJECT('type', 'number'), 'volume', JSON_OBJECT('type', 'number'), 'catalyst', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求调温、改变反应物浓度倍率、压缩/膨胀容器或加入/移除催化剂。',
        'doNotUseWhen', '用户要求按计量比一次性加入反应物/产物时使用 applyIntervention。'
      ),
      JSON_OBJECT(
        'type', 'setCatalyst',
        'description', '设置催化剂开关。payload: { catalyst: boolean }。',
        'payloadSchema', JSON_OBJECT('catalyst', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户只要求加入或移除催化剂。',
        'doNotUseWhen', '同时设置温度、浓度或体积时可使用 setReactionConditions。'
      ),
      JSON_OBJECT(
        'type', 'setPlayback',
        'description', '控制模拟播放。payload: { playing?: boolean, speed?: 0.5|1|2 }。',
        'payloadSchema', JSON_OBJECT('playing', JSON_OBJECT('type', 'boolean'), 'speed', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求播放、暂停或调整速度。',
        'doNotUseWhen', '用户要求只前进一步时使用 stepForward。'
      ),
      JSON_OBJECT(
        'type', 'stepForward',
        'description', '模拟前进一步并暂停。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求逐步演示、下一步或前进一帧。',
        'doNotUseWhen', '用户要求连续播放时使用 setPlayback。'
      ),
      JSON_OBJECT(
        'type', 'resetSimulation',
        'description', '重置当前反应预设并暂停。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求重置模拟、回到初始状态或重新开始。',
        'doNotUseWhen', '用户要求切换反应时使用 selectReaction/loadReactionPreset。'
      ),
      JSON_OBJECT(
        'type', 'applyIntervention',
        'description', '施加课堂扰动。payload: { kind: "addReactant"|"addProduct"|"tempBoost"|"compress" }。',
        'payloadSchema', JSON_OBJECT('kind', JSON_OBJECT('type', 'string'), 'intervention', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求加入反应物、加入产物、升温 30K 或压缩容器，观察速率和平衡移动。',
        'doNotUseWhen', '用户给出精确温度/体积/浓度倍率时使用 setReactionConditions。'
      ),
      JSON_OBJECT(
        'type', 'setChartOptions',
        'description', '设置主图和叠加图。payload: { primaryChart?: "vt"|"ct"|"pt"|"tt"|"at"|"lgct", secondaryChart?: "none"|"vt"|"ct"|"pt"|"tt"|"at"|"lgct" }。',
        'payloadSchema', JSON_OBJECT('primaryChart', JSON_OBJECT('type', 'string'), 'secondaryChart', JSON_OBJECT('type', 'string'), 'primary', JSON_OBJECT('type', 'string'), 'secondary', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求查看 v-t、c-t、p-t、T-t、吸光度-t 或 lgc-t 曲线。',
        'doNotUseWhen', '用户要求 K-T 图坐标时使用 setKtAxes。'
      ),
      JSON_OBJECT(
        'type', 'setComparisonCase',
        'description', '设置等效平衡比较。payload: { comparisonCase: "isoV"|"isoP"|"nonEq" }。',
        'payloadSchema', JSON_OBJECT('comparisonCase', JSON_OBJECT('type', 'string'), 'caseId', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求恒温恒容等效、恒温恒压等效或非等效比较。',
        'doNotUseWhen', '用户只要求改变当前反应条件时使用 setReactionConditions。'
      ),
      JSON_OBJECT(
        'type', 'setKtAxes',
        'description', '设置 K-T/van''t Hoff 图坐标。payload: { xAxis?: "T"|"invT", yAxis?: "K"|"lnK" }。',
        'payloadSchema', JSON_OBJECT('xAxis', JSON_OBJECT('type', 'string'), 'yAxis', JSON_OBJECT('type', 'string'), 'ktXAxis', JSON_OBJECT('type', 'string'), 'ktYAxis', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换 K-T 图、lnK-1/T 图或观察温度与平衡常数关系。',
        'doNotUseWhen', '普通动态曲线使用 setChartOptions。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "haber-equilibrium"|"ammonia-high-pressure"|"so2-catalyst"|"no2-color-rate"|"hi-temperature"|"n2o4-color-equilibrium"|"pcl5-pressure-temperature"|"equivalent-equilibrium"|"non-equivalent-equilibrium"|"rate-order-plot"|"vant-hoff-kt" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户用自然语言要求讲解反应速率、催化剂、温度/压强/浓度影响、颜色平衡、等效平衡或 K-T 关系。',
        'doNotUseWhen', '用户明确给出具体滑块数值或图表类型时使用具体 operation。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'c07', JSON_OBJECT(
        'type', 'object',
        'description', 'C07 化学反应速率与平衡模拟器快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'editor', JSON_OBJECT('type', 'object', 'description', '当前反应和预设。AI 应通过 selectReaction/loadReactionPreset 修改。', 'risk', 'high'),
          'controls', JSON_OBJECT('type', 'object', 'description', '图表、等效平衡、K-T 坐标和播放速度。AI 应通过 setChartOptions/setComparisonCase/setKtAxes/setPlayback 修改。', 'risk', 'medium'),
          'simulation', JSON_OBJECT('type', 'object', 'description', '温度、浓度倍率、体积、催化剂和浓度状态。AI 应通过 setReactionConditions 或 applyIntervention 修改。', 'risk', 'high')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 editor、controls 或 simulation 状态树。',
      'C07 只处理化学反应速率与平衡模拟器，不要输出 C03/C04/C09/C02/C05/C06/C08/M 系列相关 payload 或 operation。',
      '速率、Qc、Kc、压强、吸光度、转化率、平衡移动方向和曲线数据由 C07 引擎计算；AI 不应编造派生结果。',
      '选择反应必须来自 aiContext.reactionLibrary；无法唯一识别时返回 warnings。',
      '温度会按当前反应 temperatureRange 截断；体积只对 pressureRelevant 反应有效；催化剂只对 catalystSupported 反应有效。',
      '播放速度只支持 0.5、1、2；动画时间和历史曲线属于运行时状态，AI 不应通过 patch 手写。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示合成氨高压有利于平衡右移。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'ammonia-high-pressure')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入合成氨高压预设，平衡移动由 C07 自动计算。'
      ),
      JSON_OBJECT(
        'instruction', '把 SO2 氧化切到无催化剂对比，并查看 v-t 曲线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadReactionPreset', 'reactionId', 'so2', 'presetId', 'no-catalyst'),
          JSON_OBJECT('type', 'setChartOptions', 'primaryChart', 'vt', 'secondaryChart', 'none')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入 SO2 氧化无催化剂预设，并显示速率-时间曲线。'
      ),
      JSON_OBJECT(
        'instruction', '把当前体系升温到 760 K，加入催化剂，速度调成 2 倍播放。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setReactionConditions', 'temperature', 760, 'catalyst', CAST('true' AS JSON)),
          JSON_OBJECT('type', 'setPlayback', 'playing', CAST('true' AS JSON), 'speed', 2)
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已设置温度和催化剂，并以 2 倍速播放。'
      ),
      JSON_OBJECT(
        'instruction', '展示恒温恒容等效平衡比较。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'setComparisonCase', 'comparisonCase', 'isoV')),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到恒温恒容等效平衡比较。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于反应选择、预设、条件扰动、播放控制、曲线、等效平衡、K-T 图还是典型教学场景。',
      '典型课堂需求优先使用 loadTeachingScenario 或 loadReactionPreset；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如播放且调速时不要只选择反应。',
      '涉及速率、平衡常数、反应商、平衡移动方向、压强和吸光度时只输出输入控制项，派生数据由 C07 计算。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'c07';
