# DSL 指令编写参考

> 从真题辅助构造中提炼，编写 DSL 指令时参考

## cube-line-plane-parallel-midpoint
构型：正方体中过中点的线面平行关系
几何体：正方体
辅助构造：在截面内作平行线, 利用线线平行证明线面平行, 连接棱中点, 连接面对角线, 构造平行四边形
需要的 DSL 元素：
- face (crossSection)
- midpoint
- segment

## cylinder-oblique-section-ellipse
构型：圆柱斜截面椭圆的参数计算
几何体：圆柱
辅助构造：斜平面截圆柱, 分析椭圆参数, 作垂直辅助线, 构造直角三角形, 利用离心率关系
需要的 DSL 元素：
- face (crossSection)
- segment
- point_face_distance / line_line_distance

## cube-skew-distance
构型：正方体中异面距离
几何体：正方体
辅助构造：连接对角线, 利用平行条件, 确定平面交线, 利用平行关系, 建立坐标系
需要的 DSL 元素：
- segment
- face (crossSection)
- coordinateSystem
- line_line_angle
- point_face_distance / line_line_distance

## cube-line-length-range
构型：正方体中线段长度范围问题
几何体：正方体
辅助构造：取各棱中点, 构造平行平面, 确定动点轨迹, 确定动点轨迹线段
需要的 DSL 元素：
- midpoint
- face (crossSection)
- point_face_distance / line_line_distance

## cube-vector-dot-product
构型：正方体中向量数量积问题
几何体：正方体
辅助构造：建立坐标系, 参数化动点位置
需要的 DSL 元素：
- coordinateSystem

## pyramid4-dihedral-angle
构型：正四棱锥中二面角问题
几何体：正四棱锥
辅助构造：构造平行四边形, 建立坐标系, 求法向量, 利用垂直关系建立二面角
需要的 DSL 元素：
- coordinateSystem
- dihedral_angle

## pyramid4-dynamic-point
构型：正四棱锥中动点问题
几何体：正四棱锥
辅助构造：连接对角线, 构造截面, 取各棱中点, 构造截面三角形
需要的 DSL 元素：
- segment
- face (crossSection)
- midpoint

## cuboid-trajectory-angle
构型：长方体中动点轨迹与直线夹角最值
几何体：长方体
辅助构造：构造平行平面, 确定轨迹
需要的 DSL 元素：
- face (crossSection)

## cube-projection-area
构型：正方体中图形的正投影面积
几何体：正方体
辅助构造：确定关键点投影, 确定动点轨迹, 计算投影面积, 利用投影面积关系, 证明面积相等
需要的 DSL 元素：
- midpoint

## cube-section-area
构型：正方体中截面面积计算
几何体：正方体
辅助构造：取棱中点, 构造截面梯形, 利用面面平行性质, 构造平行四边形截面
需要的 DSL 元素：
- midpoint
- face (crossSection)

## cube-section-perimeter
构型：正方体中截面周长计算
几何体：正方体
辅助构造：取棱中点, 证明四点共面, 利用线面平行性质, 取侧棱中点, 构造截面
需要的 DSL 元素：
- midpoint
- face (crossSection)

## cube-moving-point-diagonal-comprehensive
构型：正方体中动点在对角线上的综合性质
几何体：正方体
辅助构造：动点轨迹分析, 平面截面构造, 取棱中点, 连接对角线, 利用三垂直性质
需要的 DSL 元素：
- face (crossSection)
- midpoint
- segment
- free_point (foot of perpendicular)

## cuboid-skew-lines-angle
构型：长方体中异面直线夹角
几何体：长方体
辅助构造：取侧棱中点, 建立坐标系, 取各棱中点
需要的 DSL 元素：
- midpoint
- coordinateSystem
- line_line_angle

## pyramid4-skew-lines-angle
构型：正四棱锥中异面直线所成角
几何体：正四棱锥
辅助构造：延长底边, 平移线段, 构造平行四边形, 取棱中点, 应用余弦定理
需要的 DSL 元素：
- midpoint
- line_line_angle

## pyramid4-surface-area
构型：正四棱锥表面积计算
几何体：正四棱锥
辅助构造：利用体积求球半径, 证明线面垂直, 构造直角三角形
需要的 DSL 元素：
- circumSphere

## pyramid4-volume
构型：正四棱锥体积计算
几何体：正四棱锥
辅助构造：展开图分析, 建立x与h的关系, 求斜高, 取中点, 连接对角线
需要的 DSL 元素：
- midpoint
- segment

