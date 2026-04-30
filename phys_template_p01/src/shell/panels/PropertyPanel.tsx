import {
  inferQualifier,
  normalizeBuilderParamValues,
  type BuilderWorkspaceId,
  useBuilderStore,
  useBuilderWorkspace,
} from '@/store/builder-store';
import { entityRegistry } from '@/core/registries/entity-registry';
import {
  getProtectedBuilderEntityIds,
  resolveBuilderInstrumentSlotBindings,
  validateBuilderTemplateContext,
  type BuilderInstrumentEntityType,
} from '@/domains/em/builder/template-library';
import {
  resolveMeterConversionBuilderAnalysis,
  resolveOhmmeterBuilderAnalysis,
} from '@/domains/em/builder/template-analysis';
import { getConfiguredResistance, isCurrentMeter } from '@/domains/em/logic/circuit-solver-utils';
import {
  BuilderEntityParamField,
  BuilderEntityParamFields,
  filterEntitySchemasForTemplate,
  getTemplateSpecificEntityNote,
} from '@/shell/panels/BuilderParamEditor';
import { COLORS } from '@/styles/tokens';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

/**
 * 选中元件属性编辑面板（builder 模式右侧）
 */
export interface BuilderTemplateSummary {
  title: string;
  variantLabel: string;
  description: string;
  adjustableParts: string[];
  lockedParts: string[];
}

export interface BuilderStructureControls {
  familyTitle: string;
  structureLabel: string;
  selectedVariantId: string;
  variants: Array<{
    id: string;
    label: string;
    shortLabel?: string;
    description: string;
  }>;
  onSelectVariant: (variantId: string) => void;
}

export interface BuilderTemplateSlotContext {
  familyId: string;
  variantId: string;
}

interface PropertyPanelProps {
  workspaceId: BuilderWorkspaceId;
  templateSummary?: BuilderTemplateSummary | null;
  structureControls?: BuilderStructureControls | null;
  templateSlotContext?: BuilderTemplateSlotContext | null;
}

export function PropertyPanel({
  workspaceId,
  templateSummary,
  structureControls,
  templateSlotContext,
}: PropertyPanelProps) {
  const workspaceLabel = workspaceId === 'primary' ? '左工作区' : '右工作区';
  const selectedId = useBuilderWorkspace(workspaceId, (state) => state.selectedEntityId);
  const entities = useBuilderWorkspace(workspaceId, (state) => state.entities);
  const builderParamValues = useBuilderWorkspace(workspaceId, (state) => state.builderParamValues);
  const currentTemplateFamilyId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateFamilyId,
  );
  const removeEntity = useBuilderStore((s) => s.removeEntity);
  const updateProperty = useBuilderStore((s) => s.updateEntityProperty);
  const updateBuilderParam = useBuilderStore((s) => s.updateBuilderParam);

  const entity = selectedId ? entities.get(selectedId) : undefined;
  const protectedEntityIds = templateSlotContext
    ? getProtectedBuilderEntityIds({
        familyId: templateSlotContext.familyId,
        variantId: templateSlotContext.variantId,
        entities,
      })
    : null;

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 280,
        minWidth: 260,
        borderLeft: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="px-4 py-3 text-sm font-semibold"
        style={{ color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}
      >
        属性面板 · {workspaceLabel}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!entity && !templateSummary ? (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: COLORS.textMuted }}>
            点击画布中的元件查看属性
          </div>
        ) : (
          <div className="space-y-4">
            {templateSummary && <TemplateSummaryCard summary={templateSummary} />}
            {structureControls && <StructureControlsCard controls={structureControls} />}
            {templateSummary && templateSlotContext && (
              <TemplateSlotPanel
                workspaceId={workspaceId}
                slotContext={templateSlotContext}
                allEntities={entities}
                builderParamValues={builderParamValues}
                onUpdateEntityProperty={updateProperty}
                onUpdateBuilderParam={updateBuilderParam}
              />
            )}
            {templateSummary && templateSlotContext && (
              <TemplateRuleCard
                slotContext={templateSlotContext}
                allEntities={entities}
                builderParamValues={builderParamValues}
              />
            )}
            {templateSummary && templateSlotContext && (
              <TemplateQuickAdjustmentsCard
                slotContext={templateSlotContext}
                allEntities={entities}
                builderParamValues={builderParamValues}
                onUpdateEntityProperty={updateProperty}
                onUpdateBuilderParam={updateBuilderParam}
              />
            )}
            {templateSummary && (
              <TemplateResultSummaryCard
                slotContext={templateSlotContext}
                allEntities={entities}
                builderParamValues={builderParamValues}
              />
            )}
            {templateSummary && (
              <TemplateTeachingCard
                slotContext={templateSlotContext}
                allEntities={entities}
                builderParamValues={builderParamValues}
              />
            )}

            {!entity ? (
              <div
                className="rounded-lg border px-3 py-3 text-xs"
                style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted, color: COLORS.textMuted }}
              >
                当前先以模板结构为主。点击电路中的具体元件后，这里会显示该元件的参数；模板骨架和关键测量节点默认不建议手工改动。
              </div>
            ) : (
              <EntityProperties
                currentTemplateFamilyId={currentTemplateFamilyId}
                entity={entity}
                allEntities={entities}
                builderParamValues={builderParamValues}
                isDeleteDisabled={Boolean(protectedEntityIds?.has(entity.id))}
                onUpdate={(key, value) => updateProperty(entity.id, key, value, workspaceId)}
                onUpdateBuilderParam={(key, value) => updateBuilderParam(key, value, workspaceId)}
                onDelete={() => removeEntity(entity.id, workspaceId)}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function TemplateSummaryCard({ summary }: { summary: BuilderTemplateSummary }) {
  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.primary + '33', backgroundColor: COLORS.primaryLight }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.primary }}>
          当前模板
        </div>
        <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.text }}>
          {summary.title}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textSecondary }}>
          {summary.variantLabel}
        </div>
        <div className="mt-2 text-[11px]" style={{ color: COLORS.textSecondary, lineHeight: 1.6 }}>
          {summary.description}
        </div>
      </div>

      <TemplateSummaryBlock label="优先调整" items={summary.adjustableParts} />
      <TemplateSummaryBlock label="默认锁定" items={summary.lockedParts} />
    </div>
  );
}

function TemplateSummaryBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: COLORS.bg }}
    >
      <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
      {items.length === 0 ? (
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
          暂无
        </div>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li
              key={`${label}-${item}`}
              className="flex items-start gap-2 text-[11px]"
              style={{ color: COLORS.textSecondary, lineHeight: 1.6 }}
            >
              <span style={{ color: COLORS.primary }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StructureControlsCard({ controls }: { controls: BuilderStructureControls }) {
  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          结构切换
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {controls.familyTitle} · {controls.structureLabel}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {controls.variants.map((variant) => {
          const isActive = variant.id === controls.selectedVariantId;

          return (
            <button
              key={variant.id}
              onClick={() => controls.onSelectVariant(variant.id)}
              className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
              style={{
                color: isActive ? COLORS.text : COLORS.textSecondary,
                backgroundColor: isActive ? COLORS.bg : COLORS.bgMuted,
                border: isActive ? 'none' : `1px solid ${COLORS.border}`,
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(0,0,0,0)' : 'none',
              }}
              title={variant.description}
            >
              {variant.shortLabel ?? variant.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type InstrumentPreset = {
  id: string;
  label: string;
  properties: Record<string, number | boolean | string>;
};

const INSTRUMENT_PRESETS: Record<string, InstrumentPreset[]> = {
  ammeter: [
    { id: 'ammeter-0.6', label: '0.6A 表', properties: { range: 0.6, internalResistance: 0.2 } },
    { id: 'ammeter-3', label: '3A 表', properties: { range: 3, internalResistance: 0.1 } },
  ],
  voltmeter: [
    { id: 'voltmeter-3', label: '3V 表', properties: { range: 3, internalResistance: 3000 } },
    { id: 'voltmeter-15', label: '15V 表', properties: { range: 15, internalResistance: 15000 } },
  ],
  galvanometer: [
    { id: 'galvanometer-300', label: '300μA', properties: { range: 300, internalResistance: 100 } },
    { id: 'galvanometer-500', label: '500μA', properties: { range: 500, internalResistance: 100 } },
    { id: 'galvanometer-1000', label: '1mA', properties: { range: 1000, internalResistance: 100 } },
  ],
};

function TemplateSlotPanel({
  workspaceId,
  slotContext,
  allEntities,
  builderParamValues,
  onUpdateEntityProperty,
  onUpdateBuilderParam,
}: {
  workspaceId: BuilderWorkspaceId;
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
  onUpdateEntityProperty: (id: string, key: string, value: unknown) => void;
  onUpdateBuilderParam: (key: string, value: number | boolean | string) => void;
}) {
  const slotBindings = resolveBuilderInstrumentSlotBindings({
    familyId: slotContext.familyId,
    variantId: slotContext.variantId,
    entities: allEntities,
  });
  const normalizedBuilderParams = normalizeBuilderParamValues(allEntities, builderParamValues);

  if (slotBindings.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          模板槽位
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
          槽位按模板语义固定。可以在槽位内切器材类型、改规格，并指定当前参与判读的仪表。
        </div>
      </div>

      {slotBindings.map(({ slot, entity }) => {
        const currentType = entity?.type as BuilderInstrumentEntityType | undefined;
        const presets = currentType ? (INSTRUMENT_PRESETS[currentType] ?? []) : [];
        const registration = currentType ? entityRegistry.get(currentType) : undefined;
        const activityParamKey = slot.activityRole === 'voltage'
          ? 'activeVoltmeterId'
          : slot.activityRole === 'current'
            ? 'activeCurrentMeterId'
            : null;
        const isActiveInstrument = entity
          ? activityParamKey != null &&
            (builderParamValues[activityParamKey] === entity.id ||
              normalizedBuilderParams[activityParamKey] === entity.id)
          : false;

        return (
          <div
            key={slot.id}
            className="rounded-lg border px-3 py-3"
            style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
                  {slot.label}
                </div>
                <div className="mt-1 text-[10px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
                  {slot.description}
                </div>
              </div>

              {entity && activityParamKey && (
                <button
                  onClick={() => onUpdateBuilderParam(activityParamKey, entity.id)}
                  className="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
                  style={{
                    color: isActiveInstrument ? COLORS.primary : COLORS.textSecondary,
                    backgroundColor: isActiveInstrument ? COLORS.primaryLight : COLORS.bg,
                    border: `1px solid ${isActiveInstrument ? COLORS.primary : COLORS.border}`,
                  }}
                >
                  {isActiveInstrument ? '当前判读' : '设为判读'}
                </button>
              )}
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
                可用器材
              </div>
              <ul className="mt-1 space-y-1">
                {slot.allowedEntityTypes.map((type) => (
                  <li
                    key={`${slot.id}-allowed-${type}`}
                    className="flex items-start gap-2 text-[10px]"
                    style={{ color: COLORS.textMuted, lineHeight: 1.5 }}
                  >
                    <span style={{ color: COLORS.primary }}>•</span>
                    <span>{formatInstrumentTypeLabel(type)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {slot.allowedEntityTypes.map((type) => {
                const isCurrentType = currentType === type;

                return (
                  <button
                    key={`${slot.id}-${type}`}
                    onClick={() => {
                      if (entity && !isCurrentType) {
                        replaceBuilderEntityType(workspaceId, entity.id, type);
                      }
                    }}
                    disabled={!entity || isCurrentType}
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      color: isCurrentType ? COLORS.primary : COLORS.textSecondary,
                      backgroundColor: isCurrentType ? COLORS.primaryLight : COLORS.bg,
                      border: `1px solid ${isCurrentType ? COLORS.primary : COLORS.border}`,
                    }}
                  >
                    {formatInstrumentTypeLabel(type)}
                  </button>
                );
              })}
            </div>

            {!entity ? (
              <div
                className="mt-3 rounded-lg border px-3 py-2 text-[11px]"
                style={{ borderColor: COLORS.warning + '55', backgroundColor: COLORS.warningLight, color: '#92400E' }}
              >
                当前模板没有解析出这个槽位对应的器材，请检查模板结构或元件替换逻辑。
              </div>
            ) : (
              <>
                <div
                  className="mt-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
                >
                  <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
                    当前绑定
                  </div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: COLORS.text }}>
                    {entity.label ?? registration?.label ?? entity.type}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: COLORS.textMuted }}>
                    {formatInstrumentSpec(entity)}
                  </div>
                </div>

                {presets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {presets.map((preset) => {
                      const isMatched = Object.entries(preset.properties).every(
                        ([key, value]) => entity.properties[key] === value,
                      );

                      return (
                        <button
                          key={preset.id}
                          onClick={() => {
                            for (const [key, value] of Object.entries(preset.properties)) {
                              onUpdateEntityProperty(entity.id, key, value);
                            }
                          }}
                          className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                          style={{
                            color: isMatched ? COLORS.primary : COLORS.textSecondary,
                            backgroundColor: isMatched ? COLORS.primaryLight : COLORS.bg,
                            border: `1px solid ${isMatched ? COLORS.primary : COLORS.border}`,
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatInstrumentTypeLabel(type: BuilderInstrumentEntityType): string {
  switch (type) {
    case 'ammeter':
      return '电流表';
    case 'voltmeter':
      return '电压表';
    case 'galvanometer':
      return '灵敏电流计';
  }
}

function replaceBuilderEntityType(
  workspaceId: BuilderWorkspaceId,
  entityId: string,
  newType: BuilderInstrumentEntityType,
): void {
  const store = useBuilderStore.getState();
  const currentEntity = store.workspaces[workspaceId].entities.get(entityId);
  if (!currentEntity || currentEntity.type === newType) return;

  const nextProperties: Record<string, unknown> = {};
  const internalResistance = currentEntity.properties.internalResistance;
  if (internalResistance != null) {
    nextProperties.internalResistance = internalResistance;
  }

  store.replaceEntityType(entityId, newType, nextProperties, workspaceId);
}

function formatInstrumentSpec(entity: import('@/core/types').Entity): string {
  const range = entity.properties.range as number | undefined;
  const internalResistance = entity.properties.internalResistance as number | undefined;

  if (entity.type === 'galvanometer') {
    return `满偏 ${range ?? '—'} μA · 内阻 ${internalResistance ?? '—'} Ω`;
  }

  if (entity.type === 'voltmeter') {
    return `量程 ${range ?? '—'} V · 内阻 ${internalResistance ?? '—'} Ω`;
  }

  return `量程 ${range ?? '—'} A · 内阻 ${internalResistance ?? '—'} Ω`;
}

function TemplateResultSummaryCard({
  slotContext,
  allEntities,
  builderParamValues,
}: {
  slotContext?: BuilderTemplateSlotContext | null;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
}) {
  if (slotContext?.familyId === 'meter-conversion') {
    return (
      <MeterConversionResultCard
        slotContext={slotContext}
        allEntities={allEntities}
        builderParamValues={builderParamValues}
      />
    );
  }

  if (slotContext?.familyId === 'ohmmeter') {
    return (
      <OhmmeterTeachingResultCard
        slotContext={slotContext}
        allEntities={allEntities}
      />
    );
  }

  const source = Array.from(allEntities.values()).find((entity) => entity.type === 'dc-source');
  if (!source) return null;

  const normalizedBuilderParams = normalizeBuilderParamValues(allEntities, builderParamValues);
  const currentMeter = normalizedBuilderParams.activeCurrentMeterId
    ? allEntities.get(String(normalizedBuilderParams.activeCurrentMeterId))
    : Array.from(allEntities.values()).find((entity) => isCurrentMeter(entity.type));
  const voltmeter = normalizedBuilderParams.activeVoltmeterId
    ? allEntities.get(String(normalizedBuilderParams.activeVoltmeterId))
    : Array.from(allEntities.values()).find((entity) => entity.type === 'voltmeter');
  const resistor = Array.from(allEntities.values()).find(
    (entity) => entity.type === 'fixed-resistor' || entity.type === 'resistance-box',
  );
  const rheostat = Array.from(allEntities.values()).find((entity) => entity.type === 'slide-rheostat');
  const circuitType =
    (source.properties.circuitType as string | undefined) ??
    inferQualifier(allEntities)?.circuit ??
    'general-circuit';

  const metrics: Array<{ label: string; value: string; highlighted?: boolean }> = [];
  let note: string | null = null;

  switch (circuitType) {
    case 'voltammetry-internal':
    case 'voltammetry-external': {
      const measuredR = source.properties.measuredR as number | undefined;
      const trueR = (source.properties.trueR as number | undefined) ??
        (resistor?.properties.resistance as number | undefined);
      const error = source.properties.error as number | undefined;
      metrics.push(
        { label: 'I 表读数', value: formatCurrentValue(currentMeter?.properties.reading as number | undefined) },
        { label: 'V 表读数', value: formatVoltageValue(voltmeter?.properties.reading as number | undefined) },
        { label: 'R测', value: formatResistanceValue(measuredR, 2), highlighted: true },
      );
      if (trueR !== undefined) {
        metrics.push({ label: 'R真', value: formatResistanceValue(trueR, 2) });
      }
      if (error !== undefined) {
        note = `${circuitType === 'voltammetry-internal' ? '内接法' : '外接法'}当前相对误差 ${formatPercentValue(error)}。`;
      }
      break;
    }

    case 'measure-emf-r': {
      const lastI = source.properties.lastI as number | undefined;
      const lastU = source.properties.lastU as number | undefined;
      const measureMode = source.properties.measureMode as string | undefined;
      const outputVoltage = source.properties.outputVoltage as number | undefined;
      const outputCurrent = source.properties.outputCurrent as number | undefined;
      metrics.push(
        { label: '本次 I', value: formatCurrentValue(lastI), highlighted: true },
        { label: '本次 U', value: formatVoltageValue(lastU), highlighted: true },
        { label: '路端电压', value: formatVoltageValue(source.properties.terminalVoltage as number | undefined) },
      );
      if (rheostat) {
        metrics.push({
          label: measureMode === 'divider' ? '滑变总阻值' : '滑变有效阻值',
          value: formatResistanceValue(getConfiguredResistance(rheostat), 2),
        });
      }
      if (measureMode === 'divider') {
        metrics.push({ label: '滑片输出', value: formatVoltageValue(outputVoltage) });
        metrics.push({ label: '负载支路电流', value: formatCurrentValue(outputCurrent) });
        note = '当前按分压接法计算：滑片结构只负责改变外电路等效电阻；实验采样仍读取电源端电压 U 和主支路电流 I。';
      } else {
        note = '当前按限流接法计算：滑动变阻器串联在主回路中，通过改变主路电流影响测量点。';
      }
      break;
    }

    case 'half-deflection-ammeter':
    case 'half-deflection-voltmeter': {
      const currentReading = source.properties.currentReading as number | undefined;
      const targetHalfReading = source.properties.targetHalfReading as number | undefined;
      const estimatedResistance =
        (source.properties.estimatedResistance as number | undefined) ??
        (source.properties.currentHalfResistance as number | undefined);
      const currentErrorPercent = source.properties.currentErrorPercent as number | undefined;

      metrics.push(
        {
          label: '当前读数',
          value:
            circuitType === 'half-deflection-voltmeter'
              ? formatVoltageValue(currentReading)
              : formatCurrentValue(currentReading),
          highlighted: true,
        },
        {
          label: '半偏目标',
          value:
            circuitType === 'half-deflection-voltmeter'
              ? formatVoltageValue(targetHalfReading)
              : formatCurrentValue(targetHalfReading),
        },
        {
          label: '当前估计值',
          value: formatResistanceValue(estimatedResistance, 2),
          highlighted: true,
        },
      );
      if (currentErrorPercent !== undefined) {
        note = `当前近似误差 ${formatPercentValue(currentErrorPercent / 100)}。`;
      }
      break;
    }

    case 'ohmmeter':
    case 'multi-range-ohmmeter': {
      const ohmReading = source.properties.ohmReading as number | undefined;
      const rMid = source.properties.R_mid as number | undefined;
      const deflectionRatio = source.properties.deflectionRatio as number | undefined;
      const isZeroed = Boolean(source.properties.isZeroed);
      const selectedRange = source.properties.selectedRange as string | undefined;
      const selectedResistance = source.properties.R_sel as number | undefined;

      metrics.push(
        { label: '欧姆表示值', value: formatResistanceValue(ohmReading, 2), highlighted: true },
        { label: '中值电阻', value: formatResistanceValue(rMid, 2) },
        { label: '偏转比例', value: deflectionRatio != null ? `${(deflectionRatio * 100).toFixed(1)}%` : '—' },
      );
      if (circuitType === 'multi-range-ohmmeter') {
        metrics.push({ label: '当前档位', value: selectedRange ?? '—' });
        metrics.push({ label: '档位串联电阻', value: formatResistanceValue(selectedResistance, 2) });
        note = `当前档位 ${selectedRange ?? '—'} 会直接改变中值电阻和测量范围。`;
      } else {
        note = isZeroed ? '当前已调零，可直接观察读数。' : '当前未完全调零，读数会带入系统偏差。';
      }
      break;
    }

    default: {
      metrics.push(
        { label: '总电流', value: formatCurrentValue(source.properties.totalCurrent as number | undefined), highlighted: true },
        { label: '路端电压', value: formatVoltageValue(source.properties.terminalVoltage as number | undefined) },
      );
      note = '当前仍按通用电路结果汇总显示。';
      break;
    }
  }

  if (metrics.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          结果摘要
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          当前模板的关键读数会随着参数变化实时刷新。
        </div>
      </div>

      <MetricList metrics={metrics} />

      {note && (
        <div
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary, lineHeight: 1.6 }}
        >
          {note}
        </div>
      )}
    </div>
  );
}

function TemplateQuickAdjustmentsCard({
  slotContext,
  allEntities,
  builderParamValues,
  onUpdateEntityProperty,
  onUpdateBuilderParam,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
  onUpdateEntityProperty: (id: string, key: string, value: unknown) => void;
  onUpdateBuilderParam: (key: string, value: number | boolean | string) => void;
}) {
  const sections = resolveTemplateQuickSections(slotContext, allEntities);
  if (sections.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          快捷调参
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          这里放当前模板最常调整的器材参数，减少来回点选元件。
        </div>
      </div>

      {slotContext.familyId === 'meter-conversion' && (
        <MeterConversionQuickControlCard
          slotContext={slotContext}
          allEntities={allEntities}
          builderParamValues={builderParamValues}
          onUpdateEntityProperty={onUpdateEntityProperty}
          onUpdateBuilderParam={onUpdateBuilderParam}
        />
      )}

      {sections.map((section) => (
        <QuickEntityEditorCard
          key={section.id}
          section={section}
          onUpdateEntityProperty={onUpdateEntityProperty}
        />
      ))}
    </div>
  );
}

interface QuickEditorSection {
  id: string;
  title: string;
  description: string;
  entity: import('@/core/types').Entity;
  paramKeys?: string[];
}

function resolveTemplateQuickSections(
  slotContext: BuilderTemplateSlotContext,
  allEntities: Map<string, import('@/core/types').Entity>,
): QuickEditorSection[] {
  const entities = Array.from(allEntities.values());
  const slots = resolveBuilderInstrumentSlotBindings({
    familyId: slotContext.familyId,
    variantId: slotContext.variantId,
    entities: allEntities,
  });

  const source = entities.find((entity) => entity.type === 'dc-source');
  const resistor = entities.find(
    (entity) =>
      (entity.type === 'fixed-resistor' || entity.type === 'resistance-box') &&
      !String(entity.label ?? '').includes('半偏'),
  );
  const halfResistor = entities.find((entity) => String(entity.label ?? '').includes('半偏') || String(entity.label ?? '').includes("R'"));
  const rheostat = entities.find((entity) => entity.type === 'slide-rheostat');
  const rangeSwitch = entities.find((entity) => entity.type === 'range-switch');
  const galvanometer = entities.find((entity) => entity.type === 'galvanometer');
  const ammeter = entities.find((entity) => entity.type === 'ammeter');
  const voltmeter = entities.find((entity) => entity.type === 'voltmeter');
  const switches = entities.filter((entity) => entity.type === 'switch');

  const sections: QuickEditorSection[] = [];
  const push = (section: QuickEditorSection | null) => {
    if (section?.entity) sections.push(section);
  };

  if (source) {
    push({
      id: 'source',
      title: '电源',
      description: '电动势与内阻',
      entity: source,
      paramKeys: ['emf', 'internalResistance'],
    });
  }

  switch (slotContext.familyId) {
    case 'voltammetry':
      if (resistor) {
        push({
          id: 'test-resistor',
          title: '被测电阻',
          description: 'Rx 的真实阻值',
          entity: resistor,
          paramKeys: ['faultType', 'resistance'],
        });
      }
      break;

    case 'measure-emf-r':
      if (rheostat) {
        push({
          id: 'rheostat',
          title: '滑动变阻器',
          description: '最大阻值与滑片位置',
          entity: rheostat,
          paramKeys: ['faultType', 'connectionMode', 'maxResistance', 'sliderRatio'],
        });
      }
      if (resistor) {
        push({
          id: 'load-resistor',
          title: '负载电阻',
          description: '分压模式下的负载支路电阻',
          entity: resistor,
          paramKeys: ['faultType', 'resistance'],
        });
      }
      break;

    case 'half-deflection':
      if (rheostat) {
        push({
          id: 'rheostat',
          title: '滑动变阻器',
          description: '设置基准读数的关键器材',
          entity: rheostat,
          paramKeys: ['faultType', 'maxResistance', 'sliderRatio'],
        });
      }
      if (halfResistor) {
        push({
          id: 'half-resistor',
          title: '半偏电阻',
          description: '决定半偏近似结果',
          entity: halfResistor,
          paramKeys: ['faultType', 'resistance'],
        });
      }
      break;

    case 'ohmmeter':
      if (rheostat) {
        push({
          id: 'zeroing-rheostat',
          title: '调零电阻',
          description: '影响欧姆表调零状态',
          entity: rheostat,
          paramKeys: ['faultType', 'maxResistance', 'sliderRatio'],
        });
      }
      if (rangeSwitch) {
        push({
          id: 'range-switch',
          title: '量程开关',
          description: '切换多量程欧姆表档位',
          entity: rangeSwitch,
          paramKeys: ['selectedIndex'],
        });
      }
      if (resistor) {
        push({
          id: 'ohmmeter-rx',
          title: '待测电阻',
          description: '当前被测电阻值',
          entity: resistor,
          paramKeys: ['faultType', 'resistance'],
        });
      }
      break;

    case 'meter-conversion':
      if (galvanometer) {
        push({
          id: 'conversion-galvanometer',
          title: '表头 G',
          description: '原表头的满偏电流与内阻',
          entity: galvanometer,
          paramKeys: ['range', 'internalResistance'],
        });
      }
      if (resistor) {
        push({
          id: 'conversion-accessory',
          title: slotContext.variantId === 'ammeter' ? '分流电阻 Rs' : '分压电阻 Rv',
          description: '当前实际接入的改装电阻',
          entity: resistor,
          paramKeys: ['resistance'],
        });
      }
      if (slotContext.variantId === 'ammeter' && ammeter) {
        push({
          id: 'conversion-target-ammeter',
          title: '改装后量程',
          description: '电流表目标量程',
          entity: ammeter,
          paramKeys: ['range'],
        });
      }
      if (slotContext.variantId === 'voltmeter' && voltmeter) {
        push({
          id: 'conversion-target-voltmeter',
          title: '改装后量程',
          description: '电压表目标量程',
          entity: voltmeter,
          paramKeys: ['range'],
        });
      }
      break;
  }

  for (const slot of slots) {
    if (!slot.entity) continue;
    push({
      id: `slot-${slot.slot.id}`,
      title: slot.slot.label,
      description: '量程与内阻',
      entity: slot.entity,
      paramKeys: ['range', 'internalResistance'],
    });
  }

  switches.forEach((switchEntity, index) => {
    push({
      id: `switch-${switchEntity.id}`,
      title: switchEntity.label ?? `开关 ${index + 1}`,
      description: '模板内的开关控制',
      entity: switchEntity,
      paramKeys: ['closed'],
    });
  });

  return dedupeQuickSections(sections);
}

function dedupeQuickSections(sections: QuickEditorSection[]): QuickEditorSection[] {
  const seen = new Set<string>();
  return sections.filter((section) => {
    if (seen.has(section.entity.id)) return false;
    seen.add(section.entity.id);
    return true;
  });
}

function QuickEntityEditorCard({
  section,
  onUpdateEntityProperty,
}: {
  section: QuickEditorSection;
  onUpdateEntityProperty: (id: string, key: string, value: unknown) => void;
}) {
  const registration = entityRegistry.get(section.entity.type);
  if (!registration) return null;

  const schemas = section.paramKeys?.length
    ? registration.paramSchemas.filter((schema) => section.paramKeys?.includes(schema.key))
    : registration.paramSchemas;
  if (schemas.length === 0) return null;

  return (
    <div
      className="rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
    >
      <div className="mb-3">
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          {section.title}
        </div>
        <div className="mt-1 text-[10px]" style={{ color: COLORS.textMuted }}>
          {section.description}
        </div>
      </div>

      <div className="space-y-3">
        {schemas.map((schema) => {
          const currentValue = section.entity.properties[schema.key];

          if (section.entity.type === 'range-switch' && schema.key === 'selectedIndex') {
            const ranges = Array.isArray(section.entity.properties.ranges)
              ? (section.entity.properties.ranges as Array<{ label?: unknown; resistance?: unknown }>)
              : [];
            const selectedIndex = Number(currentValue ?? 0);

            return (
              <div key={schema.key} className="space-y-2">
                <Label className="text-xs" style={{ color: COLORS.textSecondary }}>
                  {schema.label}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {ranges.map((range, index) => {
                    const active = index === selectedIndex;
                    const resistance = Number(range.resistance ?? 0);

                    return (
                      <button
                        key={`${schema.key}-${index}`}
                        onClick={() => onUpdateEntityProperty(section.entity.id, schema.key, index)}
                        className="rounded-lg border px-2 py-2 text-left transition-colors"
                        style={{
                          borderColor: active ? COLORS.primary : COLORS.border,
                          backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
                        }}
                      >
                        <div
                          className="text-[11px] font-semibold"
                          style={{ color: active ? COLORS.primary : COLORS.text }}
                        >
                          {String(range.label ?? `档位 ${index + 1}`)}
                        </div>
                        <div className="mt-1 text-[10px]" style={{ color: COLORS.textMuted }}>
                          串联 {formatResistanceValue(resistance, resistance < 100 ? 1 : 0)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <BuilderEntityParamField
              key={schema.key}
              entity={section.entity}
              schema={schema}
              onUpdate={(key, value) => onUpdateEntityProperty(section.entity.id, key, value)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MeterConversionQuickControlCard({
  slotContext,
  allEntities,
  builderParamValues,
  onUpdateEntityProperty,
  onUpdateBuilderParam,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
  onUpdateEntityProperty: (id: string, key: string, value: unknown) => void;
  onUpdateBuilderParam: (key: string, value: number | boolean | string) => void;
}) {
  const analysis = resolveMeterConversionBuilderAnalysis({
    variantId: slotContext.variantId,
    entities: allEntities,
    builderParamValues,
  });

  if (!analysis) {
    return (
      <div
        className="rounded-lg border px-3 py-3 text-[11px]"
        style={{ borderColor: COLORS.warning + '55', backgroundColor: COLORS.warningLight, color: '#92400E', lineHeight: 1.6 }}
      >
        电表改装模板暂时无法解析工作点，请确认表头、改装电阻和改装后的仪表都在场景中。
      </div>
    );
  }

  const precision = getNumberPrecision(analysis.operatingStep);
  const deviation = analysis.result.actualAccessoryResistance - analysis.result.idealAccessoryResistance;

  return (
    <div
      className="rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
    >
      <div className="mb-3">
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          工作点
        </div>
        <div className="mt-1 text-[10px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
          先确定改装后的目标量程，再把当前工作点推到量程的不同位置，观察指针偏转、示数偏差和过载风险。
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs" style={{ color: COLORS.textSecondary }}>
            {analysis.operatingLabel}
          </Label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={analysis.operatingInput.toFixed(precision)}
              min={0}
              max={analysis.maxOperatingInput}
              step={analysis.operatingStep}
              onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                if (!Number.isNaN(nextValue)) {
                  const clamped = Math.max(0, Math.min(analysis.maxOperatingInput, nextValue));
                  onUpdateBuilderParam('conversionOperatingInput', clamped);
                }
              }}
              className="w-20 rounded border px-1.5 py-0.5 text-right text-xs tabular-nums"
              style={{ borderColor: COLORS.border, color: COLORS.text }}
            />
            <span className="text-[10px]" style={{ color: COLORS.textMuted }}>
              {analysis.operatingUnit}
            </span>
          </div>
        </div>
        <Slider
          min={0}
          max={analysis.maxOperatingInput}
          step={analysis.operatingStep}
          value={[analysis.operatingInput]}
          onValueChange={([value]) => {
            if (value !== undefined) onUpdateBuilderParam('conversionOperatingInput', value);
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          { label: '70% 量程', value: analysis.result.targetRange * 0.7 },
          { label: '95% 量程', value: analysis.result.targetRange * 0.95 },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => onUpdateBuilderParam('conversionOperatingInput', Math.min(analysis.maxOperatingInput, preset.value))}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
            style={{ color: COLORS.textSecondary, backgroundColor: COLORS.bg, border: `1px solid ${COLORS.border}` }}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => onUpdateEntityProperty(analysis.accessory.id, 'resistance', analysis.result.idealAccessoryResistance)}
          className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
          style={{ color: COLORS.primary, backgroundColor: COLORS.primaryLight, border: `1px solid ${COLORS.primary}` }}
        >
          电阻取理论值
        </button>
      </div>

      <div
        className="mt-3 rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: COLORS.bg, color: COLORS.textSecondary, lineHeight: 1.6 }}
      >
        当前理论{analysis.mode === 'ammeter' ? ' Rs ' : ' Rv '}为
        {formatResistanceValue(analysis.result.idealAccessoryResistance, analysis.mode === 'ammeter' ? 3 : 1)}
        ，实际值为
        {formatResistanceValue(analysis.result.actualAccessoryResistance, analysis.mode === 'ammeter' ? 3 : 1)}
        ，偏差
        <span style={{ color: deviation === 0 ? COLORS.textSecondary : deviation > 0 ? COLORS.warning : COLORS.primary }}>
          {formatSignedPercentValue(analysis.result.fullScaleErrorPercent)}
        </span>
        （按满量程误差折算）。
      </div>
    </div>
  );
}

function TemplateRuleCard({
  slotContext,
  allEntities,
  builderParamValues,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
}) {
  const normalizedBuilderParams = normalizeBuilderParamValues(allEntities, builderParamValues);
  const validation = validateBuilderTemplateContext({
    familyId: slotContext.familyId,
    variantId: slotContext.variantId,
    entities: allEntities,
    activeCurrentMeterId: String(normalizedBuilderParams.activeCurrentMeterId ?? ''),
    activeVoltmeterId: String(normalizedBuilderParams.activeVoltmeterId ?? ''),
    builderParamValues: normalizedBuilderParams,
  });
  const infoLines = getTemplateRuleInfos(slotContext, allEntities, normalizedBuilderParams);

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          模板规则
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          这里显示当前模板的结构完整性和判读槽位提醒。
        </div>
      </div>

      {validation.errors.length === 0 && validation.warnings.length === 0 && (
        <div
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: COLORS.successLight, color: '#166534', lineHeight: 1.6 }}
        >
          当前模板结构完整，关键槽位和主判读仪表均已对齐。
        </div>
      )}

      {validation.errors.map((error) => (
        <div
          key={error}
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: COLORS.errorLight, color: COLORS.error, lineHeight: 1.6 }}
        >
          {error}
        </div>
      ))}

      {validation.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: COLORS.warningLight, color: '#92400E', lineHeight: 1.6 }}
        >
          {warning}
        </div>
      ))}

      {infoLines.map((line) => (
        <div
          key={line}
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{ backgroundColor: COLORS.primaryLight, color: COLORS.primary, lineHeight: 1.6 }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function MeterConversionResultCard({
  slotContext,
  allEntities,
  builderParamValues,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
}) {
  const analysis = resolveMeterConversionBuilderAnalysis({
    variantId: slotContext.variantId,
    entities: allEntities,
    builderParamValues,
  });
  if (!analysis) return null;

  const result = analysis.result;
  const scaleRows = result.scaleMarks.filter((mark) => mark.division % 2 === 0 || mark.division === 5);
  const primaryUnitLabel = analysis.mode === 'ammeter' ? '改装表示数' : '改装表示值';
  const actualReading =
    analysis.mode === 'ammeter'
      ? formatCurrentValue(result.indicatedValue)
      : formatVoltageValue(result.indicatedValue);
  const targetRangeLabel =
    analysis.mode === 'ammeter'
      ? formatCurrentValue(result.targetRange)
      : formatVoltageValue(result.targetRange);
  const originalFullScaleLabel =
    analysis.mode === 'ammeter'
      ? formatCurrentValue(result.originalFullScale)
      : formatVoltageValue(result.originalFullScale);
  const operatingInputLabel =
    analysis.mode === 'ammeter'
      ? formatCurrentValue(result.operatingInput)
      : formatVoltageValue(result.operatingInput);
  const accessoryLabel = analysis.mode === 'ammeter' ? '分流电阻 Rs' : '分压电阻 Rv';
  const statusLine = result.isUnsafe
    ? '当前工作点已经让表头越过额定满偏值，应先降低工作点或把改装电阻调回理论附近。'
    : result.isOverRange
      ? '当前工作点已超出改装后量程，机械指针会钉在满刻度附近，无法继续线性显示。'
      : result.isNearFullScale
        ? '当前工作点接近满量程，最适合观察“量程是否准确”和“偏差方向”。'
        : '当前工作点还留有余量，适合先比较理论电阻、实际电阻和指针偏转关系。';

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          教学结果
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          把表头参数、改装电阻、目标量程和当前工作点放到同一张结果卡里看。
        </div>
      </div>

      <MetricCards
        metrics={[
          { label: '目标量程', value: targetRangeLabel, highlighted: true },
          { label: '原表头满偏', value: originalFullScaleLabel },
          { label: primaryUnitLabel, value: actualReading, highlighted: true },
          { label: '当前工作点', value: operatingInputLabel },
          {
            label: accessoryLabel,
            value: formatResistanceValue(result.actualAccessoryResistance, analysis.mode === 'ammeter' ? 3 : 1),
          },
          {
            label: '当前误差',
            value: formatSignedPercentValue(result.currentErrorPercent),
            highlighted: result.isUnsafe || result.isOverRange,
          },
        ]}
      />

      <CompactRatioBar
        label="指针偏转"
        ratio={result.usedPointerRatio}
        note={`${(result.usedPointerRatio * 100).toFixed(1)}% 满偏`}
      />

      <div
        className="rounded-lg px-3 py-2 text-[11px]"
        style={{ backgroundColor: result.isUnsafe ? COLORS.warningLight : COLORS.bgMuted, color: result.isUnsafe ? '#92400E' : COLORS.textSecondary, lineHeight: 1.6 }}
      >
        {statusLine}
      </div>

      <div
        className="rounded-lg border px-3 py-3"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
      >
        <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
          关键对照
        </div>
        <div className="mt-2 space-y-2 text-[11px]" style={{ color: COLORS.textSecondary }}>
          <KeyValueRow
            label="理论改装电阻"
            value={formatResistanceValue(result.idealAccessoryResistance, analysis.mode === 'ammeter' ? 3 : 1)}
          />
          <KeyValueRow
            label="当前实际电阻"
            value={formatResistanceValue(result.actualAccessoryResistance, analysis.mode === 'ammeter' ? 3 : 1)}
          />
          <KeyValueRow
            label="满量程误差"
            value={formatSignedPercentValue(result.fullScaleErrorPercent)}
          />
          <KeyValueRow
            label={result.mode === 'ammeter' ? '等效内阻' : '输入电阻'}
            value={formatResistanceValue(
              result.mode === 'ammeter' ? result.equivalentResistanceActual : result.inputResistanceActual,
              result.mode === 'ammeter' ? 3 : 1,
            )}
          />
        </div>
      </div>

      <div
        className="rounded-lg border px-3 py-3"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
      >
        <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
          刻度语义
        </div>
        <div className="mt-2 space-y-2">
          {scaleRows.map((mark) => (
            <div key={mark.division} className="grid grid-cols-[48px_1fr_1fr] gap-2 text-[11px]">
              <div style={{ color: COLORS.textMuted }}>第 {mark.division} 格</div>
              <div style={{ color: COLORS.textSecondary }}>
                原表头 {analysis.mode === 'ammeter' ? formatCurrentValue(mark.originalValue) : formatVoltageValue(mark.originalValue)}
              </div>
              <div style={{ color: COLORS.text }}>
                改装后 {analysis.mode === 'ammeter' ? formatCurrentValue(mark.convertedValue) : formatVoltageValue(mark.convertedValue)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OhmmeterTeachingResultCard({
  slotContext,
  allEntities,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
}) {
  const analysis = resolveOhmmeterBuilderAnalysis({
    variantId: slotContext.variantId,
    entities: allEntities,
  });
  if (!analysis) return null;

  const isMultiRange = analysis.variant === 'multi-range';
  const usageGuidance = resolveOhmmeterUsageGuidance(analysis);
  const headline = isMultiRange
    ? `当前档位 ${analysis.selectedRange ?? '—'} 的中值电阻决定了这一档最顺手的测量区间。`
    : analysis.isZeroed
      ? '当前已经调零，可以直接把读数、偏转和中值电阻放在一起看。'
      : '当前还没完全调零，应先短接表笔，使指针在 Rx=0 时满偏。';

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          教学结果
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {headline}
        </div>
      </div>

      <MetricCards
        metrics={[
          {
            label: isMultiRange ? '当前档位' : '欧姆表示值',
            value: isMultiRange ? (analysis.selectedRange ?? '—') : formatResistanceValue(analysis.ohmReading, 2),
            highlighted: true,
          },
          {
            label: isMultiRange ? '欧姆表示值' : '中值电阻',
            value: isMultiRange ? formatResistanceValue(analysis.ohmReading, 2) : formatResistanceValue(analysis.midResistance, 2),
            highlighted: !isMultiRange,
          },
          { label: '当前 Rx', value: formatResistanceValue(analysis.currentRx, 2) },
          { label: '偏转比例', value: `${(analysis.deflectionRatio * 100).toFixed(1)}%` },
          {
            label: '半偏状态',
            value: analysis.isHalfDeflection ? '已接近半偏' : '未到半偏',
            highlighted: analysis.isHalfDeflection,
          },
          {
            label: '调零状态',
            value: analysis.isZeroed ? '已调零' : '待调零',
            highlighted: !analysis.isZeroed,
          },
        ]}
      />

      <CompactRatioBar
        label="表盘位置"
        ratio={clampRatio(analysis.deflectionRatio)}
        note="偏转越大，表示的电阻越小"
      />

      <div
        className="rounded-lg px-3 py-2 text-[11px]"
        style={{
          backgroundColor: usageGuidance.tone === 'good' ? COLORS.successLight : COLORS.warningLight,
          color: usageGuidance.tone === 'good' ? '#166534' : '#92400E',
          lineHeight: 1.6,
        }}
      >
        <div className="font-semibold">{usageGuidance.title}</div>
        <div className="mt-1">{usageGuidance.detail}</div>
      </div>

      <div
        className="rounded-lg border px-3 py-3"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
      >
        <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
          关键对照
        </div>
        <div className="mt-2 space-y-2 text-[11px]" style={{ color: COLORS.textSecondary }}>
          <KeyValueRow label="当前中值电阻" value={formatResistanceValue(analysis.midResistance, 2)} />
          {!isMultiRange && (
            <KeyValueRow
              label="Rx=0 时偏转比"
              value={analysis.zeroingThetaAtRxZero != null ? `${analysis.zeroingThetaAtRxZero.toFixed(2)}` : '—'}
            />
          )}
          {!isMultiRange && (
            <KeyValueRow
              label="真正半偏电阻"
              value={formatResistanceValue(analysis.currentHalfDeflectionResistance, 2)}
            />
          )}
          {isMultiRange && (
            <KeyValueRow
              label="当前档位串联电阻"
              value={formatResistanceValue(analysis.selectedSeriesResistance, 2)}
            />
          )}
          {isMultiRange && (
            <KeyValueRow
              label="测量甜区"
              value={formatRecommendedBand(analysis.midResistance)}
            />
          )}
        </div>
      </div>

      <div
        className="rounded-lg border px-3 py-3"
        style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
      >
        <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
          {isMultiRange ? '档位/量程对照' : '刻度语义'}
        </div>
        <div className="mt-2 space-y-2">
          {(isMultiRange ? analysis.rangeRows : buildBasicOhmmeterRows(analysis)).map((row) => (
            <div
              key={`${row.label}-${row.midResistance}`}
              className="grid grid-cols-[54px_1fr_1fr] gap-2 rounded-lg px-2 py-2 text-[11px]"
              style={{
                backgroundColor: row.selected ? COLORS.primaryLight : COLORS.bg,
                border: `1px solid ${row.selected ? COLORS.primary + '66' : COLORS.border}`,
              }}
            >
              <div style={{ color: row.selected ? COLORS.primary : COLORS.text }}>{row.label}</div>
              <div style={{ color: COLORS.textSecondary }}>
                R中 {formatResistanceValue(row.midResistance, 2)}
              </div>
              <div style={{ color: COLORS.textSecondary }}>
                推荐 {formatResistanceValue(row.suggestedMin, 2)} ~ {formatResistanceValue(row.suggestedMax, 2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeterConversionTeachingCard({
  slotContext,
  allEntities,
  builderParamValues,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
}) {
  const analysis = resolveMeterConversionBuilderAnalysis({
    variantId: slotContext.variantId,
    entities: allEntities,
    builderParamValues,
  });
  if (!analysis) return null;

  const result = analysis.result;
  const formulaLines =
    result.mode === 'ammeter'
      ? [
          'Rs = Ig / (I - Ig) × Rg',
          `当前理论 Rs ≈ ${formatResistanceValue(result.idealAccessoryResistance, 3)}，实际 Rs ≈ ${formatResistanceValue(result.actualAccessoryResistance, 3)}`,
          `并联后等效内阻 Req ≈ ${formatResistanceValue(result.equivalentResistanceActual, 3)}`,
        ]
      : [
          'Rv = U / Ig - Rg',
          `当前理论 Rv ≈ ${formatResistanceValue(result.idealAccessoryResistance, 1)}，实际 Rv ≈ ${formatResistanceValue(result.actualAccessoryResistance, 1)}`,
          `串联后输入电阻 Rin ≈ ${formatResistanceValue(result.inputResistanceActual, 1)}`,
        ];
  const noteLines =
    result.mode === 'ammeter'
      ? [
          '先由表头 G 的 Rg、Ig 求理论分流电阻，再决定要把量程放大到多少。',
          'Rs 偏大时分流不足，表头分到的电流更多，读数偏大也更容易过载。',
          '真正危险的是分流支路断开、接触不良或 Rs 偏大，不是 Rs 偏小本身。',
        ]
      : [
          '先由表头 G 的 Rg、Ig 求理论分压电阻，再决定目标电压量程。',
          'Rv 偏小时限流不足，表头电流偏大，读数偏大且更容易过载。',
          '电压表改装真正危险的是限流电阻过小或短接，不是电阻偏大。',
        ];

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          教学说明
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {result.mode === 'ammeter'
            ? '围绕“分流”讲量程放大、误差方向和安全边界。'
            : '围绕“分压”讲量程放大、输入电阻和过载风险。'}
        </div>
      </div>

      <TeachingBlock title="关键公式" lines={formulaLines} monospace />
      <TeachingBlock title="步骤与结论" lines={noteLines} />
    </div>
  );
}

function OhmmeterTeachingNotesCard({
  slotContext,
  allEntities,
}: {
  slotContext: BuilderTemplateSlotContext;
  allEntities: Map<string, import('@/core/types').Entity>;
}) {
  const analysis = resolveOhmmeterBuilderAnalysis({
    variantId: slotContext.variantId,
    entities: allEntities,
  });
  if (!analysis) return null;

  const formulaLines =
    analysis.variant === 'multi-range'
      ? [
          'R中 = Rg + Rsel',
          '换挡后不是只放大量程，而是整套中值电阻和刻度语义一起改变。',
          `当前档位 ${analysis.selectedRange ?? '—'}：R中 ≈ ${formatResistanceValue(analysis.midResistance, 2)}`,
        ]
      : [
          'I = E / (Rg + r + R0 + Rx)',
          '调零定义：Rx = 0 时，让表头满偏。',
          `理想中值电阻 R中 ≈ ${formatResistanceValue(analysis.midResistance, 2)}`,
        ];
  const noteLines =
    analysis.variant === 'multi-range'
      ? [
          '先选档位，再把待测电阻放到当前档位的甜区附近读取，读数最稳定。',
          '档位越高，Rsel 越大，对应的中值电阻和适合测的电阻范围也整体上移。',
          '如果读数总是挤在某一端，优先换档，而不是硬读不合适的档位。',
        ]
      : [
          analysis.isZeroed
            ? '当前已接近调零完成，可直接用偏转位置判断 Rx 大小。'
            : '当前未完全调零，应先短接表笔并调节调零电阻使表头满偏。',
          '半偏对应的不是“量程中点”，而是满足 Rx = R中 的那个读数位置。',
          analysis.canZero === false
            ? '当前参数下无法通过非负调零电阻实现满偏，应先提高 E/Ig 或减小 Rg+r。'
            : '调零完成后，再看 Rx 与 R中 的关系，刻度语义会更清楚。',
        ];

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          教学说明
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {analysis.variant === 'multi-range'
            ? '重点是“每个档位都有自己的中值电阻和甜区”。'
            : '重点是“先调零，再把中值电阻和半偏联系起来”。'}
        </div>
      </div>

      <TeachingBlock title="关键公式" lines={formulaLines} monospace />
      <TeachingBlock title="步骤与结论" lines={noteLines} />
    </div>
  );
}

function TemplateTeachingCard({
  slotContext,
  allEntities,
  builderParamValues,
}: {
  slotContext?: BuilderTemplateSlotContext | null;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
}) {
  if (slotContext?.familyId === 'meter-conversion') {
    return (
      <MeterConversionTeachingCard
        slotContext={slotContext}
        allEntities={allEntities}
        builderParamValues={builderParamValues}
      />
    );
  }

  if (slotContext?.familyId === 'ohmmeter') {
    return (
      <OhmmeterTeachingNotesCard
        slotContext={slotContext}
        allEntities={allEntities}
      />
    );
  }

  const source = Array.from(allEntities.values()).find((entity) => entity.type === 'dc-source');
  if (!source) return null;

  const normalizedBuilderParams = normalizeBuilderParamValues(allEntities, builderParamValues);
  const circuitType =
    (source.properties.circuitType as string | undefined) ??
    inferQualifier(allEntities)?.circuit ??
    'general-circuit';
  const currentMeter = normalizedBuilderParams.activeCurrentMeterId
    ? allEntities.get(String(normalizedBuilderParams.activeCurrentMeterId))
    : Array.from(allEntities.values()).find((entity) => isCurrentMeter(entity.type));
  const voltmeter = normalizedBuilderParams.activeVoltmeterId
    ? allEntities.get(String(normalizedBuilderParams.activeVoltmeterId))
    : Array.from(allEntities.values()).find((entity) => entity.type === 'voltmeter');
  const resistor = Array.from(allEntities.values()).find(
    (entity) => entity.type === 'fixed-resistor' || entity.type === 'resistance-box',
  );
  const rheostat = Array.from(allEntities.values()).find((entity) => entity.type === 'slide-rheostat');

  const title = getTeachingTitle(circuitType);
  const formulaLines = getTeachingFormulas(circuitType, {
    source,
    currentMeter,
    voltmeter,
    resistor,
    rheostat,
  });
  const noteLines = getTeachingNotes(circuitType, {
    source,
    currentMeter,
    voltmeter,
    resistor,
    rheostat,
  });

  if (formulaLines.length === 0 && noteLines.length === 0) return null;

  return (
    <div
      className="space-y-3 rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      <div>
        <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
          教学说明
        </div>
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {title}
        </div>
      </div>

      {formulaLines.length > 0 && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: COLORS.bgMuted }}
        >
          <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
            关键公式
          </div>
          <div className="mt-1 space-y-1" style={{ color: COLORS.text, fontSize: 11, lineHeight: 1.6, fontFamily: '"Courier New", monospace' }}>
            {formulaLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {noteLines.length > 0 && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ backgroundColor: COLORS.bgMuted }}
        >
          <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
            操作与结论
          </div>
          <div className="mt-1 space-y-1" style={{ color: COLORS.textSecondary, fontSize: 11, lineHeight: 1.6 }}>
            {noteLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getTeachingTitle(circuitType: string): string {
  switch (circuitType) {
    case 'voltammetry-internal':
      return '伏安法内接：电压表并联在电流表与被测电阻整体两端。';
    case 'voltammetry-external':
      return '伏安法外接：电流表在干路上，电压表并联在被测电阻两端。';
    case 'measure-emf-r':
      return '通过改变外电阻采样多组 U-I 点，利用图线斜率与截距求 ε 和 r。';
    case 'half-deflection-ammeter':
      return '保持主回路条件近似不变，调并联支路使表头半偏。';
    case 'half-deflection-voltmeter':
      return '先设基准读数，再通过短接/半偏支路切换使读数减半。';
    case 'ohmmeter':
      return '先调零，再根据偏转角判断待测电阻；中值电阻对应半偏。';
    case 'multi-range-ohmmeter':
      return '多量程欧姆表通过切换串联电阻改变中值电阻和测量范围。';
    default:
      return '当前结果按通用电路逻辑展示。';
  }
}

function getTeachingFormulas(
  circuitType: string,
  context: {
    source: import('@/core/types').Entity;
    currentMeter?: import('@/core/types').Entity;
    voltmeter?: import('@/core/types').Entity;
    resistor?: import('@/core/types').Entity;
    rheostat?: import('@/core/types').Entity;
  },
): string[] {
  const emf = context.source.properties.emf as number | undefined;
  const sourceR = context.source.properties.internalResistance as number | undefined;
  const meterR = context.currentMeter?.properties.internalResistance as number | undefined;
  const voltmeterR = context.voltmeter?.properties.internalResistance as number | undefined;
  const resistorR = context.resistor?.properties.resistance as number | undefined;
  const ohmMid = context.source.properties.R_mid as number | undefined;
  const rangeLabel = context.source.properties.selectedRange as string | undefined;

  switch (circuitType) {
    case 'voltammetry-internal':
      return [
        `R测 = U / I = Rx + rA`,
        `当前：Rx ≈ ${formatResistanceValue(resistorR, 2)}，rA ≈ ${formatResistanceValue(meterR, 2)}`,
      ];
    case 'voltammetry-external':
      return [
        `R测 = U / I = Rx·rV / (Rx + rV)`,
        `当前：Rx ≈ ${formatResistanceValue(resistorR, 2)}，rV ≈ ${formatResistanceValue(voltmeterR, 2)}`,
      ];
    case 'measure-emf-r':
      return (context.source.properties.measureMode as string) === 'divider'
        ? [
            `U = ε - Ir`,
            `分压式只改变外电阻，采样量仍是电源端电压 U 与主支路电流 I`,
            `当前：ε ≈ ${formatVoltageValue(emf)}，r ≈ ${formatResistanceValue(sourceR, 2)}`,
          ]
        : [
            `U = ε - Ir`,
            `当前：ε ≈ ${formatVoltageValue(emf)}，r ≈ ${formatResistanceValue(sourceR, 2)}`,
          ];
    case 'half-deflection-ammeter':
      return [
        `教材近似：R' ≈ r被测`,
        `更严格地看，半偏时总电流并非严格不变`,
      ];
    case 'half-deflection-voltmeter':
      return [
        `教材近似：R' ≈ rV`,
        `更严格地看，分压条件会随支路切换变化`,
      ];
    case 'ohmmeter':
      return [
        `I = E / (Rg + r + R0 + Rx)`,
        `R中 = Rg + r + R0 ≈ ${formatResistanceValue(ohmMid, 2)}`,
      ];
    case 'multi-range-ohmmeter':
      return [
        `R中 = Rg + Rsel`,
        `当前档位 ${rangeLabel ?? '—'}：R中 ≈ ${formatResistanceValue(ohmMid, 2)}`,
      ];
    default:
      return [];
  }
}

function getTeachingNotes(
  circuitType: string,
  context: {
    source: import('@/core/types').Entity;
    currentMeter?: import('@/core/types').Entity;
    voltmeter?: import('@/core/types').Entity;
    resistor?: import('@/core/types').Entity;
    rheostat?: import('@/core/types').Entity;
  },
): string[] {
  const recommendedMethod = context.source.properties.recommendedMethod as string | undefined;
  const approximationNote = context.source.properties.approximationNote as string | undefined;
  const selectedRange = context.source.properties.selectedRange as string | undefined;
  const isZeroed = Boolean(context.source.properties.isZeroed);
  const connectionMode = context.rheostat?.properties.connectionMode as string | undefined;

  switch (circuitType) {
    case 'voltammetry-internal':
    case 'voltammetry-external':
      return [
        circuitType === 'voltammetry-internal'
          ? '内接法：电压表跨 A+Rx，电流表内阻被计入测量值，所以 R测偏大。'
          : '外接法：电流表测干路总电流，电压表分流，所以 R测偏小。',
        recommendedMethod ? `系统推荐的更优接法：${recommendedMethod === 'internal' ? '内接法' : '外接法'}` : '比较 Rx 与表内阻/内阻量级后再选择接法。',
      ];
    case 'measure-emf-r':
      return connectionMode === 'divider'
        ? [
            '分压接法：滑动变阻器整段跨接在电源两端，滑片输出只用于改变外电路等效电阻。',
            '电压表仍并联在电源两端记录端电压，电流表记录主支路电流，因此采样量仍然是 U-I。',
          ]
        : [
            '限流接法：滑动变阻器串联在主回路中，通过改变主路电流得到不同测量点。',
            '采样时应改变外电阻得到多组 U-I 点，再用图线求斜率和截距。',
          ];
    case 'half-deflection-ammeter':
    case 'half-deflection-voltmeter':
      return [
        approximationNote ?? '半偏法依赖教材近似条件，结果应结合误差来源理解。',
      ];
    case 'ohmmeter':
      return [
        isZeroed ? '当前已完成调零，可直接观察待测电阻读数。' : '当前未完全调零，应先将 Rx 调到 0 并使表头满偏。',
        '偏角越大，表示的电阻越小；偏角越小，表示的电阻越大。',
      ];
    case 'multi-range-ohmmeter':
      return [
        `当前档位：${selectedRange ?? '—'}。换挡后中值电阻和测量范围都会变化。`,
        '多量程欧姆表的教学重点是“每个档位都有自己的中值电阻”，不是单纯放大量程。',
      ];
    default:
      return [];
  }
}

function getTemplateRuleInfos(
  slotContext: BuilderTemplateSlotContext,
  allEntities: Map<string, import('@/core/types').Entity>,
  builderParamValues: import('@/core/types').ParamValues,
): string[] {
  if (slotContext.familyId === 'meter-conversion') {
    const analysis = resolveMeterConversionBuilderAnalysis({
      variantId: slotContext.variantId,
      entities: allEntities,
      builderParamValues,
    });
    if (!analysis) return [];

    return [
      analysis.mode === 'ammeter'
        ? '当前是并联分流改装：核心看 Rs 与理论值的偏差方向。'
        : '当前是串联分压改装：核心看 Rv 是否把表头电流压回额定满偏附近。',
      `目标量程 ${analysis.mode === 'ammeter' ? formatCurrentValue(analysis.result.targetRange) : formatVoltageValue(analysis.result.targetRange)}，原表头满偏 ${analysis.mode === 'ammeter' ? formatCurrentValue(analysis.result.originalFullScale) : formatVoltageValue(analysis.result.originalFullScale)}。`,
      `当前工作点 ${analysis.operatingLabel} = ${analysis.mode === 'ammeter' ? formatCurrentValue(analysis.operatingInput) : formatVoltageValue(analysis.operatingInput)}。`,
    ];
  }

  if (slotContext.familyId === 'ohmmeter') {
    const analysis = resolveOhmmeterBuilderAnalysis({
      variantId: slotContext.variantId,
      entities: allEntities,
    });
    if (!analysis) return [];

    if (analysis.variant === 'multi-range') {
      return [
        `当前档位 ${analysis.selectedRange ?? '—'}：R中 ≈ ${formatResistanceValue(analysis.midResistance, 2)}。`,
        `建议把待测电阻放在 ${formatRecommendedBand(analysis.midResistance)} 附近读数。`,
        resolveOhmmeterUsageGuidance(analysis).title,
      ];
    }

    return [
      `当前中值电阻 R中 ≈ ${formatResistanceValue(analysis.midResistance, 2)}。`,
      analysis.isZeroed
        ? '已调零，当前可直接比较 Rx 是否接近中值电阻。'
        : '未完全调零时，即使 Rx = R中 也不一定正好半偏。',
      resolveOhmmeterUsageGuidance(analysis).title,
    ];
  }

  return [];
}

function MetricCards({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; highlighted?: boolean }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-lg border px-3 py-2"
          style={{
            borderColor: metric.highlighted ? COLORS.primary + '55' : COLORS.border,
            backgroundColor: metric.highlighted ? COLORS.primaryLight : COLORS.bgMuted,
          }}
        >
          <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
            {metric.label}
          </div>
          <div
            className="mt-1 text-xs font-semibold"
            style={{ color: metric.highlighted ? COLORS.primary : COLORS.text }}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricList({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; highlighted?: boolean }>;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className="flex items-center justify-between gap-4 px-3 py-2.5"
          style={{
            borderTop: index === 0 ? 'none' : `1px solid ${COLORS.border}`,
            backgroundColor: metric.highlighted ? COLORS.primaryLight : COLORS.bg,
          }}
        >
          <span
            className="text-[11px] font-medium"
            style={{ color: metric.highlighted ? COLORS.primary : COLORS.textSecondary }}
          >
            {metric.label}
          </span>
          <span
            className="text-right text-xs font-semibold"
            style={{ color: metric.highlighted ? COLORS.primary : COLORS.text }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function CompactRatioBar({
  label,
  ratio,
  note,
}: {
  label: string;
  ratio: number;
  note: string;
}) {
  const safeRatio = clampRatio(ratio);

  return (
    <div
      className="rounded-lg border px-3 py-3"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
    >
      <div className="flex items-center justify-between text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
        <span>{label}</span>
        <span>{note}</span>
      </div>
      <div className="mt-2 h-2.5 rounded-full" style={{ backgroundColor: COLORS.bg }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${safeRatio * 100}%`, backgroundColor: COLORS.primary }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px]" style={{ color: COLORS.textMuted }}>
        <span>左端</span>
        <span>中值/半偏</span>
        <span>满偏</span>
      </div>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text }}>{value}</span>
    </div>
  );
}

function TeachingBlock({
  title,
  lines,
  monospace = false,
}: {
  title: string;
  lines: string[];
  monospace?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: COLORS.bgMuted }}
    >
      <div className="text-[10px] font-semibold" style={{ color: COLORS.textMuted }}>
        {title}
      </div>
      <div
        className="mt-1 space-y-1"
        style={{
          color: monospace ? COLORS.text : COLORS.textSecondary,
          fontSize: 11,
          lineHeight: 1.6,
          fontFamily: monospace ? '"Courier New", monospace' : undefined,
        }}
      >
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function buildBasicOhmmeterRows(analysis: NonNullable<ReturnType<typeof resolveOhmmeterBuilderAnalysis>>) {
  const mid = analysis.midResistance;
  if (mid == null || !Number.isFinite(mid) || mid <= 0) return [];

  return [
    {
      label: '偏大',
      seriesResistance: 0,
      midResistance: mid * 4,
      suggestedMin: mid * 2,
      suggestedMax: mid * 8,
      selected: false,
    },
    {
      label: '半偏',
      seriesResistance: 0,
      midResistance: mid,
      suggestedMin: mid * 0.95,
      suggestedMax: mid * 1.05,
      selected: true,
    },
    {
      label: '偏小',
      seriesResistance: 0,
      midResistance: mid / 4,
      suggestedMin: mid / 8,
      suggestedMax: mid / 2,
      selected: false,
    },
  ];
}

function resolveOhmmeterUsageGuidance(
  analysis: NonNullable<ReturnType<typeof resolveOhmmeterBuilderAnalysis>>,
): {
  title: string;
  detail: string;
  tone: 'good' | 'warning';
} {
  const mid = analysis.midResistance;
  const rx = analysis.currentRx;

  if (rx == null || !Number.isFinite(rx)) {
    return {
      title: '当前接近高阻端',
      detail: '待测支路近似断开时，指针会回到无穷大一侧，适合先检查是否断路或换到更高档。',
      tone: 'warning',
    };
  }

  if (mid == null || !Number.isFinite(mid) || mid <= 0) {
    return {
      title: '当前档位语义尚未稳定',
      detail: '先完成调零或检查量程设置，再比较待测电阻与中值电阻的关系。',
      tone: 'warning',
    };
  }

  const lowBand = mid / 4;
  const highBand = mid * 4;

  if (rx < lowBand) {
    return {
      title: analysis.variant === 'multi-range' ? '当前 Rx 偏小，读数挤在低阻端' : '当前读数偏向低阻端',
      detail: analysis.variant === 'multi-range'
        ? `该档甜区约 ${formatRecommendedBand(mid)}。现在 ${formatResistanceValue(rx, 2)} 偏小，建议换更低档，让中值电阻下移。`
        : `当前 ${formatResistanceValue(rx, 2)} 远小于 R中，表盘会贴近 0 Ω 一侧，读数不够舒展。`,
      tone: 'warning',
    };
  }

  if (rx > highBand) {
    return {
      title: analysis.variant === 'multi-range' ? '当前 Rx 偏大，读数挤在高阻端' : '当前读数偏向高阻端',
      detail: analysis.variant === 'multi-range'
        ? `该档甜区约 ${formatRecommendedBand(mid)}。现在 ${formatResistanceValue(rx, 2)} 偏大，建议换更高档，让中值电阻上移。`
        : `当前 ${formatResistanceValue(rx, 2)} 远大于 R中，表盘会靠近 ∞ 端，读数分辨率会下降。`,
      tone: 'warning',
    };
  }

  return {
    title: analysis.isHalfDeflection ? '当前接近中值电阻，最适合讲半偏语义' : '当前落在甜区，读数最舒展',
    detail: analysis.variant === 'multi-range'
      ? `该档甜区约 ${formatRecommendedBand(mid)}。现在 ${formatResistanceValue(rx, 2)} 与 R中 同量级，最适合观察这一档的刻度语义。`
      : `当前 ${formatResistanceValue(rx, 2)} 与 R中 同量级，指针处在更容易判读的中段区域。`,
    tone: 'good',
  };
}

function formatRecommendedBand(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${formatResistanceValue(value / 4, 2)} ~ ${formatResistanceValue(value * 4, 2)}`;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getNumberPrecision(step: number): number {
  const normalized = String(step);
  if (!normalized.includes('.')) return 0;
  return normalized.split('.')[1]?.length ?? 0;
}

function formatCurrentValue(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.001) return `${(value * 1000000).toFixed(0)} μA`;
  if (Math.abs(value) < 0.01) return `${(value * 1000).toFixed(2)} mA`;
  return `${value.toFixed(3)} A`;
}

function formatVoltageValue(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} V`;
}

function formatResistanceValue(value: number | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} kΩ`;
  return `${value.toFixed(digits)} Ω`;
}

function formatPercentValue(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(2)}%`;
}

function formatSignedPercentValue(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

interface EntityPropertiesProps {
  currentTemplateFamilyId: string | null;
  entity: import('@/core/types').Entity;
  allEntities: Map<string, import('@/core/types').Entity>;
  builderParamValues: import('@/core/types').ParamValues;
  isDeleteDisabled: boolean;
  onUpdate: (key: string, value: unknown) => void;
  onUpdateBuilderParam: (key: string, value: number | boolean | string) => void;
  onDelete: () => void;
}

function EntityProperties({
  currentTemplateFamilyId,
  entity,
  allEntities,
  builderParamValues,
  isDeleteDisabled,
  onUpdate,
  onUpdateBuilderParam,
  onDelete,
}: EntityPropertiesProps) {
  const registration = entityRegistry.get(entity.type);
  if (!registration) return null;

  const schemas = filterEntitySchemasForTemplate({
    familyId: currentTemplateFamilyId,
    entity,
    schemas: registration.paramSchemas,
  });
  const templateSpecificNote = getTemplateSpecificEntityNote(currentTemplateFamilyId, entity);
  const circuitType = inferQualifier(allEntities)?.circuit;
  const normalizedBuilderParams = normalizeBuilderParamValues(allEntities, builderParamValues);
  const currentMeterCount = Array.from(allEntities.values()).filter((item) => isCurrentMeter(item.type)).length;
  const voltmeterCount = Array.from(allEntities.values()).filter((item) => item.type === 'voltmeter').length;
  const isCurrentInstrument = isCurrentMeter(entity.type);
  const isVoltmeter = entity.type === 'voltmeter';
  const isActiveInstrument = isCurrentInstrument
    ? entity.id === normalizedBuilderParams.activeCurrentMeterId
    : isVoltmeter
      ? entity.id === normalizedBuilderParams.activeVoltmeterId
      : false;

  return (
    <div className="space-y-4">
      {/* 元件标题 */}
      <div>
        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
          {entity.label ?? registration.label}
        </div>
        <div className="mt-0.5 text-[10px]" style={{ color: COLORS.textMuted }}>
          {entity.type} · {entity.id.slice(-8)}
        </div>
      </div>

      {/* 参数控件 */}
      {templateSpecificNote && (
        <div
          className="rounded-lg border px-3 py-2 text-[11px]"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted, color: COLORS.textSecondary, lineHeight: 1.6 }}
        >
          {templateSpecificNote}
        </div>
      )}

      <BuilderEntityParamFields
        entity={entity}
        schemas={schemas}
        onUpdate={onUpdate}
      />

      {entity.type === 'dc-source' && circuitType === 'voltammetry-compare' && (
        <div
          className="space-y-2 rounded-lg border px-3 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
        >
          <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
            伏安法对比
          </div>
          <div className="text-[10px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            当前实验不再单独切换接法，系统会同时计算理想值、内接法和外接法，并给出误差对比与推荐结论。
          </div>
        </div>
      )}

      {entity.type === 'slide-rheostat' && (
        <div
          className="rounded-lg border px-3 py-2 text-[10px]"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted, color: COLORS.textMuted }}
        >
          当前按
          {(entity.properties.connectionMode as string) === 'divider' ? '分压接法' : '限流接法'}
          求解：
          {(entity.properties.connectionMode as string) === 'divider'
            ? ' 滑动变阻器整段跨接在电源两端，滑片结构用于改变外电路等效电阻；实验采样仍读取端电压与主支路电流。'
            : ' 主回路按接入段电阻参与计算，便于观察限流效果。'}
        </div>
      )}

      {(isCurrentInstrument || isVoltmeter) && (
        <div
          className="space-y-2 rounded-lg border px-3 py-3"
          style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgMuted }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
              活动仪表
            </div>
            <span className="text-[10px]" style={{ color: isActiveInstrument ? COLORS.primary : COLORS.textMuted }}>
              {isActiveInstrument ? '当前参与判读' : '未参与判读'}
            </span>
          </div>
          <button
            onClick={() =>
              onUpdateBuilderParam(
                isCurrentInstrument ? 'activeCurrentMeterId' : 'activeVoltmeterId',
                entity.id,
              )
            }
            className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{
              color: isActiveInstrument ? COLORS.primary : COLORS.textSecondary,
              border: `1px solid ${isActiveInstrument ? COLORS.primary : COLORS.border}`,
              backgroundColor: isActiveInstrument ? COLORS.primaryLight : COLORS.bg,
            }}
          >
            {isActiveInstrument ? '已设为活动仪表' : `设为活动${isCurrentInstrument ? '电流表' : '电压表'}`}
          </button>
          <div className="text-[10px]" style={{ color: COLORS.textMuted, lineHeight: 1.6 }}>
            {isCurrentInstrument
              ? `当前画布共有 ${currentMeterCount} 块电流测量表；专用实验求解器只让活动仪表参与判读。`
              : `当前画布共有 ${voltmeterCount} 块电压表；专用实验求解器只让活动仪表参与判读。`}
          </div>
        </div>
      )}

      {/* 位置信息 */}
      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{ backgroundColor: COLORS.bgMuted, color: COLORS.textMuted }}
      >
        位置: x={entity.transform.position.x.toFixed(2)} y={entity.transform.position.y.toFixed(2)}
      </div>

      {/* 删除按钮 */}
      <button
        onClick={onDelete}
        disabled={isDeleteDisabled}
        className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ color: COLORS.error, border: `1px solid ${COLORS.error}` }}
      >
        {isDeleteDisabled ? '模板核心元件不可删除' : '删除元件'}
      </button>
    </div>
  );
}
