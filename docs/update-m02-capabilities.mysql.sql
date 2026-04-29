UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5177/m02',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'm02',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '函数图像实验室，支持通过结构化 operations 创建和修改函数图像、分段函数、参数变换、视窗、导数/特征点/切线显示、样式和参数动画配置。',
    'supportedIntents', JSON_ARRAY(
      'add-function',
      'update-function',
      'add-piecewise-function',
      'set-viewport',
      'adjust-function-transform',
      'show-derivative',
      'show-feature-points',
      'add-tangent',
      'adjust-function-style',
      'set-param-animation',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'addFunction',
        'description', '新增标准函数或模板函数。payload: { expression?: string, templateId?: "linear"|"quadratic"|"cubic"|"sine"|"cosine"|"exponential"|"logarithm"|"power", label?: string, params?: object, transform?: {a?,b?,h?,k?}, color?: string }。',
        'payloadSchema', JSON_OBJECT(
          'expression', JSON_OBJECT(
            'type', 'string'
          ),
          'templateId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'params', JSON_OBJECT(
            'type', 'object'
          ),
          'transform', JSON_OBJECT(
            'type', 'object'
          ),
          'color', JSON_OBJECT(
            'type', 'string'
          ),
          'visible', JSON_OBJECT(
            'type', 'boolean'
          )
        ),
        'useWhen', '用户要求生成一次函数、二次函数、三角函数、指数/对数/幂函数或自定义表达式图像。',
        'doNotUseWhen', '修改已有函数时使用 updateFunction；创建分段函数时使用 addPiecewiseFunction。'
      ),
      JSON_OBJECT(
        'type', 'updateFunction',
        'description', '修改已有函数。payload: { functionId?: string, fromLabel?: string, expression?: string, params?: object, transform?: {a?,b?,h?,k?}, visible?: boolean, color?: string, newLabel?: string }。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'fromLabel', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'expression', JSON_OBJECT(
            'type', 'string'
          ),
          'params', JSON_OBJECT(
            'type', 'object'
          ),
          'transform', JSON_OBJECT(
            'type', 'object'
          ),
          'visible', JSON_OBJECT(
            'type', 'boolean'
          ),
          'color', JSON_OBJECT(
            'type', 'string'
          ),
          'newLabel', JSON_OBJECT(
            'type', 'string'
          )
        ),
        'useWhen', '用户要求把已有函数改成某表达式、调整模板参数、平移伸缩、改颜色/标签/显隐。',
        'doNotUseWhen', '目标函数不存在或不明确时返回 warnings，不要猜。'
      ),
      JSON_OBJECT(
        'type', 'addPiecewiseFunction',
        'description', '新增分段函数。payload: { label?: string, segments: [{ expression: string, xMin: number|null, xMax: number|null, xMinInclusive?: boolean, xMaxInclusive?: boolean }], color?: string }。',
        'payloadSchema', JSON_OBJECT(
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'segments', JSON_OBJECT(
            'type', 'array'
          ),
          'color', JSON_OBJECT(
            'type', 'string'
          )
        ),
        'useWhen', '用户明确要求创建分段函数并给出各段表达式和定义域。',
        'doNotUseWhen', '缺少分段表达式或定义域边界含糊时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'setViewport',
        'description', '设置坐标视窗。payload: { xMin: number, xMax: number, yMin: number, yMax: number }。',
        'payloadSchema', JSON_OBJECT(
          'xMin', JSON_OBJECT(
            'type', 'number'
          ),
          'xMax', JSON_OBJECT(
            'type', 'number'
          ),
          'yMin', JSON_OBJECT(
            'type', 'number'
          ),
          'yMax', JSON_OBJECT(
            'type', 'number'
          )
        ),
        'useWhen', '用户要求调整坐标范围、放大/缩小观察区或指定显示区间。',
        'doNotUseWhen', '不要用它修改函数本身。'
      ),
      JSON_OBJECT(
        'type', 'setFeatureFlags',
        'description', '切换显示特征。payload: { showDerivative?: boolean, showFeaturePoints?: boolean, showGrid?: boolean, showAxisLabels?: boolean, showTangent?: boolean }。',
        'payloadSchema', JSON_OBJECT(
          'showDerivative', JSON_OBJECT(
            'type', 'boolean'
          ),
          'showFeaturePoints', JSON_OBJECT(
            'type', 'boolean'
          ),
          'showGrid', JSON_OBJECT(
            'type', 'boolean'
          ),
          'showAxisLabels', JSON_OBJECT(
            'type', 'boolean'
          ),
          'showTangent', JSON_OBJECT(
            'type', 'boolean'
          )
        ),
        'useWhen', '用户要求显示/隐藏导函数、零点极值等特征点、网格、坐标轴或切线状态。',
        'doNotUseWhen', '指定切点横坐标时使用 setTangentAtX。'
      ),
      JSON_OBJECT(
        'type', 'setTangentAtX',
        'description', '在已有标准函数指定 x 处显示切线点和斜率。payload: { functionId?: string, label?: string, x: number }。函数值和斜率由 M02 计算。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'x', JSON_OBJECT(
            'type', 'number'
          )
        ),
        'useWhen', '用户要求在某函数 x=a 处作切线或观察切线。',
        'doNotUseWhen', '不要手写 tangentY 或 tangentSlope；目标函数缺失时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'addTangentFunction',
        'description', '把已有函数某点切线新增为一条函数曲线。payload: { functionId?: string, label?: string, x: number, tangentLabel?: string, color?: string }。切线表达式由 M02 计算。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'x', JSON_OBJECT(
            'type', 'number'
          ),
          'tangentLabel', JSON_OBJECT(
            'type', 'string'
          ),
          'color', JSON_OBJECT(
            'type', 'string'
          )
        ),
        'useWhen', '用户明确要求画出/添加一条切线函数。',
        'doNotUseWhen', '仅显示当前切线状态时使用 setTangentAtX。'
      ),
      JSON_OBJECT(
        'type', 'setActiveFunction',
        'description', '设置当前激活函数。payload: { functionId?: string, label?: string }。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          )
        ),
        'useWhen', '用户要求选中某个已有函数或后续面板聚焦该函数。',
        'doNotUseWhen', '目标函数不存在或不明确时返回 warnings。'
      ),
      JSON_OBJECT(
        'type', 'setFunctionStyle',
        'description', '设置已有函数样式。payload: { functionId?: string, label?: string, color?: string, visible?: boolean, newLabel?: string }。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'color', JSON_OBJECT(
            'type', 'string'
          ),
          'visible', JSON_OBJECT(
            'type', 'boolean'
          ),
          'newLabel', JSON_OBJECT(
            'type', 'string'
          )
        ),
        'useWhen', '用户要求把某函数改颜色、隐藏/显示或改标签。',
        'doNotUseWhen', '修改表达式或参数时使用 updateFunction。'
      ),
      JSON_OBJECT(
        'type', 'setParamAnimation',
        'description', '配置参数动画但不自动播放。payload: { functionId?: string, label?: string, params: [{ key: string, from: number, to: number, enabled?: boolean }], duration?: number, easing?: string, loop?: boolean }。key 支持 transform.a/b/h/k 或 named.xxx。',
        'payloadSchema', JSON_OBJECT(
          'functionId', JSON_OBJECT(
            'type', 'string'
          ),
          'label', JSON_OBJECT(
            'type', 'string'
          ),
          'params', JSON_OBJECT(
            'type', 'array'
          ),
          'duration', JSON_OBJECT(
            'type', 'number'
          ),
          'easing', JSON_OBJECT(
            'type', 'string'
          ),
          'loop', JSON_OBJECT(
            'type', 'boolean'
          )
        ),
        'useWhen', '用户要求演示参数变化，例如振幅从 1 到 3、平移量变化。',
        'doNotUseWhen', '不要开启播放态或录制态。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'm02', JSON_OBJECT(
        'type', 'object',
        'description', 'M02 函数图像实验室快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'function', JSON_OBJECT(
            'type', 'object',
            'description', '函数列表、激活函数、视窗和显示特征。AI 不应直接新增函数对象，应使用 operations。',
            'risk', 'high'
          ),
          'interaction', JSON_OBJECT(
            'type', 'object',
            'description', '用户钉住的函数点和交点。第一阶段 AI 不主动创建这些标记。',
            'risk', 'high'
          ),
          'paramAnimation', JSON_OBJECT(
            'type', 'object',
            'description', '参数动画配置。AI 可通过 setParamAnimation 配置参数、时长、缓动和循环。',
            'risk', 'high'
          )
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 functions、segments、interaction 或 paramAnimation 实体树。',
      'M02 只处理函数图像实验室，不要输出 M03/M04 相关 payload 或 operation。',
      '新增或修改表达式必须交给 M02 校验；AI 不应手写采样点、函数值、导数值、切线斜率或切点 y 值。',
      '引用已有函数时必须基于 aiContext.availableFunctionLabels 或 function id；函数缺失或歧义时返回 warnings，不要同时输出依赖该函数的 operation。',
      '当前最多支持 8 个函数；达到上限时不要继续新增函数。',
      '切线需求优先使用 setTangentAtX 或 addTangentFunction，只提供目标函数和 x 坐标。',
      '参数动画只配置参数，不要设置 playing 或 recordEnabled。',
      '分段函数必须包含每段表达式和定义域边界；缺失时返回 warnings，不要自动编造定义域。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '生成函数 y = x^2 - 2x + 1，并显示特征点。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addFunction',
            'expression', 'x^2 - 2*x + 1',
            'label', 'f(x)'
          ),
          JSON_OBJECT(
            'type', 'setFeatureFlags',
            'showFeaturePoints', CAST('true' AS JSON)
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建二次函数并开启特征点显示。'
      ),
      JSON_OBJECT(
        'instruction', '生成一个振幅为 2、角频率为 0.5 的正弦函数。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addFunction',
            'templateId', 'sine',
            'params', JSON_OBJECT(
              'A', 2,
              'omega', 0.5
            ),
            'label', 'f(x)'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建正弦函数并设置振幅和角频率。'
      ),
      JSON_OBJECT(
        'instruction', '把 f(x) 向右平移 2 个单位、向上平移 1 个单位。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'updateFunction',
            'fromLabel', 'f(x)',
            'transform', JSON_OBJECT(
              'h', 2,
              'k', 1
            )
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已更新 f(x) 的平移参数。'
      ),
      JSON_OBJECT(
        'instruction', '在 f(x) 的 x=1 处显示切线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setTangentAtX',
            'label', 'f(x)',
            'x', 1
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在 f(x) 的 x=1 处显示切线，切点和斜率由 M02 自动计算。'
      ),
      JSON_OBJECT(
        'instruction', '创建分段函数：x<0 时 y=-x，x>=0 时 y=x。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addPiecewiseFunction',
            'label', 'f(x)',
            'segments', JSON_ARRAY(
              JSON_OBJECT(
                'expression', '-x',
                'xMin', NULL,
                'xMax', 0,
                'xMinInclusive', CAST('false' AS JSON),
                'xMaxInclusive', CAST('false' AS JSON)
              ),
              JSON_OBJECT(
                'expression', 'x',
                'xMin', 0,
                'xMax', NULL,
                'xMinInclusive', CAST('true' AS JSON),
                'xMaxInclusive', CAST('false' AS JSON)
              )
            )
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建两段的绝对值函数分段图像。'
      ),
      JSON_OBJECT(
        'instruction', '把视窗调整为 x 从 -5 到 5，y 从 -3 到 3。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setViewport',
            'xMin', -5,
            'xMax', 5,
            'yMin', -3,
            'yMax', 3
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已调整坐标视窗。'
      ),
      JSON_OBJECT(
        'instruction', '让 f(x) 的振幅从 1 动画变化到 3。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setParamAnimation',
            'label', 'f(x)',
            'params', JSON_ARRAY(
              JSON_OBJECT(
                'key', 'named.A',
                'from', 1,
                'to', 3
              )
            ),
            'duration', 2000,
            'easing', 'easeInOut',
            'loop', CAST('true' AS JSON)
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已配置振幅参数动画，未自动开始播放。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先识别所有可见目标，包括函数、分段、参数、视窗、导数/特征点、切线、样式和动画。',
      '每个可见目标必须映射为一个确定性 operation；不要只创建函数而遗漏显示导数、切线或视窗调整。',
      '引用已有函数前必须检查 aiContext.availableFunctionLabels；缺失或歧义时返回 warnings。',
      '如果后续 operation 依赖本次新增函数，应让 addFunction 排在前面，并使用其 label 作为后续引用。',
      '表达式只写数学表达式，不写 JS 代码，不写采样数据。',
      '模板函数优先用 templateId 和 params；复杂或非模板函数使用 expression。',
      '导数和切线数值由 M02 计算；AI 只输出显示开关或切线 x 坐标。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'm02';
