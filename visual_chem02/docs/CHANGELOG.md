# Changelog - 数据修复记录

> 更新日期：2026-03-27

## 修复问题汇总

### 1. π键电子云方向问题（共性修复）

**问题描述：** π键电子云应垂直于sp²平面，即π电子云应在分子平面内。

**修复文件：**
- `src/components/scene/ElectronCloudRenderer.tsx`

**修复内容：**
- 新增 `computeMolecularPlaneNormal()` 函数计算分子平面法向量
- 新增 `computeBondMidplaneNormal()` 函数计算键中点处分子平面法向量
- 修改 `addPiCloud()` 函数，使π电子云方向垂直于键轴且位于分子平面内
- π电子云椭球缩放比例调整为 `[0.12, length * 0.4, 0.2]`（长轴沿键方向）

**化学依据：** 
- sp²杂化：三个sp²轨道在同一平面内（120°），未参与杂化的p轨道垂直于该平面
- π键电子云由p轨道侧面重叠形成，因此π电子云在分子平面内，垂直于分子平面的法向量

**最小更改：** 是 - 仅修改ElectronCloudRenderer.tsx的π键渲染逻辑

---

### 2. 电子式显示范围调整

**问题描述：** 复杂结构分子（五氧化二磷、葡萄糖环状形式）不适合展示电子式。

**修复文件：**
- `src/data/moleculeMetadata.ts` - 新增 `skipElectronFormula?: boolean` 字段
- `src/components/panels/DisplayModePanel.tsx` - 根据skipElectronFormula过滤电子式选项

**修复内容：**
- 为以下分子添加 `skipElectronFormula: true`：
  - MOL-071（葡萄糖开链）- 已有skipElectron
  - MOL-072（α-D-吡喃葡萄糖）
  - MOL-073（β-D-吡喃葡萄糖）
  - MOL-074（五氧化二磷）
- 3D显示模式标签从"电子云"改为"成键电子云"

**化学依据：** 
- 五氧化二磷是笼状结构，原子数>7，Lewis电子式复杂
- 葡萄糖环状形式（吡喃式）同样复杂
- 高中阶段主要考察简单分子的电子式

**最小更改：** 是 - 仅影响电子式显示选项，不影响3D模型

---

### 3. 配合物分类调整

**问题描述：** 硫氰酸铁和四羟基合铝酸根是必修内容，却被放在"配合物"分类。

**修复文件：**
- `src/data/moleculeMetadata.ts`

**修复内容：**
- MOL-088（硫氰酸铁）：`level` 改为 `"高中必修"`，添加 `geometry: "平面三角形"`，添加 `skipElectronFormula: true`
- MOL-089（四羟基合铝酸根）：`level` 改为 `"高中必修"`，添加 `vsepr: "AX4"`, `hybridization: "sp³"`

**化学依据：** 
- 硫氰酸铁：用于Fe³⁺检验，是必修内容
- 四羟基合铝酸根：铝的两性反应产物，是必修内容

**最小更改：** 是 - 仅修改metadata

---

### 4. 结构简式规则修正

**问题描述：**
- ~~结构简式中隐藏N-H、O-H、不饱和C-H键~~
- **根本问题**：隐藏键但保持原子距离，导致 C 与 H 分离
- **修正理解**：官能团键不显示，合并到父原子标签

**化学依据：**
- 结构简式规则：-OH、-CHO、-NH₂ 等官能团的内部键不显示
- CH₃COOH → C-OH（CH₃合并，羟基显示-OH）
- CH₃CHO → C-CHO（CH₃合并，醛基显示-CHO）
- NH₃ → NH₃（氨基显示-NH₂）

**修复文件：**
- `src/engine/projection2d.ts`

**修复内容：**
- **羟基(-OH)**：O-H合并，O显示为"OH"
- **醛基(-CHO)**：C-H合并，C连接O(双键)时显示为"CHO"
- **氨基(-NH₂)**：N-H合并，N显示为"NH₂"
- **普通C-H**：C合并H显示为CH₃

**效果示例：**
| 分子 | 结构简式 |
|------|----------|
| CH₃COOH | **C**OOH |
| CH₃CHO | **C**HO |
| NH₃ | **NH₂** |
| CH₄ | **C** |
| H₂O | **HO** |

**最小更改：** 是 - 仅修改合并和标签生成逻辑

---

### 5. 葡萄糖链状形式确认

**问题描述：** 葡萄糖需要有链状形式（含醛基）供高中展示。

**修复文件：**
- `src/data/moleculeMetadata.ts`

