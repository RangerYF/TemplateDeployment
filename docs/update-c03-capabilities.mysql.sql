UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5192/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'c03',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '化学方程式配平器，支持通过结构化 operations 设置方程式、执行配平、展开配平步骤、载入典型方程式预设和清空历史记录。',
    'supportedIntents', JSON_ARRAY(
      'set-equation',
      'balance-equation',
      'reveal-steps',
      'load-equation-preset',
      'clear-history',
      'simplify-current-scene'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setEquation',
        'description', '设置输入框中的化学方程式。payload: { rawInput?: string, equation?: string, run?: boolean, balance?: boolean }。',
        'payloadSchema', JSON_OBJECT('rawInput', JSON_OBJECT('type', 'string'), 'equation', JSON_OBJECT('type', 'string'), 'input', JSON_OBJECT('type', 'string'), 'run', JSON_OBJECT('type', 'boolean'), 'balance', JSON_OBJECT('type', 'boolean')),
        'useWhen', '用户要求输入、替换或准备某个化学方程式但不一定立即配平。',
        'doNotUseWhen', '用户明确要求配平时优先使用 balanceEquation。'
      ),
      JSON_OBJECT(
        'type', 'balanceEquation',
        'description', '执行配平。payload 可包含 { rawInput?: string, equation?: string, input?: string }，不传则配平当前输入。',
        'payloadSchema', JSON_OBJECT('rawInput', JSON_OBJECT('type', 'string'), 'equation', JSON_OBJECT('type', 'string'), 'input', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求配平、校验守恒或查看结果。',
        'doNotUseWhen', '只想把内容放入输入框而不计算时使用 setEquation。'
      ),
      JSON_OBJECT(
        'type', 'revealSteps',
        'description', '展开配平步骤。payload: { count?: number, revealedStepCount?: number }。不传 count 时展开全部步骤。',
        'payloadSchema', JSON_OBJECT('count', JSON_OBJECT('type', 'number'), 'revealedStepCount', JSON_OBJECT('type', 'number')),
        'useWhen', '用户要求显示配平过程、下一步或完整步骤讲解。',
        'doNotUseWhen', '当前方程式尚未设置且用户只要求输入方程式时不要单独使用。'
      ),
      JSON_OBJECT(
        'type', 'loadEquationPreset',
        'description', '载入典型方程式预设并配平。payload: { presetId: "combustion"|"synthesis"|"decomposition"|"replacement"|"neutralization"|"redox"|"ionic"|"carbonate" }。',
        'payloadSchema', JSON_OBJECT('presetId', JSON_OBJECT('type', 'string'), 'id', JSON_OBJECT('type', 'string')),
        'useWhen', '用户要求演示燃烧、化合、分解、置换、中和、氧化还原、离子或碳酸盐反应等典型例子。',
        'doNotUseWhen', '用户给出具体方程式时使用 balanceEquation。'
      ),
      JSON_OBJECT(
        'type', 'clearHistory',
        'description', '清空历史记录。payload: {}。',
        'payloadSchema', JSON_OBJECT(),
        'useWhen', '用户要求清空历史记录或重置历史列表。',
        'doNotUseWhen', '不要用它清空当前输入或结果。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'c03', JSON_OBJECT(
        'type', 'object',
        'description', 'C03 化学方程式配平器快照。结构性搭建优先使用 operations；patch 只作为低风险兜底。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'editor', JSON_OBJECT('type', 'object', 'description', '当前输入和运行状态。AI 应通过 setEquation 或 balanceEquation 修改。', 'risk', 'high'),
          'ui', JSON_OBJECT('type', 'object', 'description', '配平步骤展开数量。AI 应通过 revealSteps 修改。', 'risk', 'low'),
          'preferences', JSON_OBJECT('type', 'object', 'description', '快捷输入组。AI 一般不直接修改。', 'risk', 'high'),
          'history', JSON_OBJECT('type', 'object', 'description', '历史记录。AI 可通过 clearHistory 清空，不应手写历史项。', 'risk', 'low')
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要直接手写 editor、ui、preferences 或 history 状态树。',
      'C03 只处理化学方程式配平，不要输出 C04/C07/C09/C02/C05/C06/M 系列相关 payload 或 operation。',
      '配平系数、原子守恒、电荷守恒、错误定位和步骤内容由 C03 解析器与配平器生成；AI 不应编造配平结果。',
      '用户给出具体方程式时必须原样交给 balanceEquation，不要自行改写反应物或生成物。',
      '离子方程式可使用 H+、OH-、Fe3+、SO42- 等电荷后缀；电荷守恒由 C03 自动校验。',
      'operations 必须最小充分；单个 operation 可满足时不要额外添加操作。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '配平 H2 + O2 = H2O。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'balanceEquation', 'rawInput', 'H2 + O2 = H2O')),
        'patch', JSON_OBJECT(),
        'explanation', '已将方程式交给 C03 配平并展示守恒校验。'
      ),
      JSON_OBJECT(
        'instruction', '演示一个燃烧反应配平。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'loadEquationPreset', 'presetId', 'combustion')),
        'patch', JSON_OBJECT(),
        'explanation', '已载入甲烷燃烧方程式并执行配平。'
      ),
      JSON_OBJECT(
        'instruction', '展开完整配平步骤。',
        'operations', JSON_ARRAY(JSON_OBJECT('type', 'revealSteps')),
        'patch', JSON_OBJECT(),
        'explanation', '已展开当前方程式的完整配平过程。'
      ),
      JSON_OBJECT(
        'instruction', '配平 Fe3+ + OH- = Fe(OH)3，并显示步骤。',
        'operations', JSON_ARRAY(
          JSON_OBJECT('type', 'balanceEquation', 'rawInput', 'Fe3+ + OH- = Fe(OH)3'),
          JSON_OBJECT('type', 'revealSteps')
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已配平离子方程式并展开步骤，电荷守恒由 C03 校验。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先判断用户目标属于输入方程式、执行配平、展开步骤、载入典型预设还是清空历史。',
      '用户明确要求配平时使用 balanceEquation；用户只要求准备输入时使用 setEquation。',
      '用户要求讲解过程、显示步骤、一步步看时使用 revealSteps。',
      '典型课堂例子优先使用 loadEquationPreset；用户给出具体方程式时不要替换成预设。',
      '涉及配平系数、守恒表和错误原因时只输出输入控制项，结果由 C03 计算。',
      '不要根据测试集个例添加多余操作，保持 operations 最小充分。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'c03';