## prism3-skew-lines-angle
构型：三棱柱中异面直线所成角
几何体：三棱柱
辅助构造：取中点, 建立坐标系, 取侧棱中点, 取底边中点, 补成四棱柱
需要的 DSL 元素：
- midpoint
- coordinateSystem
- line_line_angle
- circumSphere

## prism3-skew-angle-general
构型：直三棱柱中异面直线所成角
几何体：直三棱柱
辅助构造：连接体对角线, 利用平行关系, 建立坐标系
需要的 DSL 元素：
- segment
- coordinateSystem
- line_line_angle

## prism3-circumsphere-surface
构型：直三棱柱外接球表面积
几何体：直三棱柱
辅助构造：求底面外接圆半径, 确定球心位置, 补形为长方体
需要的 DSL 元素：
- circumSphere

## tetrahedron-circumsphere-special
构型：特殊四面体的外接球问题
几何体：四面体
辅助构造：扩展为正方体, 确定球心, 作二面角平面角, 利用体积公式, 构造正方体
需要的 DSL 元素：
- face (crossSection)
- dihedral_angle
- circumSphere

## cuboid-line-plane-distance
构型：长方体中直线与平面的距离
几何体：长方体
辅助构造：找出平行平面, 在三角形内求最短线段
需要的 DSL 元素：
- face (crossSection)
- point_face_distance / line_line_distance

## prism3-dihedral-angle
构型：正三棱柱中截面与底面二面角
几何体：三棱柱
辅助构造：作平行线, 取中点, 构造二面角
需要的 DSL 元素：
- midpoint
- dihedral_angle

## cylinder-random-point-probability
构型：圆柱内随机点到上下底面圆心距离的概率
几何体：圆柱
辅助构造：构造球体, 计算体积比
需要的 DSL 元素：
- point_face_distance / line_line_distance

## folded-geometry-circumsphere
构型：翻折几何体中，三垂直结构的外接球
几何体：翻折几何体
辅助构造：翻折, 构造长方体
需要的 DSL 元素：
- circumSphere

## sphere-inscribed-cone-surface
构型：球的内接圆锥侧面积最值问题
几何体：球圆锥组合体
辅助构造：建立函数关系, 求导求最值
需要的 DSL 元素：

## section-prism-dihedral-volume
构型：截面四棱柱中的二面角和体积
几何体：截面四棱柱
辅助构造：建立坐标系, 求法向量, 分割求体积
需要的 DSL 元素：
- coordinateSystem
- dihedral_angle

## cuboid-oblique-section-volume
构型：长方体被斜平面截断的组合体
几何体：截断长方体
辅助构造：补全长方体, 分割几何体, 作垂线
需要的 DSL 元素：
- free_point (foot of perpendicular)

## tetrahedron-equilateral-base-circumsphere-area
构型：等边三角形底四面体外接球表面积最值问题
几何体：四面体
辅助构造：利用体积最值确定几何关系
需要的 DSL 元素：
- circumSphere

## tetrahedron-vertex-perpendicular-point-plane-distance
构型：四面体中顶点到底面垂直时求点到侧面距离
几何体：四面体
辅助构造：建立坐标系, 利用垂直关系
需要的 DSL 元素：
- coordinateSystem
- point_face_distance / line_line_distance

## regular-tetrahedron-section-area
构型：正四面体外接球中截面面积问题
几何体：正四面体
辅助构造：找球心位置, 构造截面圆
需要的 DSL 元素：
- face (crossSection)
- circumSphere

## regular-tetrahedron-incircle-section
构型：正四面体中过棱中点截面与内切球的交线面积
几何体：正四面体
辅助构造：作垂线到底面, 利用相似三角形, 求截面圆半径
需要的 DSL 元素：
- free_point (foot of perpendicular)
- face (crossSection)

## pyramid3-folding-circumsphere-volume
构型：折叠三棱锥的外接球体积
几何体：三棱锥
辅助构造：折叠变换, 确定球心位置
需要的 DSL 元素：
- circumSphere

## cone-volume-inscribed-cube
构型：圆锥内接正方体的棱长计算
几何体：圆锥
辅助构造：作轴截面, 利用相似三角形
需要的 DSL 元素：
- face (crossSection)

