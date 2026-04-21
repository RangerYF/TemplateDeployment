import { cn } from '@/lib/utils/cn';
import { COLORS } from '@/styles/tokens';
import { useSimulationStore, useHistoryStore } from '@/editor/store';
import { RunSimulationCommand } from '@/editor/commands';
import { SIMULATION_GROUPS, SIMULATION_LIST, DEFAULT_PARAMS } from '@/types/simulation';
import type { SimulationType } from '@/types/simulation';

const META_MAP = Object.fromEntries(SIMULATION_LIST.map(s => [s.type, s]));

export function TopBar() {
  const activeSimId = useSimulationStore(s => s.activeSimId);
  const simulations = useSimulationStore(s => s.simulations);
  const createSimulation = useSimulationStore(s => s.createSimulation);

  const activeSim = activeSimId ? simulations[activeSimId] : undefined;
  const currentType = activeSim?.type;

  const handleSwitch = (newType: SimulationType) => {
    if (newType === currentType) return;

    // Find existing sim of this type or create new one
    const existing = Object.values(simulations).find(s => s.type === newType);
    if (existing) {
      useSimulationStore.getState().setActiveSimId(existing.id);
    } else {
      const sim = createSimulation(newType, DEFAULT_PARAMS[newType]);
      // For deterministic simulations, auto-run
      const deterministicTypes: SimulationType[] = ['histogram', 'binomialDist', 'normalDist', 'linearRegression'];
      if (deterministicTypes.includes(newType)) {
        const cmd = new RunSimulationCommand(sim.id, newType, sim.params);
        useHistoryStore.getState().execute(cmd);
      }
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b overflow-x-auto shrink-0"
      style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-3 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: COLORS.primary }}
        >
          P
        </div>
        <span className="font-semibold text-sm whitespace-nowrap" style={{ color: COLORS.text }}>
          概率统计模拟器
        </span>
      </div>

      <div className="w-px self-stretch" style={{ backgroundColor: COLORS.border }} />

      {/* Simulation groups */}
      {SIMULATION_GROUPS.map((group, groupIdx) => (
        <div key={group.label} className="flex items-center">
          {groupIdx > 0 && (
            <div className="mx-1.5 self-stretch" style={{ width: 1, backgroundColor: COLORS.border, minHeight: 20 }} />
          )}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ backgroundColor: COLORS.bgMuted }}
          >
            <span
              className="mr-1 whitespace-nowrap"
              style={{ fontSize: 14, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em' }}
            >
              {group.label}
            </span>
            {group.types.map(type => {
              const meta = META_MAP[type];
              if (!meta) return null;
              const isActive = currentType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleSwitch(type)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all duration-150 whitespace-nowrap',
                    'hover:opacity-90'
                  )}
                  style={{
                    backgroundColor: isActive ? COLORS.primary : 'transparent',
                    color: isActive ? COLORS.white : COLORS.textSecondary,
                    fontSize: 14,
                    minHeight: 32,
                  }}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
