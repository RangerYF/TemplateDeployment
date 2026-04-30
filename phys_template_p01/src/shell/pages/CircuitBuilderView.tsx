import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BUILDER_WORKSPACE_IDS,
  type BuilderWorkspaceId,
  useBuilderStore,
  useBuilderWorkspace,
} from '@/store/builder-store';
import { isBuilderTemplateFeedbackMode } from '@/app-config';
import {
  getBuilderTemplateFamily,
  getBuilderTemplateVariant,
  type BuilderTemplateEntityPatch,
  type BuilderTemplateFamily,
  type BuilderTemplateVariant,
} from '@/domains/em/builder/template-library';
import { MainLayout } from '../layout/MainLayout';
import { BuilderLeftPanel } from '../panels/BuilderLeftPanel';
import { PropertyPanel, type BuilderTemplateSummary } from '../panels/PropertyPanel';
import { BuilderCanvas } from '../canvas/BuilderCanvas';
import { BuilderToolbar } from '../timeline/BuilderToolbar';
import { COLORS } from '@/styles/tokens';

interface CircuitBuilderViewProps {
  onBack: () => void;
  entryMode?: 'template' | 'free';
  templateSeed?: 'none' | 'recommended';
}

export function CircuitBuilderView({
  onBack,
  entryMode = 'template',
  templateSeed = 'none',
}: CircuitBuilderViewProps) {
  const [realisticModeByWorkspace, setRealisticModeByWorkspace] = useState<Record<BuilderWorkspaceId, boolean>>({
    primary: false,
    secondary: false,
  });
  const [advancedEditEnabled, setAdvancedEditEnabled] = useState(entryMode === 'free');
  const activeWorkspaceId = useBuilderStore((state) => state.activeWorkspaceId);
  const layoutMode = useBuilderStore((state) => state.layoutMode);
  const loadPresetTemplate = useBuilderStore((state) => state.loadPresetTemplate);
  const setTemplateContext = useBuilderStore((state) => state.setTemplateContext);
  const clearAll = useBuilderStore((state) => state.clearAll);
  const selectWorkspace = useBuilderStore((state) => state.selectWorkspace);
  const setLayoutMode = useBuilderStore((state) => state.setLayoutMode);
  const primaryTemplateFamilyId = useBuilderWorkspace('primary', (state) => state.currentTemplateFamilyId);
  const primaryTemplateVariantId = useBuilderWorkspace('primary', (state) => state.currentTemplateVariantId);
  const secondaryTemplateFamilyId = useBuilderWorkspace('secondary', (state) => state.currentTemplateFamilyId);
  const secondaryTemplateVariantId = useBuilderWorkspace('secondary', (state) => state.currentTemplateVariantId);
  const selectedFamilyId = useBuilderWorkspace(
    activeWorkspaceId,
    (state) => state.currentTemplateFamilyId,
  );
  const selectedVariantId = useBuilderWorkspace(
    activeWorkspaceId,
    (state) => state.currentTemplateVariantId,
  );
  const selectedFamily = useMemo(
    () => (selectedFamilyId ? getBuilderTemplateFamily(selectedFamilyId) ?? null : null),
    [selectedFamilyId],
  );
  const selectedVariant = useMemo(
    () => (selectedFamilyId && selectedVariantId ? getBuilderTemplateVariant(selectedFamilyId, selectedVariantId) ?? null : null),
    [selectedFamilyId, selectedVariantId],
  );
  const showTemplateLibraryInFree = entryMode === 'free' && isBuilderTemplateFeedbackMode;

  useEffect(() => {
    if (entryMode !== 'free') return;

    for (const workspaceId of BUILDER_WORKSPACE_IDS) {
      clearAll(workspaceId);
      setTemplateContext(null, null, workspaceId);
    }
    selectWorkspace('primary');
    setLayoutMode('single');
    setRealisticModeByWorkspace({
      primary: false,
      secondary: false,
    });

    if (templateSeed === 'recommended') {
      const family = getBuilderTemplateFamily('voltammetry');
      const variant = family?.variants.find((item) => item.id === (family.recommendedVariantId ?? 'internal'));
      if (family && variant) {
        setTemplateContext(family.id, variant.id, 'primary');
        loadPresetTemplate(variant.presetId, 'primary');
      }
    }

    setAdvancedEditEnabled(true);
  }, [clearAll, entryMode, loadPresetTemplate, selectWorkspace, setLayoutMode, setTemplateContext, templateSeed]);

  useEffect(() => {
    if (!isBuilderTemplateFeedbackMode || entryMode !== 'template') return;
    if (primaryTemplateFamilyId && primaryTemplateVariantId) return;

    const family = getBuilderTemplateFamily('voltammetry');
    const variant = family?.variants.find((item) => item.id === (family.recommendedVariantId ?? 'internal'));
    if (!family || !variant) return;

    setTemplateContext(family.id, variant.id, 'primary');
    loadPresetTemplate(variant.presetId, 'primary');
  }, [
    entryMode,
    loadPresetTemplate,
    primaryTemplateFamilyId,
    primaryTemplateVariantId,
    setTemplateContext,
  ]);

  const handleSelectTemplate = useCallback((family: BuilderTemplateFamily, variant: BuilderTemplateVariant) => {
    setTemplateContext(family.id, variant.id, activeWorkspaceId);
    loadPresetTemplate(variant.presetId, activeWorkspaceId);

    if (variant.entityPatches && variant.entityPatches.length > 0) {
      applyVariantPatches(variant.entityPatches, activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadPresetTemplate, setTemplateContext]);
  const handleSelectVariant = useCallback((variantId: string) => {
    if (!selectedFamily) return;

    const variant = selectedFamily.variants.find((item) => item.id === variantId);
    if (!variant || !variant.presetId) return;
    handleSelectTemplate(selectedFamily, variant);
  }, [handleSelectTemplate, selectedFamily]);

  const currentTemplateLabel = useMemo(() => {
    if (!selectedFamilyId || !selectedVariantId) return null;
    return formatCurrentTemplateLabel(selectedFamilyId, selectedVariantId);
  }, [selectedFamilyId, selectedVariantId]);
  const templateSummary = useMemo(() => {
    if (!selectedFamilyId || !selectedVariantId) return null;
    return buildTemplateSummary(selectedFamilyId, selectedVariantId);
  }, [selectedFamilyId, selectedVariantId]);
  const workspaceTemplateLabels = useMemo<Record<BuilderWorkspaceId, string | null>>(
    () => ({
      primary: primaryTemplateFamilyId && primaryTemplateVariantId
        ? formatCurrentTemplateLabel(primaryTemplateFamilyId, primaryTemplateVariantId)
        : null,
      secondary: secondaryTemplateFamilyId && secondaryTemplateVariantId
        ? formatCurrentTemplateLabel(secondaryTemplateFamilyId, secondaryTemplateVariantId)
        : null,
    }),
    [
      primaryTemplateFamilyId,
      primaryTemplateVariantId,
      secondaryTemplateFamilyId,
      secondaryTemplateVariantId,
    ],
  );
  const toggleRealistic = useCallback((workspaceId: BuilderWorkspaceId) => {
    setRealisticModeByWorkspace((prev) => ({
      ...prev,
      [workspaceId]: !prev[workspaceId],
    }));
  }, []);

  const canvas = layoutMode === 'dual' ? (
    <div className="flex flex-1 gap-3 overflow-hidden p-3" style={{ backgroundColor: '#F5F7FA' }}>
      {BUILDER_WORKSPACE_IDS.map((workspaceId, index) => (
        <WorkspaceCanvasShell
          key={workspaceId}
          workspaceId={workspaceId}
          title={index === 0 ? '左侧电路图' : '右侧电路图'}
          templateLabel={workspaceTemplateLabels[workspaceId]}
          isActive={activeWorkspaceId === workspaceId}
          onActivate={() => selectWorkspace(workspaceId)}
        >
          <BuilderCanvas
            workspaceId={workspaceId}
            entryMode={entryMode}
            showTemplateLibraryInFree={showTemplateLibraryInFree}
            advancedEditEnabled={advancedEditEnabled}
            isRealistic={realisticModeByWorkspace[workspaceId]}
            onToggleRealistic={() => toggleRealistic(workspaceId)}
          />
        </WorkspaceCanvasShell>
      ))}
    </div>
  ) : (
    <BuilderCanvas
      workspaceId={activeWorkspaceId}
      entryMode={entryMode}
      showTemplateLibraryInFree={showTemplateLibraryInFree}
      advancedEditEnabled={advancedEditEnabled}
      isRealistic={realisticModeByWorkspace[activeWorkspaceId]}
      onToggleRealistic={() => toggleRealistic(activeWorkspaceId)}
    />
  );

  return (
    <MainLayout
      leftPanel={
        <BuilderLeftPanel
          mode={entryMode}
          showTemplateLibraryInFree={showTemplateLibraryInFree}
          advancedEditEnabled={advancedEditEnabled}
          selectedFamilyId={selectedFamilyId}
          selectedVariantId={selectedVariantId}
          onToggleAdvancedEdit={() => setAdvancedEditEnabled((prev) => !prev)}
          onSelectTemplate={handleSelectTemplate}
        />
      }
      canvas={canvas}
      rightPanel={
        <PropertyPanel
          workspaceId={activeWorkspaceId}
          templateSummary={templateSummary}
          templateSlotContext={
            selectedFamily && selectedVariant
              ? {
                  familyId: selectedFamily.id,
                  variantId: selectedVariant.id,
                }
              : null
          }
          structureControls={
            selectedFamily && selectedVariant
              ? {
                  familyTitle: selectedFamily.title,
                  structureLabel: selectedFamily.structureLabel,
                  selectedVariantId: selectedVariant.id,
                  variants: selectedFamily.variants
                    .filter((variant) => Boolean(variant.presetId))
                    .map((variant) => ({
                      id: variant.id,
                      label: variant.label,
                      shortLabel: variant.shortLabel,
                      description: variant.description,
                    })),
                  onSelectVariant: handleSelectVariant,
                }
              : null
          }
        />
      }
      timeline={
        <BuilderToolbar
          entryMode={entryMode}
          showTemplateLibraryInFree={showTemplateLibraryInFree}
          onBack={onBack}
          currentTemplateLabel={currentTemplateLabel}
          advancedEditEnabled={advancedEditEnabled}
        />
      }
    />
  );
}

function WorkspaceCanvasShell({
  workspaceId,
  title,
  templateLabel,
  isActive,
  onActivate,
  children,
}: {
  workspaceId: BuilderWorkspaceId;
  title: string;
  templateLabel: string | null;
  isActive: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: isActive ? COLORS.primary : COLORS.border,
        boxShadow: isActive ? '0 0 0 2px rgba(37,99,235,0.08)' : 'none',
        backgroundColor: COLORS.bg,
      }}
      onMouseDownCapture={onActivate}
      onDragEnterCapture={onActivate}
      onDragOverCapture={onActivate}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors"
        style={{
          borderColor: isActive ? `${COLORS.primary}33` : COLORS.border,
          backgroundColor: isActive ? COLORS.primaryLight : COLORS.bgMuted,
        }}
      >
        <div>
          <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
            {title}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
            {templateLabel ?? '空白自由工作区'}
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
          style={{
            color: isActive ? COLORS.primary : COLORS.textSecondary,
            backgroundColor: COLORS.bg,
          }}
        >
          {isActive ? '当前编辑' : `点击激活 ${workspaceId === 'primary' ? '左图' : '右图'}`}
        </span>
      </button>
      <div className="flex min-h-0 flex-1">{children}</div>
    </section>
  );
}

