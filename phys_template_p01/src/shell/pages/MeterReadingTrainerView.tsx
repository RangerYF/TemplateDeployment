import { useEffect, useMemo, useState } from 'react';
import { COLORS } from '@/styles/tokens';
import { Input } from '@/components/ui/input';
import {
  buildMeterDialGeometry,
  createMeterReadingQuestion,
  formatMeterReadingValue,
  getStepPrecision,
  isMeterReadingAnswerCorrect,
  listMeterTrainingSpecs,
  type MeterReadingFamily,
  type MeterReadingMode,
  type MeterReadingQuestion,
  type MeterTrainingSpec,
} from '@/domains/em/logic/meter-reading-trainer';

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
};

type FeedbackState =
  | { kind: 'correct'; message: string }
  | { kind: 'incorrect'; message: string }
  | { kind: 'revealed'; message: string };

interface TrainerStats {
  total: number;
  correct: number;
  streak: number;
  bestStreak: number;
  revealed: number;
}

const INITIAL_STATS: TrainerStats = {
  total: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  revealed: 0,
};

interface Props {
  onBack: () => void;
}

export function MeterReadingTrainerView({ onBack }: Props) {
  const [family, setFamily] = useState<MeterReadingFamily>('all');
  const [readingMode, setReadingMode] = useState<MeterReadingMode>('tick');
  const [question, setQuestion] = useState<MeterReadingQuestion>(() =>
    createMeterReadingQuestion({ family: 'all', readingMode: 'tick' }),
  );
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [stats, setStats] = useState<TrainerStats>(INITIAL_STATS);

  const availableSpecs = useMemo(() => listMeterTrainingSpecs(family), [family]);
  const accuracy =
    stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    setQuestion(createMeterReadingQuestion({ family, readingMode }));
    setAnswer('');
    setFeedback(null);
  }, [family, readingMode]);

  const nextQuestion = () => {
    setQuestion(createMeterReadingQuestion({ family, readingMode }));
    setAnswer('');
    setFeedback(null);
    setQuestionIndex((prev) => prev + 1);
  };

  const handleSubmit = () => {
    if (feedback) return;

    const numeric = Number(answer);
    if (!Number.isFinite(numeric)) return;

    const isCorrect = isMeterReadingAnswerCorrect(question, numeric);
    const answerText = `${question.answerText} ${question.spec.unitLabel}`;

    setFeedback({
      kind: isCorrect ? 'correct' : 'incorrect',
      message: isCorrect
        ? `回答正确，标准读数是 ${answerText}`
        : `回答不对，标准读数是 ${answerText}`,
    });

    setStats((prev) => {
      const streak = isCorrect ? prev.streak + 1 : 0;
      return {
        total: prev.total + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
        revealed: prev.revealed,
      };
    });
  };

  const handleReveal = () => {
    if (feedback) return;
    setFeedback({
      kind: 'revealed',
      message: `标准读数是 ${question.answerText} ${question.spec.unitLabel}`,
    });
    setStats((prev) => ({ ...prev, revealed: prev.revealed + 1 }));
  };

  const resetStats = () => {
    setStats(INITIAL_STATS);
  };

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: pageStyle.pageBg }}
    >
      <header
        className="flex items-center gap-3 px-5 py-2.5"
        style={{
          borderBottom: `1px solid ${pageStyle.border}`,
          backgroundColor: pageStyle.panelBg,
        }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{
            color: pageStyle.text,
            border: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.blockBg,
          }}
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          电表表头读数训练
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          训练常见电流表、电压表和灵敏电流计表盘读数
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <TrainerLeftPanel
          family={family}
          readingMode={readingMode}
          availableSpecs={availableSpecs}
          stats={stats}
          accuracy={accuracy}
          onChangeFamily={setFamily}
          onChangeMode={setReadingMode}
          onNextQuestion={nextQuestion}
          onResetStats={resetStats}
        />
        <TrainerCenterPanel
          question={question}
          questionIndex={questionIndex}
          answer={answer}
          feedback={feedback}
          onChangeAnswer={setAnswer}
          onSubmit={handleSubmit}
          onReveal={handleReveal}
          onNextQuestion={nextQuestion}
        />
        <TrainerRightPanel
          question={question}
          availableSpecs={availableSpecs}
          feedback={feedback}
        />
      </div>
    </div>
  );
}

