UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5175/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'chem02',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '分子结构查看器，支持通过结构化 operations 选择分子、切换 3D/2D 显示模式、控制标签/键长/孤电子对/VSEPR/自动旋转、筛选分子库、设置对比分子、选择原子并载入典型教学场景。',
    'supportedIntents', JSON_ARRAY(
      'select-molecule',
      'set-display-mode',
      'set-display-options',
      'set-molecule-filter',
      'set-compare-mode',
      'select-compare-molecule',
      'select-atoms',
      'clear-atom-selection',
      'load-molecule-preset',
      'load-teaching-scenario',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'selectMolecule',
        'description', '选择主分子。payload: { moleculeId?: string, id?: string, name?: string, formula?: string }。',
        'payloadSchema', JSON_OBJECT('moleculeId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'formula', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求展示水、二氧化碳、甲烷、苯等某个分子结构。',
        'doNotUseWhen', '设置对比分子时使用 selectCompareMolecule 或 setCompareMode。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayMode',
        'description', '切换显示模式。payload: { displayMode: "ball-and-stick"|"space-filling"|"electron-cloud"|"structural"|"electron-formula"|"skeletal" }。',
        'payloadSchema', JSON_OBJECT('displayMode', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换球棍、空间填充、电子云、结构简式、电子式或键线式。',
        'doNotUseWhen', '只开关标签、键长、孤电子对等显示项时使用 setDisplayOptions。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '设置显示项。payload 可包含 showLabels、showBondLengths、showLonePairs、showVseprOverlay、autoRotate。',
        'payloadSchema', JSON_OBJECT(
          'showLabels', JSON_OBJECT('type', 'boolean'),
          'showBondLengths', JSON_OBJECT('type', 'boolean'),
          'showLonePairs', JSON_OBJECT('type', 'boolean'),
          'showVseprOverlay', JSON_OBJECT('type', 'boolean'),
          'autoRotate', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求显示/隐藏原子标签、键长、孤电子对、VSEPR 覆盖或自动旋转。',
        'doNotUseWhen', '不要用它切换主显示模式或选择分子。'
      ),
      JSON_OBJECT(
        'type', 'setMoleculeFilter',
        'description', '设置分子列表筛选。payload: { searchQuery?: string, levelFilter?: string, categoryFilter?: string }。',
        'payloadSchema', JSON_OBJECT('searchQuery', JSON_OBJECT('type', 'string'), 'levelFilter', JSON_OBJECT('type', 'string'), 'categoryFilter', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求筛选高中必修、有机物、芳烃、常见离子、配合物等分子列表。',
        'doNotUseWhen', '用户要求直接展示某个分子时使用 selectMolecule。'
      ),
      JSON_OBJECT(
        'type', 'setCompareMode',
        'description', '开启/关闭分子对比，并可同时设置对比分子。payload: { enabled?: boolean, compareMode?: boolean, compareMoleculeId?: string, moleculeId?: string, name?: string, formula?: string }。',
        'payloadSchema', JSON_OBJECT('enabled', JSON_OBJECT('type', 'boolean'), 'compareMode', JSON_OBJECT('type', 'boolean'), 'compareMoleculeId', JSON_OBJECT('type', 'string'), 'moleculeId', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'formula', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求开启/关闭对比模式，或比较两个分子的构型、极性、键长等。',
        'doNotUseWhen', '只选择主分子时使用 selectMolecule。'
      ),
      JSON_OBJECT(
        'type', 'selectCompareMolecule',
        'description', '设置对比分子并自动开启对比模式。payload: { moleculeId?: string, id?: string, name?: string, formula?: string }。',
        'payloadSchema', JSON_OBJECT('moleculeId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string'), 'name', JSON_OBJECT('type', 'string'), 'formula', JSON_OBJECT('type', 'string')),
        'useWhen', '用户已经在对比流程中，要求把对比分子改成另一个分子。',
        'doNotUseWhen', '同时载入完整教学场景时优先使用 loadTeachingScenario。'
      ),
      JSON_OBJECT(
        'type', 'selectAtoms',
        'description', '选择当前分子中的原子索引，用于触发键长/键角展示。payload: { atomIndices: number[] }，最多 3 个索引。',
        'payloadSchema', JSON_OBJECT('atomIndices', JSON_OBJECT('type', 'array'), 'indices', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求选中两个原子看键长，或选中三个相连原子看键角。',
        'doNotUseWhen', 'AI 不知道原子索引时应先参考 aiContext.currentModel.atoms 或返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'clearAtomSelection',
        'description', '清除当前原子选择。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求取消选择、清空键长/键角选中状态。',
        'doNotUseWhen', '不要用它修改显示项。'
      ),
      JSON_OBJECT(
        'type', 'loadMoleculePreset',
        'description', '载入典型分子教学预设。payload: { presetId: "water-vsepr"|"co2-linear"|"methane-tetrahedral"|"ammonia-lone-pair"|"ethylene-pi-bond"|"benzene-delocalized"|"carbonate-resonance"|"copper-ammine-complex"|"glucose-chain" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求快速载入水分子 VSEPR、CO2 直线形、甲烷四面体、苯离域等典型场景。',
        'doNotUseWhen', '用户要求保留当前场景并局部修改时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "vsepr-bent-water"|"vsepr-linear-co2"|"tetrahedral-methane"|"lone-pair-effect"|"polarity-comparison"|"hybridization-sp-sp2-sp3"|"organic-functional-groups"|"aromatic-delocalization"|"coordination-bond"|"bond-length-comparison" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求讲解 VSEPR、孤电子对影响、极性对比、杂化、有机官能团、芳香离域、配位键或键长对比。',
        'doNotUseWhen', '用户明确给出具体分子和显示项时使用 selectMolecule + setDisplayMode/Options。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'chem02', JSON_OBJECT(
        'type', 'object',
        'description', 'C02 分子结构查看器快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'molecule', JSON_OBJECT('type', 'object', 'description', '当前分子、对比分子、筛选、原子选择和导入分子。AI 应通过 selectMolecule、setCompareMode、setMoleculeFilter、selectAtoms 修改。', 'risk', 'high'),
          'ui', JSON_OBJECT('type', 'object', 'description', '显示模式、标签、键长、孤电子对、VSEPR 覆盖、自动旋转和面板状态。AI 应通过 setDisplayMode/setDisplayOptions 修改。', 'risk', 'high')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 molecule 或 ui 状态树。',
      'C02 只处理分子结构查看器，不要输出 C05/C06/C08/M 系列相关 payload 或 operation。',
      '分子几何、VSEPR、杂化、极性、键长、键角、模型统计和电子式可用性由 C02 元数据或模型计算提供；AI 不应编造派生结果。',
      '选择分子必须来自 aiContext.moleculeLibrary 或 aiContext.importedMolecules；无法唯一识别时返回 warnings。',
      '选择原子必须使用 aiContext.currentModel.atoms 中存在的 index；键长/键角由 C02 根据选择展示。',
      'electron-formula 不适合 skipElectronFormula 为 true 的复杂分子；skeletal 不适合碳原子少于 4 的分子。',
      '对比模式下主分子和对比分子必须都能被识别；只修改对比分子时使用 selectCompareMolecule。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '展示水分子的 V 形结构，显示孤电子对和 VSEPR。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadMoleculePreset', 'presetId', 'water-vsepr')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入水分子 VSEPR 场景，并显示孤电子对与构型信息。'
      ),
      JSON_OBJECT(
        'instruction', '把乙烯切到电子云模型并显示键长。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'selectMolecule', 'moleculeId', 'MOL-049'),
          JSON_OBJECT('type', 'setDisplayMode', 'displayMode', 'electron-cloud'),
          JSON_OBJECT('type', 'setDisplayOptions', 'showBondLengths', CAST('true' AS JSON), 'showLabels', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已选择乙烯并切换到电子云模型，打开键长和标签。'
      ),
      JSON_OBJECT(
        'instruction', '对比二氧化碳和水的极性与构型。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'polarity-comparison')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入二氧化碳与水的极性对比场景。'
      ),
      JSON_OBJECT(
        'instruction', '选中当前分子的 0、1、2 号原子查看键角。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'selectAtoms', 'atomIndices', JSON_ARRAY(0, 1, 2))),
        'patch', JSON_OBJECT(),
        'explanation', '已按原子索引设置选择，键角由 C02 展示。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于分子选择、显示模式、显示项、筛选、对比、原子选择还是典型教学场景。',
      '典型课堂需求优先使用 loadMoleculePreset 或 loadTeachingScenario；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如展示 VSEPR 且显示孤电子对时不要只选择分子。',
      '涉及键长/键角时只输出原子索引选择，派生数值由 C02 计算或从元数据读取。',
      '对比两个分子时先设置主分子，再开启 compareMode 并设置对比分子。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'chem02';