## pyramid3-line-face-angle
构型：正三棱锥中侧棱与侧面的线面角
几何体：正三棱锥
辅助构造：确定垂足, 利用外接球条件求高
需要的 DSL 元素：
- free_point (foot of perpendicular)
- line_face_angle
- circumSphere

## pyramid3-surface-area
构型：正三棱锥中已知外接球和底边长求侧面积
几何体：正三棱锥
辅助构造：连接底面中心, 利用球心位置关系
需要的 DSL 元素：
- segment
- circumSphere

## pyramid3-lateral-base-dihedral
构型：正三棱锥中侧面与底面的二面角
几何体：正三棱锥
辅助构造：作高线, 取中点, 构造直角三角形
需要的 DSL 元素：
- midpoint
- dihedral_angle
- circumSphere

## prism4-point-distance-ratio
构型：正四棱柱中顶点到对角线和平面的距离比值关系
几何体：正四棱柱
辅助构造：建立坐标系, 距离公式
需要的 DSL 元素：
- coordinateSystem
- point_face_distance / line_line_distance

## prism-quad-trajectory-midpoint
构型：直四棱柱中线面平行约束下中点轨迹长度
几何体：直四棱柱
辅助构造：构造平行平面
需要的 DSL 元素：
- face (crossSection)

## triangular-frustum-skew-lines-base-center
构型：正三棱台中过底面中心的直线夹角
几何体：正三棱台
辅助构造：连接底面中心, 作垂线, 构造直角三角形
需要的 DSL 元素：
- segment
- free_point (foot of perpendicular)
- line_line_angle

## triangular-pyramid-dihedral-edge-midpoint
构型：三角锥中过边中点截面的二面角
几何体：三角锥
辅助构造：取中点, 作垂线, 建立坐标系
需要的 DSL 元素：
- midpoint
- free_point (foot of perpendicular)
- coordinateSystem
- dihedral_angle

## cube-dihedral-other
构型：正方体中其他二面角问题
几何体：正方体
辅助构造：作平面垂线, 作到棱的距离
需要的 DSL 元素：
- face (crossSection)
- free_point (foot of perpendicular)
- dihedral_angle
- point_face_distance / line_line_distance

## cube-skew-angle-midpoint-general
构型：正方体中各种中点连线的异面直线所成角
几何体：正方体
辅助构造：利用线线平行转化角度, 构造等边三角形, 建立坐标系, 取棱中点, 平移直线
需要的 DSL 元素：
- coordinateSystem
- midpoint
- segment
- line_line_angle

## cube-plane-plane-parallel
构型：正方体中面面平行关系
几何体：正方体
辅助构造：取棱中点, 构造截面, 连接对角线, 连接侧面对角线, 取中点
需要的 DSL 元素：
- midpoint
- face (crossSection)
- segment

## cube-line-plane-angle
构型：正方体中线面角
几何体：正方体
辅助构造：作垂线确定线面角, 计算正切值, 取侧面中心, 取底边中点, 作垂线
需要的 DSL 元素：
- free_point (foot of perpendicular)
- midpoint
- line_face_angle

## cuboid-parallel-plane-section
构型：长方体中平行平面的截面关系
几何体：长方体
辅助构造：利用面面平行性质, 确定中点位置, 取棱中点, 构造平行平面, 计算梯形面积
需要的 DSL 元素：
- midpoint
- face (crossSection)

## pyramid4-line-plane-angle
构型：正四棱锥中直线与平面所成角
几何体：正四棱锥
辅助构造：连接底面对角线, 过顶点作底面垂线, 取棱中点, 建立坐标系
需要的 DSL 元素：
- segment
- free_point (foot of perpendicular)
- midpoint
- coordinateSystem
- line_face_angle

## tetrahedron-perpendicular-midpoint
构型：四面体中基于中点的垂直关系证明
几何体：四面体
辅助构造：连接中点, 证明线线垂直, 取各边中点, 构造中位线, 取各棱中点
需要的 DSL 元素：
- midpoint
- segment
- face (crossSection)

## sphere-section-volume
构型：球与截面圆的几何关系求体积
几何体：球
辅助构造：利用勾股定理, 连接球心与截面圆心, 构造直角三角形
需要的 DSL 元素：
- face (crossSection)
- segment
- point_face_distance / line_line_distance