function TrainerLeftPanel({
  family,
  readingMode,
  availableSpecs,
  stats,
  accuracy,
  onChangeFamily,
  onChangeMode,
  onNextQuestion,
  onResetStats,
}: {
  family: MeterReadingFamily;
  readingMode: MeterReadingMode;
  availableSpecs: MeterTrainingSpec[];
  stats: TrainerStats;
  accuracy: string;
  onChangeFamily: (family: MeterReadingFamily) => void;
  onChangeMode: (mode: MeterReadingMode) => void;
  onNextQuestion: () => void;
  onResetStats: () => void;
}) {
  return (
    <div
      className="flex w-[280px] shrink-0 flex-col overflow-y-auto"
      style={{
        backgroundColor: pageStyle.panelSoft,
        borderRight: `1px solid ${pageStyle.border}`,
      }}
    >
      <div className="p-4">
        <SectionTitle title="题库设置" />
        <ToggleGroup<MeterReadingFamily>
          value={family}
          options={[
            { value: 'all', label: '全部电表' },
            { value: 'ammeter', label: '电流表' },
            { value: 'voltmeter', label: '电压表' },
            { value: 'galvanometer', label: '灵敏电流计' },
          ]}
          onChange={onChangeFamily}
        />

        <div className="mt-4" />
        <SectionTitle title="读数方式" />
        <ToggleGroup<MeterReadingMode>
          value={readingMode}
          options={[
            { value: 'tick', label: '整格读数' },
            { value: 'estimate', label: '半格估读' },
          ]}
          onChange={onChangeMode}
        />

        <div
          className="mt-4 rounded-xl border p-3"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockSoft }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前题库
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableSpecs.map((spec) => (
              <span
                key={spec.id}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${spec.accent}14`, color: spec.accent }}
              >
                {spec.rangeLabel}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatCard label="已判题目" value={`${stats.total}`} />
          <StatCard label="正确率" value={`${accuracy}%`} />
          <StatCard label="连续答对" value={`${stats.streak}`} />
          <StatCard label="最佳连对" value={`${stats.bestStreak}`} />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatCard label="答对题数" value={`${stats.correct}`} />
          <StatCard label="查看答案" value={`${stats.revealed}`} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton label="换一题" onClick={onNextQuestion} />
          <ActionButton label="清空统计" onClick={onResetStats} subtle />
        </div>
      </div>
    </div>
  );
}

function TrainerCenterPanel({
  question,
  questionIndex,
  answer,
  feedback,
  onChangeAnswer,
  onSubmit,
  onReveal,
  onNextQuestion,
}: {
  question: MeterReadingQuestion;
  questionIndex: number;
  answer: string;
  feedback: FeedbackState | null;
  onChangeAnswer: (value: string) => void;
  onSubmit: () => void;
  onReveal: () => void;
  onNextQuestion: () => void;
}) {
  const feedbackStyle =
    feedback?.kind === 'correct'
      ? {
          border: `${COLORS.success}66`,
          background: COLORS.successLight,
          color: COLORS.success,
        }
      : feedback?.kind === 'incorrect'
        ? {
            border: `${COLORS.error}66`,
            background: COLORS.errorLight,
            color: COLORS.error,
          }
        : {
            border: `${COLORS.warning}66`,
            background: COLORS.warningLight,
            color: COLORS.warning,
          };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg }}>
      <div className="p-4">
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium" style={{ color: pageStyle.muted }}>
                第 {questionIndex} 题
              </div>
              <div className="mt-1 text-lg font-semibold" style={{ color: question.spec.accent }}>
                {question.spec.title} · {question.spec.rangeLabel}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: pageStyle.secondary }}>
                {question.readingMode === 'tick' ? '指针落在刻度线上' : '指针落在两小格中间，训练估读'}
              </div>
            </div>
            <div className="rounded-full px-3 py-1 text-[11px] font-medium" style={{ backgroundColor: `${question.spec.accent}12`, color: question.spec.accent }}>
              每小格 {formatMeterReadingValue(question.minorStep, getStepPrecision(question.minorStep))} {question.spec.unitLabel}
            </div>
          </div>

          <div className="mx-auto mt-4 w-full max-w-[860px]">
            <MeterDialCard question={question} />
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockSoft }}>
            <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
              输入读数
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                step={question.inputStep}
                value={answer}
                onChange={(event) => onChangeAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSubmit();
                }}
                placeholder="输入你的读数"
                style={{ maxWidth: 240 }}
              />
              <span className="text-sm font-medium" style={{ color: pageStyle.secondary }}>
                {question.spec.unitLabel}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton label="提交判题" onClick={onSubmit} disabled={feedback !== null || answer.trim() === ''} />
              <ActionButton label="查看答案" onClick={onReveal} subtle disabled={feedback !== null} />
              <ActionButton label="下一题" onClick={onNextQuestion} subtle />
            </div>

            {feedback && (
              <div
                className="rounded-lg border px-3 py-2 text-sm font-medium"
                style={{
                  borderColor: feedbackStyle.border,
                  backgroundColor: feedbackStyle.background,
                  color: feedbackStyle.color,
                }}
              >
                {feedback.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainerRightPanel({
  question,
  availableSpecs,
  feedback,
}: {
  question: MeterReadingQuestion;
  availableSpecs: MeterTrainingSpec[];
  feedback: FeedbackState | null;
}) {
  return (
    <div
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto"
      style={{
        backgroundColor: pageStyle.panelBg,
        borderLeft: `1px solid ${pageStyle.border}`,
      }}
    >
      <div className="p-3">
        <PanelTitle title="当前题解析" />
        <InfoBlock
          title="读数步骤"
          color={question.spec.accent}
          lines={
            feedback
              ? question.explanationLines
              : [
                  '先认量程，再确定总小格数。',
                  `本页统一按 ${question.spec.totalDivisions} 小格训练，先算每小格值。`,
                  '提交判题或查看答案后，会展开完整计算过程。',
                ]
          }
        />

        <PanelTitle title="训练规则" />
        <InfoBlock
          title="读表方法"
          color={COLORS.primary}
          lines={[
            '1. 先看表盘量程，例如 0~0.6A 或 0~15V。',
            `2. 再看满偏被均分成多少小格，本模块统一为 ${question.spec.totalDivisions} 小格。`,
            '3. 用量程 ÷ 小格数，求每小格代表的数值。',
            question.readingMode === 'estimate'
              ? '4. 当前为半格估读训练，指针在两小格中间。'
              : '4. 当前为整格训练，指针落在刻度线上。',
          ]}
        />

        <PanelTitle title="题库范围" />
        <div className="rounded-xl border p-3" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
          {availableSpecs.map((spec) => (
            <div key={spec.id} className="mb-2 last:mb-0 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
              <span style={{ color: spec.accent, fontWeight: 600 }}>{spec.title}</span>
              {' · '}
              {spec.rangeLabel}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeterDialCard({ question }: { question: MeterReadingQuestion }) {
  const { spec } = question;
  const geometry = buildMeterDialGeometry(question);

  return (
    <svg
      viewBox={`0 0 ${geometry.viewBoxWidth} ${geometry.viewBoxHeight}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <rect
        x="1"
        y="1"
        width={geometry.viewBoxWidth - 2}
        height={geometry.viewBoxHeight - 2}
        rx="18"
        fill="#FFFFFF"
        stroke={pageStyle.border}
      />
      <rect
        x={geometry.face.x}
        y={geometry.face.y}
        width={geometry.face.width}
        height={geometry.face.height}
        rx={geometry.face.radius}
        fill="#FCFCFD"
        stroke={pageStyle.border}
      />

      <path d={geometry.arcPath} fill="none" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />

      {geometry.marks.map((mark) => (
        <g key={mark.division}>
          <line
            x1={mark.line.x1}
            y1={mark.line.y1}
            x2={mark.line.x2}
            y2={mark.line.y2}
            stroke={mark.isLabeled ? '#111827' : mark.isMajor ? '#475569' : '#94A3B8'}
            strokeWidth={mark.isLabeled ? 2.5 : mark.isMajor ? 1.8 : 1.1}
            strokeLinecap="round"
          />
          {mark.label && (
            <text
              x={mark.label.x}
              y={mark.label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill={pageStyle.secondary}
            >
              {mark.label.text}
            </text>
          )}
        </g>
      ))}

      <text
        x={geometry.unitPosition.x}
        y={geometry.unitPosition.y}
        textAnchor="middle"
        fontSize="11"
        fill={pageStyle.muted}
      >
        单位 {spec.unitLabel}
      </text>

      <line
        x1={geometry.pointer.tail.x}
        y1={geometry.pointer.tail.y}
        x2={geometry.pointer.tip.x}
        y2={geometry.pointer.tip.y}
        stroke={spec.accent}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx={geometry.center.x} cy={geometry.center.y} r={geometry.hubOuterRadius} fill={spec.accent} />
      <circle cx={geometry.center.x} cy={geometry.center.y} r={geometry.hubInnerRadius} fill="#FFFFFF" />

      <text
        x={geometry.titlePosition.x}
        y={geometry.titlePosition.y}
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill={spec.accent}
      >
        {spec.rangeLabel}
      </text>
      <text
        x={geometry.subtitlePosition.x}
        y={geometry.subtitlePosition.y}
        textAnchor="middle"
        fontSize="11"
        fill={pageStyle.muted}
      >
        共 {spec.totalDivisions} 小格 · {question.readingMode === 'tick' ? '整格读数' : '半格估读'}
      </text>
    </svg>
  );
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={{
              color: active ? pageStyle.accent : pageStyle.secondary,
              backgroundColor: active ? pageStyle.accentSoft : pageStyle.blockBg,
              border: `1px solid ${active ? `${pageStyle.accent}44` : pageStyle.border}`,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-[10px]" style={{ color: pageStyle.muted }}>
        {label}
      </div>
      <div className="mt-1 text-base font-semibold" style={{ color: pageStyle.text }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  subtle = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  subtle?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-3 py-1.5 text-[11px] font-medium disabled:cursor-not-allowed"
      style={{
        color: disabled
          ? pageStyle.muted
          : subtle
            ? pageStyle.secondary
            : pageStyle.accent,
        backgroundColor: disabled
          ? pageStyle.blockSoft
          : subtle
            ? pageStyle.blockBg
            : pageStyle.accentSoft,
        border: `1px solid ${
          disabled
            ? pageStyle.border
            : subtle
              ? pageStyle.border
              : `${pageStyle.accent}33`
        }`,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

function InfoBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div className="mb-2 rounded-lg p-2.5" style={{ border: `1px solid ${color}33`, backgroundColor: `${color}10` }}>
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {lines.map((line) => (
        <div key={line} className="text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-2 text-xs font-semibold" style={{ color: pageStyle.text }}>
      {title}
    </h2>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 text-[11px] font-semibold" style={{ color: pageStyle.secondary }}>
      {title}
    </div>
  );
}