function formatCurrentTemplateLabel(familyId: string, variantId: string): string {
  const family = getBuilderTemplateFamily(familyId);
  const variant = getBuilderTemplateVariant(familyId, variantId);

  return `${family?.title ?? familyId} · ${variant?.label ?? variantId}`;
}

function buildTemplateSummary(
  familyId: string,
  variantId: string,
): BuilderTemplateSummary | null {
  const family = getBuilderTemplateFamily(familyId);
  const variant = getBuilderTemplateVariant(familyId, variantId);
  if (!family || !variant) return null;

  return {
    title: family.title,
    variantLabel: `${family.structureLabel}：${variant.label}`,
    description: variant.description,
    adjustableParts: family.adjustableParts,
    lockedParts: family.lockedParts,
  };
}

function applyVariantPatches(
  patches: BuilderTemplateEntityPatch[],
  workspaceId: BuilderWorkspaceId,
): void {
  const store = useBuilderStore.getState();
  const entities = Array.from(store.workspaces[workspaceId].entities.values());

  for (const patch of patches) {
    const matchMode = patch.match ?? 'first';
    const matchedEntities = entities.filter((entity) => entity.type === patch.entityType);
    const targetEntities = matchMode === 'all' ? matchedEntities : matchedEntities.slice(0, 1);

    for (const entity of targetEntities) {
      store.updateEntityProperty(entity.id, patch.propertyKey, patch.value, workspaceId);
    }
  }
}