## cube-dihedral-diagonal-face
构型：正方体中对角截面与底面的二面角
几何体：正方体
辅助构造：连接对角线, 取交点, 构造二面角, 连接底面对角线, 作二面角平面角
需要的 DSL 元素：
- segment
- face (crossSection)
- free_point (foot of perpendicular)
- dihedral_angle

## cube-line-line-perpendicular
构型：正方体中线线垂直关系
几何体：正方体
辅助构造：利用中点性质, 证明线面垂直
需要的 DSL 元素：
- midpoint

## cube-point-plane-distance
构型：正方体中点到平面距离
几何体：正方体
辅助构造：计算三角形面积, 利用等积法
需要的 DSL 元素：
- point_face_distance / line_line_distance

## cuboid-line-plane-angle
构型：长方体中直线与平面所成角
几何体：长方体
辅助构造：取棱中点, 建立坐标系
需要的 DSL 元素：
- midpoint
- coordinateSystem
- line_face_angle

## cuboid-dihedral-angle
构型：长方体中过平行线的二面角
几何体：长方体
辅助构造：无
需要的 DSL 元素：
- dihedral_angle

## cuboid-diagonal-section-perpendicular
构型：长方体中体对角线与截面垂直
几何体：长方体
辅助构造：取边中点, 构造截面, 建立坐标系
需要的 DSL 元素：
- midpoint
- face (crossSection)
- coordinateSystem

## pyramid4-parallel-proof
构型：四棱锥中平行关系证明
几何体：四棱锥
辅助构造：连接对角线, 取中点
需要的 DSL 元素：
- segment
- midpoint

## pyramid4-probability
构型：四棱锥内接球概率问题
几何体：四棱锥
辅助构造：确定外接球半径, 计算体积比
需要的 DSL 元素：
- circumSphere

## prism3-line-face-angle
构型：正三棱柱中线面角
几何体：三棱柱
辅助构造：确定底面中心, 利用体积求高
需要的 DSL 元素：
- line_face_angle

## prism3-point-face-distance
构型：直三棱柱中点到平面距离
几何体：三棱柱
辅助构造：作点到面的垂线, 利用面面垂直性质
需要的 DSL 元素：
- free_point (foot of perpendicular)
- point_face_distance / line_line_distance

## prism3-face-face-perpendicular
构型：直三棱柱中面面垂直关系
几何体：三棱柱
辅助构造：取棱中点, 证明线面垂直
需要的 DSL 元素：
- midpoint

## prism-construction-design
构型：判断棱柱并设计截面构造三棱柱
几何体：棱柱
辅助构造：设计截面, 构造三棱柱
需要的 DSL 元素：
- face (crossSection)

## chuying-geometry-properties
构型：刍营几何体中，线面平行与线线垂直性质
几何体：刍营几何体
辅助构造：取中点, 构造平行四边形
需要的 DSL 元素：
- midpoint

## truncated-cuboid-skew-angle
构型：截角长方体中，异面直线所成角
几何体：截角长方体
辅助构造：平移直线, 构造三角形
需要的 DSL 元素：
- line_line_angle

## sphere-cube-container-volume
构型：球与正方体容器的组合体积问题
几何体：球正方体组合体
辅助构造：利用截面圆性质建立方程
需要的 DSL 元素：
- face (crossSection)

## tetrahedron-section-parallel
构型：四面体中截面与原有棱边的平行关系
几何体：四面体
辅助构造：利用比例关系证明线线平行
需要的 DSL 元素：

## tetrahedron-edge-midpoint-skew-angle
构型：四面体中棱中点连线与对棱的夹角
几何体：四面体
辅助构造：取棱中点, 构造辅助三角形, 利用中位线性质
需要的 DSL 元素：
- midpoint
- line_line_angle

## tetrahedron-angle-midpoint
构型：特殊四面体中过棱中点的角度计算
几何体：四面体
辅助构造：取中点连线, 构造直角三角形
需要的 DSL 元素：
- midpoint
- segment
- dihedral_angle
- line_face_angle

## sphere-perpendicular-chords
构型：球中过一点作三条两两垂直弦的平方和
几何体：球
辅助构造：构造长方体, 利用球的内接长方体性质
需要的 DSL 元素：

## sphere-radius-from-section
构型：球中根据平行截面面积求球半径
几何体：球
辅助构造：作截面圆, 利用勾股定理
需要的 DSL 元素：
- face (crossSection)
- circumSphere

