UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5179/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'm06',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '向量运算演示台，支持通过结构化 operations 切换向量教学场景、设置二维/三维向量、数乘系数、基底分解、显示项、格式选项、单位圆角度，以及轻量自由演示台对象。',
    'supportedIntents', JSON_ARRAY(
      'set-operation',
      'load-vector-preset',
      'load-teaching-scenario',
      'set-vector-2d',
      'set-vector-3d',
      'set-chain-vectors',
      'set-scalar',
      'set-dot-product-demo',
      'set-decomposition-demo',
      'set-cross-product-demo',
      'set-triangle-chain-demo',
      'set-display-options',
      'set-format-options',
      'set-unit-circle-angle',
      'play-parallelogram-animation',
      'clear-demo-stage',
      'add-demo-vector',
      'add-demo-vector-operation',
      'scale-demo-vector',
      'update-demo-vector',
      'delete-demo-entity',
      'bind-demo-endpoints',
      'unbind-demo-endpoint',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setOperation',
        'description', '切换 M06 主运算类型。payload: { operation: "concept"|"coordinate"|"parallelogram"|"triangle"|"subtraction"|"scalar"|"dotProduct"|"decomposition"|"space3D"|"crossProduct"|"geometry3D"|"demoStage" }。',
        'payloadSchema', JSON_OBJECT('operation', JSON_OBJECT('type', 'string'), 'operationType', JSON_OBJECT('type', 'string'), 'mode', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到某类向量概念、运算或空间向量演示。',
        'doNotUseWhen', '用户要求典型场景时优先使用 loadVectorPreset 或 loadTeachingScenario。'
      ),
      JSON_OBJECT(
        'type', 'loadVectorPreset',
        'description', '载入已有 VEC 教学预设。payload: { presetId: string }，例如 VEC-011-B、VEC-041-G、VEC-062-C。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求切换到某个标准示例、典型向量场景或明确 VEC 编号。',
        'doNotUseWhen', '用户要求保留当前场景并只修改向量参数时使用具体 set operation。'
      ),
      JSON_OBJECT(
        'type', 'loadTeachingScenario',
        'description', '载入语义化教学场景。payload: { scenarioId: "vector-basic-elements"|"coordinate-345"|"parallelogram-rule"|"triangle-chain"|"subtraction-common-origin"|"scalar-negative"|"dot-perpendicular"|"dot-projection"|"polarization-identity"|"basis-decomposition"|"space-vector-dot"|"cross-product-area"|"cube-diagonal"|"pyramid-normal" }。',
        'payloadSchema', JSON_OBJECT('scenarioId', JSON_OBJECT('type', 'string'), 'presetId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户用自然语言要求讲解某个向量主题或课堂场景。',
        'doNotUseWhen', '用户明确给出具体向量坐标时使用 setVector2D/setVector3D。'
      ),
      JSON_OBJECT(
        'type', 'setVector2D',
        'description', '设置二维向量。payload: { target: "vecA"|"vecB"|"decompTarget"|"basis1"|"basis2"|"chain", value: [x,y], index?: number }。',
        'payloadSchema', JSON_OBJECT(
          'target', JSON_OBJECT('type', 'string'),
          'vectorKey', JSON_OBJECT('type', 'string'),
          'value', JSON_OBJECT('type', 'array'),
          'vec', JSON_OBJECT('type', 'array'),
          'vector', JSON_OBJECT('type', 'array'),
          'index', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求修改平面向量 a、b、分解目标向量、基底向量或三角形法则链式向量。',
        'doNotUseWhen', '三维空间向量使用 setVector3D。'
      ),
      JSON_OBJECT(
        'type', 'setVector3D',
        'description', '设置三维向量。payload: { target: "vecA3"|"vecB3", value: [x,y,z] }。',
        'payloadSchema', JSON_OBJECT(
          'target', JSON_OBJECT('type', 'string'),
          'vectorKey', JSON_OBJECT('type', 'string'),
          'value', JSON_OBJECT('type', 'array'),
          'vec', JSON_OBJECT('type', 'array'),
          'vector', JSON_OBJECT('type', 'array')
        ),
        'useWhen', '用户要求修改空间向量、叉积或立体几何中的三维向量。',
        'doNotUseWhen', '二维向量使用 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'setChainVectors',
        'description', '设置三角形法则中的额外链式向量。payload: { vectors: [[x,y], ...] }。vecA 与 vecB 之外的后续向量写入 vectors。',
        'payloadSchema', JSON_OBJECT('vectors', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求展示多个向量首尾相接求和。',
        'doNotUseWhen', '只修改 a 或 b 时使用 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'setScalar',
        'description', '设置数乘系数。payload: { k: number }。',
        'payloadSchema', JSON_OBJECT('k', JSON_OBJECT('type', 'number'), 'scalarK', JSON_OBJECT('type', 'number'), 'value', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求设置 k·a 中的 k，或演示方向反转/伸缩。',
        'doNotUseWhen', '不要用它修改向量坐标。'
      ),
      JSON_OBJECT(
        'type', 'setDotProductDemo',
        'description', '一站式配置点积演示。payload: { vecA?: [x,y], vecB?: [x,y], showAngleArc?: boolean, showProjection?: boolean, showPolarization?: boolean }。',
        'payloadSchema', JSON_OBJECT('vecA', JSON_OBJECT('type', 'array'), 'vecB', JSON_OBJECT('type', 'array'), 'a', JSON_OBJECT('type', 'array'), 'b', JSON_OBJECT('type', 'array'), 'showAngleArc', JSON_OBJECT('type', 'boolean'), 'showProjection', JSON_OBJECT('type', 'boolean'), 'showPolarization', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求点积、夹角、投影或极化恒等式的一体化演示。',
        'doNotUseWhen', '只修改单个向量时使用 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'setDecompositionDemo',
        'description', '一站式配置基底分解。payload: { target: [x,y], basis1: [x,y], basis2: [x,y], showDecompParallel?: boolean }。',
        'payloadSchema', JSON_OBJECT('target', JSON_OBJECT('type', 'array'), 'decompTarget', JSON_OBJECT('type', 'array'), 'basis1', JSON_OBJECT('type', 'array'), 'basis2', JSON_OBJECT('type', 'array'), 'e1', JSON_OBJECT('type', 'array'), 'e2', JSON_OBJECT('type', 'array'), 'showDecompParallel', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户一次性给出目标向量和两个基底，要求演示分解。',
        'doNotUseWhen', '基底共线时返回 warnings，不要伪造分解结果。'
      ),
      JSON_OBJECT(
        'type', 'setCrossProductDemo',
        'description', '一站式配置三维叉积演示。payload: { vecA3?: [x,y,z], vecB3?: [x,y,z], show3DGrid?: boolean, showPerspective?: boolean }。',
        'payloadSchema', JSON_OBJECT('vecA3', JSON_OBJECT('type', 'array'), 'vecB3', JSON_OBJECT('type', 'array'), 'a3', JSON_OBJECT('type', 'array'), 'b3', JSON_OBJECT('type', 'array'), 'a', JSON_OBJECT('type', 'array'), 'b', JSON_OBJECT('type', 'array'), 'show3DGrid', JSON_OBJECT('type', 'boolean'), 'showPerspective', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求演示叉积方向、面积或三维法向量。',
        'doNotUseWhen', '空间点积或夹角演示使用 setVector3D + setOperation。'
      ),
      JSON_OBJECT(
        'type', 'setTriangleChainDemo',
        'description', '一站式配置三角形法则链式向量。payload: { vectors: [[x,y], [x,y], ...] }。',
        'payloadSchema', JSON_OBJECT('vectors', JSON_OBJECT('type', 'array')),
        'useWhen', '用户要求多个向量首尾相接求和。',
        'doNotUseWhen', '只有两个向量加法时优先使用 parallelogram 或 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '设置显示项。payload 可包含 showGrid、showAngleArc、showProjection、showDecompParallel、showPerspective、show3DGrid、showPolarization、showTeachingPoints、showCoordLabels、scenarioPanelOpen、paramPanelOpen。',
        'payloadSchema', JSON_OBJECT(
          'showGrid', JSON_OBJECT('type', 'boolean'),
          'showAngleArc', JSON_OBJECT('type', 'boolean'),
          'showProjection', JSON_OBJECT('type', 'boolean'),
          'showDecompParallel', JSON_OBJECT('type', 'boolean'),
          'showPerspective', JSON_OBJECT('type', 'boolean'),
          'show3DGrid', JSON_OBJECT('type', 'boolean'),
          'showPolarization', JSON_OBJECT('type', 'boolean'),
          'showTeachingPoints', JSON_OBJECT('type', 'boolean'),
          'showCoordLabels', JSON_OBJECT('type', 'boolean'),
          'scenarioPanelOpen', JSON_OBJECT('type', 'boolean'),
          'paramPanelOpen', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求显示/隐藏网格、夹角、投影、分解辅助线、3D 网格、极化恒等式、教学要点或坐标标签。',
        'doNotUseWhen', '不要用它修改向量坐标。'
      ),
      JSON_OBJECT(
        'type', 'setFormatOptions',
        'description', '设置格式项。payload: { angleUnit?: "deg"|"rad", decimalPlaces?: number, surdMode?: boolean }。',
        'payloadSchema', JSON_OBJECT('angleUnit', JSON_OBJECT('type', 'string'), 'decimalPlaces', JSON_OBJECT('type', 'number'), 'surdMode', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求角度用度/弧度、调整小数位数或开启根式精确显示。',
        'doNotUseWhen', '不要用它修改显示辅助项或向量坐标。'
      ),
      JSON_OBJECT(
        'type', 'setUnitCircleAngle',
        'description', '设置单位圆/角度演示角。payload: { angleRad?: number, angleDeg?: number, piMultiple?: number, playing?: boolean }。',
        'payloadSchema', JSON_OBJECT('angleRad', JSON_OBJECT('type', 'number'), 'angleDeg', JSON_OBJECT('type', 'number'), 'piMultiple', JSON_OBJECT('type', 'number'), 'anglePiMultiple', JSON_OBJECT('type', 'number'), 'playing', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求设置单位圆角度或开始/停止角度旋转演示。',
        'doNotUseWhen', '普通向量夹角由 M06 根据向量自动计算，不要手写。'
      ),
      JSON_OBJECT(
        'type', 'playParallelogramAnimation',
        'description', '播放平行四边形构造动画。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求演示平行四边形法则的构造过程。',
        'doNotUseWhen', '不是平行四边形法则时不要输出。'
      ),
      JSON_OBJECT(
        'type', 'clearDemoStage',
        'description', '清空自由演示台并切换到 demoStage。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求清空演示台、重新开始自由向量搭建。',
        'doNotUseWhen', '只切换主教学预设时不要使用。'
      ),
      JSON_OBJECT(
        'type', 'addDemoVector',
        'description', '在自由演示台添加一个向量。payload: { start?: [x,y], end: [x,y], id?: string, label?: string, color?: string, showLabel?: boolean }。',
        'payloadSchema', JSON_OBJECT('start', JSON_OBJECT('type', 'array'), 'startPoint', JSON_OBJECT('type', 'array'), 'end', JSON_OBJECT('type', 'array'), 'endPoint', JSON_OBJECT('type', 'array'), 'value', JSON_OBJECT('type', 'array'), 'id', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string'), 'color', JSON_OBJECT('type', 'string'), 'showLabel', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求在自由演示台创建可拖拽向量。',
        'doNotUseWhen', '主教学面板的向量 a/b 使用 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'addDemoVectorOperation',
        'description', '在自由演示台添加向量运算节点。payload: { kind: "add"|"subtract"|"dotProduct"|"scale", vec1Id?: string, vec2Id?: string, label1?: string, label2?: string, scalarK?: number, origin?: [x,y] }。',
        'payloadSchema', JSON_OBJECT('kind', JSON_OBJECT('type', 'string'), 'vec1Id', JSON_OBJECT('type', 'string'), 'vec2Id', JSON_OBJECT('type', 'string'), 'label1', JSON_OBJECT('type', 'string'), 'label2', JSON_OBJECT('type', 'string'), 'scalarK', JSON_OBJECT('type', 'number'), 'k', JSON_OBJECT('type', 'number'), 'origin', JSON_OBJECT('type', 'array')),
        'useWhen', '用户明确要求新增/显示一个运算结果节点，例如显示 u+v、显示 2u、添加点积结果。',
        'doNotUseWhen', '用户说“把 u 变成 2 倍”“把 u 做 2 倍数乘”时使用 scaleDemoVector 原地修改已有向量；引用向量缺失或歧义时返回 warnings，不要猜。'
      ),
      JSON_OBJECT(
        'type', 'scaleDemoVector',
        'description', '原地缩放自由演示台已有向量。payload: { id?: string, vecId?: string, label?: string, k?: number, newLabel?: string }。保持起点不变，终点按倍率移动。',
        'payloadSchema', JSON_OBJECT('id', JSON_OBJECT('type', 'string'), 'vecId', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string'), 'k', JSON_OBJECT('type', 'number'), 'scalarK', JSON_OBJECT('type', 'number'), 'scale', JSON_OBJECT('type', 'number'), 'newLabel', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求把自由演示台里的某个已有向量扩大/缩小为 k 倍，或把 u 做 2 倍数乘。',
        'doNotUseWhen', '用户明确要求保留 u 并额外显示 2u 时使用 addDemoVectorOperation。'
      ),
      JSON_OBJECT(
        'type', 'updateDemoVector',
        'description', '更新自由演示台向量。payload: { id?: string, label?: string, start?: [x,y], end?: [x,y], color?: string, newLabel?: string, showLabel?: boolean, constraint?: "free"|"fixedStart"|"fixedEnd", constraintLength?: number }。',
        'payloadSchema', JSON_OBJECT('id', JSON_OBJECT('type', 'string'), 'vecId', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string'), 'start', JSON_OBJECT('type', 'array'), 'end', JSON_OBJECT('type', 'array'), 'color', JSON_OBJECT('type', 'string'), 'newLabel', JSON_OBJECT('type', 'string'), 'showLabel', JSON_OBJECT('type', 'boolean'), 'constraint', JSON_OBJECT('type', 'string'), 'constraintLength', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求移动、重命名、改色、隐藏标签或约束自由演示台中的已有向量。',
        'doNotUseWhen', '主教学向量 a/b 使用 setVector2D。'
      ),
      JSON_OBJECT(
        'type', 'deleteDemoEntity',
        'description', '删除自由演示台实体。payload: { id: string }。删除向量时会同时删除端点、关联运算和绑定。',
        'payloadSchema', JSON_OBJECT('id', JSON_OBJECT('type', 'string'), 'entityId', JSON_OBJECT('type', 'string'), 'vecId', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求删除自由演示台中的向量或运算。',
        'doNotUseWhen', '清空整个演示台时使用 clearDemoStage。'
      ),
      JSON_OBJECT(
        'type', 'bindDemoEndpoints',
        'description', '绑定两个自由演示台向量端点。payload: { vec1Id?: string, vec2Id?: string, label1?: string, label2?: string, endpoint1?: "start"|"end", endpoint2?: "start"|"end" }。',
        'payloadSchema', JSON_OBJECT('vec1Id', JSON_OBJECT('type', 'string'), 'vec2Id', JSON_OBJECT('type', 'string'), 'label1', JSON_OBJECT('type', 'string'), 'label2', JSON_OBJECT('type', 'string'), 'endpoint1', JSON_OBJECT('type', 'string'), 'endpoint2', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求自由演示台向量首尾相接、共起点或绑定端点。',
        'doNotUseWhen', '引用向量缺失或标签重名时返回 warnings，不要猜。'
      ),
      JSON_OBJECT(
        'type', 'unbindDemoEndpoint',
        'description', '解除自由演示台端点绑定。payload: { bindingId?: string, vecId?: string, label?: string, endpoint?: "start"|"end" }。',
        'payloadSchema', JSON_OBJECT('bindingId', JSON_OBJECT('type', 'string'), 'vecId', JSON_OBJECT('type', 'string'), 'label', JSON_OBJECT('type', 'string'), 'endpoint', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求解除自由演示台端点绑定。',
        'doNotUseWhen', '没有可识别绑定目标时返回 warnings。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'm06', JSON_OBJECT(
        'type', 'object',
        'description', 'M06 向量运算演示台快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'vector', JSON_OBJECT('type', 'object', 'description', '主向量教学状态，包括当前运算、二维/三维向量、分解基底、显示项和格式项。AI 应通过 operations 修改。', 'risk', 'high'),
          'ui', JSON_OBJECT('type', 'object', 'description', '左右面板、教学要点和坐标标签显示状态。', 'risk', 'medium'),
          'demo', JSON_OBJECT('type', 'object', 'description', '自由演示台对象图。AI 不应直接手写实体树，应使用 addDemoVector 等 operations。', 'risk', 'high'),
          'demoTool', JSON_OBJECT('type', 'object', 'description', '自由演示台工具状态。AI 一般不直接修改。', 'risk', 'medium')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 vector、ui、demo 或 demoTool 状态树。',
      'M06 只处理向量运算演示台，不要输出 M02/M03/M04/M05 相关 payload 或 operation。',
      '向量和、差、点积、投影、分解系数、叉积、夹角等派生量由 M06 计算；AI 不应手写派生结果。',
      '二维向量必须是 [x,y]，三维向量必须是 [x,y,z]，所有分量必须是有限数字。',
      '基底分解要求 basis1 与 basis2 不共线；共线时返回 warnings，不要继续输出依赖分解结果的 operation。',
      '自由演示台引用已有向量时必须基于 aiContext.demoStage.vectors 中的 id 或 label。',
      '自由演示台向量标签重名时必须使用 id 引用，不要猜测目标。',
      '自由演示台绑定端点必须通过 bindDemoEndpoints；AI 不应直接手写 bindings。',
      '用户说把自由演示台某向量做 k 倍数乘时，默认原地修改该向量，使用 scaleDemoVector；只有用户说新增/显示结果时才使用 addDemoVectorOperation 的 scale。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '演示向量加法的平行四边形法则。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'parallelogram-rule'),
          JSON_OBJECT('type', 'playParallelogramAnimation')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入平行四边形法则并播放构造动画。'
      ),
      JSON_OBJECT(
        'instruction', '设置 a=(3,4)，显示它的坐标和模长。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setOperation', 'operation', 'coordinate'),
          JSON_OBJECT('type', 'setVector2D', 'target', 'vecA', 'value', JSON_ARRAY(3, 4)),
          JSON_OBJECT('type', 'setDisplayOptions', 'showCoordLabels', CAST('true' AS JSON), 'showTeachingPoints', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换到坐标表示并设置向量 a。'
      ),
      JSON_OBJECT(
        'instruction', '演示两个向量垂直时点积为 0。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadTeachingScenario', 'scenarioId', 'dot-perpendicular')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入点积垂直判定场景。'
      ),
      JSON_OBJECT(
        'instruction', '把基底改成 e1=(2,1), e2=(1,2)，分解目标向量 (5,3)。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'setOperation', 'operation', 'decomposition'),
          JSON_OBJECT('type', 'setVector2D', 'target', 'decompTarget', 'value', JSON_ARRAY(5, 3)),
          JSON_OBJECT('type', 'setVector2D', 'target', 'basis1', 'value', JSON_ARRAY(2, 1)),
          JSON_OBJECT('type', 'setVector2D', 'target', 'basis2', 'value', JSON_ARRAY(1, 2)),
          JSON_OBJECT('type', 'setDisplayOptions', 'showDecompParallel', CAST('true' AS JSON))
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已设置目标向量和斜交基底，分解系数由 M06 自动计算。'
      ),
      JSON_OBJECT(
        'instruction', '演示 i×j=k。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadVectorPreset', 'presetId', 'VEC-062-A')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入叉积基本关系 i×j=k。'
      ),
      JSON_OBJECT(
        'instruction', '在自由演示台创建两个向量 u=(3,1)、v=(1,2)，并显示 u+v。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'clearDemoStage'),
          JSON_OBJECT('type', 'addDemoVector', 'id', 'u', 'label', 'u', 'start', JSON_ARRAY(0, 0), 'end', JSON_ARRAY(3, 1), 'color', '#2196F3'),
          JSON_OBJECT('type', 'addDemoVector', 'id', 'v', 'label', 'v', 'start', JSON_ARRAY(0, 0), 'end', JSON_ARRAY(1, 2), 'color', '#00C06B'),
          JSON_OBJECT('type', 'addDemoVectorOperation', 'kind', 'add', 'vec1Id', 'u', 'vec2Id', 'v')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在自由演示台创建两个向量并添加加法运算。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于向量概念、坐标表示、加减法、数乘、点积、分解、空间向量、叉积、立体几何或自由演示台。',
      '典型教学场景优先使用 loadTeachingScenario 或 loadVectorPreset；局部修改使用具体 set operation。',
      '每个可见目标必须映射为确定 operation；例如设置点积投影时不要遗漏 showProjection。',
      '二维与三维向量不要混用；空间向量、叉积和立体几何使用 setVector3D。',
      '派生几何量由 M06 计算；AI 只输出输入向量、系数、显示项和预设引用。',
      '自由演示台只通过 clearDemoStage、addDemoVector、addDemoVectorOperation 搭建，不要手写 demo 实体树。',
      '更新、删除、绑定自由演示台对象时使用 updateDemoVector、scaleDemoVector、deleteDemoEntity、bindDemoEndpoints 和 unbindDemoEndpoint。',
      '点积、基底分解、叉积和多向量首尾相接可优先使用一站式 demo operation，减少多步组合错误。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'm06';
