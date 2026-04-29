UPDATE visual_template_definitions
SET
  entry_url = 'http://localhost:5175/',
  capabilities = JSON_OBJECT(
    '$schema', '../schemas/ai-capability.schema.json',
    'templateKey', 'm01',
    'aiLevel', 'L2',
    'supportsAiBuild', CAST('true' AS JSON),
    'description', '立体几何展示台，支持通过结构性原语创建或切换基础几何体、载入预置题图、按点名添加辅助线/边上点/截面，并调整实体显示、点标签和线段样式。',
    'supportedIntents', JSON_ARRAY(
      'build-demo',
      'set-geometry',
      'load-preset-scene',
      'add-helper-segment',
      'add-point-on-edge',
      'add-cross-section',
      'adjust-scene-style',
      'highlight-existing-entities',
      'label-existing-points',
      'simplify-current-scene',
      'add-midpoint',
      'add-center-point',
      'add-face-center-point',
      'add-auxiliary-face',
      'add-circumsphere',
      'add-distance-measurement',
      'add-angle-measurement'
    ),
    'operations', JSON_ARRAY(
      JSON_OBJECT(
        'type', 'setGeometry',
        'description', '创建或切换当前主几何体。适合用户要求生成球体、正方体、圆柱、圆锥、长方体、棱柱、棱锥等基础主体。',
        'geometryTypes', JSON_ARRAY(
          'cube',
          'cuboid',
          'sphere',
          'cylinder',
          'cone',
          'pyramid',
          'prism',
          'truncatedCone',
          'frustum',
          'regularTetrahedron',
          'cornerTetrahedron',
          'isoscelesTetrahedron',
          'orthogonalTetrahedron'
        ),
        'paramsByGeometryType', JSON_OBJECT(
          'sphere', JSON_OBJECT(
            'radius', 'number，半径，默认 1'
          ),
          'cube', JSON_OBJECT(
            'sideLength', 'number，棱长，默认 2'
          ),
          'cuboid', JSON_OBJECT(
            'length', 'number，长',
            'width', 'number，宽',
            'height', 'number，高'
          ),
          'cylinder', JSON_OBJECT(
            'radius', 'number，底面半径',
            'height', 'number，高'
          ),
          'cone', JSON_OBJECT(
            'radius', 'number，底面半径',
            'height', 'number，高'
          ),
          'pyramid', JSON_OBJECT(
            'sides', 'number，底面边数 3-8',
            'sideLength', 'number，底面边长',
            'height', 'number，高'
          ),
          'prism', JSON_OBJECT(
            'sides', 'number，底面边数 3-8',
            'sideLength', 'number，底面边长',
            'height', 'number，高'
          )
        ),
        'useWhen', '用户要求创建或切换基础几何体，例如球体、正方体、长方体、圆柱、圆锥、棱柱、棱锥等。',
        'payloadSchema', JSON_OBJECT(
          'geometryType', JSON_OBJECT('type', 'string'),
          'params', JSON_OBJECT('type', 'object')
        ),
        'doNotUseWhen', '用户只是在当前场景中添加辅助点、线、面、测量或修改样式时，不要重新 setGeometry。'
      ),
      JSON_OBJECT(
        'type', 'updateGeometryParams',
        'description', '在当前主几何体类型不变的前提下调整参数，例如把球半径改为 2、把正方体棱长改为 3。参数字段与 setGeometry.paramsByGeometryType 相同。',
        'useWhen', '当前主几何体类型不变，只调整半径、棱长、长宽高等参数。',
        'payloadSchema', JSON_OBJECT(
          'params', JSON_OBJECT('type', 'object')
        ),
        'doNotUseWhen', '切换几何体类型时使用 setGeometry。'
      ),
      JSON_OBJECT(
        'type', 'loadPresetScene',
        'description', '载入 M01 已内置的预置题图。适合用户给出常见专题需求时，直接进入更完整的球、截面、正方体、棱锥、棱柱等讲解场景。',
        'selectionGuidance', '只在用户明确匹配 presetScenes.useWhen 或要求“专题图/通用图/直接进入合适图”时使用；如果只是具体构图需求，优先输出 operation queue。',
        'presetScenes', JSON_ARRAY(
          JSON_OBJECT(
            'presetId', 'sphere-section-circle-area',
            'title', '球截面圆面积/半径关系',
            'useWhen', '用户明确要讲球被平面截得截面圆、截面圆面积、球半径与截面圆半径和球心距关系。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-section',
            'title', '正方体三点截面通用图',
            'useWhen', '用户要讲正方体截面、三点确定截面、截面多边形或截面辅助线，但没有给出具体题目时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-space-diagonal',
            'title', '正方体空间对角线通用图',
            'useWhen', '用户要讲正方体空间对角线、体对角线、面对角线、勾股关系或空间距离时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cuboid-parallel-section',
            'title', '长方体平行截面通用图',
            'useWhen', '用户要讲长方体平行截面、面面平行、截面形状或对应边平行时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-line-plane-perpendicular',
            'title', '正方体线面垂直通用图',
            'useWhen', '用户要讲线面垂直、侧棱垂直底面、点到平面距离或垂线段时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-plane-parallel',
            'title', '正方体面面平行通用图',
            'useWhen', '用户要讲面面平行、上下底面平行、对应棱平行或平行平面性质时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-pyramid-height',
            'title', '棱锥高线通用图',
            'useWhen', '用户要讲棱锥高线、顶点到底面的垂线、垂足或线面垂直关系时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-line-plane-angle',
            'title', '正方体线面角通用图',
            'useWhen', '用户要讲直线与平面所成角、斜线在平面内的投影、线面角正弦/余弦/正切关系时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-dihedral-angle',
            'title', '正方体二面角通用图',
            'useWhen', '用户要讲二面角、截面与底面夹角、公共棱或二面角平面角时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-skew-lines-angle',
            'title', '正方体异面直线夹角通用图',
            'useWhen', '用户要讲异面直线所成角、平移法、通过辅助线把异面问题转化为相交直线夹角时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-circumsphere',
            'title', '正方体外接球通用图',
            'useWhen', '用户要讲正方体外接球、球心位置、体对角线与外接球半径关系或外接球表面积/体积时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-pyramid-dihedral-angle',
            'title', '棱锥二面角通用图',
            'useWhen', '用户要讲棱锥侧面与底面的二面角、公共棱、二面角平面角或侧面倾斜关系时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-point-plane-distance-volume',
            'title', '点面距离等体积法通用图',
            'useWhen', '用户要讲点到平面的距离、等体积法、三棱锥换底求高或用体积关系求距离时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-pyramid-circumsphere',
            'title', '棱锥外接球通用图',
            'useWhen', '用户要讲三棱锥/四棱锥外接球、球心位置、顶点共球或棱锥外接球半径关系时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-prism-circumsphere',
            'title', '直棱柱外接球通用图',
            'useWhen', '用户要讲直棱柱外接球、底面外接圆、高的一半与外接球半径关系时使用。'
          ),
          JSON_OBJECT(
            'presetId', 'generic-cube-projection-area',
            'title', '正方体正投影面积通用图',
            'useWhen', '用户要讲正投影、投影面积、空间图形在平面上的投影或面积与夹角关系时使用。'
          )
        ),
        'presetIds', JSON_ARRAY(
          'sphere-section-circle-area',
          'generic-cube-section',
          'generic-cube-space-diagonal',
          'generic-cuboid-parallel-section',
          'generic-cube-line-plane-perpendicular',
          'generic-cube-plane-parallel',
          'generic-pyramid-height',
          'generic-cube-line-plane-angle',
          'generic-cube-dihedral-angle',
          'generic-cube-skew-lines-angle',
          'generic-cube-circumsphere',
          'generic-pyramid-dihedral-angle',
          'generic-point-plane-distance-volume',
          'generic-pyramid-circumsphere',
          'generic-prism-circumsphere',
          'generic-cube-projection-area'
        ),
        'useWhen', '教师明确要求专题讲解图、通用题图、直接进入合适图或匹配 presetScenes.useWhen 的专题场景。',
        'payloadSchema', JSON_OBJECT(
          'presetId', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '普通构图、生成基础几何体、按点名取点连线、标中心、作截面、添加距离角度时不要使用；这些应使用 operations。'
      ),
      JSON_OBJECT(
        'type', 'addSegmentByLabels',
        'description', '按已有点名连接一条辅助线段。payload: { labels: ["A", "C1"], style?: { color?: "#e74c3c", dashed?: boolean }, label?: string }。',
        'useWhen', '用户要求连接两个已有点、添加辅助线、对角线、高亮某条线段。',
        'requiredWhenUserSays', JSON_ARRAY(
          '连接 A 和 C1',
          '作 AC1',
          '添加辅助线',
          '画对角线'
        ),
        'payloadSchema', JSON_OBJECT(
          'labels', JSON_OBJECT('type', 'array'),
          'style', JSON_OBJECT('type', 'object'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '点名不存在时不要猜测；如果需要对缺失点名返回 warnings，不要同时输出依赖该点名的 addSegmentByLabels。线段样式修改已有线段时可使用 setStyle。'
      ),
      JSON_OBJECT(
        'type', 'addPointOnEdge',
        'description', '在已有两个顶点构成的棱上取点。payload: { edgeLabels: ["A", "B"], t?: number, label?: string }，t 从 0 到 1，0.5 表示中点。',
        'useWhen', '用户要求在已有边或两个已有端点之间按比例取点，例如在 AB 上取点。',
        'requiredWhenUserSays', JSON_ARRAY(
          '在 AB 上取点',
          '在棱 AB 上取一点',
          '在 AB 上取中点 M'
        ),
        'payloadSchema', JSON_OBJECT(
          'edgeLabels', JSON_OBJECT('type', 'array'),
          't', JSON_OBJECT('type', 'number'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '如果用户只说两个点的中点且不强调边约束，也可使用 addMidpointByLabels。'
      ),
      JSON_OBJECT(
        'type', 'addMidpointByLabels',
        'description', '按两个已有点名创建中点。payload: { labels: ["A", "B"], label?: "M" }。优先生成边约束点；如果不是顶点边关系但位置可计算，则生成自由中点。',
        'useWhen', '用户要求两个已有点的中点，或“取 AB 中点 M”。',
        'requiredWhenUserSays', JSON_ARRAY(
          '中点',
          'AB 的中点',
          '取中点 M'
        ),
        'payloadSchema', JSON_OBJECT(
          'labels', JSON_OBJECT('type', 'array'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '需要明确比例 t 或边上非中点时使用 addPointOnEdge。'
      ),
      JSON_OBJECT(
        'type', 'addCenterPoint',
        'description', '为当前主几何体创建中心点。payload: { label?: "O" }。中心坐标由 M01 根据当前几何体确定性计算，AI 不应手写坐标。',
        'useWhen', '用户要求当前主几何体的整体中心、球心、体心或几何体中心。',
        'requiredWhenUserSays', JSON_ARRAY(
          '几何体中心',
          '体心',
          '球心',
          '正方体中心'
        ),
        'payloadSchema', JSON_OBJECT(
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '用户要求底面中心、面 ABCD 的中心、侧面中心或截面中心时，必须使用 addFaceCenterPoint。'
      ),
      JSON_OBJECT(
        'type', 'addFaceCenterPoint',
        'description', '为指定面创建中心点。payload: { faceLabels?: ["A", "B", "C", "D"], entityIds?: [faceId], label?: "O1" }。优先使用 aiContext.faces 中的面 id 或点名集合。',
        'useWhen', '用户要求某个面、底面、侧面、截面或多边形面的中心点。',
        'requiredWhenUserSays', JSON_ARRAY(
          '底面中心',
          '面 ABCD 的中心',
          '正方形 ABCD 中心',
          '侧面中心',
          '截面中心',
          '在底面 ABCD 的中心标 O1'
        ),
        'payloadSchema', JSON_OBJECT(
          'faceLabels', JSON_OBJECT('type', 'array'),
          'entityIds', JSON_OBJECT('type', 'array'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '用户要求整个几何体中心、体心或球心时使用 addCenterPoint；如果指定面名或点名集合不存在，返回 warnings，不要同时输出 addFaceCenterPoint。'
      ),
      JSON_OBJECT(
        'type', 'addCircumsphere',
        'description', '为当前主几何体添加外接球。payload: {}。适合正方体、长方体、棱锥、棱柱等外接球专题；球体本身不需要添加外接球。',
        'useWhen', '用户要求为当前主几何体添加外接球、共球展示或外接球半径关系。',
        'requiredWhenUserSays', JSON_ARRAY(
          '外接球',
          '顶点共球',
          '添加外接球'
        ),
        'payloadSchema', JSON_OBJECT(),
        'doNotUseWhen', '用户明确要求进入外接球专题通用题图时可使用 loadPresetScene；球体本身不需要再添加外接球。'
      ),
      JSON_OBJECT(
        'type', 'addCrossSectionByLabels',
        'description', '用至少 3 个已有点名创建截面。payload: { labels: ["A", "C", "A1"] }。主要用于多面体场景，曲面体截面优先使用 loadPresetScene。',
        'useWhen', '用户给出至少 3 个已有点名并要求作截面。',
        'requiredWhenUserSays', JSON_ARRAY(
          '用 A、C、A1 三点作截面',
          '过三点作截面',
          '截面多边形'
        ),
        'payloadSchema', JSON_OBJECT(
          'labels', JSON_OBJECT('type', 'array')
        ),
        'doNotUseWhen', '用户只说“做个截面”但未给点名时返回 warnings；辅助平面展示用 addAuxiliaryFaceByLabels。曲面体复杂截面优先 preset。'
      ),
      JSON_OBJECT(
        'type', 'addAuxiliaryFaceByLabels',
        'description', '按已有点名创建辅助面片。payload: { labels: ["A", "C", "C1"] }。用于展示辅助平面、投影面或二面角相关面片；不应用于曲面体复杂截面。',
        'useWhen', '用户要求创建辅助平面、投影面、二面角相关面片，且给出至少 3 个已有点名。',
        'requiredWhenUserSays', JSON_ARRAY(
          '辅助平面',
          '辅助面',
          '投影面'
        ),
        'payloadSchema', JSON_OBJECT(
          'labels', JSON_OBJECT('type', 'array')
        ),
        'doNotUseWhen', '真实截面使用 addCrossSectionByLabels；曲面体复杂截面不要自由新增辅助面。'
      ),
      JSON_OBJECT(
        'type', 'addDistanceMeasurement',
        'description', '添加距离度量，数值由 M01 计算。payload: { kind: "pointPoint"|"pointLine"|"pointFace"|"lineLine"|"lineFace", labels?: string[], entityIds?: string[], label?: string }。labels 约定：pointPoint=[P,Q]，pointLine=[P,A,B]，pointFace=[P,A,B,C...]，lineLine=[A,B,C,D]，lineFace=[A,B,C,D,E...]。',
        'useWhen', '用户要求标出或计算点点、点线、点面、线线、线面距离。',
        'requiredWhenUserSays', JSON_ARRAY(
          '距离',
          '点到平面距离',
          '点到直线距离',
          '两点距离'
        ),
        'payloadSchema', JSON_OBJECT(
          'kind', JSON_OBJECT('type', 'string'),
          'labels', JSON_OBJECT('type', 'array'),
          'entityIds', JSON_OBJECT('type', 'array'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '不要手写距离数值；不要为了补全“点到平面距离”等不完整需求而发明 P、Q 等点名；测量对象不完整时返回 warnings，不要同时输出 addDistanceMeasurement；当对象标签已经明确且存在时，不要自行判断平行、相交、异面或是否可测，应交给 M01 计算。'
      ),
      JSON_OBJECT(
        'type', 'addAngleMeasurement',
        'description', '添加角度度量，数值由 M01 计算。payload: { kind: "lineLine"|"lineFace"|"dihedral", labels?: string[], faceLabels?: string[], entityIds?: string[], label?: string }。lineLine labels=[A,B,C,D]；lineFace labels=[A,B] 且 faceLabels=[C,D,E...] 或 labels=[A,B,C,D,E...]；dihedral 初版优先使用两个面 entityIds。',
        'useWhen', '用户要求标出或计算线线角、线面角或二面角。',
        'requiredWhenUserSays', JSON_ARRAY(
          '夹角',
          '线面角',
          '二面角',
          '所成角'
        ),
        'payloadSchema', JSON_OBJECT(
          'kind', JSON_OBJECT('type', 'string'),
          'labels', JSON_OBJECT('type', 'array'),
          'faceLabels', JSON_OBJECT('type', 'array'),
          'entityIds', JSON_OBJECT('type', 'array'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '不要手写角度数值；对象不完整时不要默认选择面或线；如果指定两个面来求二面角，必须输出 addAngleMeasurement(kind=dihedral) 且提供 faceLabels 或 entityIds；线面角优先直接使用 addAngleMeasurement，只有教师明确要求投影线、辅助线或连接线时才额外添加 addSegmentByLabels。'
      ),
      JSON_OBJECT(
        'type', 'setStyle',
        'description', '设置已有线段样式。payload 可用 entityIds 精确指定，或用 labels: ["A", "B"] 指定线段；style 支持 color 和 dashed。',
        'useWhen', '用户要求把已有线段标红、虚线、改颜色或调整线段样式。M01 支持该 operation 时优先用 setStyle，patch 只是兜底。',
        'payloadSchema', JSON_OBJECT(
          'entityIds', JSON_OBJECT('type', 'array'),
          'labels', JSON_OBJECT('type', 'array'),
          'style', JSON_OBJECT('type', 'object')
        ),
        'doNotUseWhen', '需要新建线段时先使用 addSegmentByLabels，并可在该 operation 内提供 style。'
      ),
      JSON_OBJECT(
        'type', 'setLabel',
        'description', '设置已有点或线段标签。payload: { entityId?: string, fromLabel?: string, label: string }。优先用当前 snapshot 中的 entityId。',
        'useWhen', '用户要求修改已有点或线段标签。M01 支持该 operation 时优先用 setLabel，patch 只是兜底。',
        'payloadSchema', JSON_OBJECT(
          'entityId', JSON_OBJECT('type', 'string'),
          'fromLabel', JSON_OBJECT('type', 'string'),
          'label', JSON_OBJECT('type', 'string')
        ),
        'doNotUseWhen', '创建新点时优先在对应创建 operation 的 label 字段设置标签。'
      ),
      JSON_OBJECT(
        'type', 'setVisible',
        'description', '显示或隐藏已有实体。payload: { entityIds?: string[], labels?: string[], visible: boolean }。适合隐藏干扰元素或只保留讲解主体。',
        'useWhen', '用户要求显示、隐藏、简化当前场景或只保留关键实体。M01 支持该 operation 时优先用 setVisible，patch 只是兜底。',
        'payloadSchema', JSON_OBJECT(
          'entityIds', JSON_OBJECT('type', 'array'),
          'labels', JSON_OBJECT('type', 'array'),
          'visible', JSON_OBJECT('type', 'boolean')
        ),
        'doNotUseWhen', '不要删除实体；只调整 visible。'
      )
    ),
    'payloadSchema', JSON_OBJECT(
      'scene', JSON_OBJECT(
        'type', 'object',
        'description', 'M01 编辑器场景快照。结构性搭建应优先使用 operations；patch 只建议基于当前 snapshot 修改已有实体的低风险字段。',
        'required', CAST('true' AS JSON),
        'risk', 'high',
        'children', JSON_OBJECT(
          'entities', JSON_OBJECT(
            'type', 'record',
            'description', '实体表，key 为实体 ID。AI patch 应优先只包含当前 snapshot 中已经存在的实体 ID。',
            'risk', 'high',
            'additionalProperties', JSON_OBJECT(
              'type', 'object',
              'description', '单个已有实体的局部 patch。',
              'children', JSON_OBJECT(
                'visible', JSON_OBJECT(
                  'type', 'boolean',
                  'description', '是否显示该实体。适合隐藏干扰元素或显示关键元素。',
                  'risk', 'low'
                ),
                'locked', JSON_OBJECT(
                  'type', 'boolean',
                  'description', '是否锁定该实体，防止误操作。',
                  'risk', 'low'
                ),
                'properties', JSON_OBJECT(
                  'type', 'object',
                  'description', '实体属性局部 patch。V1 推荐只修改点标签、线段样式等低风险字段。',
                  'risk', 'high',
                  'children', JSON_OBJECT(
                    'label', JSON_OBJECT(
                      'type', 'string',
                      'description', '点或线段的展示标签，例如 A、B、M、N、A1。',
                      'risk', 'low'
                    ),
                    'style', JSON_OBJECT(
                      'type', 'object',
                      'description', '线段样式。仅用于 type 为 segment 的实体。',
                      'risk', 'low',
                      'children', JSON_OBJECT(
                        'color', JSON_OBJECT(
                          'type', 'string',
                          'description', '线段颜色，使用十六进制颜色值，例如 #e74c3c。',
                          'risk', 'low'
                        ),
                        'dashed', JSON_OBJECT(
                          'type', 'boolean',
                          'description', '线段是否显示为虚线。',
                          'risk', 'low'
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
          'nextId', JSON_OBJECT(
            'type', 'number',
            'description', '下一个实体 ID。只在替换整份 scene 时需要提供；局部 patch 不应修改。',
            'range', JSON_ARRAY(
              1,
              10000
            ),
            'risk', 'high'
          ),
          'activeGeometryId', JSON_OBJECT(
            'type', 'string',
            'description', '当前主几何体实体 ID，通常为当前 snapshot 中 type=geometry 的实体 ID。',
            'risk', 'high'
          )
        )
      )
    ),
    'constraints', JSON_ARRAY(
      'AI 输出只能是 JSON 对象，允许包含 operations、patch、explanation、warnings，不能包含 envelope。',
      '结构性搭建必须优先使用 operations，不要手写 geometry/point/segment/face 实体树。',
      '用户要求创建或切换基础几何体时，优先使用 setGeometry；loadPresetScene 只用于明确专题讲解图或通用题图，不是普通构图的默认入口。',
      'loadPresetScene 只应用于用户明确匹配 presetScenes.useWhen，或明确要求“专题图/通用图/直接进入合适图”的场景；泛化或具体构图需求不要载入复杂题图，优先 operations 或返回 warnings。',
      '不要直接通过 patch 修改 geometry.properties.params；M01 loadSnapshot 不会根据参数自动重建内置顶点、棱和面。',
      'operations 必须使用最小充分步骤；如果单个 operation 可满足用户意图，不要额外添加构造、标注或样式操作。',
      '复杂构图可以输出多个 operations，M01 会按顺序执行；任一步失败时会回滚到执行前状态。',
      '新增辅助线、边上点、中点、中心点、面中心、截面、辅助面、外接球、距离和角度必须使用 addSegmentByLabels、addPointOnEdge、addMidpointByLabels、addCenterPoint、addFaceCenterPoint、addCrossSectionByLabels、addAuxiliaryFaceByLabels、addCircumsphere、addDistanceMeasurement、addAngleMeasurement 等确定性原语。',
      'patch 只应修改当前 snapshot 中已经存在实体的 visible、locked、properties.label、properties.style.color、properties.style.dashed。',
      '不要直接创建或修改 point、segment、face、circumSphere、angleMeasurement、distanceMeasurement 等实体树；测量值必须由 M01 计算，AI 不能手写 distanceValue 或 angleRadians。',
      '生成 operation queue 时必须做依赖闭包检查：每个 operation 引用的点名、面名、实体或标签，必须来自当前 snapshot/aiContext、本次 setGeometry 的 plannedGeometryLabels，或来自排在它前面的 operation 的确定性输出。',
      '如果某个后续 operation 需要一个可确定创建的中间实体，例如几何体中心 O、面中心 O1、中点 M，应先输出创建该实体的 operation，再输出依赖它的测量、连线或样式 operation。',
      '按点名操作前必须基于 aiContext.availablePointLabels 或本次 setGeometry 计划创建几何体的 labelProtocol.plannedGeometryLabels 推断；如果缺少点名，返回 warnings 说明需要教师确认，且不要同时输出依赖缺失点名的 operation。',
      '如果 warnings 指出点名、面名、测量对象或构图目标缺失/歧义，不要同时输出依赖该缺失信息的 operation；warning 和依赖它的 operation 不能同时出现。',
      '不要根据常见教材命名习惯自动猜测不存在的点名；点名不在上下文中时，应要求教师确认。',
      '当教师已经明确给出测量对象的点名、线名或面名时，不要自行判断它们是否平行、相交、异面或可测；只要对象标签存在，就输出 addDistanceMeasurement/addAngleMeasurement，让 M01 确定性计算数值或失败原因。',
      '曲面体的复杂截面和球相关专题优先使用 loadPresetScene，不要自由新增 point、segment、face 等实体。',
      '动画、相机视角、撤销历史和临时 hover/选中态不属于当前 snapshot 可恢复能力。'
    ),
    'examples', JSON_ARRAY(
      JSON_OBJECT(
        'instruction', '生成一个球体，半径为 2。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setGeometry',
            'geometryType', 'sphere',
            'params', JSON_OBJECT(
              'radius', 2
            )
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已切换为半径为 2 的球体，系统会自动生成球体所需的内置点、曲线和面。'
      ),
      JSON_OBJECT(
        'instruction', '我要讲球的截面圆面积，帮我直接进入合适的图。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'loadPresetScene',
            'presetId', 'sphere-section-circle-area'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已载入球截面圆面积通用图，包含球心、截面圆心、球半径、截面半径和球心距。'
      ),
      JSON_OBJECT(
        'instruction', '在正方体中连接 A 和 C1，并把这条空间对角线标红。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setGeometry',
            'geometryType', 'cube',
            'params', JSON_OBJECT(
              'sideLength', 2
            )
          ),
          JSON_OBJECT(
            'type', 'addSegmentByLabels',
            'labels', JSON_ARRAY(
              'A',
              'C1'
            ),
            'style', JSON_OBJECT(
              'color', '#e74c3c',
              'dashed', CAST('false' AS JSON)
            ),
            'label', 'AC1'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建正方体并连接 A、C1 两点，空间对角线 AC1 使用红色实线突出显示。'
      ),
      JSON_OBJECT(
        'instruction', '在 AB 上取中点 M，再连接 M 和 C1。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addPointOnEdge',
            'edgeLabels', JSON_ARRAY(
              'A',
              'B'
            ),
            't', 0.5,
            'label', 'M'
          ),
          JSON_OBJECT(
            'type', 'addSegmentByLabels',
            'labels', JSON_ARRAY(
              'M',
              'C1'
            ),
            'style', JSON_OBJECT(
              'color', '#e74c3c',
              'dashed', CAST('true' AS JSON)
            ),
            'label', 'MC1'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已在 AB 的中点处创建 M，并连接 MC1，用红色虚线作为辅助线。'
      ),
      JSON_OBJECT(
        'instruction', '用 A、C、A1 三点作一个截面。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'addCrossSectionByLabels',
            'labels', JSON_ARRAY(
              'A',
              'C',
              'A1'
            )
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已根据 A、C、A1 三点生成截面；如果当前场景缺少这些点名，会返回无法找到点的提示。'
      ),
      JSON_OBJECT(
        'instruction', '把 A 点改名为 P，把 AB 这条线改成红色虚线。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setStyle',
            'labels', JSON_ARRAY(
              'A',
              'B'
            ),
            'style', JSON_OBJECT(
              'color', '#e74c3c',
              'dashed', CAST('true' AS JSON)
            )
          ),
          JSON_OBJECT(
            'type', 'setLabel',
            'fromLabel', 'A',
            'label', 'P'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已通过结构性原语修改点标签并突出显示指定线段。'
      ),
      JSON_OBJECT(
        'instruction', '生成正方体，在底面 ABCD 的中心标 O1。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setGeometry',
            'geometryType', 'cube',
            'params', JSON_OBJECT(
              'sideLength', 2
            )
          ),
          JSON_OBJECT(
            'type', 'addFaceCenterPoint',
            'faceLabels', JSON_ARRAY(
              'A',
              'B',
              'C',
              'D'
            ),
            'label', 'O1'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建正方体，并在底面 ABCD 的中心标出 O1。'
      ),
      JSON_OBJECT(
        'instruction', '生成正方体，并标出它的中心 O。',
        'operations', JSON_ARRAY(
          JSON_OBJECT(
            'type', 'setGeometry',
            'geometryType', 'cube',
            'params', JSON_OBJECT(
              'sideLength', 2
            )
          ),
          JSON_OBJECT(
            'type', 'addCenterPoint',
            'label', 'O'
          )
        ),
        'patch', JSON_OBJECT(),
        'explanation', '已创建正方体，并标出几何体中心 O。'
      )
    ),
    'planningRules', JSON_ARRAY(
      '先识别教师需求中的所有可见构图目标，再生成 operations；可见目标包括主体几何体、新点、新线段、截面、辅助面、外接球、距离、角度、标签、样式和显隐。',
      '每个可见构图目标都必须映射到一个确定性 operation；不能只完成主体几何体而遗漏后续目标。',
      'operations 必须最小充分：单个 operation 能满足需求时不要额外添加操作；复杂构图才输出多个 operations，并按依赖顺序排列。',
      '普通构图优先 operation queue；loadPresetScene 只用于教师明确要求专题讲解图、通用题图或直接进入预置场景。',
      '不要为了省步骤使用 preset；生成基础几何体、取点、连线、标中心、作截面、添加距离角度时应使用对应 operation。',
      '按点名或面名操作前必须基于 aiContext.availablePointLabels、aiContext.faces 或本次 setGeometry 计划创建的标准点名推断；缺少点名或面名时返回 warnings，不要猜，也不要同时输出依赖该缺失信息的 operation。',
      '生成 operation queue 时必须做依赖闭包检查：每个 operation 引用的点名、面名、实体或标签，必须来自当前 snapshot/aiContext、本次 setGeometry 的 plannedGeometryLabels，或来自排在它前面的 operation 的确定性输出。',
      '如果某个后续 operation 需要一个可确定创建的中间实体，例如几何体中心 O、面中心 O1、中点 M，应先输出创建该实体的 operation，再输出依赖它的测量、连线或样式 operation。',
      '整体几何体中心使用 addCenterPoint；某个面、底面、侧面、截面或多边形面的中心使用 addFaceCenterPoint。',
      '距离和角度只输出测量 operation，数值必须由 M01 计算，AI 不能手写 distanceValue、angleRadians 或坐标。',
      '不要为了补全测量对象而发明 P、Q、M、N 等点名；只有教师明确要求创建新点时，才可以在对应创建 operation 中使用新标签。',
      '用户只说“点到平面距离”“这个图里的二面角”等对象不完整需求时，应返回 warnings 请求确认，不要选择默认点、默认面或默认二面角。',
      '当教师已经明确给出测量对象的点名、线名或面名时，不要自行判断它们是否平行、相交、异面或可测；只要对象标签存在，就输出 addDistanceMeasurement/addAngleMeasurement，让 M01 确定性计算数值或失败原因。',
      '如果指定两个面来求二面角，必须输出 addAngleMeasurement(kind=dihedral) 且提供 faceLabels 或 entityIds；解释中不能声称已添加角度但 operations 为空。',
      '线面角、距离、二面角等测量需求优先使用 addAngleMeasurement 或 addDistanceMeasurement；只有教师明确要求画投影线、辅助线或连接线时，才额外添加 addSegmentByLabels。',
      '已有线段样式、标签、显隐修改优先使用 setStyle、setLabel、setVisible；patch 只作为低风险兜底。'
    )
  ),
  updated_at = NOW()
WHERE template_key = 'm01';