## prism3-parallel-section
构型：三棱柱中过侧棱中点的截面与底边相关面平行
几何体：三棱柱
辅助构造：连接面对角线, 找交点, 证明平行四边形
需要的 DSL 元素：
- segment

## cone-surface-area-inscribed-sphere
构型：圆锥内切球表面积计算
几何体：圆锥
辅助构造：求圆锥高, 求内切球半径
需要的 DSL 元素：

## pyramid4-dihedral-lateral-lateral
构型：底面为矩形的四棱锥中，侧面与侧面的二面角
几何体：四棱锥
辅助构造：建立坐标系, 求法向量
需要的 DSL 元素：
- coordinateSystem
- dihedral_angle

## pyramid4-line-face-angle-rhombus-equilateral
构型：四棱锥中，底面菱形侧面等边三角形时的线面角
几何体：四棱锥
辅助构造：取边中点, 证明线面垂直, 构造直角三角形
需要的 DSL 元素：
- midpoint
- line_face_angle

## pyramid3-unfold-shortest-path
构型：正三棱锥中沿侧面展开的最短路径
几何体：正三棱锥
辅助构造：侧面展开, 连接直线段
需要的 DSL 元素：
- segment
- line_line_angle
- point_face_distance / line_line_distance

## prism4-circumsphere-surface
构型：正四棱柱的外接球关系
几何体：正四棱柱
辅助构造：利用外接球求高, 体对角线与球直径关系
需要的 DSL 元素：
- circumSphere

## prism-quad-diagonal-perpendicular
构型：直四棱柱中对角直线垂直的条件
几何体：直四棱柱
辅助构造：连接对角线, 利用平行关系
需要的 DSL 元素：
- segment

## frustum4-lateral-area
构型：正四棱台侧面积计算
几何体：正四棱台
辅助构造：求斜高
需要的 DSL 元素：

## cube-surface-curve
构型：正方体表面曲线长度
几何体：正方体
辅助构造：分析各面上的圆弧, 计算圆弧长度
需要的 DSL 元素：
- point_face_distance / line_line_distance

## cuboid-section-optimization
构型：长方体中过顶点截面的面积最值
几何体：长方体
辅助构造：作垂线, 构造线面角, 基本不等式
需要的 DSL 元素：
- free_point (foot of perpendicular)

## cuboid-section-comprehensive
构型：长方体中动点截面的综合性质
几何体：长方体
辅助构造：动点截面, 展开图, 平行线
需要的 DSL 元素：
- face (crossSection)

## cylinder-dandelin-sphere-ellipse
构型：圆柱Dandelin双球截面椭圆的离心率
几何体：圆柱
辅助构造：Dandelin双球性质, 椭圆参数关系
需要的 DSL 元素：

## cube-inscribed-cylinder-surface
构型：正方体内接轴向圆柱的最大侧面积
几何体：正方体圆柱组合体
辅助构造：确定圆柱轴线, 求最大半径
需要的 DSL 元素：

## tetrahedron-equal-edges-circumsphere
构型：对棱相等四面体的外接球和体积
几何体：四面体
辅助构造：扩展为长方体
需要的 DSL 元素：
- circumSphere

## prism3-line-plane-perpendicular
构型：直三棱柱中直线与平面垂直的条件
几何体：直三棱柱
辅助构造：取中点, 建立坐标系
需要的 DSL 元素：
- midpoint
- coordinateSystem

## pyramid3-right-circumsphere-constraint
构型：直角三棱锥中已知体积和垂直关系求外接球表面积最值
几何体：三棱锥
辅助构造：构造长方体, 利用外接球直径, 基本不等式
需要的 DSL 元素：
- circumSphere

## cone-ellipse-oblique-section-axis
构型：圆锥斜截面椭圆的短半轴长计算
几何体：圆锥
辅助构造：作平行截面, 相交弦定理, 取母线中点
需要的 DSL 元素：
- face (crossSection)
- midpoint

## pyramid4-point-face-distance-vertical-lateral
构型：四棱锥中，侧面与底面垂直时求点到侧面距离
几何体：四棱锥
辅助构造：建立坐标系, 利用线面平行确定位置
需要的 DSL 元素：
- coordinateSystem
- point_face_distance / line_line_distance

## cube-tetrahedron-comprehensive
构型：正方体中四面体综合性质
几何体：正方体
辅助构造：取棱中点, 构造垂线, 建立坐标系
需要的 DSL 元素：
- midpoint
- free_point (foot of perpendicular)
- coordinateSystem

