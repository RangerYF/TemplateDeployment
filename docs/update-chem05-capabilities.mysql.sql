UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5174/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'chem05',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '晶体结构查看器，支持通过结构化 operations 选择晶体、切换晶体/堆积视图、设置渲染模式、晶胞扩展、显示项、键类型筛选、原子高亮、堆积动画和空隙展示，并载入典型晶体教学场景。',
    'supportedIntents', JSON_ARRAY(
      'select-crystal',
      'set-active-tab',
      'set-render-mode',
      'set-expansion-range',
      'set-display-options',
      'set-bond-type-visibility',
      'highlight-atom',
      'clear-highlight',
      'set-packing-type',
      'set-packing-step',
      'set-packing-playback',
      'set-voids',
      'load-crystal-preset',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'selectCrystal',
        'description', '选择晶体。payload: { crystalId?: string, id?: string, name?: string, formula?: string, structureType?: string }。',
        'payloadSchema', JSON_OBJECT('crystalId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'formula', JSON_OBJECT('type', 'string'), 'structureType', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示氯化钠、氯化铯、金刚石、石墨、铜、α-铁、镁、硫化锌等某个晶体结构。',
        'doNotUseWhen', '用户只要求切换渲染、扩胞、堆积或空隙时使用对应 operation。'
      ),
      JSON_OBJECT(
        'type', 'setActiveTab',
        'description', '切换视图页。payload: { tab: "crystal"|"packing" }。',
        'payloadSchema', JSON_OBJECT('tab', JSON_OBJECT('type', 'string'), 'activeTab', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到晶体结构视图或堆积演示视图。',
        'doNotUseWhen', '载入完整堆积场景时优先使用 loadTeachingScenario 或 loadCrystalPreset。'
      ),
      JSON_OBJECT(
        'type', 'setRenderMode',
        'description', '设置晶体渲染模式。payload: { renderMode: "ballAndStick"|"spaceFilling"|"polyhedral"|"wireframe" }。',
        'payloadSchema', JSON_OBJECT('renderMode', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求球棍、空间填充、多面体或线框显示。',
        'doNotUseWhen', '不要用它切换堆积类型或显示空隙。'
      ),
      JSON_OBJECT(
        'type', 'setExpansionRange',
        'description', '设置晶胞扩展范围。payload: { size?: 1|2|3|4, x?: [min,max], y?: [min,max], z?: [min,max] }。',
        'payloadSchema', JSON_OBJECT('size', JSON_OBJECT('type', 'number'), 'range', JSON_OBJECT('type', 'number'), 'x', JSON_OBJECT('type', 'array'), 'y', JSON_OBJECT('type', 'array'), 'z', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求展示 1×1×1、2×2×2 或沿某轴扩展晶胞。',
        'doNotUseWhen', '不要用它选择新晶体。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '设置显示项。payload 可包含 showUnitCell、showBonds、showLabels、showAxes、showTeachingPoints、showInfoPanel。',
        'payloadSchema', JSON_OBJECT(
          'showUnitCell', JSON_OBJECT('type', 'boolean'),
          'showBonds', JSON_OBJECT('type', 'boolean'),
          'showLabels', JSON_OBJECT('type', 'boolean'),
          'showAxes', JSON_OBJECT('type', 'boolean'),
          'showTeachingPoints', JSON_OBJECT('type', 'boolean'),
          'showInfoPanel', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求显示/隐藏晶胞框架、化学键、原子标签、坐标轴、教学要点或信息面板。',
        'doNotUseWhen', '不要用它修改晶体、渲染模式或堆积类型。'
      ),
      JSON_OBJECT(
        'type', 'setBondTypeVisibility',
        'description', '设置键类型可见性。payload: { visibleBondTypes?: BondType[], bondType?: BondType, visible?: boolean }。BondType 为 ionic、covalent-sigma、covalent-pi、metallic、hydrogen、vanDerWaals。',
        'payloadSchema', JSON_OBJECT('visibleBondTypes', JSON_OBJECT('type', 'array'), 'bondType', JSON_OBJECT('type', 'string'), 'visible', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求只看离子键、隐藏范德华力、筛选金属键等。',
        'doNotUseWhen', '只是总开关化学键时使用 setDisplayOptions。'
      ),
      JSON_OBJECT(
        'type', 'highlightAtom',
        'description', '高亮当前晶体中的原子位点。payload: { atomIndex?: number, siteIndex?: number, element?: string, label?: string }。',
        'payloadSchema', JSON_OBJECT('atomIndex', JSON_OBJECT('type', 'number'), 'siteIndex', JSON_OBJECT('type', 'number'), 'index', JSON_OBJECT('type', 'number'), 'element', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求查看某个原子的配位环境、近邻或空隙类型。',
        'doNotUseWhen', 'AI 无法唯一确定原子位点时返回 warnings，不要猜。'
      ),
      JSON_OBJECT(
        'type', 'clearHighlight',
        'description', '清除原子高亮。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求取消高亮或清除配位信息。',
        'doNotUseWhen', '不要用它修改晶体或显示项。'
      ),
      JSON_OBJECT(
        'type', 'setPackingType',
        'description', '设置堆积类型并切换到堆积视图。payload: { packingType: "SC"|"BCC"|"FCC"|"HCP" }。',
        'payloadSchema', JSON_OBJECT('packingType', JSON_OBJECT('type', 'string'), 'typeValue', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求演示简单立方、体心立方、面心立方或六方最密堆积。',
        'doNotUseWhen', '选择具体晶体结构时使用 selectCrystal。'
      ),
      JSON_OBJECT(
        'type', 'setPackingStep',
        'description', '设置堆积动画步骤。payload: { step: number }。',
        'payloadSchema', JSON_OBJECT('step', JSON_OBJECT('type', 'number'), 'packingStep', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求跳到堆积动画某一步或展示最终堆积。',
        'doNotUseWhen', '播放/暂停或调速度使用 setPackingPlayback。'
      ),
      JSON_OBJECT(
        'type', 'setPackingPlayback',
        'description', '控制堆积动画播放。payload: { playing?: boolean, speed?: 0.5|1|2 }。',
        'payloadSchema', JSON_OBJECT('playing', JSON_OBJECT('type', 'boolean'), 'speed', JSON_OBJECT('type', 'number'), 'packingSpeed', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求播放、暂停堆积动画或调整播放速度。',
        'doNotUseWhen', '切换堆积类型使用 setPackingType。'
      ),
      JSON_OBJECT(
        'type', 'setVoids',
        'description', '设置空隙显示。payload: { showVoids?: boolean, voidType?: "tetrahedral"|"octahedral"|"all" }。',
        'payloadSchema', JSON_OBJECT('showVoids', JSON_OBJECT('type', 'boolean'), 'voidType', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求显示四面体空隙、八面体空隙或所有空隙。',
        'doNotUseWhen', '普通晶体配位高亮使用 highlightAtom。'
      ),
      JSON_OBJECT(
        'type', 'loadCrystalPreset',
        'description', '载入典型晶体预设。payload: { presetId: "nacl-rock-salt"|"cscl-eight-coordination"|"diamond-network"|"graphite-layered"|"fcc-copper"|"bcc-iron"|"hcp-magnesium"|"zinc-blende" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求快速载入典型晶体、结构类型或标准示例。',
        'doNotUseWhen', '用户要求保留当前晶体并局部修改时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "nacl-coordination"|"cscl-coordination"|"diamond-covalent-network"|"graphite-layered-structure"|"fcc-close-packing"|"bcc-metal-packing"|"hcp-close-packing"|"zinc-blende-tetrahedral"|"unit-cell-expansion"|"voids-in-close-packing"|"bond-type-comparison" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解离子晶体配位、共价网络、层状结构、金属堆积、晶胞扩展、空隙或键类型对比。',
        'doNotUseWhen', '用户明确给出晶体和显示项时使用 selectCrystal + set operations。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'chem05', JSON_OBJECT(
        'type', 'object',
        'description', 'C05 晶体结构查看器快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'crystal', JSON_OBJECT('type', 'object', 'description', '当前晶体、渲染、扩胞、键类型筛选、原子高亮、堆积动画和空隙状态。AI 应通过 operations 修改。', 'risk', 'high'),
          'ui', JSON_OBJECT('type', 'object', 'description', '教学要点、信息面板和右侧面板状态。AI 一般通过 setDisplayOptions 修改。', 'risk', 'medium')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 crystal 或 ui 状态树。',
      'C05 只处理晶体结构查看器，不要输出 C02/C06/C08/M 系列相关 payload 或 operation。',
      '晶体结构、配位数、键长、堆积效率、空隙信息、教学要点等派生信息由 C05 数据或引擎提供；AI 不应编造派生结果。',
      '选择晶体必须来自 aiContext.crystalLibrary；无法唯一识别时返回 warnings。',
      '高亮原子必须使用 aiContext.activeCrystal.atomSites 中存在的 index、element 或 label；匹配不唯一时返回 warnings。',
      '晶胞扩展范围必须保持较小；通常使用 size 1-4，避免输出大范围扩展。',
      '演示完堆积后，如果用户继续要求选择晶体、切换渲染、扩胞、高亮原子或筛选键类型，应输出对应晶体视图 operation，C05 会自动回到 crystal 视图。',
      '堆积演示使用 setPackingType、setPackingStep、setPackingPlayback、setVoids；不要把堆积类型伪装成晶体结构。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '展示氯化钠岩盐型晶体，并显示配位多面体。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadCrystalPreset', 'presetId', 'nacl-rock-salt')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入氯化钠岩盐型晶体并切换到多面体显示。'
      ),
      JSON_OBJECT(
        'instruction', '把当前晶体扩展成 2×2×2，并显示坐标轴。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setExpansionRange', 'size', 2),
          JSON_OBJECT('type', 'setDisplayOptions', 'showAxes', CAST('true' AS JSON), 'showUnitCell', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已设置 2×2×2 晶胞扩展并显示坐标轴。'
      ),
      JSON_OBJECT(
        'instruction', '演示 FCC 堆积，并显示八面体空隙。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setPackingType', 'packingType', 'FCC'),
          JSON_OBJECT('type', 'setVoids', 'showVoids', CAST('true' AS JSON), 'voidType', 'octahedral')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到 FCC 堆积演示并显示八面体空隙。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于晶体选择、渲染模式、晶胞扩展、显示项、键类型筛选、原子高亮、堆积演示、空隙显示还是典型教学场景。',
      '典型课堂需求优先使用 loadCrystalPreset 或 loadTeachingScenario；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如显示 FCC 八面体空隙时不要只切换 packingType。',
      '用户从堆积演示继续切换晶体或渲染时，不要额外输出 setActiveTab；对应 operation 会自动回到晶体视图。',
      '涉及配位、键长、堆积效率和空隙数量时只输出输入控制项，派生数据由 C05 计算或读取。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'chem05';
