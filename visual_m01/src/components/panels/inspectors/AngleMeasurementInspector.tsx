import { useMemo } from 'react';
import type { Entity, SegmentProperties, PointProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import {
  calculateDihedralAngle,
  calculateLineFaceAngle,
  calculateLineLineAngle,
} from '@/engine/math/angleCalculator';
import type { Vec3, BuilderResult } from '@/engine/types';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const KIND_LABELS: Record<string, string> = {
  dihedral: '二面角',
  lineFace: '线面角',
  lineLine: '线线角',
};

function getSegEndpoints(
  segId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): { start: Vec3; end: Vec3 } | null {
  const seg = entities[segId];
  if (!seg || seg.type !== 'segment') return null;
  const sp = (seg as Entity<'segment'>).properties;
  if (sp.startPointId && sp.endPointId) {
    const s = entities[sp.startPointId];
    const e = entities[sp.endPointId];
    if (s && s.type === 'point' && e && e.type === 'point') {
      const sPos = computePointPosition((s as Entity<'point'>).properties, result);
      const ePos = computePointPosition((e as Entity<'point'>).properties, result);
      if (sPos && ePos) return { start: sPos, end: ePos };
    }
  }
  if (sp.curvePoints && sp.curvePoints.length === 2) {
    return { start: sp.curvePoints[0], end: sp.curvePoints[1] };
  }
  return null;
}

function getFacePos(
  faceId: string,
  entities: Record<string, Entity>,
  result: BuilderResult,
): Vec3[] | null {
  const face = entities[faceId];
  if (!face || face.type !== 'face') return null;
  const fp = (face as Entity<'face'>).properties;
  if (fp.pointIds.length > 0) {
    const positions: Vec3[] = [];
    for (const pid of fp.pointIds) {
      const pe = entities[pid];
      if (!pe || pe.type !== 'point') return null;
      const pos = computePointPosition((pe as Entity<'point'>).properties, result);
      if (!pos) return null;
      positions.push(pos);
    }
    return positions.length >= 3 ? positions : null;
  }
  const src = fp.source;
  if (src.type === 'surface' && src.surfaceType === 'disk' && result.kind === 'surface') {
    const sf = result.faces[src.faceIndex];
    if (sf?.samplePoints && sf.samplePoints.length >= 3) return sf.samplePoints.slice(0, 3);
  }
  return null;
}

function AngleMeasurementInspector({ entity }: { entity: Entity }) {
  const amEntity = entity as Entity<'angleMeasurement'>;
  const props = amEntity.properties;
  const result = useBuilderResult(props.geometryId);
  const entities = useEntityStore((s) => s.entities);

  const liveAngle = useMemo(() => {
    if (!result) return null;
    if (props.kind === 'dihedral') {
      const [fId1, fId2] = props.entityIds;
      const f1 = getFacePos(fId1, entities, result);
      const f2 = getFacePos(fId2, entities, result);
      if (!f1 || !f2) return null;
      const f1Pts = (entities[fId1] as Entity<'face'>)?.properties.pointIds;
      const f2Pts = (entities[fId2] as Entity<'face'>)?.properties.pointIds;
      if (!f1Pts || !f2Pts) return null;
      const shared = f1Pts.filter((pid: string) => f2Pts.includes(pid));
      if (shared.length < 2) return null;
      const p1 = entities[shared[0]];
      const p2 = entities[shared[1]];
      if (!p1 || p1.type !== 'point' || !p2 || p2.type !== 'point') return null;
      const pos1 = computePointPosition((p1 as Entity<'point'>).properties, result);
      const pos2 = computePointPosition((p2 as Entity<'point'>).properties, result);
      if (!pos1 || !pos2) return null;
      return calculateDihedralAngle(pos1, pos2, f1, f2);
    }
    if (props.kind === 'lineFace') {
      const [segId, faceId] = props.entityIds;
      const ep = getSegEndpoints(segId, entities, result);
      const fp = getFacePos(faceId, entities, result);
      if (!ep || !fp) return null;
      return calculateLineFaceAngle(ep.start, ep.end, fp);
    }
    if (props.kind === 'lineLine') {
      const [sId1, sId2] = props.entityIds;
      const ep1 = getSegEndpoints(sId1, entities, result);
      const ep2 = getSegEndpoints(sId2, entities, result);
      if (!ep1 || !ep2) return null;
      return calculateLineLineAngle(ep1.start, ep1.end, ep2.start, ep2.end);
    }
    return null;
  }, [props.kind, props.entityIds, entities, result]);

  const angleDegrees = liveAngle?.degrees ?? props.angleDegrees;
  const angleLatex = liveAngle?.latex ?? props.angleLatex;

  const relatedLabelsStr = useEntityStore((s) => {
    return props.entityIds.map((id) => {
      const e = s.entities[id];
      if (!e) return '?';

      if (e.type === 'segment') {
        const segProps = e.properties as SegmentProperties;
        if (segProps.label) return segProps.label;
        const sp = s.entities[segProps.startPointId];
        const ep = s.entities[segProps.endPointId];
        const sl = sp?.type === 'point' ? (sp.properties as PointProperties).label : '?';
        const el = ep?.type === 'point' ? (ep.properties as PointProperties).label : '?';
        return `${sl}${el}`;
      }

      if (e.type === 'face') {
        const faceProps = e.properties as { pointIds: string[] };
        const labels = faceProps.pointIds.map((pid: string) => {
          const pe = s.entities[pid];
          return pe?.type === 'point' ? (pe.properties as PointProperties).label : '';
        }).filter(Boolean);
        return labels.length > 0 ? `面${labels.join('')}` : '面';
      }

      return '?';
    }).join('\0');
  });
  const relatedLabels = relatedLabelsStr.split('\0');

  let relatedDesc = '';
  if (props.kind === 'dihedral' && relatedLabels.length >= 2) {
    relatedDesc = `${relatedLabels[0]} 与 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineFace' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 与 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineLine' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 与 线段 ${relatedLabels[1]}`;
  }

  const hasLatex = angleLatex.includes('\\');
  const kindLabel = KIND_LABELS[props.kind] || '角度度量';

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={kindLabel}
        displayName={`${angleDegrees.toFixed(1)}°`}
        canDelete={true}
        deleteLabel="删除度量"
        canRename={false}
      />

      {relatedDesc && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          {relatedDesc}
        </div>
      )}

      <div className="text-sm" style={{ color: COLORS.text }}>
        角度：<strong style={{ color: '#f97316' }}>{angleDegrees.toFixed(2)}°</strong>
      </div>

      {hasLatex && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          精确值：{angleLatex}
        </div>
      )}
    </div>
  );
}

registerInspector('angleMeasurement', AngleMeasurementInspector);

export { AngleMeasurementInspector };
