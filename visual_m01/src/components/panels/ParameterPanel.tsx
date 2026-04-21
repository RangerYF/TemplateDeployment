import { useRef, useCallback } from 'react';
import { useEntityStore, useHistoryStore, UpdateGeometryParamsCommand, getBuilderResult } from '@/editor';
import type { GeometryProperties } from '@/editor/entities/types';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { COLORS } from '@/styles/tokens';
import type { GeometryType, PyramidParams } from '@/types/geometry';

// ─── 参数项配置 ───

interface ParamField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

const PARAM_FIELDS: Record<string, ParamField[]> = {
  cuboid: [
    { key: 'length', label: '长', min: 0.5, max: 10, step: 0.1 },
    { key: 'width', label: '宽', min: 0.5, max: 10, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  cone: [
    { key: 'radius', label: '底面半径', min: 0.5, max: 5, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  cube: [
    { key: 'sideLength', label: '边长', min: 0.5, max: 10, step: 0.1 },
  ],
  pyramid: [
    { key: 'sides', label: '底面边数', min: 3, max: 8, step: 1 },
    { key: 'sideLength', label: '底面边长', min: 0.5, max: 10, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
    { key: 'lateralEdgeLength', label: '侧棱长', min: 0.5, max: 15, step: 0.1 },
  ],
  cylinder: [
    { key: 'radius', label: '底面半径', min: 0.5, max: 5, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  sphere: [
    { key: 'radius', label: '半径', min: 0.5, max: 5, step: 0.1 },
  ],
  regularTetrahedron: [
    { key: 'sideLength', label: '棱长', min: 0.5, max: 10, step: 0.1 },
  ],
  cornerTetrahedron: [
    { key: 'edgeA', label: '直角边 a', min: 0.5, max: 10, step: 0.1 },
    { key: 'edgeB', label: '直角边 b', min: 0.5, max: 10, step: 0.1 },
    { key: 'edgeC', label: '直角边 c', min: 0.5, max: 10, step: 0.1 },
  ],
  prism: [
    { key: 'sides', label: '底面边数', min: 3, max: 8, step: 1 },
    { key: 'sideLength', label: '底面边长', min: 0.5, max: 10, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  truncatedCone: [
    { key: 'topRadius', label: '上底半径', min: 0.1, max: 5, step: 0.1 },
    { key: 'bottomRadius', label: '下底半径', min: 0.5, max: 5, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  frustum: [
    { key: 'sides', label: '底面边数', min: 3, max: 8, step: 1 },
    { key: 'bottomSideLength', label: '下底边长', min: 0.5, max: 10, step: 0.1 },
    { key: 'topSideLength', label: '上底边长', min: 0.1, max: 10, step: 0.1 },
    { key: 'height', label: '高', min: 0.5, max: 10, step: 0.1 },
  ],
  isoscelesTetrahedron: [
    { key: 'edgeP', label: '对棱 p (AB=CD)', min: 0.5, max: 10, step: 0.1 },
    { key: 'edgeQ', label: '对棱 q (AC=BD)', min: 0.5, max: 10, step: 0.1 },
    { key: 'edgeR', label: '对棱 r (AD=BC)', min: 0.5, max: 10, step: 0.1 },
  ],
  orthogonalTetrahedron: [
    { key: 'edgeAB', label: '对棱 AB', min: 0.5, max: 10, step: 0.1 },
    { key: 'edgeCD', label: '对棱 CD', min: 0.5, max: 10, step: 0.1 },
  ],
};

// ─── 拓扑变化检测 ───

function isTopologyChange(geometryType: GeometryType, oldParams: Record<string, number>, newParams: Record<string, number>): boolean {
  if (geometryType === 'pyramid' || geometryType === 'prism' || geometryType === 'frustum') {
    return oldParams.sides !== newParams.sides;
  }
  return false;
}

// ─── 单个参数行 ───

function ParamRow({
  field,
  value,
  onSliderChange,
  onSliderCommit,
  onInputCommit,
}: {
  field: ParamField;
  value: number;
  onSliderChange: (v: number) => void;
  onSliderCommit: (v: number) => void;
  onInputCommit: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Label className="text-xs flex-shrink-0" style={{ width: 56, color: COLORS.textMuted }}>{field.label}</Label>
      <div className="flex-1 min-w-0">
        <Slider
          value={[value]}
          onValueChange={([v]) => onSliderChange(v)}
          onValueCommit={([v]) => onSliderCommit(v)}
          min={field.min}
          max={field.max}
          step={field.step}
        />
      </div>
      <Input
        type="number"
        value={value}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v >= field.min && v <= field.max) {
            onInputCommit(v);
          }
        }}
        className="w-14 h-6 text-xs text-center px-1 py-0 flex-shrink-0"
        style={{ borderRadius: 4 }}
      />
    </div>
  );
}

// ─── 参数面板 ───

export function ParameterPanel() {
  const geometryId = useEntityStore((s) => s.activeGeometryId);
  const geometryType = useEntityStore((s) => {
    if (!s.activeGeometryId) return undefined;
    const e = s.entities[s.activeGeometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).geometryType : undefined;
  });
  const params = useEntityStore((s) => {
    if (!s.activeGeometryId) return undefined;
    const e = s.entities[s.activeGeometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).params : undefined;
  });
  const beforeParamsRef = useRef<GeometryProperties['params'] | null>(null);

  const fields = geometryType ? PARAM_FIELDS[geometryType] : undefined;

  // 滑块实时拖动：直接更新 EntityStore（不发 Command）
  const handleSliderChange = useCallback((key: string, value: number) => {
    if (!geometryId || !params || !geometryType) return;

    // 首次拖动记录 beforeParams
    if (!beforeParamsRef.current) {
      beforeParamsRef.current = { ...params };
    }

    const newParams = { ...params, [key]: value };
    const store = useEntityStore.getState();
    store.updateProperties(geometryId, { params: newParams });

    // 拓扑变化时实时重建 builtIn 实体，避免旧拓扑渲染新参数导致线条错乱
    if (isTopologyChange(geometryType, params as unknown as Record<string, number>, newParams as unknown as Record<string, number>)) {
      const result = getBuilderResult(geometryId, geometryType, newParams as GeometryProperties['params']);
      if (result) {
        store.rebuildBuiltInEntities(geometryId, result);
      }
    }
  }, [geometryId, params, geometryType]);

  // 滑块松开：发 Command（支持 undo）
  const handleSliderCommit = useCallback((key: string, value: number) => {
    if (!geometryId || !geometryType || !beforeParamsRef.current) return;

    const oldParams = beforeParamsRef.current as unknown as Record<string, number>;
    const newParams = { ...oldParams, [key]: value } as unknown as GeometryProperties['params'];
    const topologyChanged = isTopologyChange(geometryType, oldParams, newParams as unknown as Record<string, number>);

    let oldBuiltInSnapshot: ReturnType<typeof useEntityStore.getState>['entities'] extends Record<string, infer E> ? E[] : never[] = undefined as never;
    let newBuilderResult = undefined;

    if (topologyChanged) {
      oldBuiltInSnapshot = useEntityStore.getState().getBuiltInEntities(geometryId);
      newBuilderResult = getBuilderResult(geometryId, geometryType, newParams) ?? undefined;
    }

    useHistoryStore.getState().execute(
      new UpdateGeometryParamsCommand(
        geometryId,
        beforeParamsRef.current,
        newParams,
        topologyChanged,
        oldBuiltInSnapshot,
        newBuilderResult,
      ),
    );

    beforeParamsRef.current = null;
  }, [geometryId, geometryType]);

  // 数字输入框：直接发 Command
  const handleInputCommit = useCallback((key: string, value: number) => {
    if (!geometryId || !params || !geometryType) return;

    const oldParams = { ...params };
    const newParams = { ...params, [key]: value } as GeometryProperties['params'];
    const topologyChanged = isTopologyChange(geometryType, oldParams as unknown as Record<string, number>, newParams as unknown as Record<string, number>);

    let oldBuiltInSnapshot = undefined;
    let newBuilderResult = undefined;

    if (topologyChanged) {
      oldBuiltInSnapshot = useEntityStore.getState().getBuiltInEntities(geometryId);
      newBuilderResult = getBuilderResult(geometryId, geometryType, newParams) ?? undefined;
    }

    useHistoryStore.getState().execute(
      new UpdateGeometryParamsCommand(
        geometryId,
        oldParams,
        newParams,
        topologyChanged,
        oldBuiltInSnapshot,
        newBuilderResult,
      ),
    );
  }, [geometryId, params, geometryType]);

  // ─── 棱锥高度 ⇄ 侧棱长联动 ───
  const pyramidParams = geometryType === 'pyramid' ? (params as unknown as PyramidParams) : null;

  /** 计算棱锥底面外接圆半径 */
  const getPyramidR = useCallback(() => {
    if (!pyramidParams) return 0;
    const n = Math.max(3, Math.min(8, Math.round(pyramidParams.sides)));
    return pyramidParams.sideLength / (2 * Math.sin(Math.PI / n));
  }, [pyramidParams]);

  /** 棱锥联动处理：修改 key 时同步另一个参数 */
  const syncPyramidParam = useCallback((key: string, value: number): Record<string, unknown> | null => {
    if (!pyramidParams) return null;
    const R = getPyramidR();

    if (key === 'height') {
      return { lateralEdgeLength: Math.sqrt(value * value + R * R) };
    }
    if (key === 'lateralEdgeLength') {
      const h = value * value > R * R ? Math.sqrt(value * value - R * R) : 0.01;
      return { height: h };
    }
    if (key === 'sides' || key === 'sideLength') {
      // R 变化，根据当前 height 重算侧棱长
      const newSideLength = key === 'sideLength' ? value : pyramidParams.sideLength;
      const newSides = key === 'sides' ? value : pyramidParams.sides;
      const n = Math.max(3, Math.min(8, Math.round(newSides)));
      const newR = newSideLength / (2 * Math.sin(Math.PI / n));
      return { lateralEdgeLength: Math.sqrt(pyramidParams.height * pyramidParams.height + newR * newR) };
    }
    return null;
  }, [pyramidParams, getPyramidR]);

  // 包装原始 handler，增加棱锥联动
  const handleSliderChangeSynced = useCallback((key: string, value: number) => {
    if (!geometryId || !params || !geometryType) return;

    if (!beforeParamsRef.current) {
      beforeParamsRef.current = { ...params };
    }

    const syncPatch = geometryType === 'pyramid' ? syncPyramidParam(key, value) : null;
    const newParams = syncPatch
      ? { ...params, [key]: value, ...syncPatch }
      : { ...params, [key]: value };

    const store = useEntityStore.getState();
    store.updateProperties(geometryId, { params: newParams });

    // 拓扑变化时实时重建 builtIn 实体
    if (isTopologyChange(geometryType, params as unknown as Record<string, number>, newParams as unknown as Record<string, number>)) {
      const result = getBuilderResult(geometryId, geometryType, newParams as GeometryProperties['params']);
      if (result) {
        store.rebuildBuiltInEntities(geometryId, result);
      }
    }
  }, [geometryId, params, geometryType, syncPyramidParam]);

  const handleSliderCommitSynced = useCallback((key: string, value: number) => {
    if (!geometryId || !geometryType || !beforeParamsRef.current) return;

    const oldParams = beforeParamsRef.current as unknown as Record<string, number>;
    const syncPatch = geometryType === 'pyramid' ? syncPyramidParam(key, value) : null;
    const newParams = syncPatch
      ? { ...oldParams, [key]: value, ...syncPatch } as unknown as GeometryProperties['params']
      : { ...oldParams, [key]: value } as unknown as GeometryProperties['params'];
    const topologyChanged = isTopologyChange(geometryType, oldParams, newParams as unknown as Record<string, number>);

    let oldBuiltInSnapshot: ReturnType<typeof useEntityStore.getState>['entities'] extends Record<string, infer E> ? E[] : never[] = undefined as never;
    let newBuilderResult = undefined;

    if (topologyChanged) {
      oldBuiltInSnapshot = useEntityStore.getState().getBuiltInEntities(geometryId);
      newBuilderResult = getBuilderResult(geometryId, geometryType, newParams) ?? undefined;
    }

    useHistoryStore.getState().execute(
      new UpdateGeometryParamsCommand(
        geometryId,
        beforeParamsRef.current,
        newParams,
        topologyChanged,
        oldBuiltInSnapshot,
        newBuilderResult,
      ),
    );

    beforeParamsRef.current = null;
  }, [geometryId, geometryType, syncPyramidParam]);

  const handleInputCommitSynced = useCallback((key: string, value: number) => {
    if (!geometryId || !params || !geometryType) return;

    const oldParams = { ...params };
    const syncPatch = geometryType === 'pyramid' ? syncPyramidParam(key, value) : null;
    const newParams = syncPatch
      ? { ...params, [key]: value, ...syncPatch } as GeometryProperties['params']
      : { ...params, [key]: value } as GeometryProperties['params'];
    const topologyChanged = isTopologyChange(geometryType, oldParams as unknown as Record<string, number>, newParams as unknown as Record<string, number>);

    let oldBuiltInSnapshot = undefined;
    let newBuilderResult = undefined;

    if (topologyChanged) {
      oldBuiltInSnapshot = useEntityStore.getState().getBuiltInEntities(geometryId);
      newBuilderResult = getBuilderResult(geometryId, geometryType, newParams) ?? undefined;
    }

    useHistoryStore.getState().execute(
      new UpdateGeometryParamsCommand(
        geometryId,
        oldParams,
        newParams,
        topologyChanged,
        oldBuiltInSnapshot,
        newBuilderResult,
      ),
    );
  }, [geometryId, params, geometryType, syncPyramidParam]);

  if (!fields) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-sm" style={{ color: COLORS.textPlaceholder }}>
          暂不支持该几何体参数调节
        </span>
      </div>
    );
  }

  // 动态参数范围调整
  const displayFields = (() => {
    // 棱锥：侧棱长 min > R，max 保证有效范围充足
    if (geometryType === 'pyramid' && pyramidParams) {
      return fields.map((f) => {
        if (f.key === 'lateralEdgeLength') {
          const R = getPyramidR();
          const dynamicMin = Math.round((R + 0.01) * 100) / 100;
          const dynamicMax = Math.max(15, Math.round((R + 5) * 100) / 100);
          return { ...f, min: dynamicMin, max: dynamicMax };
        }
        return f;
      });
    }
    // 棱台、圆台：使用静态范围，避免动态 min/max 导致相邻滑块 thumb 跳动和填充条失真
    // builder 不依赖上下底约束，上底 > 下底只是产生上宽下窄的形状
    return fields;
  })();

  // 棱锥联动字段标记
  const LINKED_KEYS = new Set(['height', 'lateralEdgeLength']);
  const isPyramidLinked = geometryType === 'pyramid';

  // 确保棱锥的 lateralEdgeLength 有初始值
  const paramValues = params as unknown as Record<string, number>;
  const getParamValue = (key: string): number => {
    if (key === 'lateralEdgeLength' && isPyramidLinked && pyramidParams && paramValues[key] === undefined) {
      const R = getPyramidR();
      return Math.sqrt(pyramidParams.height * pyramidParams.height + R * R);
    }
    return paramValues[key];
  };

  // 棱锥使用联动 handler，非棱锥使用原始 handler
  const sliderChange = isPyramidLinked ? handleSliderChangeSynced : handleSliderChange;
  const sliderCommit = isPyramidLinked ? handleSliderCommitSynced : handleSliderCommit;
  const inputCommit = isPyramidLinked ? handleInputCommitSynced : handleInputCommit;

  // 分离棱锥联动字段和普通字段
  const normalFields = isPyramidLinked
    ? displayFields.filter((f) => !LINKED_KEYS.has(f.key))
    : displayFields;
  const linkedFields = isPyramidLinked
    ? displayFields.filter((f) => LINKED_KEYS.has(f.key))
    : [];

  return (
    <div>
      {normalFields.map((field) => (
        <ParamRow
          key={field.key}
          field={field}
          value={getParamValue(field.key)}
          onSliderChange={(v) => sliderChange(field.key, v)}
          onSliderCommit={(v) => sliderCommit(field.key, v)}
          onInputCommit={(v) => inputCommit(field.key, v)}
        />
      ))}
      {linkedFields.length > 0 && (
        <div
          className="mt-1 pt-1 rounded"
          style={{ borderLeft: `2px solid ${COLORS.primary}40`, paddingLeft: 6 }}
        >
          <div
            className="text-xs px-1 mb-0.5"
            style={{ color: COLORS.primary }}
          >
            ↕ 联动
          </div>
          <div className="flex gap-1">
            {linkedFields.map((field) => (
              <div key={field.key} className="flex-1 min-w-0">
                <div className="flex items-center gap-1 py-0.5">
                  <Label className="text-xs flex-shrink-0" style={{ color: COLORS.textMuted }}>{field.label}</Label>
                  <Input
                    type="number"
                    value={getParamValue(field.key)}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v >= field.min && v <= field.max) {
                        inputCommit(field.key, v);
                      }
                    }}
                    className="w-full h-6 text-xs text-center px-1 py-0"
                    style={{ borderRadius: 4 }}
                  />
                </div>
                <Slider
                  value={[getParamValue(field.key)]}
                  onValueChange={([v]) => sliderChange(field.key, v)}
                  onValueCommit={([v]) => sliderCommit(field.key, v)}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
