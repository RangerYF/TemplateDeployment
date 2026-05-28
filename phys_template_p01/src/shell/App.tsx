import { useState, useEffect, useRef, useCallback } from 'react';
import {
  isBuilderEnabled,
  isBuilderFeedbackMode,
  isBuilderFreeFeedbackMode,
  isBuilderTemplateFeedbackMode,
  isP04StandaloneMode,
  isP13StandaloneMode,
  isP08StandaloneMode,
  isPresetVisible,
} from '@/app-config';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import { entityRegistry } from '@/core/registries/entity-registry';
import { createRenderLoop } from '@/renderer/render-loop';
import { computeCenteredOrigin } from '@/renderer/fit-entities';
import { screenToWorld } from '@/renderer/coordinate';
import { MainLayout } from './layout/MainLayout';
import { ParamPanel } from './panels/ParamPanel';
import { InfoPanel } from './panels/InfoPanel';
import { CanvasContainer } from './canvas/CanvasContainer';
import { TimelineBar, PlaybackDock } from './timeline/TimelineBar';
import { PresetGallery } from './pages/PresetGallery';
import { HomePage } from './pages/HomePage';
import { CircuitBuilderView } from './pages/CircuitBuilderView';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { CircuitInfoCards } from './panels/CircuitInfoCards';
import { MeterErrorComparisonView } from './pages/MeterErrorComparisonView';
import { MeasureEmfComparisonView } from './pages/MeasureEmfComparisonView';
import { HalfDeflectionComparisonView } from './pages/HalfDeflectionComparisonView';
import { OhmmeterMidpointComparisonView } from './pages/OhmmeterMidpointComparisonView';
import { MeterReadingTrainerView } from './pages/MeterReadingTrainerView';
import { MeterConversionExperimentView } from './pages/MeterConversionExperimentView';
import { VoltageResistanceMethodPage } from './pages/VoltageResistanceMethodPage';
import { CurrentResistanceMethodPage } from './pages/CurrentResistanceMethodPage';
import { FieldInfoCards } from './panels/FieldInfoCards';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { P08FieldMagnetHome } from './pages/P08FieldMagnetHome';
import { P08FieldBuilderPage } from './pages/P08FieldBuilderPage';
import { P08RotationCirclePage } from './pages/P08RotationCirclePage';
import { P08MagneticFocusDivergencePage } from './pages/P08MagneticFocusDivergencePage';
import { P08ElectricOscillationPage } from './pages/P08ElectricOscillationPage';
import { P08TranslationCirclePage } from './pages/P08TranslationCirclePage';
import { P08ScalingCirclePage } from './pages/P08ScalingCirclePage';
import { P08VideoExhibitPage } from './pages/P08VideoExhibitPage';
import { P13InductionHome } from './pages/P13InductionHome';
import { P13BuilderPage } from './pages/P13BuilderPage';
import { P13BaseLoopPage } from './pages/P13BaseLoopPage';
import { P13LenzMagnetCoilPage } from './pages/P13LenzMagnetCoilPage';
import { P13SingleRodResistivePage } from './pages/P13SingleRodResistivePage';
import { P13SingleRodWithSourcePage } from './pages/P13SingleRodWithSourcePage';
import { P13SingleRodWithCapacitorPage } from './pages/P13SingleRodWithCapacitorPage';
import { P13DoubleRodBasicPage } from './pages/P13DoubleRodBasicPage';
import { P13DoubleRodDrivenPage } from './pages/P13DoubleRodDrivenPage';
import { P13VerticalRailRodPage } from './pages/P13VerticalRailRodPage';
import { P08DisplayControls } from './panels/P08DisplayControls';
import { P08ResultOverlay } from './panels/P08ResultOverlay';
import { P08StageHeader } from './panels/P08StageHeader';
import {
  WireBFieldCanvasOverlay,
  WireBFieldControlPanel,
  WireBFieldInfoPanel,
} from './panels/WireBFieldTeachingPanels';
import {
  LoopBFieldCanvasOverlay,
  LoopBFieldTeachingWorkspace,
} from './panels/LoopBFieldTeachingPanels';
import { SolenoidBFieldTeachingWorkspace } from './panels/SolenoidBFieldTeachingPanels';
import {
  P08_PRESET_IDS,
  getP08ModuleKeyByPresetId,
  isP08ModuleKey,
  type P08ModuleKey,
} from './pages/p08PresetCatalog';
import { P13_PRESET_IDS } from './pages/p13PresetCatalog';
import { P13_BASE_LOOP_PRESET_ID } from '@/domains/em/p13/base-loop';
import { P13_LENZ_MAGNET_COIL_PRESET_ID } from '@/domains/em/p13/lenz-magnet-coil';
import {
  P13_SINGLE_ROD_RESISTIVE_PRESET_ID,
  P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID,
  P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID,
} from '@/domains/em/p13/single-rod';
import {
  P13_DOUBLE_ROD_BASIC_PRESET_ID,
  P13_DOUBLE_ROD_DRIVEN_PRESET_ID,
} from '@/domains/em/p13/double-rod';
import { P13_VERTICAL_RAIL_ROD_PRESET_ID } from '@/domains/em/p13/vertical-rail-rod';
import type { Entity } from '@/core/types';
import { WIRE_BFIELD_PRESET_ID } from '@/domains/em/logic/straight-wire-teaching';
import {
  LOOP_BFIELD_PRESET_ID,
  getLoopViewMode,
} from '@/domains/em/logic/loop-current-teaching';
import {
  clampLoopPitchDeg,
  getLoopCameraState,
} from '@/domains/em/logic/loop-current-3d';
import { SOLENOID_BFIELD_PRESET_ID } from '@/domains/em/logic/solenoid-teaching';
import {
  getPotentialSurfacePanelBounds,
  getPotentialSurfaceResetButtonBounds,
} from '@/domains/em/viewports/potential-surface-renderer';
import {
  getP08CanvasBackground,
  getP08CanvasShellStyle,
  getP08PageBackground,
} from './p08/p08Theme';

const P08_ROTATION_CIRCLE_PRESET_ID = 'P02-EMF038-rotation-circle';
const P08_ELECTRIC_OSCILLATION_PRESET_ID = 'P02-EMF011-efield-acceleration';
const P08_TRANSLATION_CIRCLE_PRESET_ID = 'P02-EMF037-translation-circle';
const P08_SCALING_CIRCLE_PRESET_ID = 'P02-EMF039-scaling-circle';
const P08_MAGNETIC_FOCUSING_PRESET_ID = 'P02-EMF033-magnetic-focusing';
const P08_MAGNETIC_DIVERGENCE_PRESET_ID = 'P02-EMF036-magnetic-divergence';
const P08_CYCLOTRON_VIDEO_PRESET_ID = 'P02-EMF042-cyclotron';
const P08_FLOWMETER_VIDEO_PRESET_ID = 'P02-EMF043-em-flowmeter';