## cuboid-parallel-midpoint-section
构型：长方体中过棱中点的截面平行关系
几何体：长方体
辅助构造：取对棱中点, 构造截面, 过中点作截面, 取侧棱中点, 利用平行传递性
需要的 DSL 元素：
- midpoint
- face (crossSection)

## pyramid4-perpendicular-proof
构型：四棱锥中垂直关系证明
几何体：四棱锥
辅助构造：利用勾股定理, 证明线线垂直, 作底面垂线, 利用射影定理
需要的 DSL 元素：
- free_point (foot of perpendicular)

## prism3-line-face-parallel
构型：三棱柱中直线与平面平行关系
几何体：三棱柱
辅助构造：取中点构造平行四边形, 利用平行四边形性质, 取中点, 构造平行四边形, 取边中点
需要的 DSL 元素：
- midpoint

## cylinder-volume-calculation
构型：圆柱体积计算
几何体：圆柱
辅助构造：建立体积函数, 求导求最值
需要的 DSL 元素：

## equal-volume-surface-comparison
构型：等体积几何体的表面积比较
几何体：多几何体组合
辅助构造：建立体积等式
需要的 DSL 元素：

## prism3-projection-area-optimization
构型：直三棱柱变角度投影下正侧视图面积乘积最值
几何体：直三棱柱
辅助构造：建立投影关系, 用角度表示面积
需要的 DSL 元素：

## cube-volume-sphere-region
构型：正方体中球形区域体积
几何体：正方体
辅助构造：构造八分之一球体
需要的 DSL 元素：

## cube-center-midpoint-relation
构型：正方体中面中心与中点连线关系
几何体：正方体
辅助构造：连接面对角线, 利用中位线性质
需要的 DSL 元素：
- segment

## cuboid-projection-area
构型：长方体中三角形在对角面上的正投影面积
几何体：长方体
辅助构造：作正投影, 确定投影点位置
需要的 DSL 元素：

## pyramid4-point-plane-distance
构型：四棱锥中点到平面距离
几何体：四棱锥
辅助构造：取中点, 等体积法
需要的 DSL 元素：
- midpoint
- point_face_distance / line_line_distance

## prism3-path-optimization
构型：正三棱柱中动点路径最值问题
几何体：三棱柱
辅助构造：底面侧面展开, 三点共线原理
需要的 DSL 元素：

## cube-circumsphere
构型：正方体的外接球表面积
几何体：正方体
辅助构造：求体对角线
需要的 DSL 元素：
- circumSphere

## cube-cylinder-hole-surface
构型：正方体挖圆柱孔后的表面积
几何体：正方体圆柱组合体
辅助构造：挖圆柱孔
需要的 DSL 元素：

## tetrahedron-square-section-properties
构型：四面体中正方形截面的几何性质
几何体：四面体
辅助构造：利用正方形性质, 平移线段
需要的 DSL 元素：

## prism3-diagonal-perpendicular-condition
构型：直三棱柱中对角直线垂直的条件
几何体：直三棱柱
辅助构造：连接对角线, 利用垂直关系
需要的 DSL 元素：
- segment

## pyramid3-perpendicular-face-circumsphere
构型：三棱锥中面面垂直且含等腰直角三角形的外接球
几何体：三棱锥
辅助构造：确定球心位置
需要的 DSL 元素：
- circumSphere

## cone-ellipse-oblique-section-eccentricity
构型：圆锥斜截面的离心率计算
几何体：圆锥
辅助构造：母线与轴线夹角, 截面与轴线夹角
需要的 DSL 元素：
- face (crossSection)

## pyramid4-point-face-distance-vertical-base
构型：四棱锥中，侧棱垂直底面时求点到侧面距离
几何体：四棱锥
辅助构造：构造辅助平面, 利用等体积法
需要的 DSL 元素：
- face (crossSection)
- point_face_distance / line_line_distance

## cube-midpoint-triangle-properties
构型：正方体中多个中点构成的三角形性质
几何体：正方体
辅助构造：取各棱中点, 构造截面正六边形
需要的 DSL 元素：
- midpoint
- face (crossSection)

## prism3-volume-circumsphere
构型：三棱柱内接于球的体积最值问题
几何体：三棱柱
辅助构造：建立坐标系, 利用外接球条件
需要的 DSL 元素：
- coordinateSystem
- circumSphere

