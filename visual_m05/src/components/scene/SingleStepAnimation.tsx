/**
 * Single-step visual animation for coinFlip, diceRoll, twoDiceSum, ballDraw, meetingProblem.
 * Shown briefly after "运行一次" before chart updates.
 */
import { useEffect, useRef, useState } from 'react';
import { COLORS, SHADOWS } from '@/styles/tokens';

interface Props {
  type: 'coinFlip' | 'diceRoll' | 'twoDiceSum' | 'ballDraw' | 'meetingProblem';
  result: unknown;
  onComplete: () => void;
  /** Extra context for ballDraw (redCount, whiteCount) */
  ballDrawContext?: { redCount: number; whiteCount: number };
  /** Extra context for meetingProblem (T) */
  meetingContext?: { T: number; t: number };
}

/* ─── Coin Flip ─── */
function CoinFlipAnim({ result, onComplete }: { result: 'H' | 'T'; onComplete: () => void }) {
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const mid = setTimeout(() => setShowResult(true), 300);
    return () => clearTimeout(mid);
  }, []);

  const isHeads = result === 'H';

  return (
    <div style={{ perspective: 400, display: 'flex', justifyContent: 'center' }}>
      <div
        className="animate-coin-flip"
        onAnimationEnd={onComplete}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: showResult
            ? (isHeads ? COLORS.primary : COLORS.info)
            : '#D1D1CF',
          color: COLORS.white,
          fontSize: 36,
          fontWeight: 800,
          boxShadow: SHADOWS.lg,
          transition: 'background-color 0.05s',
          userSelect: 'none',
        }}
      >
        {showResult ? (isHeads ? '正' : '反') : '?'}
      </div>
    </div>
  );
}

/* ─── Dice shared ─── */
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[30, 30]],
  2: [[15, 15], [45, 45]],
  3: [[15, 15], [30, 30], [45, 45]],
  4: [[15, 15], [45, 15], [15, 45], [45, 45]],
  5: [[15, 15], [45, 15], [30, 30], [15, 45], [45, 45]],
  6: [[15, 15], [45, 15], [15, 30], [45, 30], [15, 45], [45, 45]],
};

function DiceFace({ value, size = 60 }: { value: number; size?: number }) {
  const dots = DOT_POSITIONS[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      <rect x={1} y={1} width={58} height={58} rx={8} fill={COLORS.white} stroke={COLORS.border} strokeWidth={2} />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={5} fill={COLORS.text} />
      ))}
    </svg>
  );
}

function DiceRollAnim({ result, onComplete, showSum }: { result: number[]; onComplete: () => void; showSum?: boolean }) {
  const [currentFaces, setCurrentFaces] = useState<number[]>(result.map(() => 1));
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const DURATION = 1200;

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - (1 - t) * (1 - t);

      if (t < 1) {
        const interval = 60 + eased * 250;
        const shouldUpdate = elapsed % interval < 20;
        if (shouldUpdate) {
          setCurrentFaces(result.map(() => Math.floor(Math.random() * 6) + 1));
        }
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentFaces(result);
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [result]);

  useEffect(() => {
    if (done) {
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }
  }, [done, onComplete]);

  const sum = result.reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {currentFaces.map((face, i) => (
          <div key={i} style={{ filter: done ? 'none' : 'blur(0.5px)', transition: 'filter 0.2s' }}>
            <DiceFace value={face} size={64} />
          </div>
        ))}
      </div>
      {showSum && done && (
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary }}>= {sum}</div>
      )}
    </div>
  );
}