/**
 * 顶层应用组件
 * 三页面：首页 → 预设选择/模拟器 | 自由搭建
 */

type AppPage =
  | 'home'
  | 'gallery'
  | 'p13'
  | 'p13-builder'
  | 'p08'
  | 'p08-builder'
  | 'simulator'
  | 'builder'
  | 'builder-free'
  | 'meter-error'
  | 'measure-emf-compare'
  | 'half-deflection-compare'
  | 'ohmmeter-midpoint-compare'
  | 'meter-reading-trainer'
  | 'meter-conversion'
  | 'voltage-resistance-method'
  | 'current-resistance-method';

interface AppRoute {
  page: AppPage;
  presetId?: string;
  from?: 'p08' | 'p13' | 'p13-builder';
  p08Module?: P08ModuleKey;
}

function getVisiblePresetId(presetId: string): string | undefined {
  const preset = presetRegistry.get(presetId);
  return preset && isPresetVisible(preset) ? presetId : undefined;
}

function parseHash(): AppRoute {
  const hash = window.location.hash.replace('#', '');
  const [rawPath = '', query = ''] = hash.split('?');
  const path = rawPath;
  const params = new URLSearchParams(query);
  if (isP08StandaloneMode) {
    if (path === 'p08-builder') return { page: 'p08-builder' };
    if (path === 'p08') {
      const moduleParam = params.get('module');
      const p08Module = isP08ModuleKey(moduleParam) ? moduleParam : undefined;
      return { page: 'p08', p08Module };
    }
    if (path.startsWith('preset/')) {
      const presetId = path.slice(7);
      const moduleParam = params.get('module');
      const p08Module = isP08ModuleKey(moduleParam) ? moduleParam : undefined;
      return getVisiblePresetId(presetId)
        ? { page: 'simulator', presetId, from: 'p08', p08Module }
        : { page: 'p08', p08Module };
    }
    if (path && !path.includes('/')) {
      return getVisiblePresetId(path)
        ? { page: 'simulator', presetId: path, from: 'p08' }
        : { page: 'home' };
    }
    return { page: 'home' };
  }
  if (isBuilderFreeFeedbackMode) {
    return { page: 'builder-free' };
  }
  if (isBuilderFeedbackMode) {
    if (path === 'builder-free') return { page: 'builder-free' };
    if (path === 'builder') return { page: 'builder' };
  }
  if (path === 'builder') return isBuilderEnabled ? { page: 'builder' } : { page: 'home' };
  if (path === 'builder-free') return isBuilderEnabled ? { page: 'builder-free' } : { page: 'home' };
  if (path === 'meter-error') return { page: 'meter-error' };
  if (path === 'measure-emf-compare') return { page: 'measure-emf-compare' };
  if (path === 'half-deflection-compare') return { page: 'half-deflection-compare' };
  if (path === 'ohmmeter-midpoint-compare') return { page: 'ohmmeter-midpoint-compare' };
  if (path === 'meter-reading-trainer') return { page: 'meter-reading-trainer' };
  if (path === 'meter-conversion') return { page: 'meter-conversion' };
  if (path === 'voltage-resistance-method') return { page: 'voltage-resistance-method' };
  if (path === 'current-resistance-method') return { page: 'current-resistance-method' };
  if (path === 'gallery') return { page: 'gallery' };
  if (path === 'p13') return (isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p13' };
  if (path === 'p13-builder') return (isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p13-builder' };
  if (path === 'p08') {
    const moduleParam = params.get('module');
    const p08Module = isP08ModuleKey(moduleParam) ? moduleParam : undefined;
    return (isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p08', p08Module };
  }
  if (path === 'p08-builder') return (isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p08-builder' };
  if (path.startsWith('preset/')) {
    const presetId = path.slice(7);
    const fromParam = params.get('from');
    const from =
      fromParam === 'p08' || fromParam === 'p13' || fromParam === 'p13-builder'
        ? fromParam
        : undefined;
    const moduleParam = params.get('module');
    const p08Module = isP08ModuleKey(moduleParam) ? moduleParam : undefined;
    return getVisiblePresetId(presetId)
      ? { page: 'simulator', presetId, from, p08Module }
      : from === 'p08'
        ? ((isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p08', p08Module })
        : from === 'p13'
          ? ((isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p13' })
          : from === 'p13-builder'
            ? ((isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p13-builder' })
          : { page: 'gallery' };
  }
  // 兼容旧格式：裸 presetId
  if (path && !path.includes('/')) {
    return getVisiblePresetId(path)
      ? { page: 'simulator', presetId: path }
      : { page: 'gallery' };
  }
  return { page: 'home' };
}

function setHash(route: AppRoute): void {
  if (route.page === 'simulator' && route.presetId) {
    if (route.from === 'p08') {
      const params = new URLSearchParams({ from: 'p08' });
      if (route.p08Module) {
        params.set('module', route.p08Module);
      }
      window.location.hash = `preset/${route.presetId}?${params.toString()}`;
    } else if (route.from === 'p13-builder') {
      window.location.hash = `preset/${route.presetId}?from=p13-builder`;
    } else if (route.from === 'p13') {
      window.location.hash = `preset/${route.presetId}?from=p13`;
    } else {
      window.location.hash = route.presetId;
    }
  } else if (route.page === 'builder') {
    window.location.hash = 'builder';
  } else if (route.page === 'builder-free') {
    window.location.hash = 'builder-free';
  } else if (route.page === 'p13') {
    window.location.hash = 'p13';
  } else if (route.page === 'p13-builder') {
    window.location.hash = 'p13-builder';
  } else if (route.page === 'p08') {
    const params = new URLSearchParams();
    if (route.p08Module) {
      params.set('module', route.p08Module);
    }
    window.location.hash = params.toString() ? `p08?${params.toString()}` : 'p08';
  } else if (route.page === 'p08-builder') {
    window.location.hash = 'p08-builder';
  } else if (route.page === 'meter-error') {
    window.location.hash = 'meter-error';
  } else if (route.page === 'measure-emf-compare') {
    window.location.hash = 'measure-emf-compare';
  } else if (route.page === 'half-deflection-compare') {
    window.location.hash = 'half-deflection-compare';
  } else if (route.page === 'ohmmeter-midpoint-compare') {
    window.location.hash = 'ohmmeter-midpoint-compare';
  } else if (route.page === 'meter-reading-trainer') {
    window.location.hash = 'meter-reading-trainer';
  } else if (route.page === 'meter-conversion') {
    window.location.hash = 'meter-conversion';
  } else if (route.page === 'voltage-resistance-method') {
    window.location.hash = 'voltage-resistance-method';
  } else if (route.page === 'current-resistance-method') {
    window.location.hash = 'current-resistance-method';
  } else if (route.page === 'gallery') {
    window.location.hash = 'gallery';
  } else {
    window.location.hash = '';
  }
}

function syncStoreFromSimulator(): void {
  const simState = simulator.getState();
  const result = simulator.getCurrentResult();
  const store = useSimulationStore.getState();

  store.setParamValues({ ...simState.scene.paramValues });
  store.setSimulationState({
    status: simState.status,
    timeline: simState.timeline,
    scene: simState.scene,
    currentResult: result,
    resultHistory: simState.resultHistory,
  });
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => parseHash());

  useEffect(() => {
    if (!isP13StandaloneMode) return;
    if (route.page === 'p13' || route.page === 'p13-builder' || route.page === 'simulator') return;
    navigateTo({
      page: 'p13',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onHashChange() {
      const newRoute = parseHash();
      if (newRoute.page !== 'simulator') simulator.unload();
      setRoute(newRoute);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = useCallback((r: AppRoute) => {
    if (r.page !== 'simulator') simulator.unload();
    setHash(r);
    setRoute(r);
  }, []);

  const navigateToP13Preset = useCallback((presetId: string) => {
    navigateTo({ page: 'simulator', presetId, from: 'p13' });
  }, [navigateTo]);

  const navigateToP13BuilderPreset = useCallback((presetId: string) => {
    navigateTo({ page: 'simulator', presetId, from: 'p13-builder' });
  }, [navigateTo]);

  const navigateBackFromPreset = useCallback((presetRoute: AppRoute) => {
    if (presetRoute.from === 'p13-builder') {
      navigateTo({ page: 'p13-builder' });
      return;
    }

    const shouldReturnToP13 =
      presetRoute.from === 'p13' ||
      P13_PRESET_IDS.has(presetRoute.presetId!);
    const fallbackP08Module = getP08ModuleKeyByPresetId(presetRoute.presetId!);
    const shouldReturnToP08 =
      !shouldReturnToP13 &&
      (
        presetRoute.from === 'p08' ||
        fallbackP08Module === 'particle-electric'
      );

    if (shouldReturnToP13) {
      navigateTo({ page: 'p13' });
      return;
    }

    navigateTo({
      page: shouldReturnToP08 || isP08StandaloneMode ? 'p08' : 'gallery',
      ...((shouldReturnToP08 || isP08StandaloneMode)
        ? { p08Module: presetRoute.p08Module ?? fallbackP08Module }
        : {}),
    });
  }, [navigateTo]);

  switch (route.page) {
    case 'home':
      if (isP13StandaloneMode) {
        return (
          <P13InductionHome
            onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id, from: 'p13' })}
            onOpenRoute={(target) => navigateTo({ page: target })}
            onBack={() => navigateTo({ page: 'p13' })}
          />
        );
      }
      if (isBuilderFreeFeedbackMode) {
        return (
          <CircuitBuilderView
            key="builder-free-feedback"
            onBack={() => navigateTo({ page: 'home' })}
            entryMode="free"
          />
        );
      }
      return (
        <HomePage
          onSelectTemplate={() => navigateTo({
            page: isP08StandaloneMode ? 'p08' : 'gallery',
          })}
          onSelectP13={
            !isBuilderFeedbackMode && !isP04StandaloneMode && !isP08StandaloneMode
              ? () => navigateTo({ page: 'p13' })
              : undefined
          }
          onSelectP08={
            !isBuilderFeedbackMode && !isP04StandaloneMode
              ? () => navigateTo({ page: 'p08' })
              : undefined
          }
          onSelectP08Builder={
            !isBuilderFeedbackMode && !isP04StandaloneMode
              ? () => navigateTo({ page: 'p08-builder' })
              : undefined
          }
          onSelectBuilder={
            isBuilderEnabled
              ? () => navigateTo({ page: isBuilderFeedbackMode ? 'builder-free' : 'builder' })
              : undefined
          }
        />
      );

    case 'gallery':
      if (isP13StandaloneMode) {
        return (
          <P13InductionHome
            onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id, from: 'p13' })}
            onOpenRoute={(target) => navigateTo({ page: target })}
            onBack={() => navigateTo({ page: 'p13' })}
          />
        );
      }
      if (isP08StandaloneMode) {
        return (
          <HomePage
            onSelectTemplate={() => navigateTo({ page: 'p08' })}
            onSelectP08={() => navigateTo({ page: 'p08' })}
            onSelectP08Builder={() => navigateTo({ page: 'p08-builder' })}
          />
        );
      }
      if (isBuilderFeedbackMode) {
        return (
          <PresetGallery
            onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id })}
            onBack={() => navigateTo({ page: 'home' })}
          />
        );
      }
      if (isBuilderFreeFeedbackMode) {
        return (
          <CircuitBuilderView
            key="builder-free-feedback"
            onBack={() => navigateTo({ page: 'home' })}
            entryMode="free"
          />
        );
      }
      return (
        <PresetGallery
          onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id })}
          onOpenP13={() => navigateTo({ page: 'p13' })}
          onOpenP08={() => navigateTo({ page: 'p08' })}
          onBack={() => navigateTo({ page: 'home' })}
        />
      );

    case 'p13':
      if (isP08StandaloneMode) {
        return (
          <HomePage
            onSelectTemplate={() => navigateTo({ page: 'p08' })}
            onSelectP08={() => navigateTo({ page: 'p08' })}
            onSelectP08Builder={() => navigateTo({ page: 'p08-builder' })}
          />
        );
      }
      return (
        <P13InductionHome
          onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id, from: 'p13' })}
          onOpenRoute={(target) => navigateTo({ page: target })}
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'p13-builder':
      return (
        <P13BuilderPage
          onSelectPreset={navigateToP13BuilderPreset}
          onBack={() => navigateTo({ page: 'p13' })}
        />
      );

    case 'p08':
      return (
        <P08FieldMagnetHome
          initialActiveKey={route.p08Module}
          onSelectPreset={(id, moduleKey) => navigateTo({
            page: 'simulator',
            presetId: id,
            from: 'p08',
            p08Module: moduleKey,
          })}
          onOpenBuilder={() => navigateTo({ page: 'p08-builder' })}
          onBack={() => navigateTo({ page: isP08StandaloneMode ? 'home' : 'gallery' })}
        />
      );

    case 'p08-builder':
      return (
        <P08FieldBuilderPage
          onBack={() => navigateTo({ page: isP08StandaloneMode ? 'home' : 'p08' })}
        />
      );

    case 'simulator':
      if (isBuilderFreeFeedbackMode) {
        return (
          <CircuitBuilderView
            key="builder-free-feedback"
            onBack={() => navigateTo({ page: 'home' })}
            entryMode="free"
          />
        );
      }
      if (!route.presetId || !getVisiblePresetId(route.presetId)) {
        if (route.from === 'p08') {
          return (
            <P08FieldMagnetHome
              initialActiveKey={route.p08Module}
              onSelectPreset={(id, moduleKey) => navigateTo({
                page: 'simulator',
                presetId: id,
                from: 'p08',
                p08Module: moduleKey,
              })}
              onOpenBuilder={() => navigateTo({ page: 'p08-builder' })}
              onBack={() => navigateTo({ page: isP08StandaloneMode ? 'home' : 'gallery' })}
            />
          );
        }
        if (isP08StandaloneMode) {
          return (
            <HomePage
              onSelectTemplate={() => navigateTo({ page: 'p08' })}
              onSelectP08={() => navigateTo({ page: 'p08' })}
              onSelectP08Builder={() => navigateTo({ page: 'p08-builder' })}
            />
          );
        }
        if (route.from === 'p13') {
          return (
            <P13InductionHome
              onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id, from: 'p13' })}
              onOpenRoute={(target) => navigateTo({ page: target })}
              onBack={() => navigateTo({ page: 'gallery' })}
            />
          );
        }
        if (route.from === 'p13-builder') {
          return (
            <P13BuilderPage
              onSelectPreset={navigateToP13BuilderPreset}
              onBack={() => navigateTo({ page: 'p13' })}
            />
          );
        }
        return (
          <PresetGallery
            onSelectPreset={(id) => navigateTo({ page: 'simulator', presetId: id })}
            onOpenP13={() => navigateTo({ page: 'p13' })}
            onOpenP08={() => navigateTo({ page: 'p08' })}
            onBack={() => navigateTo({ page: 'home' })}
          />
        );
      }

      if (route.presetId === P13_LENZ_MAGNET_COIL_PRESET_ID) {
        return (
          <P13LenzMagnetCoilPage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P13_BASE_LOOP_PRESET_ID) {
        return (
          <P13BaseLoopPage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (
        route.presetId === P13_SINGLE_ROD_RESISTIVE_PRESET_ID ||
        route.presetId === P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID ||
        route.presetId === P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID
      ) {
        const SingleRodPage =
          route.presetId === P13_SINGLE_ROD_WITH_SOURCE_PRESET_ID
            ? P13SingleRodWithSourcePage
            : route.presetId === P13_SINGLE_ROD_WITH_CAPACITOR_PRESET_ID
              ? P13SingleRodWithCapacitorPage
              : P13SingleRodResistivePage;
        return (
          <SingleRodPage
            onSelectPreset={route.from === 'p13-builder' ? navigateToP13BuilderPreset : navigateToP13Preset}
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (
        route.presetId === P13_DOUBLE_ROD_BASIC_PRESET_ID ||
        route.presetId === P13_DOUBLE_ROD_DRIVEN_PRESET_ID
      ) {
        const DoubleRodPage =
          route.presetId === P13_DOUBLE_ROD_DRIVEN_PRESET_ID
            ? P13DoubleRodDrivenPage
            : P13DoubleRodBasicPage;
        return (
          <DoubleRodPage
            onSelectPreset={route.from === 'p13-builder' ? navigateToP13BuilderPreset : navigateToP13Preset}
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P13_VERTICAL_RAIL_ROD_PRESET_ID) {
        return (
          <P13VerticalRailRodPage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P08_ROTATION_CIRCLE_PRESET_ID) {
        return (
          <P08RotationCirclePage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P08_ELECTRIC_OSCILLATION_PRESET_ID) {
        return (
          <P08ElectricOscillationPage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P08_TRANSLATION_CIRCLE_PRESET_ID) {
        return (
          <P08TranslationCirclePage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (route.presetId === P08_SCALING_CIRCLE_PRESET_ID) {
        return (
          <P08ScalingCirclePage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (
        route.presetId === P08_CYCLOTRON_VIDEO_PRESET_ID ||
        route.presetId === P08_FLOWMETER_VIDEO_PRESET_ID
      ) {
        return (
          <P08VideoExhibitPage
            presetId={route.presetId}
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      if (
        route.presetId === P08_MAGNETIC_FOCUSING_PRESET_ID ||
        route.presetId === P08_MAGNETIC_DIVERGENCE_PRESET_ID
      ) {
        return (
          <P08MagneticFocusDivergencePage
            onBack={() => navigateBackFromPreset(route)}
          />
        );
      }

      return (
        <SimulatorView
          key={route.presetId}
          presetId={route.presetId!}
          onBack={() => navigateBackFromPreset(route)}
        />
      );

    case 'builder':
      if (isBuilderFreeFeedbackMode) {
        return (
          <CircuitBuilderView
            key="builder-free-feedback"
            onBack={() => navigateTo({ page: 'home' })}
            entryMode="free"
          />
        );
      }
      if (!isBuilderEnabled) {
        return (
          <HomePage
            onSelectTemplate={() => navigateTo({ page: 'gallery' })}
          />
        );
      }
      return (
        <CircuitBuilderView
          key={isBuilderTemplateFeedbackMode ? 'builder-template-seeded-feedback' : 'builder-template'}
          onBack={() => navigateTo({ page: 'home' })}
          entryMode={isBuilderTemplateFeedbackMode ? 'free' : 'template'}
          templateSeed={isBuilderTemplateFeedbackMode ? 'recommended' : 'none'}
        />
      );

    case 'builder-free':
      if (isBuilderFreeFeedbackMode) {
        return (
          <CircuitBuilderView
            key="builder-free-feedback"
            onBack={() => navigateTo({ page: 'home' })}
            entryMode="free"
          />
        );
      }
      if (!isBuilderEnabled) {
        return (
          <HomePage
            onSelectTemplate={() => navigateTo({ page: 'gallery' })}
          />
        );
      }
      return (
        <CircuitBuilderView
          key="builder-free"
          onBack={() => navigateTo({ page: 'home' })}
          entryMode="free"
          templateSeed="none"
        />
      );

    case 'meter-error':
      return (
        <MeterErrorComparisonView
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'measure-emf-compare':
      return (
        <MeasureEmfComparisonView
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'half-deflection-compare':
      return (
        <HalfDeflectionComparisonView
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'ohmmeter-midpoint-compare':
      return (
        <OhmmeterMidpointComparisonView
          onBack={() => navigateTo({ page: 'gallery' })}
          onOpenPreset={() => navigateTo({ page: 'simulator', presetId: 'P04-CIR-EXP005-ohmmeter' })}
        />
      );

    case 'meter-reading-trainer':
      return (
        <MeterReadingTrainerView
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'meter-conversion':
      return (
        <MeterConversionExperimentView
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'voltage-resistance-method':
      return (
        <VoltageResistanceMethodPage
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );

    case 'current-resistance-method':
      return (
        <CurrentResistanceMethodPage
          onBack={() => navigateTo({ page: 'gallery' })}
        />
      );
  }
}

// ─── 模拟器视图（保持原有逻辑不变） ───

interface SimulatorViewProps {
  presetId: string;
  onBack: () => void;
}

function SimulatorView({ presetId, onBack }: SimulatorViewProps) {
  const paramGroups = useSimulationStore(
    (s) => s.simulationState.scene.paramGroups,
  );
  const paramValues = useSimulationStore((s) => s.paramValues);
  const status = useSimulationStore((s) => s.simulationState.status);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const renderLoopRef = useRef<ReturnType<typeof createRenderLoop> | null>(
    null,
  );
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  // 可变的坐标变换（缩放/平移）
  const transformRef = useRef<{ scale: number; originX: number; originY: number }>({
    scale: 150, originX: 0, originY: 0,
  });

  const recenterTransform = useCallback((ctx: CanvasRenderingContext2D | null, entities: Map<string, Entity>) => {
    if (!ctx) return;

    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;
    const origin = computeCenteredOrigin({
      entities: entities.values(),
      scale: transformRef.current.scale,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
    });
    transformRef.current.originX = origin.x;
    transformRef.current.originY = origin.y;
  }, []);

  // 加载预设
  useEffect(() => {
    const preset = presetRegistry.get(presetId);
    if (!preset) return;

    // 从 displayConfig 初始化缩放级别；origin 先采用 preset 值，再在已知画布尺寸时重新居中。
    const dc = preset.displayConfig;
    if (dc?.scale) transformRef.current.scale = dc.scale;
    if (dc?.origin) {
      transformRef.current.originX = dc.origin.x;
      transformRef.current.originY = dc.origin.y;
    } else {
      transformRef.current.originX = 0;
      transformRef.current.originY = 0;
    }

    simulator.loadPreset(preset);
    const state = simulator.getState();
    useSimulationStore.getState().initFromPreset({
      simulationState: state,
      paramValues: { ...state.scene.paramValues },
      viewportState: {
        primary: preset.defaultViewport,
        overlays: [],
        density: 'standard',
      },
    });
    recenterTransform(canvasContextRef.current, state.scene.entities);
  }, [presetId, recenterTransform]);

  // 播放驱动：status 为 running 时启动 rAF 循环驱动 simulator.step
  useEffect(() => {
    if (status !== 'running') return;

    let rafId: number;
    let lastTime = performance.now();

    function tick() {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      simulator.step(dt);

      const simState = simulator.getState();
      const result = simulator.getCurrentResult();
      const store = useSimulationStore.getState();

      // 粒子到达边界后自动结束（所有粒子速度和加速度均为零）
      let allStopped = false;
      if (result && result.motionStates.size > 0) {
        allStopped = true;
        for (const ms of result.motionStates.values()) {
          const speed = Math.hypot(ms.velocity.x, ms.velocity.y);
          const accel = Math.hypot(ms.acceleration.x, ms.acceleration.y);
          if (speed > 0.001 || accel > 0.001) { allStopped = false; break; }
        }
      }

      store.setSimulationState({
        status: allStopped ? 'finished' : simState.status,
        timeline: simState.timeline,
        currentResult: result,
      });

      if (!allStopped && simState.status === 'running') {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  // 参数变更
  const handleParamChange = useCallback(
    (key: string, value: number | boolean | string) => {
      simulator.updateParam(key, value);
      syncStoreFromSimulator();
    },
    [],
  );

  // Canvas 就绪 → 启动渲染循环（纯渲染，不驱动模拟）
  const handleContextReady = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      canvasContextRef.current = ctx;
      renderLoopRef.current?.stop();

      const canvas = ctx.canvas;
      const entities = useSimulationStore.getState().simulationState.scene.entities;
      recenterTransform(ctx, entities);

      const loop = createRenderLoop({
        canvas,
        getEntities: () =>
          useSimulationStore.getState().simulationState.scene.entities,
        getRelations: () =>
          useSimulationStore.getState().simulationState.scene.relations,
        getResult: () => simulator.getCurrentResult(),
        getViewport: () => useSimulationStore.getState().viewportState,
        getSelectedEntityId: () =>
          useSimulationStore.getState().selectedEntityId,
        getCoordinateTransform: () => ({
          scale: transformRef.current.scale,
          origin: {
            x: transformRef.current.originX,
            y: transformRef.current.originY,
          },
        }),
      });

      renderLoopRef.current = loop;
      loop.start();
    },
    [recenterTransform],
  );

  // 清理渲染循环
  useEffect(() => {
    return () => {
      renderLoopRef.current?.stop();
    };
  }, []);

  const schemas = paramGroups.flatMap((g) => g.params);
  const isStraightWireTeachingScene = presetId === WIRE_BFIELD_PRESET_ID;
  const isLoopTeachingScene = presetId === LOOP_BFIELD_PRESET_ID;
  const isSolenoidTeachingScene = presetId === SOLENOID_BFIELD_PRESET_ID;
  const isTeachingScene = isStraightWireTeachingScene || isLoopTeachingScene || isSolenoidTeachingScene;
  if (isSolenoidTeachingScene) {
    return (
      <SolenoidBFieldTeachingWorkspace
        onBack={onBack}
        onValueChange={handleParamChange}
      />
    );
  }
  if (isLoopTeachingScene) {
    return (
      <LoopBFieldTeachingWorkspace
        onBack={onBack}
        onValueChange={handleParamChange}
      />
    );
  }

  return (
    <MainLayout
      leftPanel={isStraightWireTeachingScene ? (
        <PanelErrorBoundary title="长直导线参数">
          <WireBFieldControlPanel
            onBack={onBack}
            onValueChange={handleParamChange}
          />
        </PanelErrorBoundary>
      ) : (
        <PanelErrorBoundary title="参数面板">
          <ParamPanel
            schemas={schemas}
            values={paramValues}
            onValueChange={handleParamChange}
            onBack={onBack}
            presetId={isTeachingScene ? undefined : presetId}
          />
        </PanelErrorBoundary>
      )}
      canvas={
        <SimulatorCanvas
          presetId={presetId}
          onContextReady={handleContextReady}
          transformRef={transformRef}
        />
      }
      rightPanel={isStraightWireTeachingScene ? (
        <PanelErrorBoundary title="长直导线信息">
          <WireBFieldInfoPanel />
        </PanelErrorBoundary>
      ) : (
        <PanelErrorBoundary title="信息面板">
          <InfoPanel presetId={presetId} />
        </PanelErrorBoundary>
      )}
      timeline={!isTeachingScene && duration > 0 ? (
        <PanelErrorBoundary title="时间轴" compact>
          <TimelineBar />
        </PanelErrorBoundary>
      ) : null}
      pageStyle={!isTeachingScene && P08_PRESET_IDS.has(presetId) ? getP08PageBackground(presetId) : undefined}
      topRowStyle={!isTeachingScene && P08_PRESET_IDS.has(presetId) ? { padding: 14, gap: 14 } : undefined}
    />
  );
}

// ─── 模拟器画布（含视图切换按钮叠加） ───

function SimulatorCanvas({ presetId, onContextReady, transformRef }: {
  presetId: string;
  onContextReady: (ctx: CanvasRenderingContext2D) => void;
  transformRef: React.MutableRefObject<{ scale: number; originX: number; originY: number }>;
}) {
  const density = useSimulationStore((s) => s.viewportState.density);
  const setInfoDensity = useSimulationStore((s) => s.setInfoDensity);
  const viewport = useSimulationStore((s) => s.viewportState.primary);
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const placePotentialProbe = useSimulationStore((s) => s.placePotentialProbe);
  const setPotentialProbe = useSimulationStore((s) => s.setPotentialProbe);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const activePotentialProbe = useSimulationStore((s) => s.activePotentialProbe);
  const setActivePotentialProbe = useSimulationStore((s) => s.setActivePotentialProbe);
  const setElectrostaticSurface3D = useSimulationStore((s) => s.setElectrostaticSurface3D);
  const resetElectrostaticSurface3D = useSimulationStore((s) => s.resetElectrostaticSurface3D);
  const [popup, setPopup] = useState<{ entity: Entity; x: number; y: number } | null>(null);
  const [isLoopOrbiting, setIsLoopOrbiting] = useState(false);
  const dragRef = useRef<{
    mode: 'none' | 'pan' | 'entity' | 'loop-orbit' | 'surface-3d' | 'probe';
    lastX: number;
    lastY: number;
    entityId: string | null;
    offsetX: number;
    offsetY: number;
    suppressClick: boolean;
    orbitYaw: number;
    orbitPitch: number;
    surfaceYaw: number;
    surfacePitch: number;
    probeLabel: 'A' | 'B' | null;
  }>({
    mode: 'none',
    lastX: 0,
    lastY: 0,
    entityId: null,
    offsetX: 0,
    offsetY: 0,
    suppressClick: false,
    orbitYaw: 0,
    orbitPitch: 0,
    surfaceYaw: 0,
    surfacePitch: 0,
    probeLabel: null,
  });

  const isCircuit = viewport === 'circuit';
  const isField = viewport === 'field';
  const isRealistic = density === 'detailed';
  const isP08Scene = P08_PRESET_IDS.has(presetId);
  const isStraightWireTeachingScene = presetId === WIRE_BFIELD_PRESET_ID;
  const isLoopTeachingScene = presetId === LOOP_BFIELD_PRESET_ID;
  const isTeachingScene = isStraightWireTeachingScene || isLoopTeachingScene;
  const canRotateLoopView = isLoopTeachingScene && getLoopViewMode(paramValues) === 'isometric';
  const canDragPointCharges =
    isField &&
    Array.from(entities.values()).some((entity) => entity.type === 'point-charge') &&
    !Array.from(entities.values()).some(
      (entity) => entity.type === 'uniform-efield' || entity.type === 'uniform-bfield',
    );
  const canDragParticleEmitters =
    !isTeachingScene &&
    Array.from(entities.values()).some((entity) => entity.type === 'particle-emitter');
  const supportsPotentialMeasurement = isP08Scene && canDragPointCharges;

  const getProbeHitLabel = useCallback((container: HTMLElement, clientX: number, clientY: number): 'A' | 'B' | null => {
    if (!supportsPotentialMeasurement) return null;
    const rect = container.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const transform = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };

    const candidates = [
      potentialProbeA ? { label: 'A' as const, point: potentialProbeA } : null,
      potentialProbeB ? { label: 'B' as const, point: potentialProbeB } : null,
    ].filter(Boolean) as Array<{ label: 'A' | 'B'; point: { x: number; y: number } }>;

    for (const candidate of candidates) {
      const px = transform.origin.x + (candidate.point.x * transform.scale);
      const py = transform.origin.y - (candidate.point.y * transform.scale);
      if (Math.hypot(px - screenX, py - screenY) <= 14) {
        return candidate.label;
      }
    }
    return null;
  }, [potentialProbeA, potentialProbeB, supportsPotentialMeasurement, transformRef]);

  useEffect(() => {
    if (!isTeachingScene) return;
    setPopup(null);
    useSimulationStore.getState().selectEntity(null);
  }, [isTeachingScene]);

  useEffect(() => {
    if (canRotateLoopView) return;
    dragRef.current.mode = 'none';
    setIsLoopOrbiting(false);
  }, [canRotateLoopView]);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (supportsPotentialMeasurement && target.tagName === 'CANVAS') {
      const panelBounds = getPotentialSurfacePanelBounds(target as HTMLCanvasElement, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const insidePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (insidePanel) {
          e.preventDefault();
          const current = useSimulationStore.getState().electrostaticSurface3D;
          setElectrostaticSurface3D({
            zoom: Math.max(0.7, Math.min(1.8, current.zoom * (e.deltaY > 0 ? 0.92 : 1.08))),
          });
          return;
        }
      }
    }

    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(30, Math.min(2500, transformRef.current.scale * factor));

    // 以鼠标位置为中心缩放
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = newScale / transformRef.current.scale;
    transformRef.current.originX = mx - (mx - transformRef.current.originX) * ratio;
    transformRef.current.originY = my - (my - transformRef.current.originY) * ratio;
    transformRef.current.scale = newScale;
  }, [setElectrostaticSurface3D, supportsPotentialMeasurement, transformRef]);

  const getWorldPoint = useCallback((container: HTMLElement, clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    const pixel = { x: clientX - rect.left, y: clientY - rect.top };
    return screenToWorld(pixel, {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    });
  }, [transformRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const canvasTarget = target.tagName === 'CANVAS' ? target as HTMLCanvasElement : null;

    if (e.button === 0 && canvasTarget && supportsPotentialMeasurement) {
      const panelBounds = getPotentialSurfacePanelBounds(canvasTarget, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = canvasTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const resetBounds = getPotentialSurfaceResetButtonBounds(panelBounds);
        const inReset =
          x >= resetBounds.x &&
          x <= resetBounds.x + resetBounds.width &&
          y >= resetBounds.y &&
          y <= resetBounds.y + resetBounds.height;
        if (inReset) {
          resetElectrostaticSurface3D();
          return;
        }

        const inSurfacePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (inSurfacePanel) {
          const surface = useSimulationStore.getState().electrostaticSurface3D;
          dragRef.current = {
            ...dragRef.current,
            mode: 'surface-3d',
            lastX: e.clientX,
            lastY: e.clientY,
            suppressClick: false,
            surfaceYaw: surface.yawDeg,
            surfacePitch: surface.pitchDeg,
            probeLabel: null,
          };
          return;
        }
      }
    }

    if (e.button === 0 && canRotateLoopView) {
      if (target.tagName !== 'CANVAS') return;
      const camera = getLoopCameraState(useSimulationStore.getState().paramValues);
      dragRef.current = {
        ...dragRef.current,
        mode: 'loop-orbit',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: null,
        suppressClick: false,
        orbitYaw: camera.yawDeg,
        orbitPitch: camera.pitchDeg,
      };
      setIsLoopOrbiting(true);
      return;
    }

    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      dragRef.current = {
        ...dragRef.current,
        mode: 'pan',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: null,
        suppressClick: false,
      };
      return;
    }

    if (e.button !== 0) return;
    if (target.tagName !== 'CANVAS') return;

    const probeHit = getProbeHitLabel(e.currentTarget, e.clientX, e.clientY);
    if (probeHit) {
      setActivePotentialProbe(probeHit);
      dragRef.current = {
        ...dragRef.current,
        mode: 'probe',
        lastX: e.clientX,
        lastY: e.clientY,
        suppressClick: false,
        probeLabel: probeHit,
      };
      return;
    }
    if (!canDragPointCharges && !canDragParticleEmitters) return;

    const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
    const tf = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };

    for (const entity of entities.values()) {
      if (entity.type === 'point-charge' && !canDragPointCharges) continue;
      if (entity.type === 'particle-emitter' && !canDragParticleEmitters) continue;
      if (entity.type !== 'point-charge' && entity.type !== 'particle-emitter') continue;
      const registration = entityRegistry.get(entity.type);
      if (!registration?.hitTest(entity, worldPoint, tf)) continue;

      setPopup(null);
      useSimulationStore.getState().selectEntity(entity.id);
      dragRef.current = {
        mode: 'entity',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: entity.id,
        offsetX: worldPoint.x - entity.transform.position.x,
        offsetY: worldPoint.y - entity.transform.position.y,
        suppressClick: false,
        orbitYaw: dragRef.current.orbitYaw,
        orbitPitch: dragRef.current.orbitPitch,
        surfaceYaw: dragRef.current.surfaceYaw,
        surfacePitch: dragRef.current.surfacePitch,
        probeLabel: null,
      };
      return;
    }
  }, [canDragParticleEmitters, canDragPointCharges, canRotateLoopView, entities, getProbeHitLabel, getWorldPoint, resetElectrostaticSurface3D, setActivePotentialProbe, supportsPotentialMeasurement, transformRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.mode === 'none') return;

    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    if (Math.hypot(dx, dy) > 2) {
      dragRef.current.suppressClick = true;
    }

    if (dragRef.current.mode === 'pan') {
      transformRef.current.originX += dx;
      transformRef.current.originY += dy;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'loop-orbit') {
      dragRef.current.orbitYaw += dx * 0.45;
      dragRef.current.orbitPitch = clampLoopPitchDeg(dragRef.current.orbitPitch - dy * 0.24);
      const store = useSimulationStore.getState();
      store.updateParam('loopCameraYawDeg', dragRef.current.orbitYaw);
      store.updateParam('loopCameraPitchDeg', dragRef.current.orbitPitch);
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'surface-3d') {
      dragRef.current.surfaceYaw += dx * 0.42;
      dragRef.current.surfacePitch = Math.max(-15, Math.min(70, dragRef.current.surfacePitch - (dy * 0.24)));
      setElectrostaticSurface3D({
        yawDeg: dragRef.current.surfaceYaw,
        pitchDeg: dragRef.current.surfacePitch,
      });
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'probe' && dragRef.current.probeLabel) {
      const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
      setPotentialProbe(dragRef.current.probeLabel, worldPoint);
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'entity' && dragRef.current.entityId) {
      const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
      simulator.updateEntityPosition(dragRef.current.entityId, {
        x: worldPoint.x - dragRef.current.offsetX,
        y: worldPoint.y - dragRef.current.offsetY,
      });
      syncStoreFromSimulator();
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    }
  }, [getWorldPoint, setElectrostaticSurface3D, setPotentialProbe, transformRef]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.mode === 'loop-orbit') {
      simulator.updateParam('loopCameraYawDeg', dragRef.current.orbitYaw);
      simulator.updateParam('loopCameraPitchDeg', dragRef.current.orbitPitch);
      syncStoreFromSimulator();
    }

    setIsLoopOrbiting(false);
    if (dragRef.current.mode === 'probe') {
      setActivePotentialProbe(null);
    }
    dragRef.current.mode = 'none';
    dragRef.current.entityId = null;
    dragRef.current.probeLabel = null;
  }, [setActivePotentialProbe]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.suppressClick) {
      dragRef.current.suppressClick = false;
      return;
    }

    setPopup(null);
    const target = e.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    if (supportsPotentialMeasurement) {
      const panelBounds = getPotentialSurfacePanelBounds(target as HTMLCanvasElement, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const inSurfacePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (inSurfacePanel) return;
      }
    }

    const tf = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };
    const wp = getWorldPoint(e.currentTarget, e.clientX, e.clientY);

    const sceneEntities = useSimulationStore.getState().simulationState.scene.entities;
    for (const ent of sceneEntities.values()) {
      const reg = entityRegistry.get(ent.type);
      if (reg?.hitTest(ent, wp, tf)) {
        if (isTeachingScene) return;
        setPopup({ entity: ent, x: e.clientX, y: e.clientY });
        useSimulationStore.getState().selectEntity(ent.id);
        return;
      }
    }
    if (supportsPotentialMeasurement) {
      placePotentialProbe(wp);
      useSimulationStore.getState().selectEntity(null);
      return;
    }
    useSimulationStore.getState().selectEntity(null);
  }, [getWorldPoint, isTeachingScene, placePotentialProbe, supportsPotentialMeasurement, transformRef]);

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        cursor:
          dragRef.current.mode === 'surface-3d' || dragRef.current.mode === 'probe'
            ? 'grabbing'
            : canRotateLoopView
              ? (isLoopOrbiting ? 'grabbing' : 'grab')
              : activePotentialProbe
                ? 'grab'
                : 'default',
        ...(isP08Scene ? getP08CanvasShellStyle(presetId) : {}),
      }}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <CanvasContainer
        onContextReady={onContextReady}
        backgroundStyle={isLoopTeachingScene ? {
          background:
            'radial-gradient(circle at 50% 18%, rgba(255,255,255,0.98) 0%, rgba(244,247,242,0.96) 36%, rgba(231,237,230,0.92) 100%)',
        } : isP08Scene ? getP08CanvasBackground(presetId, viewport) : undefined}
      />
      {isP08Scene && <P08StageHeader presetId={presetId} viewport={viewport} />}
      {isCircuit && (
        <button
          onClick={(e) => { e.stopPropagation(); setInfoDensity(isRealistic ? 'standard' : 'detailed'); }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${isRealistic ? '#3B82F6' : '#D1D5DB'}`,
            backgroundColor: isRealistic ? '#EFF6FF' : 'rgba(255,255,255,0.95)',
            color: isRealistic ? '#3B82F6' : '#374151',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {isRealistic ? '实物图模式' : '电路图模式'}
          <span style={{ color: '#9CA3AF', fontSize: 10 }}>点击切换</span>
        </button>
      )}
      {isP08Scene && <P08DisplayControls presetId={presetId} />}
      {isCircuit && (
        <PanelErrorBoundary title="电路信息卡" compact>
          <CircuitInfoCards entities={entities} />
        </PanelErrorBoundary>
      )}
      {!isTeachingScene && (
        <PanelErrorBoundary title="场信息卡" compact>
          <FieldInfoCards entities={entities} presetId={presetId} />
        </PanelErrorBoundary>
      )}
      {isStraightWireTeachingScene && <WireBFieldCanvasOverlay transformRef={transformRef} />}
      {isLoopTeachingScene && <LoopBFieldCanvasOverlay />}
      <PlaybackDock />
      {!isTeachingScene && isP08Scene && <P08ResultOverlay presetId={presetId} />}
      {popup && (
        <SimulatorParamPopup
          entity={popup.entity}
          x={popup.x}
          y={popup.y}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// ─── 模拟器内元件参数弹窗 ───

function SimulatorParamPopup({ entity, x, y, onClose }: {
  entity: Entity; x: number; y: number; onClose: () => void;
}) {
  const paramValues = useSimulationStore((s) => s.paramValues);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sim-popup]')) onClose();
    };
    const timer = setTimeout(() => window.addEventListener('click', handler), 50);
    return () => { clearTimeout(timer); window.removeEventListener('click', handler); };
  }, [onClose]);

  const reg = entityRegistry.get(entity.type);
  if (!reg) return null;

  // 找到该实体对应的 paramGroup 中的参数
  const paramGroups = useSimulationStore.getState().simulationState.scene.paramGroups;

  // 收集所有 targetEntityId 指向该实体的参数
  const entityParams: Array<{ schema: import('@/core/types').ParamSchema; value: unknown }> = [];
  for (const group of paramGroups) {
    for (const param of group.params) {
      if (param.targetEntityId === entity.id) {
        entityParams.push({ schema: param, value: paramValues[param.key] ?? getParamSchemaDefaultValue(param) });
      }
    }
  }

  if (entityParams.length === 0) return null;

  const panelW = 240;
  const left = Math.max(8, Math.min(window.innerWidth - panelW - 8, x - panelW / 2));
  const top = Math.max(8, Math.min(window.innerHeight - 300, y + 20));

  const handleChange = (key: string, value: number | boolean | string) => {
    simulator.updateParam(key, value);
    syncStoreFromSimulator();
  };

  return (
    <div
      data-sim-popup
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 1000,
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.md,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{entity.label ?? reg.label}</span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.textMuted, fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entityParams.map(({ schema, value }) => {
          if (schema.type === 'slider') {
            const numVal = (value as number) ?? schema.default;
            return (
              <div key={schema.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{schema.label}</span>
                  <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 500 }}>{numVal}{schema.unit}</span>
                </div>
                <input
                  type="range"
                  min={schema.min}
                  max={schema.max}
                  step={schema.step}
                  value={Math.min(numVal, schema.max)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) handleChange(schema.key, v);
                  }}
                  style={{ width: '100%', accentColor: COLORS.primary }}
                />
              </div>
            );
          }
          if (schema.type === 'toggle') {
            const boolVal = (value as boolean) ?? schema.default;
            return (
              <div key={schema.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{schema.label}</span>
                <button
                  onClick={() => handleChange(schema.key, !boolVal)}
                  style={{
                    padding: '2px 10px',
                    fontSize: 11,
                    borderRadius: 4,
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: boolVal ? COLORS.primaryLight : COLORS.bg,
                    color: boolVal ? COLORS.primary : COLORS.textSecondary,
                    cursor: 'pointer',
                  }}
                >{boolVal ? (schema.labelOn ?? '开') : (schema.labelOff ?? '关')}</button>
              </div>
            );
          }
          if (schema.type === 'select') {
            const curVal = value ?? schema.default;
            return (
              <div key={schema.key}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>{schema.label}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {schema.options.map((opt) => {
                    const optVal = typeof opt.value === 'number' ? opt.value : opt.value;
                    const isActive = String(optVal) === String(curVal);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { handleChange(schema.key, optVal); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '5px 10px',
                          fontSize: 11,
                          textAlign: 'left',
                          borderRadius: 4,
                          border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
                          backgroundColor: isActive ? COLORS.primaryLight : COLORS.bg,
                          color: isActive ? COLORS.primary : COLORS.text,
                          fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function getParamSchemaDefaultValue(schema: import('@/core/types').ParamSchema): unknown {
  switch (schema.type) {
    case 'slider':
    case 'input':
    case 'toggle':
    case 'select':
      return schema.default;
    case 'button':
    default:
      return undefined;
  }
}
