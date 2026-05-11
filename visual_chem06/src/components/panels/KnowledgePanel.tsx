import type { ReactNode } from 'react';
import { AlertTriangle, ArrowLeftRight, Beaker, BookOpenText, Lightbulb } from 'lucide-react';
import { PanelCard } from '@/components/panels/PanelCard';
import { COLORS } from '@/styles/tokens';
import { getCurrentModel, getCurrentScenario, useElectrochemStore } from '@/store/electrochemStore';

export function KnowledgePanel() {
  const selectedModelId = useElectrochemStore((state) => state.selectedModelId);
  const selectedScenarioId = useElectrochemStore((state) => state.selectedScenarioId);
  const progress = useElectrochemStore((state) => state.progress);

  const model = getCurrentModel({ selectedModelId });
  const scenario = getCurrentScenario({ selectedModelId, selectedScenarioId });
  const activeKeyframe = [...scenario.keyframes].reverse().find((item) => progress >= item.at) ?? scenario.keyframes[0];

  return (
    <div className="space-y-4">
      <PanelCard title="反应与关键帧" subtitle={model.environment} right={<KeyframeBadge title={activeKeyframe?.title ?? '演示中'} />}>
        <div className="space-y-4">
          <EquationBlock title="总反应" value={scenario.totalReaction} accent={COLORS.primaryLight} />
          <EquationBlock title={scenario.leftElectrode.label} value={scenario.leftElectrode.reaction} accent="#EEF5FF" alternate={getAlternateOxidationForm(scenario.leftElectrode.reaction, scenario.leftElectrode.role)} />
          <EquationBlock title={scenario.rightElectrode.label} value={scenario.rightElectrode.reaction} accent="#FFF7EE" alternate={getAlternateOxidationForm(scenario.rightElectrode.reaction, scenario.rightElectrode.role)} />
          <div className="rounded-2xl border px-4 py-4" style={{ borderColor: COLORS.border, background: COLORS.bgPage }}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>
              <BookOpenText size={12} />
              当前说明
            </div>
            <div className="mt-2 text-sm font-medium" style={{ color: COLORS.text }}>{activeKeyframe?.title}</div>
            <p className="mt-1 text-sm leading-6" style={{ color: COLORS.textSecondary }}>{activeKeyframe?.description}</p>
          </div>
        </div>
      </PanelCard>

      <PanelCard title="内电路观察" subtitle="离子迁移、物质变化、竞争反应与环境提示">
        <div className="space-y-4 text-sm">
          <InfoBullet icon={<ArrowLeftRight size={14} />} title="粒子迁移" body={scenario.streams.map((stream) => `${stream.label}：${stream.note.replace(/。$/, '')}`).join('；')} />
          <InfoBullet icon={<Beaker size={14} />} title="电极表面" body={`${scenario.leftElectrode.surfaceNote.replace(/。$/, '')}；${scenario.rightElectrode.surfaceNote.replace(/。$/, '')}`} />
          {scenario.phIndicators?.length ? <InfoBullet icon={<Lightbulb size={14} />} title="pH 指示" body={scenario.phIndicators.map((item) => `${item.label}${item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}：${item.note.replace(/。$/, '')}`).join('；')} /> : null}
          {scenario.competition ? <InfoBullet icon={<AlertTriangle size={14} />} title={scenario.competition.title} body={`${scenario.competition.winner} 优先于 ${scenario.competition.loser}：${scenario.competition.explanation}`} /> : null}
          {scenario.trend ? <InfoBullet icon={<ArrowLeftRight size={14} />} title={scenario.trend.title} body={scenario.trend.points.map((p) => p.replace(/。$/, '')).join('；')} /> : null}
          {model.crossDisciplineNote ? <InfoBullet icon={<BookOpenText size={14} />} title="跨学科提示" body={model.crossDisciplineNote} /> : null}
        </div>
      </PanelCard>

      <PanelCard title="环境提示" subtitle="满足 PRD 中的反应环境标注要求">
        <div className="space-y-3">
          {model.environmentTips.map((tip) => (
            <div key={tip.title} className="rounded-2xl border-l-[3px] px-4 py-3 text-sm leading-6" style={{ background: tip.kind === 'warning' ? '#FFF7EE' : '#EEF8FF', borderLeftColor: tip.kind === 'warning' ? '#F59E0B' : '#3182CE', color: COLORS.textSecondary }}>
              <div className="font-semibold" style={{ color: COLORS.text }}>{tip.title}</div>
              <div>{tip.body}</div>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

interface EquationBlockProps {
  title: string;
  value: string;
  accent: string;
  alternate?: string | null;
}

function EquationBlock({ title, value, accent, alternate }: EquationBlockProps) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: accent }}>
      <div className="text-xs font-semibold tracking-[0.14em]" style={{ color: COLORS.textMuted }}>{title}</div>
      <div className="mt-2 text-sm font-medium leading-7" style={{ color: COLORS.text }}>{value}</div>
      {alternate ? <div className="mt-1 text-xs leading-6" style={{ color: COLORS.textSecondary }}>等价写法：{alternate}</div> : null}
    </div>
  );
}

function getAlternateOxidationForm(reaction: string, role: string) {
  if (role !== '阳极') return null;
  const electronMatch = reaction.match(/\s-\s(\d*e⁻)/);
  if (!electronMatch) return null;
  const electronTerm = electronMatch[1];
  const arrowIdx = reaction.indexOf('→');
  if (arrowIdx === -1) return null;
  const leftSide = reaction.slice(0, arrowIdx).replace(/\s-\s\d*e⁻/, '').replace(/^\s*\+\s*/, '').replace(/\s*\+\s*$/, '').trim();
  const rightSide = reaction.slice(arrowIdx + 1).trim();
  return `${leftSide} → ${rightSide} + ${electronTerm}`;
}

interface InfoBulletProps {
  icon: ReactNode;
  title: string;
  body: string;
}

function InfoBullet({ icon, title, body }: InfoBulletProps) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: COLORS.border, background: COLORS.bgPage }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: COLORS.textMuted }}>
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 leading-6" style={{ color: COLORS.textSecondary }}>{body}</p>
    </div>
  );
}

function KeyframeBadge({ title }: { title: string }) {
  return (
    <div className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: COLORS.primaryLight, color: COLORS.primary }}>
      {title}
    </div>
  );
}
