import type { Entity, SegmentProperties, PointProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const KIND_LABELS: Record<string, string> = {
  pointPoint: '点到点距离',
  pointLine: '点到线距离',
  pointFace: '点到面距离',
  lineLine: '异面直线距离',
  lineFace: '线到面距离',
};

function DistanceMeasurementInspector({ entity }: { entity: Entity }) {
  const dmEntity = entity as Entity<'distanceMeasurement'>;
  const props = dmEntity.properties;

  const relatedLabelsStr = useEntityStore((s) => {
    return props.entityIds.map((id) => {
      const e = s.entities[id];
      if (!e) return '?';

      if (e.type === 'point') {
        return (e.properties as PointProperties).label || `点${e.id}`;
      }

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
  if (props.kind === 'pointPoint' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 点 ${relatedLabels[1]}`;
  } else if (props.kind === 'pointLine' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 线段 ${relatedLabels[1]}`;
  } else if (props.kind === 'pointFace' && relatedLabels.length >= 2) {
    relatedDesc = `点 ${relatedLabels[0]} 到 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineLine' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 与 线段 ${relatedLabels[1]}`;
  } else if (props.kind === 'lineFace' && relatedLabels.length >= 2) {
    relatedDesc = `线段 ${relatedLabels[0]} 到 ${relatedLabels[1]}`;
  }

  const hasLatex = props.distanceLatex.includes('\\');
  const kindLabel = KIND_LABELS[props.kind] || '距离度量';

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={kindLabel}
        displayName={relatedDesc || kindLabel}
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
        距离：<strong style={{ color: '#8b5cf6' }}>{props.distanceValue.toFixed(4)}</strong>
      </div>

      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        {hasLatex ? `精确值：${props.distanceLatex}` : `= ${props.distanceLatex}`}
      </div>

      {hasLatex && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          {props.distanceApprox}
        </div>
      )}
    </div>
  );
}

registerInspector('distanceMeasurement', DistanceMeasurementInspector);

export { DistanceMeasurementInspector };
