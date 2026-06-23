import { useState, useEffect, useCallback } from 'react';
import { useSimulatorScene } from './hooks/useSimulatorScene';
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
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import { MainLayout } from './layout/MainLayout';
import { AppLayout } from './layout/AppLayout';
import type { TopBarTab } from './layout/TopBar';
import { RightSidebar } from './panels/RightSidebar';
import { SimulatorCanvas } from './canvas/SimulatorCanvas';
import { TimelineBar } from './timeline/TimelineBar';
import { PresetGallery } from './pages/PresetGallery';
import { HomePage } from './pages/HomePage';
import { CircuitBuilderView } from './pages/CircuitBuilderView';
import { MeterErrorComparisonView } from './pages/MeterErrorComparisonView';
import { MeasureEmfComparisonView } from './pages/MeasureEmfComparisonView';
import { HalfDeflectionComparisonView } from './pages/HalfDeflectionComparisonView';
import { OhmmeterMidpointComparisonView } from './pages/OhmmeterMidpointComparisonView';
import { MeterReadingTrainerView } from './pages/MeterReadingTrainerView';
import { MeterConversionExperimentView } from './pages/MeterConversionExperimentView';
import { VoltageResistanceMethodPage } from './pages/VoltageResistanceMethodPage';
import { CurrentResistanceMethodPage } from './pages/CurrentResistanceMethodPage';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { P08UnifiedSimulator } from './pages/P08UnifiedSimulator';
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
import {
  WireBFieldControlPanel,
  WireBFieldInfoPanel,
} from './panels/WireBFieldTeachingPanels';
import {
  LoopBFieldTeachingWorkspace,
} from './panels/LoopBFieldTeachingPanels';
import { SolenoidBFieldTeachingWorkspace } from './panels/SolenoidBFieldTeachingPanels';
import {
  P08_PRESET_IDS,
  P08_SPECIAL_PRESET_IDS,
  P08_MODULES,
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
import { WIRE_BFIELD_PRESET_ID } from '@/domains/em/logic/straight-wire-teaching';
import { LOOP_BFIELD_PRESET_ID } from '@/domains/em/logic/loop-current-teaching';
import { SOLENOID_BFIELD_PRESET_ID } from '@/domains/em/logic/solenoid-teaching';
import { getP08PageBackground } from './p08/p08Theme';

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
  p08Mode?: 'preset' | 'builder';
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
    if (path === 'p08-builder') return { page: 'p08', p08Mode: 'builder' };
    if (path === 'p08') {
      const moduleParam = params.get('module');
      const p08Module = isP08ModuleKey(moduleParam) ? moduleParam : undefined;
      const modeParam = params.get('mode');
      const p08Mode = modeParam === 'builder' ? 'builder' as const : undefined;
      return { page: 'p08', p08Module, p08Mode };
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
        : { page: 'p08' };
    }
    return { page: 'p08' };
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
  if (path === 'p08-builder') return (isP04StandaloneMode || isBuilderFeedbackMode) ? { page: 'gallery' } : { page: 'p08', p08Mode: 'builder' };
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
    if (route.p08Mode === 'builder') {
      params.set('mode', 'builder');
    }
    window.location.hash = params.toString() ? `p08?${params.toString()}` : 'p08';
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

  const navigateToP08Preset = useCallback((presetId: string, currentRoute: AppRoute) => {
    if (P08_SPECIAL_PRESET_IDS.has(presetId)) {
      navigateTo({
        page: 'simulator',
        presetId,
        from: 'p08',
        p08Module: currentRoute.p08Module ?? getP08ModuleKeyByPresetId(presetId),
      });
    } else {
      navigateTo({
        page: 'p08',
        presetId,
        p08Module: getP08ModuleKeyByPresetId(presetId),
      });
    }
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
      if (isP08StandaloneMode) {
        navigateTo({ page: 'p08' });
        return null;
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
          onSelectTemplate={() => navigateTo({ page: 'gallery' })}
          onSelectP13={
            !isBuilderFeedbackMode && !isP04StandaloneMode
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
              ? () => navigateTo({ page: 'p08', p08Mode: 'builder' })
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
        navigateTo({ page: 'p08' });
        return null;
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
        navigateTo({ page: 'p08' });
        return null;
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
        <P08UnifiedSimulator
          onBack={() => navigateTo({ page: isP08StandaloneMode ? 'home' : 'gallery' })}
          onNavigateToSpecialPage={(presetId) => navigateTo({
            page: 'simulator',
            presetId,
            from: 'p08',
            p08Module: route.p08Module,
          })}
          initialPresetId={route.presetId}
          initialModuleKey={route.p08Module}
          initialMode={route.p08Mode}
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
        if (route.from === 'p08' || isP08StandaloneMode) {
          navigateTo({ page: 'p08', p08Module: route.p08Module });
          return null;
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
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
          />
        );
      }

      if (route.presetId === P08_ELECTRIC_OSCILLATION_PRESET_ID) {
        return (
          <P08ElectricOscillationPage
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
          />
        );
      }

      if (route.presetId === P08_TRANSLATION_CIRCLE_PRESET_ID) {
        return (
          <P08TranslationCirclePage
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
          />
        );
      }

      if (route.presetId === P08_SCALING_CIRCLE_PRESET_ID) {
        return (
          <P08ScalingCirclePage
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
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
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
          />
        );
      }

      if (
        route.presetId === P08_MAGNETIC_FOCUSING_PRESET_ID ||
        route.presetId === P08_MAGNETIC_DIVERGENCE_PRESET_ID
      ) {
        return (
          <P08MagneticFocusDivergencePage
            onSelectPreset={(id: string) => navigateToP08Preset(id, route)}
          />
        );
      }

      return (
        <SimulatorView
          key={route.presetId}
          presetId={route.presetId!}
          onBack={() => navigateBackFromPreset(route)}
          onSelectPreset={(id) => navigateTo({ ...route, presetId: id })}
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
  /** Switch to a sibling preset (used by the P09 TopBar scene tabs). */
  onSelectPreset?: (presetId: string) => void;
}

function SimulatorView({ presetId, onBack, onSelectPreset }: SimulatorViewProps) {
  const { schemas, paramValues, duration, handleParamChange, handleContextReady, transformRef } =
    useSimulatorScene(presetId);
  const isStraightWireTeachingScene = presetId === WIRE_BFIELD_PRESET_ID;
  const isLoopTeachingScene = presetId === LOOP_BFIELD_PRESET_ID;
  const isSolenoidTeachingScene = presetId === SOLENOID_BFIELD_PRESET_ID;
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

  // 长直导线教学场景:沿用原 MainLayout(专用左右教学面板),本轮不迁移。
  if (isStraightWireTeachingScene) {
    return (
      <MainLayout
        leftPanel={
          <PanelErrorBoundary title="长直导线参数">
            <WireBFieldControlPanel onBack={onBack} onValueChange={handleParamChange} />
          </PanelErrorBoundary>
        }
        canvas={
          <SimulatorCanvas presetId={presetId} onContextReady={handleContextReady} transformRef={transformRef} />
        }
        rightPanel={
          <PanelErrorBoundary title="长直导线信息">
            <WireBFieldInfoPanel />
          </PanelErrorBoundary>
        }
        timeline={null}
      />
    );
  }

  // 标准模拟器:P09 风格 AppLayout(顶栏 + 画布 + 右 320px 合并侧栏 + 响应式抽屉)。
  const p08ModuleKey = P08_PRESET_IDS.has(presetId) ? getP08ModuleKeyByPresetId(presetId) : undefined;
  const p08Tabs: TopBarTab[] | undefined = p08ModuleKey
    ? (P08_MODULES.find((m) => m.key === p08ModuleKey)?.presetIds ?? [])
        .map((id) => {
          const p = presetRegistry.get(id);
          return p ? { id, label: p.name } : null;
        })
        .filter((t): t is TopBarTab => t !== null)
    : undefined;
  const title = presetRegistry.get(presetId)?.name ?? '模拟器';

  return (
    <AppLayout
      title={title}
      tabs={p08Tabs}
      activeTabId={presetId}
      onSelectTab={(id) => onSelectPreset?.(id)}
      onBack={onBack}
      pageStyle={P08_PRESET_IDS.has(presetId) ? getP08PageBackground(presetId) : undefined}
      timeline={duration > 0 ? (
        <PanelErrorBoundary title="时间轴" compact>
          <TimelineBar />
        </PanelErrorBoundary>
      ) : null}
      sidebar={
        <PanelErrorBoundary title="参数与读数">
          <RightSidebar
            schemas={schemas}
            values={paramValues}
            onValueChange={handleParamChange}
            presetId={presetId}
          />
        </PanelErrorBoundary>
      }
    >
      <SimulatorCanvas presetId={presetId} onContextReady={handleContextReady} transformRef={transformRef} />
    </AppLayout>
  );
}