/* ─── Ball Draw ─── */
function BallDrawAnim({ reds, redCount, whiteCount, onComplete }: {
  reds: number; redCount: number; whiteCount: number; onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'bag' | 'draw' | 'done'>('bag');
  const total = redCount + whiteCount;

  // Generate ball layout in bag
  const balls: Array<{ color: 'red' | 'white'; x: number; y: number }> = [];
  const displayTotal = Math.min(total, 20);
  const cols = Math.ceil(Math.sqrt(displayTotal));
  const redRatio = redCount / total;
  for (let i = 0; i < displayTotal; i++) {
    const isRed = i < Math.round(displayTotal * redRatio);
    const col = i % cols;
    const row = Math.floor(i / cols);
    balls.push({
      color: isRed ? 'red' : 'white',
      x: 20 + col * 28 + (row % 2 ? 14 : 0),
      y: 20 + row * 26,
    });
  }
  const bagW = cols * 28 + 40;
  const bagH = Math.ceil(displayTotal / cols) * 26 + 40;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('draw'), 600);
    const t2 = setTimeout(() => setPhase('done'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  // The drawn balls
  const whites = (reds <= redCount ? redCount + whiteCount - (total - redCount + reds) : 0);
  void whites;
  const drawnRed = reds;
  const drawnWhite = Math.max(0, (redCount + whiteCount > redCount ? 1 : 0)); // simplified
  void drawnWhite;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Bag */}
      <svg width={bagW} height={bagH} viewBox={`0 0 ${bagW} ${bagH}`}>
        <rect x={0} y={0} width={bagW} height={bagH} rx={12} fill={COLORS.bgMuted} stroke={COLORS.border} strokeWidth={1.5} />
        {balls.map((b, i) => (
          <circle
            key={i}
            cx={b.x + 10}
            cy={b.y + 10}
            r={10}
            fill={b.color === 'red' ? COLORS.error : COLORS.white}
            stroke={b.color === 'red' ? '#cc3333' : COLORS.borderStrong}
            strokeWidth={1.5}
            opacity={phase === 'bag' ? 1 : 0.4}
            style={{ transition: 'opacity 0.3s' }}
          />
        ))}
      </svg>

      {/* Drawn result */}
      {(phase === 'draw' || phase === 'done') && (
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap',
          opacity: phase === 'done' ? 1 : 0.6,
          transition: 'opacity 0.3s',
        }}>
          {Array.from({ length: drawnRed }, (_, i) => (
            <div key={`r${i}`} style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: COLORS.error, border: '2px solid #cc3333',
            }} />
          ))}
          {Array.from({ length: Math.max(0, (reds <= redCount ? (redCount + whiteCount >= redCount ? 1 : 0) : 0) - 1 + 1) }, () => null).length === 0 ? null : null}
        </div>
      )}

      {/* Result text */}
      {phase === 'done' && (
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary }}>
          摸出红球 {drawnRed} 个
        </div>
      )}
    </div>
  );
}