**修复内容：**
- 确认MOL-071数据正确（PubChem CID 5793，葡萄糖开链形式）
- 更新features描述：`"开链结构，含醛基（CHO）"`
- 新增functional_group：`"多羟基醛"`

**化学依据：**
- 葡萄糖有链状（开链）和环状（吡喃式）两种形式
- 链状形式含有醛基-CHO，是还原性的体现
- 淀粉和纤维素是由葡萄糖环状形式聚合而成

**最小更改：** 是 - 仅修改metadata描述

---

### 6. NO₂自由基形式电荷修复

**问题描述：** NO₂是含有单电子的自由基，被错误处理成硝酰正离子（NO₂⁺）。

**修复文件：**
- `src/data/moleculeMetadata.ts`

**修复内容：**
- 为MOL-015添加 `formalChargeOverrides: { 0: 1, 1: 0, 2: 0 }`
- 更新features：`"含单电子（自由基）"`

**化学依据：**
- NO₂总电子数17（奇数），无法用常规八隅体规则
- 正确形式：N带+1电荷，两个O不带形式电荷
- 含有1个未成对电子（自由基）

**最小更改：** 是 - 仅添加formalChargeOverrides

---

### 7. SO₂和O₃的Lewis结构式处理

**问题描述：** 北京教材Lewis结构式和离域共轭（虚线）不应共存。

**修复文件：**
- `src/data/moleculeMetadata.ts` - 新增lewis相关字段
- `src/engine/projection2d.ts` - 支持lewisFormalCharges
- `src/components/formula/Formula2DView.tsx` - 读取lewisFormalCharges

**修复内容：**
- 新增 `electronFormulaType?: 'lewis'` 和 `lewisFormalCharges?: Record<number, number>` 字段
- SO₂（MOL-014）：
  - 添加 `electronFormulaType: 'lewis'`
  - 添加 `lewisFormalCharges: { 0: 2, 1: -1, 2: -1 }`（S带+2，O各带-1）
  - 3D模型显示离域π键，电子式显示Lewis结构
- O₃（MOL-018）：
  - 已有bondTypeOverrides: delocalized
  - 添加 `electronFormulaType: 'lewis'`
  - 添加 `lewisFormalCharges: { 0: 1, 1: -1, 2: 0 }`（中心O带+1，一个O带-1）

**化学依据：**
- 北京教材使用Lewis结构式（S=带+2，O带-1）
- 实际上SO₂和O₃是等电子体，有共振结构

**最小更改：** 是 - 仅影响电子式显示

---

### 8. XeF₂孤电子对计算修复

**问题描述：** XeF₂的氙原子少算了一对孤电子（应有3对，算法只算出2对）。

**修复文件：**
- `src/engine/legacyBuilder.ts`

**修复内容：**
- 新增 `EXPANDABLE_OCTET` 常量，包含可超八隅体的元素（Si, P, S, Cl, Se, Br, I, Xe）
- 修改孤电子对计算逻辑，允许expandable元素扩展到6对孤电子对

**化学依据：**
- Xe有8个价电子
- XeF₂中Xe形成2个共价键（各用1电子），剩余6电子 = 3对孤电子对
- Xe可以扩展八隅体（超八隅体）

**最小更改：** 是 - 仅修改legacyBuilder的孤电子对计算

---

### 9. 删除普鲁士蓝

**问题描述：** 普鲁士蓝是晶体结构，不适合在此模块展示。

**修复文件：**
- `src/data/moleculeMetadata.ts`

**修复内容：**
- 从 `coordinationMolecules` 数组中删除 MOL-091（普鲁士蓝）

**化学依据：**
- 普鲁士蓝 Fe₄[Fe(CN)₆]₃ 是配位聚合物/晶体
- 晶体结构不适合用球棍模型展示

**最小更改：** 是 - 仅删除一个条目

---

## 分子数量变化

| 分类 | 修改前 | 修改后 |
|------|--------|--------|
| 总分子数 | 91 | 90 |

---

## 测试建议

1. **π键电子云方向**：检查乙烯(C₂H₄)、甲醛(HCHO)等sp²分子
2. **电子式过滤**：检查五氧化二磷、葡萄糖是否隐藏电子式选项
3. **结构简式**：检查氨（NH₃应隐藏N-H）、水（H₂O应隐藏O-H）、乙烯（C₂H₄应隐藏C-H）
4. **NO₂自由基**：检查二氧化氮的形式电荷是否为N+1
5. **SO₂/O₃**：检查电子式是否显示Lewis形式电荷，3D模型是否显示离域键
6. **XeF₂**：检查3D模型是否显示3对孤电子对
