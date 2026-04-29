UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5177/m03',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'm03',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '解析几何画板，支持通过结构化 operations 创建和修改圆锥曲线、直线、隐式曲线，调整显示项、视窗、样式，以及轨迹和光学演示配置。',
    'supportedIntents', JSON_ARRAY(
      'add-conic',
      'update-conic',
      'add-line',
      'update-line',
      'add-implicit-curve',
      'set-display-options',
      'set-viewport',
      'adjust-entity-style',
      'load-preset-scene',
      'set-locus-demo',
      'set-optical-demo',
      'pin-conic-point',
      'pin-line-conic-intersections',
      'add-movable-point',
      'add-conic-tangent-line',
      'add-conic-normal-line',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'addConic',
        'description', '新增圆锥曲线。payload: { conicType: "ellipse"|"hyperbola"|"parabola"|"circle", params?: object, label?: string, color?: string }。ellipse params: {a,b,cx?,cy?}; hyperbola params: {a,b,cx?,cy?}; parabola params: {p,cx?,cy?,orientation?: "h"|"v"}; circle params: {r,cx?,cy?}。',
        'payloadSchema', JSON_OBJECT(
          'conicType', JSON_OBJECT('type', 'string'),
          'entityType', JSON_OBJECT('type', 'string'),
          'params', JSON_OBJECT('type', 'object'),
          'label', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求生成椭圆、双曲线、抛物线或圆。',
        'doNotUseWhen', '修改已有圆锥曲线时使用 updateConicParams；切换到预设场景时使用 loadPresetConicScene。'
      ),
      JSON_OBJECT(
        'type', 'updateConicParams',
        'description', '修改已有圆锥曲线参数。payload: { entityId?: string, label?: string, params: object }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'fromLabel', JSON_OBJECT('type', 'string'),
          'params', JSON_OBJECT('type', 'object')
        ),
        'useWhen', '用户要求把已有椭圆/双曲线/抛物线/圆的 a、b、p、r 或中心参数改掉。',
        'doNotUseWhen', '目标实体不存在或不明确时返回 warnings，不要猜。'
      ),
      JSON_OBJECT(
        'type', 'addLine',
        'description', '新增直线。payload: { params: { vertical?: boolean, k?: number, b?: number, x?: number }, label?: string, color?: string }。非竖直线使用 y=kx+b；竖直线使用 x=常数。',
        'payloadSchema', JSON_OBJECT(
          'params', JSON_OBJECT('type', 'object'),
          'label', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求添加直线、准线、辅助线或形如 y=kx+b / x=c 的线。',
        'doNotUseWhen', '修改已有直线时使用 updateLine。'
      ),
      JSON_OBJECT(
        'type', 'updateLine',
        'description', '修改已有直线。payload: { entityId?: string, label?: string, params: { vertical?: boolean, k?: number, b?: number, x?: number } }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'fromLabel', JSON_OBJECT('type', 'string'),
          'params', JSON_OBJECT('type', 'object')
        ),
        'useWhen', '用户要求修改已有直线斜率、截距或竖直线位置。',
        'doNotUseWhen', '目标实体不是直线或不明确时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'addImplicitCurve',
        'description', '新增隐式曲线。payload: { expression: string, label?: string, color?: string }。表达式只写数学关系，例如 x^2 + y^2 - 25 = 0 或 x^2 + y^2 - 25。',
        'payloadSchema', JSON_OBJECT(
          'expression', JSON_OBJECT('type', 'string'),
          'exprStr', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求创建无法用标准圆锥曲线参数表达的隐式曲线。',
        'doNotUseWhen', '标准圆锥曲线优先使用 addConic。'
      ),
      JSON_OBJECT(
        'type', 'updateImplicitCurve',
        'description', '修改已有隐式曲线表达式。payload: { entityId?: string, label?: string, expression: string }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'fromLabel', JSON_OBJECT('type', 'string'),
          'expression', JSON_OBJECT('type', 'string'),
          'exprStr', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求把已有隐式曲线改为另一个表达式。',
        'doNotUseWhen', '目标实体不是隐式曲线或不明确时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'setDisplayOptions',
        'description', '切换显示项。payload 可包含 showGrid、showFoci、showDirectrices、showAsymptotes、showLabels、showIntersections、showVertices、showAxesOfSymmetry、showTangent、showNormal、showFocalChord。',
        'payloadSchema', JSON_OBJECT(
          'showGrid', JSON_OBJECT('type', 'boolean'),
          'showFoci', JSON_OBJECT('type', 'boolean'),
          'showDirectrices', JSON_OBJECT('type', 'boolean'),
          'showAsymptotes', JSON_OBJECT('type', 'boolean'),
          'showLabels', JSON_OBJECT('type', 'boolean'),
          'showIntersections', JSON_OBJECT('type', 'boolean'),
          'showVertices', JSON_OBJECT('type', 'boolean'),
          'showAxesOfSymmetry', JSON_OBJECT('type', 'boolean'),
          'showTangent', JSON_OBJECT('type', 'boolean'),
          'showNormal', JSON_OBJECT('type', 'boolean'),
          'showFocalChord', JSON_OBJECT('type', 'boolean')
        ),
        'useWhen', '用户要求显示/隐藏焦点、准线、渐近线、交点、顶点、对称轴、切线、法线或网格标签等辅助信息。',
        'doNotUseWhen', '不要用它修改实体参数。'
      ),
      JSON_OBJECT(
        'type', 'setViewport',
        'description', '设置坐标视窗。payload: { xMin: number, xMax: number, yMin: number, yMax: number }。',
        'payloadSchema', JSON_OBJECT(
          'xMin', JSON_OBJECT('type', 'number'),
          'xMax', JSON_OBJECT('type', 'number'),
          'yMin', JSON_OBJECT('type', 'number'),
          'yMax', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求调整坐标范围、放大/缩小观察区或指定显示区间。',
        'doNotUseWhen', '不要用它修改实体本身。'
      ),
      JSON_OBJECT(
        'type', 'setActiveEntity',
        'description', '设置当前激活实体。payload: { entityId?: string, label?: string }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求选中某个已有实体或后续面板聚焦该实体。',
        'doNotUseWhen', '目标实体不存在或不明确时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'setEntityStyle',
        'description', '设置已有实体样式。payload: { entityId?: string, label?: string, color?: string, visible?: boolean, newLabel?: string }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string'),
          'visible', JSON_OBJECT('type', 'boolean'),
          'newLabel', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求把某个圆锥曲线、直线或隐式曲线改颜色、隐藏/显示或改标签。',
        'doNotUseWhen', '修改参数或表达式时使用对应 update operation。'
      ),
      JSON_OBJECT(
        'type', 'loadPresetConicScene',
        'description', '载入一个预设圆锥曲线场景并替换当前实体。payload: { presetId: "standard-ellipse"|"standard-hyperbola"|"standard-parabola"|"standard-circle" }。',
        'payloadSchema', JSON_OBJECT(
          'presetId', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求切换到某个标准预设、只保留某种圆锥曲线、重新开始演示某个典型场景。',
        'doNotUseWhen', '用户说新增/再添加时使用 addConic，不要替换现有实体。'
      ),
      JSON_OBJECT(
        'type', 'setLocusDemo',
        'description', '配置轨迹演示。payload: { entityId?: string, label?: string, preset: "sum-of-distances"|"focus-directrix" }。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'preset', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求演示椭圆到两焦点距离和、抛物线焦点准线性质或轨迹生成。',
        'doNotUseWhen', '目标圆锥曲线不存在或不明确时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'setOpticalDemo',
        'description', '配置光学演示。payload: { enabled: boolean, rayCount?: number }。',
        'payloadSchema', JSON_OBJECT(
          'enabled', JSON_OBJECT('type', 'boolean'),
          'rayCount', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求开启/关闭椭圆或抛物线的光学反射演示，或调整光线数量。',
        'doNotUseWhen', '不要用它创建曲线；曲线缺失时先通过 addConic 创建。'
      ),
      JSON_OBJECT(
        'type', 'pinConicPoint',
        'description', '在已有圆锥曲线的确定位置钉住一个点。payload: { entityId?: string, label?: string, pointKind?: "rightVertex"|"leftVertex"|"topVertex"|"bottomVertex"|"vertex", t?: number }。坐标由 M03 根据圆锥曲线计算。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'entityLabel', JSON_OBJECT('type', 'string'),
          'pointKind', JSON_OBJECT('type', 'string'),
          'point', JSON_OBJECT('type', 'string'),
          't', JSON_OBJECT('type', 'number')
        ),
        'useWhen', '用户要求在椭圆、双曲线、抛物线或圆上标记顶点、端点或某个参数位置点。',
        'doNotUseWhen', '标记直线与圆锥曲线交点时使用 pinLineConicIntersections；不要手写派生坐标。'
      ),
      JSON_OBJECT(
        'type', 'pinLineConicIntersections',
        'description', '钉住已有直线与已有圆锥曲线的交点。payload: { lineId?: string, lineLabel?: string, conicId?: string, conicLabel?: string, which?: "all"|"first"|"second" }。交点由 M03 计算。',
        'payloadSchema', JSON_OBJECT(
          'lineId', JSON_OBJECT('type', 'string'),
          'lineLabel', JSON_OBJECT('type', 'string'),
          'conicId', JSON_OBJECT('type', 'string'),
          'conicLabel', JSON_OBJECT('type', 'string'),
          'which', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求标出、显示或钉住直线与椭圆/双曲线/抛物线/圆的交点。',
        'doNotUseWhen', '只切换全局交点显示时使用 setDisplayOptions。'
      ),
      JSON_OBJECT(
        'type', 'addMovablePoint',
        'description', '在已有圆锥曲线上新增动点。payload: { entityId?: string, label?: string, entityLabel?: string, t?: number, pointKind?: string, pointLabel?: string, showTrajectory?: boolean, showProjections?: boolean, color?: string }。点坐标由 M03 计算。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'entityLabel', JSON_OBJECT('type', 'string'),
          't', JSON_OBJECT('type', 'number'),
          'pointKind', JSON_OBJECT('type', 'string'),
          'pointLabel', JSON_OBJECT('type', 'string'),
          'showTrajectory', JSON_OBJECT('type', 'boolean'),
          'showProjections', JSON_OBJECT('type', 'boolean'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求在圆锥曲线上添加可移动点、观察点运动轨迹或投影。',
        'doNotUseWhen', '仅静态标记一个点时使用 pinConicPoint。'
      ),
      JSON_OBJECT(
        'type', 'addConicTangentLine',
        'description', '在已有圆锥曲线指定位置添加切线。payload: { entityId?: string, label?: string, entityLabel?: string, t?: number, pointKind?: string, lineLabel?: string, color?: string }。切线参数由 M03 计算。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'entityLabel', JSON_OBJECT('type', 'string'),
          't', JSON_OBJECT('type', 'number'),
          'pointKind', JSON_OBJECT('type', 'string'),
          'lineLabel', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求在椭圆、双曲线、抛物线或圆某点作切线。',
        'doNotUseWhen', '作法线时使用 addConicNormalLine；不要手写直线斜率。'
      ),
      JSON_OBJECT(
        'type', 'addConicNormalLine',
        'description', '在已有圆锥曲线指定位置添加法线。payload: { entityId?: string, label?: string, entityLabel?: string, t?: number, pointKind?: string, lineLabel?: string, color?: string }。法线参数由 M03 计算。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string'),
          'entityLabel', JSON_OBJECT('type', 'string'),
          't', JSON_OBJECT('type', 'number'),
          'pointKind', JSON_OBJECT('type', 'string'),
          'lineLabel', JSON_OBJECT('type', 'string'),
          'color', JSON_OBJECT('type', 'string')
        ),
        'useWhen', '用户要求在圆锥曲线某点作法线。',
        'doNotUseWhen', '作切线时使用 addConicTangentLine；不要手写直线斜率。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'm03', JSON_OBJECT(
        'type', 'object',
        'description', 'M03 解析几何画板快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'entity', JSON_OBJECT(
            'type', 'object',
            'description', '实体列表、激活实体、视窗和显示项。AI 不应直接新增实体对象，应使用 operations。',
            'risk', 'high'
          ),
          'interaction', JSON_OBJECT(
            'type', 'object',
            'description', '用户钉住的点、交点和动点。AI 可通过 pinConicPoint、pinLineConicIntersections 和 addMovablePoint 创建这些结构。',
            'risk', 'high'
          ),
          'locus', JSON_OBJECT(
            'type', 'object',
            'description', '轨迹演示配置。AI 可通过 setLocusDemo 配置预设和目标实体。',
            'risk', 'high'
          ),
          'optical', JSON_OBJECT(
            'type', 'object',
            'description', '光学演示配置。AI 可通过 setOpticalDemo 配置开关和光线数量。',
            'risk', 'high'
          )
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 entities、interaction、locus 或 optical 实体树。',
      'M03 只处理解析几何画板，不要输出 M02/M04 相关 payload 或 operation。',
      '圆锥曲线焦点、准线、渐近线、交点、顶点等派生量由 M03 计算；AI 不应手写派生坐标或采样数据。',
      '引用已有实体时必须基于 aiContext.availableEntityLabels 或 entity id；实体缺失或歧义时返回 warnings，不要同时输出依赖该实体的 operation。',
      '当前最多支持 12 个实体；达到上限时不要继续新增实体。',
      '用户说生成/添加/再加时默认新增实体；用户说切换/换成/只保留/预设时使用 loadPresetConicScene 替换当前场景。',
      '点、交点、切线、法线和动点必须通过对应 operations 创建；AI 不应直接手写 interaction 或 movable point 实体树。',
      '隐式曲线表达式只写数学表达式，不写 JS 代码，不写采样点。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '生成一个长半轴 5、短半轴 3 的椭圆。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addConic',
            'conicType', 'ellipse',
            'params', JSON_OBJECT('a', 5, 'b', 3, 'cx', 0, 'cy', 0),
            'label', '椭圆'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建标准椭圆。'
      ),
      JSON_OBJECT(
        'instruction', '生成抛物线 y^2=4x，并显示焦点和准线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addConic',
            'conicType', 'parabola',
            'params', JSON_OBJECT('p', 1, 'cx', 0, 'cy', 0, 'orientation', 'h'),
            'label', '抛物线'
          ),
          JSON_OBJECT(
            'type', 'setDisplayOptions',
            'showFoci', CAST('true' AS JSON),
            'showDirectrices', CAST('true' AS JSON)
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建抛物线并显示焦点和准线。'
      ),
      JSON_OBJECT(
        'instruction', '添加直线 y=x+1。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addLine',
            'params', JSON_OBJECT('vertical', CAST('false' AS JSON), 'k', 1, 'b', 1),
            'label', 'l'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已添加直线。'
      ),
      JSON_OBJECT(
        'instruction', '显示双曲线的渐近线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setDisplayOptions',
            'showAsymptotes', CAST('true' AS JSON)
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已开启渐近线显示。'
      ),
      JSON_OBJECT(
        'instruction', '添加隐式曲线 x^2+y^2-25=0。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addImplicitCurve',
            'expression', 'x^2 + y^2 - 25 = 0',
            'label', '隐式圆'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已添加隐式曲线。'
      ),
      JSON_OBJECT(
        'instruction', '开启光学演示，光线数量设为 10。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setOpticalDemo',
            'enabled', CAST('true' AS JSON),
            'rayCount', 10
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已开启光学演示并设置光线数量。'
      ),
      JSON_OBJECT(
        'instruction', '在椭圆右顶点标记一个点。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'pinConicPoint',
            'label', '椭圆',
            'pointKind', 'rightVertex'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在椭圆右顶点添加标记点。'
      ),
      JSON_OBJECT(
        'instruction', '标出直线 l 和椭圆的两个交点。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'pinLineConicIntersections',
            'lineLabel', 'l',
            'conicLabel', '椭圆',
            'which', 'all'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已标出直线与椭圆的交点，坐标由 M03 自动计算。'
      ),
      JSON_OBJECT(
        'instruction', '在椭圆上添加一个动点 P，并显示投影。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addMovablePoint',
            'label', '椭圆',
            'pointLabel', 'P',
            't', 0.2,
            'showProjections', CAST('true' AS JSON)
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在椭圆上添加动点 P 并开启投影显示。'
      ),
      JSON_OBJECT(
        'instruction', '在椭圆右顶点作切线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addConicTangentLine',
            'label', '椭圆',
            'pointKind', 'rightVertex',
            'lineLabel', '切线'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在椭圆右顶点添加切线，直线参数由 M03 自动计算。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先识别所有可见目标，包括圆锥曲线、直线、隐式曲线、显示项、视窗、样式、轨迹和光学演示。',
      '每个可见目标必须映射为一个确定性 operation；不要只创建曲线而遗漏焦点、准线、渐近线或视窗调整。',
      '引用已有实体前必须检查 aiContext.availableEntityLabels；缺失或歧义时返回 warnings。',
      '如果后续 operation 依赖本次新增实体，应让 addConic/addLine/addImplicitCurve 排在前面，并使用其 label 作为后续引用。',
      '标准圆锥曲线优先使用 addConic 和 params；复杂曲线使用 addImplicitCurve。',
      '派生几何量由 M03 计算；AI 只输出显示开关、目标实体引用、pointKind 或参数 t。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'm03';