/* ─── Meeting Problem ─── */
function MeetingAnim({ point, T, t: waitTime, onComplete }: {
  point: { x: number; y: number; met: boolean };
  T: number; t: number;
  onComplete: () => void;
}) {
  const [simTime, setSimTime] = useState(0);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const DURATION = 3000; // 3s for full time sweep

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      setSimTime(progress * T);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDone(true);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [T]);

  useEffect(() => {
    if (done) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [done, onComplete]);

  const W = 420, H = 180;
  const SCENE_CY = 60; // center Y for people scene
  const TL_Y = 130;    // timeline Y
  const PAD = 40;
  const barW = W - PAD * 2;
  const toX = (v: number) => PAD + (v / T) * barW;
  const sceneCenter = W / 2;

  // Walk animation: person slides in from offscreen, stays at center, slides out
  const walkT = T * 0.04; // sim-time for walk in/out transition
  function personPos(arriveTime: number, fromLeft: boolean): number {
    const offscreen = fromLeft ? -20 : W + 20;
    const atSpot = fromLeft ? sceneCenter - 24 : sceneCenter + 24;
    const leaveTime = arriveTime + waitTime;
    if (simTime < arriveTime) return offscreen;
    if (simTime < arriveTime + walkT) {
      const p = (simTime - arriveTime) / walkT;
      return offscreen + (atSpot - offscreen) * p;
    }
    if (simTime < leaveTime - walkT) return atSpot;
    if (simTime < leaveTime) {
      const p = (simTime - (leaveTime - walkT)) / walkT;
      return atSpot + (offscreen - atSpot) * p;
    }
    return offscreen;
  }

  const aX = personPos(point.x, true);
  const bX = personPos(point.y, false);
  const aPresent = simTime >= point.x && simTime <= point.x + waitTime;
  const bPresent = simTime >= point.y && simTime <= point.y + waitTime;
  const bothPresent = aPresent && bPresent;

  // Wait bars grow on timeline
  const aBarStart = toX(point.x);
  const aBarCurEnd = toX(Math.min(simTime, point.x + waitTime));
  const bBarStart = toX(point.y);
  const bBarCurEnd = toX(Math.min(simTime, point.y + waitTime));
  const cursorX = toX(Math.min(simTime, T));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Clock display */}
        <text x={W / 2} y={16} textAnchor="middle" fontSize={14} fontWeight={700} fill={COLORS.text}>
          时间: {simTime.toFixed(1)} / {T} 分钟
        </text>

        {/* Meeting spot marker */}
        <line x1={sceneCenter} y1={SCENE_CY - 24} x2={sceneCenter} y2={SCENE_CY + 24}
          stroke={COLORS.border} strokeWidth={1} strokeDasharray="3 3" />
        <text x={sceneCenter} y={SCENE_CY + 38} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>约会地点</text>

        {/* Person A */}
        <circle cx={aX} cy={SCENE_CY} r={16}
          fill={aPresent ? COLORS.primary : COLORS.bgActive}
          stroke={COLORS.primary} strokeWidth={2} />
        <text x={aX} y={SCENE_CY + 5} textAnchor="middle" fontSize={14} fontWeight={700}
          fill={aPresent ? COLORS.white : COLORS.textMuted}>甲</text>

        {/* Person B */}
        <circle cx={bX} cy={SCENE_CY} r={16}
          fill={bPresent ? COLORS.info : COLORS.bgActive}
          stroke={COLORS.info} strokeWidth={2} />
        <text x={bX} y={SCENE_CY + 5} textAnchor="middle" fontSize={14} fontWeight={700}
          fill={bPresent ? COLORS.white : COLORS.textMuted}>乙</text>

        {/* Meeting highlight */}
        {bothPresent && (
          <circle cx={sceneCenter} cy={SCENE_CY - 28} r={10}
            fill={COLORS.primary} opacity={0.8}>
            <animate attributeName="r" values="8;12;8" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
        {bothPresent && (
          <text x={sceneCenter} y={SCENE_CY - 24} textAnchor="middle" fontSize={14}
            fontWeight={800} fill={COLORS.white}>!</text>
        )}

        {/* Timeline bar */}
        <rect x={PAD} y={TL_Y} width={barW} height={4} rx={2} fill={COLORS.bgActive} />
        <text x={PAD} y={TL_Y + 18} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>0</text>
        <text x={PAD + barW} y={TL_Y + 18} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>{T}</text>

        {/* A wait bar (grows over time) */}
        {simTime >= point.x && (
          <rect x={aBarStart} y={TL_Y - 8} width={Math.max(0, aBarCurEnd - aBarStart)} height={6} rx={3}
            fill="rgba(0,192,107,0.3)" stroke={COLORS.primary} strokeWidth={0.5} />
        )}

        {/* B wait bar (grows over time) */}
        {simTime >= point.y && (
          <rect x={bBarStart} y={TL_Y + 6} width={Math.max(0, bBarCurEnd - bBarStart)} height={6} rx={3}
            fill="rgba(24,144,255,0.3)" stroke={COLORS.info} strokeWidth={0.5} />
        )}

        {/* Time cursor */}
        <line x1={cursorX} y1={TL_Y - 12} x2={cursorX} y2={TL_Y + 16}
          stroke={COLORS.text} strokeWidth={1.5} />
        <circle cx={cursorX} cy={TL_Y + 2} r={3} fill={COLORS.text} />
      </svg>

      {/* Result */}
      {done && (
        <div style={{ fontSize: 16, fontWeight: 700, color: point.met ? COLORS.primary : COLORS.error }}>
          {point.met ? '相遇了！' : '未相遇'}
          <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.textSecondary, marginLeft: 8 }}>
            甲 {point.x.toFixed(1)}分到 / 乙 {point.y.toFixed(1)}分到
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Main ─── */
export function SingleStepAnimation({ type, result, onComplete, ballDrawContext, meetingContext }: Props) {
  if (type === 'coinFlip') {
    return <CoinFlipAnim result={result as 'H' | 'T'} onComplete={onComplete} />;
  }
  if (type === 'diceRoll') {
    return <DiceRollAnim result={result as number[]} onComplete={onComplete} />;
  }
  if (type === 'twoDiceSum') {
    const t = result as { faces: number[]; sum: number };
    return <DiceRollAnim result={t.faces} onComplete={onComplete} showSum />;
  }
  if (type === 'ballDraw' && ballDrawContext) {
    return <BallDrawAnim reds={result as number} redCount={ballDrawContext.redCount} whiteCount={ballDrawContext.whiteCount} onComplete={onComplete} />;
  }
  if (type === 'meetingProblem' && meetingContext) {
    const pt = result as { x: number; y: number; met: boolean };
    return <MeetingAnim point={pt} T={meetingContext.T} t={meetingContext.t} onComplete={onComplete} />;
  }
  return null;
}