## cube-volume-tetrahedron
构型：正方体中四面体体积计算
几何体：正方体
辅助构造：无
需要的 DSL 元素：

## cube-skew-angle-midpoint-diagonal
构型：正方体中棱中点连线与体对角线的异面直线所成角
几何体：正方体
辅助构造：取中点, 平移线段, 构造直角三角形, 连接对角线, 利用中位线性质
需要的 DSL 元素：
- midpoint
- segment
- line_line_angle

## cube-inscribed-sphere-section
构型：正方体内接球截面形状
几何体：正方体
辅助构造：过球心作截面, 分类讨论截面位置
需要的 DSL 元素：
- face (crossSection)

## cuboid-coordinate-vector
构型：长方体的坐标系与向量计算
几何体：长方体
辅助构造：建立坐标系, 确定顶点坐标
需要的 DSL 元素：
- coordinateSystem

## pyramid4-right-triangle
构型：四棱锥中直角三角形问题
几何体：四棱锥
辅助构造：利用线面垂直性质
需要的 DSL 元素：

## prism3-line-perpendicular
构型：直三棱柱中对角线垂直条件
几何体：三棱柱
辅助构造：连接对角线, 证明线面垂直
需要的 DSL 元素：
- segment

## multi-cylinder-eccentricity-compare
构型：两圆柱截面椭圆离心率比较
几何体：圆柱
辅助构造：离心率公式对比
需要的 DSL 元素：

## cylinder-circumscribed-sphere
构型：圆柱外接球表面积计算
几何体：圆柱
辅助构造：作轴截面
需要的 DSL 元素：
- face (crossSection)
- circumSphere

## sphere-cylinder-circumscribed
构型：球与圆柱的外切关系
几何体：球圆柱组合体
辅助构造：利用外切关系确定圆柱参数
需要的 DSL 元素：

## sphere-section-circle-area
构型：球的截面圆面积计算
几何体：球
辅助构造：利用勾股定理求截面圆半径, 构造直角三角形
需要的 DSL 元素：
- face (crossSection)

## pyramid3-inscribed-sphere-formula
构型：三棱锥内切球半径公式的类比推理
几何体：三棱锥
辅助构造：等体积分割
需要的 DSL 元素：

## prism4-edge-midpoint-relation
构型：正四棱柱中棱中点连线的位置关系判断
几何体：正四棱柱
辅助构造：取棱中点, 连接中点
需要的 DSL 元素：
- midpoint
- segment

## parallelepiped-analogy-diagonal
构型：平行六面体中对角线关系的类比推理
几何体：平行六面体
辅助构造：空间对角线分析
需要的 DSL 元素：

## cube-fold-line-path
构型：正方体中折线路径问题
几何体：正方体
辅助构造：面展开, 化折为直
需要的 DSL 元素：

## cube-line-plane-position-comprehensive
构型：正方体中线面位置关系综合判断
几何体：正方体
辅助构造：利用三垂线定理
需要的 DSL 元素：
- free_point (foot of perpendicular)

## cube-moving-point-plane-sweep
构型：正方体中动点扫过平面问题
几何体：正方体
辅助构造：取棱中点, 构造平行平面
需要的 DSL 元素：
- midpoint
- face (crossSection)

## cube-perpendicular-trajectory
构型：正方体中满足垂直条件的动点轨迹
几何体：正方体
辅助构造：利用面面垂直性质
需要的 DSL 元素：

## cube-diagonal-parallel-properties
构型：正方体中对角线与平行关系
几何体：正方体
辅助构造：构造平行四边形, 平移直线
需要的 DSL 元素：
- line_line_angle

## prism3-circumsphere-volume
构型：直三棱柱外接球体积计算
几何体：三棱柱
辅助构造：利用外接球半径求高
需要的 DSL 元素：
- circumSphere

## prism3-pyramid-volume-ratio
构型：三棱柱中三棱锥体积比
几何体：三棱柱
辅助构造：取棱中点, 构造三棱锥
需要的 DSL 元素：
- midpoint

## sphere-projection-ellipse
构型：球的平行投影与椭圆的关系
几何体：球
辅助构造：利用投影几何关系, 建立角度与半径关系
需要的 DSL 元素：

## prism3-volume-tetrahedron
构型：三棱柱中过底边中点的四面体体积
几何体：三棱柱
辅助构造：连接面对角线, 取交点, 利用中位线性质
需要的 DSL 元素：
- segment

