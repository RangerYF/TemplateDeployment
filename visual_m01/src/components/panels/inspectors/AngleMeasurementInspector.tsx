import type { Entity, SegmentProperties, PointProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const KIND_LABELS: Record<string, string> = {
  dihedral: '二面角',
  lineFace: '线面角',
  lineLine: '线线角',
};

function AngleMeasurementInspector({ entity }: { entity: Entity }) {
  const amEntity = entity as Entity<'angleMeasurement'>;
  const props = amEntity.properties;

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

  const hasLatex = props.angleLatex.includes('\\');
  const kindLabel = KIND_LABELS[props.kind] || '角度度量';

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={kindLabel}
        displayName={`${props.angleDegrees.toFixed(1)}°`}
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
        角度：<strong style={{ color: '#f97316' }}>{props.angleDegrees.toFixed(2)}°</strong>
      </div>

      {hasLatex && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          精确值：{props.angleLatex}
        </div>
      )}
    </div>
  );
}

registerInspector('angleMeasurement', AngleMeasurementInspector);

export { AngleMeasurementInspector };
