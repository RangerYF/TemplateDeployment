# 正反示例对照

## pitfalls.md

### 好的条目

```markdown
### 旋转方向计算
- **现象**：鼠标顺时针移动，物体逆时针旋转
- **原因**：`atan2(dx, dy)` 计算的是从 Y+ 轴到鼠标向量的顺时针角度，但物理引擎 angle 为 CCW 正方向。物体局部 Y-up = `(-sin(a), cos(a))`，要让它指向鼠标需取反 dx
- **修复**：`Math.atan2(-dx, dy)` 而非 `Math.atan2(dx, dy)`
- **文件**：SelectTool.ts
```

有根因分析，有具体的修复方法，有涉及文件。下次遇到旋转相关开发时能直接避坑。

### 差的条目

```markdown
### 旋转 bug
- 旋转方向不对，改了 atan2 的参数就好了
```

缺少根因分析（为什么不对？），修复描述模糊（改了什么参数？），没有文件引用。下次遇到时无法判断是否是同一个问题。

---

## architecture.md

### 好的条目

```markdown
### Registry 模式
**原则**：新增物体/约束/力 = 1 个描述文件 + 1 行 import，删除 = 删 1 个文件。

**实现**：`src/models/bodyTypes/registry.ts` 维护 `Map<BodyType, BodyTypeDescriptor>`。

**扩展指导**：未来的约束系统（JointDescriptor + jointRegistry）和力系统应复用此模式，避免 switch/case 分散耦合。
```

清晰的原则、精确的文件路径、对未来的扩展指导。

### 差的条目

```markdown
### Registry 模式
所有物体类型都注册在 registry.ts 里，用 Map 存储。调用 registerBodyType 注册，getBodyDescriptor 查询。
```

只描述了"是什么"（可以从代码看到），缺少"为什么这样设计"和"未来怎么扩展"。

---

## playbooks/

### 好的条目

```markdown
### 2.1 创建描述符文件
在 `src/models/bodyTypes/` 创建 `yourType.tsx`。

实现必需接口：
- toShapeConfig(body) — 返回 ShapeConfig
- toDensity(body) — 返回密度
- renderEdit(ctx, body, scale) — Canvas 2D 编辑模式渲染
- ...

### 2.2 注册到 Registry
在 `src/models/bodyTypes/registry.ts` 添加 import。
```

精确到文件路径和具体操作，一个新对话中的 Claude 能直接执行。

### 差的条目

```markdown
### 2. 实现
创建描述符文件并注册。
```

没有文件路径，没有具体接口要求，无法直接执行。

---

## product.md

### 好的条目

```markdown
| Ground | vertical-only | false | false | false | X 锁定，仅可上下调整高度 |
```

具体的约束值，有特殊说明。

### 差的条目

```markdown
Ground 的交互有一些限制。
```

模糊，不知道具体限制了什么。

---

## design.md

### 好的条目

```markdown
- 选中态：蓝色 `#3b82f6`
- 对齐辅助线：蓝色虚线 `#3b82f6`，lineWidth=1，setLineDash([4,4])
```

有具体的颜色值、线宽、虚线参数。

### 差的条目

```markdown
- 选中时显示蓝色高亮
- 对齐时显示虚线
```

"蓝色"是哪个蓝？"虚线"多宽多长？无法直接实现。

---

## 不应该记录的例子

以下内容**不应写入知识库**：

```markdown
### 修复了 Canvas.tsx 第 42 行的拼写错误
```
→ 一次性修改，不可复用，git log 能看到

```markdown
### SceneBody 接口有 x, y, width, height, angle 字段
```
→ 能从代码直接看到，不需要记录

```markdown
### 考虑用 WebGL 替代 Canvas 2D
```
→ 未验证的想法，不是已确立的知识
