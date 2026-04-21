/**
 * PresetsPanel — Phase 8
 *
 * Three one-click preset configurations for typical Chinese high-school problems.
 * Pill-button style aligned with visual_template SYXMA design.
 */

import { Circle, GitBranch, CornerUpRight } from 'lucide-react';
import { useEntityStore } from '@/editor/store/entityStore';
import { createEntity }   from '@/editor/entities/types';
import { ENTITY_COLORS }  from '@/types';
import { COLORS }          from '@/styles/colors';
import type { ConicType } from '@/types';

// ─── Preset definitions ───────────────────────────────────────────────────────

interface PresetDef {
  name:     string;
  equation: string;
  type:     ConicType;
  params:   Record<string, number>;
  color:    string;
  label:    string;
  icon:     React.ComponentType<{ size?: string | number; strokeWidth?: string | number }>;
}

const PRESETS: PresetDef[] = [
  {
    name:     '椭圆',
    equation: 'x²/25+y²/9=1',
    type:     'ellipse',
    params:   { a: 5, b: 3, cx: 0, cy: 0 },
    color:    ENTITY_COLORS[0],
    label:    '标准椭圆',
    icon:     Circle,
  },
  {
    name:     '双曲线',
    equation: 'x²/9−y²/9=1',
    type:     'hyperbola',
    params:   { a: 3, b: 3, cx: 0, cy: 0 },
    color:    ENTITY_COLORS[1],
    label:    '直角双曲线',
    icon:     GitBranch,
  },
  {
    name:     '抛物线',
    equation: 'y²=4x',
    type:     'parabola',
    params:   { p: 2, cx: 0, cy: 0 },
    color:    ENTITY_COLORS[2],
    label:    '标准抛物线',
    icon:     CornerUpRight,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PresetsPanel() {
  const replaceAllEntities = useEntityStore((s) => s.replaceAllEntities);
  const setActiveEntityId  = useEntityStore((s) => s.setActiveEntityId);
  const entities           = useEntityStore((s) => s.entities);

  // Determine active preset type from first entity
  const activeType = entities.length > 0 ? entities[0].type : null;

  function handleLoad(preset: PresetDef) {
    const entity = createEntity(
      preset.type,
      preset.params as never,
      { color: preset.color, label: preset.label },
    );
    replaceAllEntities([entity]);
    setActiveEntityId(entity.id);
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: 600, marginRight: 2 }}>
        预设:
      </span>
      {PRESETS.map((preset) => {
        const isActive = activeType === preset.type;
        const Icon = preset.icon;
        return (
          <button
            key={preset.name}
            onClick={() => handleLoad(preset)}
            title={`${preset.name} ${preset.equation}`}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '5px',
              padding:      '4px 12px',
              background:   isActive ? COLORS.primary : 'transparent',
              border:       isActive ? 'none' : `1px solid ${COLORS.border}`,
              borderRadius: '9999px',
              cursor:       'pointer',
              fontSize:     13,
              fontWeight:   500,
              color:        isActive ? COLORS.white : COLORS.textSecondary,
              transition:   'all 0.15s',
              whiteSpace:   'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = COLORS.surfaceLight;
                e.currentTarget.style.color = COLORS.textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = COLORS.textSecondary;
              }
            }}
          >
            <Icon size={14} strokeWidth={2} />
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
