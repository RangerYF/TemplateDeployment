import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { useVectorStore, useHistoryStore, useUIStore } from '@/editor';
import { UpdateVec2DCommand, UpdateVec3DCommand, UpdateScalarCommand } from '@/editor/commands/updateVector';
import type { Vec2D, Vec3D, OperationType } from '@/editor/entities/types';
import { OPERATION_META } from '@/editor/entities/types';
import { getPresetsByOperation as getPresets } from '@/data/presets';
import {
  add2D, sub2D, scale2D, dot2D, mag2D, angle2D, projectVec2D, decomposeVector,
  add3D, cross3D, mag3D, angle3D, dot3D, toDeg, evalSqrtExpr,
} from '@/engine/vectorMath';
import { useFmt } from '@/hooks/useFmt';
import { Settings, ChevronDown, ChevronRight, Lightbulb, Grid3X3, Eye, Play, Pause, Camera } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';


/** 尝试将数值逆向显示为常见根号表达式 */
function numToExpr(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (Math.abs(abs - Math.SQRT2) < 0.001) return `${sign}√2`;
  if (Math.abs(abs - Math.sqrt(3)) < 0.001) return `${sign}√3`;
  if (Math.abs(abs - Math.SQRT1_2) < 0.001) return `${sign}√2/2`;
  if (Math.abs(abs - Math.sqrt(3) / 2) < 0.001) return `${sign}√3/2`;
  // 整数或简单小数直接显示
  if (Number.isInteger(n)) return String(n);
  // 保留合理精度
  const s = n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

// ─── 表达式输入框（支持 √() 自由输入） ───

interface ExprInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function ExprInput({ label, value, onChange, min = -8, max = 8 }: ExprInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => numToExpr(value));
  const [valid, setValid] = useState(true);
  const [prevValue, setPrevValue] = useState(value);

  // 外部 value 变化时同步（如预设切换）
  if (Math.abs(value - prevValue) > 0.0001) {
    setPrevValue(value);
    setText(numToExpr(value));
    setValid(true);
  }

  const handleChange = useCallback((raw: string) => {
    setText(raw);
    const v = evalSqrtExpr(raw);
    if (!isNaN(v) && v >= min && v <= max) {
      setValid(true);
      setPrevValue(v);
      onChange(v);
    } else if (!isNaN(v)) {
      setValid(true);
      const clamped = Math.max(min, Math.min(max, v));
      setPrevValue(clamped);
      onChange(clamped);
    } else {
      setValid(false);
    }
  }, [onChange, min, max]);

  const insertSqrt = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const selected = text.slice(start, end);
    const insert = selected ? `√(${selected})` : '√()';
    const newText = text.slice(0, start) + insert + text.slice(end);
    handleChange(newText);
    // 光标放在括号内
    requestAnimationFrame(() => {
      el.focus();
      const cursorPos = start + (selected ? insert.length : 2); // after √(
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }, [text, handleChange]);

  return (
    <div className="flex items-center gap-1">
      <span style={{ fontSize: 14, color: COLORS.textMuted, minWidth: 14 }}>{label}</span>
      <div className="flex items-center gap-0.5" style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            width: 100,
            height: 30,
            border: `1px solid ${valid ? COLORS.border : '#e53e3e'}`,
            borderRadius: RADIUS.xs,
            padding: '0 6px',
            fontSize: 14,
            color: COLORS.text,
            background: COLORS.bg,
            outline: 'none',
            fontFamily: 'Inter, monospace',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = valid ? COLORS.primary : '#e53e3e'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = valid ? COLORS.border : '#e53e3e'; }}
          title="支持 √() 嵌套表达式，如 1+√(2)、√(3)/2"
        />
        <button
          onClick={insertSqrt}
          style={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.primary,
            background: COLORS.bgMuted,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.xs,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
          }}
          title="插入 √()"
        >
          √
        </button>
      </div>
      {!valid && (
        <span style={{ fontSize: 11, color: '#e53e3e' }}>!</span>
      )}
    </div>
  );
}

// ─── Vec2D 编辑器 ───

interface Vec2DEditorProps {
  label: string;
  color: string;
  value: Vec2D;
  onChange: (v: Vec2D) => void;
}

function Vec2DEditor({ label, color, value, onChange }: Vec2DEditorProps) {
  const { f } = useFmt();
  const displayStr = `(${f(value[0])}, ${f(value[1])})`;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{label}</span>
        <span style={{ fontSize: 14, color: COLORS.textMuted, marginLeft: 2 }}>= {displayStr}</span>
      </div>
      <div className="flex gap-2 pl-3">
        <ExprInput label="x" value={value[0]} onChange={(v) => onChange([v, value[1]])} />
        <ExprInput label="y" value={value[1]} onChange={(v) => onChange([value[0], v])} />
      </div>
    </div>
  );
}

// ─── Vec3D 编辑器 ───

interface Vec3DEditorProps {
  label: string;
  color: string;
  value: Vec3D;
  onChange: (v: Vec3D) => void;
}

function Vec3DEditor({ label, color, value, onChange }: Vec3DEditorProps) {
  const { fv3 } = useFmt();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{label}</span>
        <span style={{ fontSize: 14, color: COLORS.textMuted, marginLeft: 2 }}>= {fv3(value)}</span>
      </div>
      <div className="flex flex-col gap-1 pl-3">
        <ExprInput label="x" value={value[0]} onChange={(v) => onChange([v, value[1], value[2]])} min={-5} max={5} />
        <ExprInput label="y" value={value[1]} onChange={(v) => onChange([value[0], v, value[2]])} min={-5} max={5} />
        <ExprInput label="z" value={value[2]} onChange={(v) => onChange([value[0], value[1], v])} min={-5} max={5} />
      </div>
    </div>
  );
}

// ─── 结果展示块 ───

interface ResultBlockProps {
  label: string;
  value: string;
  color?: string;
}

function ResultBlock({ label, value, color = COLORS.primary }: ResultBlockProps) {
  return (
    <div
      className="flex items-start gap-2 py-1.5 px-2.5 rounded-md"
      style={{ background: COLORS.bgMuted, border: `1px solid ${COLORS.border}` }}
    >
      <span style={{ fontSize: 14, color: COLORS.textMuted, minWidth: 68, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Inter, monospace' }}>{value}</span>
    </div>
  );
}

// ─── 教学要点 ───

function TeachingPoints({ points }: { points: string[] }) {
  const [open, setOpen] = useState(true);
  if (!points || points.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full py-1"
        style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}
      >
        <Lightbulb size={14} style={{ color: COLORS.warning }} />
        教学要点
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 pl-2">
          {points.map((pt, i) => (
            <li key={i} style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.6, paddingLeft: 8, borderLeft: `2px solid ${COLORS.border}` }}>
              {pt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 分割线 ───

function Divider() {
  return <div style={{ height: 1, background: COLORS.border, margin: '8px 0' }} />;
}

// ─── 3D 视图控制（共用于三个3D运算）───

function View3DControls() {
  const showPerspective = useVectorStore((s) => s.showPerspective);
  const show3DGrid = useVectorStore((s) => s.show3DGrid);
  const togglePerspective = useVectorStore((s) => s.togglePerspective);
  const toggle3DGrid = useVectorStore((s) => s.toggle3DGrid);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Camera size={14} style={{ color: COLORS.textMuted }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>三维视图</span>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={showPerspective} onChange={togglePerspective} style={{ accentColor: COLORS.primary }} />
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>透视投影</span>
        <span style={{ fontSize: 14, color: COLORS.textMuted }}>（关闭=正交）</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={show3DGrid} onChange={toggle3DGrid} style={{ accentColor: COLORS.primary }} />
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>地面网格</span>
      </label>
    </div>
  );
}

// ─── 各运算参数面板 ───

function ConceptParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const setVecA = useVectorStore((s) => s.setVecA);
  const activePresetId = useVectorStore((s) => s.activePresetId);
  const unitCirclePlaying = useVectorStore((s) => s.unitCirclePlaying);
  const setUnitCirclePlaying = useVectorStore((s) => s.setUnitCirclePlaying);
  const setUnitCircleAngle = useVectorStore((s) => s.setUnitCircleAngle);
  const { execute } = useHistoryStore();
  const { f } = useFmt();

  const magVal = mag2D(vecA);
  const dirDeg = toDeg(Math.atan2(vecA[1], vecA[0]));
  const isUnitMode = activePresetId === 'VEC-001-B';

  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const presets = getPresets('concept');
  const pts = presets[0]?.teachingPoints ?? [];

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <Divider />
      <ResultBlock label="|a| =" value={f(magVal, 3)} color={COLORS.vecA} />
      <ResultBlock label="方向角 =" value={`${f(dirDeg, 1)}°`} />

      {/* 单位向量动画控制 */}
      {isUnitMode && (
        <>
          <Divider />
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>
            动态向量（单位圆旋转）
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!unitCirclePlaying) {
                  setUnitCircleAngle(Math.atan2(vecA[1], vecA[0]));
                }
                setUnitCirclePlaying(!unitCirclePlaying);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md"
              style={{
                background: unitCirclePlaying ? COLORS.error : COLORS.bgMuted,
                border: `1px solid ${unitCirclePlaying ? COLORS.error : COLORS.border}`,
                cursor: 'pointer',
                fontSize: 14,
                color: unitCirclePlaying ? COLORS.white : COLORS.textSecondary,
                fontWeight: 600,
              }}
            >
              {unitCirclePlaying ? <Pause size={12} /> : <Play size={12} style={{ color: COLORS.primary }} />}
              {unitCirclePlaying ? '停止旋转' : '开始旋转'}
            </button>
          </div>
          <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7 }}>
            固定起点，|a|=1 的向量绕原点旋转
          </div>
        </>
      )}

      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, padding: '4px 8px', background: COLORS.bgMuted, borderRadius: RADIUS.sm }}>
        <b>自由向量</b>：与起点位置无关，只要方向和模相同，就是同一个向量。画布上的虚线副本与实线向量等价。
      </div>
      <Divider />
      <TeachingPoints points={pts} />
    </div>
  );
}

function CoordinateParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const setVecA = useVectorStore((s) => s.setVecA);
  const { execute } = useHistoryStore();
  const { f } = useFmt();

  const magVal = mag2D(vecA);
  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const presets = getPresets('coordinate');
  const pts = presets[0]?.teachingPoints ?? [];

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <Divider />
      <ResultBlock label="x 分量 =" value={f(vecA[0])} color={COLORS.basis1} />
      <ResultBlock label="y 分量 =" value={f(vecA[1])} color={COLORS.basis2} />
      <ResultBlock label="|a| =" value={`√(${f(vecA[0])}² + ${f(vecA[1])}²) = ${f(magVal, 3)}`} color={COLORS.vecA} />
      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, padding: '4px 8px', background: COLORS.bgMuted, borderRadius: RADIUS.sm }}>
        坐标 = 终点坐标 − 起点坐标（起点为原点时即终点坐标）
      </div>
      <Divider />
      <TeachingPoints points={pts} />
    </div>
  );
}

function ParallelogramParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const playParallelogramAnim = useVectorStore((s) => s.playParallelogramAnim);
  const { execute } = useHistoryStore();
  const { f, fv2 } = useFmt();

  const sum = add2D(vecA, vecB);

  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const handleChangeB = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 b', vecB, v, setVecB));

  const presets = getPresets('parallelogram');
  const pts = presets[0]?.teachingPoints ?? [];

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <Vec2DEditor label="向量 b" color={COLORS.vecB} value={vecB} onChange={handleChangeB} />
      <Divider />
      <ResultBlock label="a + b =" value={fv2(sum)} color={COLORS.vecResult} />
      <ResultBlock label="|a + b| =" value={f(mag2D(sum))} color={COLORS.vecResult} />
      <Divider />
      {/* 动画播放按钮 */}
      <button
        onClick={playParallelogramAnim}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md w-full"
        style={{
          background: COLORS.bgMuted,
          border: `1px solid ${COLORS.border}`,
          cursor: 'pointer',
          fontSize: 14,
          color: COLORS.textSecondary,
          fontWeight: 600,
        }}
        title="逐步展示平行四边形法则构造过程"
      >
        <Play size={12} style={{ color: COLORS.primary }} />
        播放构造动画
      </button>
      <Divider />
      <TeachingPoints points={pts} />
    </div>
  );
}

/** 链向量调色板（c₁ ~ c₈ 循环） */
const CHAIN_COLORS = ['#E67E22', '#8E44AD', '#27AE60', '#2980B9', '#C0392B', '#16A085', '#D35400', '#7F8C8D'];

function TriangleParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const chainVecs = useVectorStore((s) => s.chainVecs);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const setChainVec = useVectorStore((s) => s.setChainVec);
  const addChainVec = useVectorStore((s) => s.addChainVec);
  const removeChainVec = useVectorStore((s) => s.removeChainVec);
  const { execute } = useHistoryStore();
  const { f, fv2 } = useFmt();

  // 全链 = [vecA, vecB, ...chainVecs]
  const allVecs: Vec2D[] = [vecA, vecB, ...chainVecs];
  const sum = allVecs.reduce<Vec2D>((acc, v) => add2D(acc, v), [0, 0]);
  const n = allVecs.length;

  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const handleChangeB = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 b', vecB, v, setVecB));

  // 向量名标签: a, b, c₁, c₂, ...
  const vecLabel = (i: number) => i === 0 ? 'a' : i === 1 ? 'b' : `c${i - 1}`;
  const vecColor = (i: number) => i === 0 ? COLORS.vecA : i === 1 ? COLORS.vecB : CHAIN_COLORS[(i - 2) % CHAIN_COLORS.length];

  return (
    <div className="space-y-3">
      <Vec2DEditor label={`向量 ${vecLabel(0)}`} color={vecColor(0)} value={vecA} onChange={handleChangeA} />
      <Vec2DEditor label={`向量 ${vecLabel(1)}`} color={vecColor(1)} value={vecB} onChange={handleChangeB} />
      {chainVecs.map((cv, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="flex-1">
            <Vec2DEditor
              label={`向量 ${vecLabel(i + 2)}`}
              color={vecColor(i + 2)}
              value={cv}
              onChange={(v) => setChainVec(i, v)}
            />
          </div>
          <button
            onClick={() => removeChainVec(i)}
            style={{
              marginTop: 2, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: COLORS.error, background: 'none', border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.xs, cursor: 'pointer',
            }}
            title={`删除向量 ${vecLabel(i + 2)}`}
          >
            −
          </button>
        </div>
      ))}
      {/* 添加向量按钮 */}
      <button
        onClick={() => addChainVec()}
        style={{
          width: '100%', padding: '6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontSize: 14, color: COLORS.primary, background: COLORS.bgMuted,
          border: `1px dashed ${COLORS.primary}`, borderRadius: RADIUS.sm, cursor: 'pointer',
        }}
      >
        + 添加向量 {vecLabel(n)}
      </button>
      <Divider />
      <ResultBlock label="总和 =" value={fv2(sum)} color={COLORS.vecResult} />
      <ResultBlock label="|总和| =" value={f(mag2D(sum))} color={COLORS.vecResult} />
      <div style={{ fontSize: 14, color: COLORS.textMuted }}>
        共 {n} 个向量首尾相接
      </div>
      <Divider />
      <TeachingPoints points={[
        '首尾相接法：前一个向量终点即为下一个起点',
        '从链首到链尾的连线即为总和向量',
        '点击 + 添加更多向量，体验 n 向量首尾相接',
      ]} />
    </div>
  );
}

function SubtractionParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const { execute } = useHistoryStore();
  const { f, fv2 } = useFmt();

  const diff = sub2D(vecA, vecB);
  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const handleChangeB = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 b', vecB, v, setVecB));

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <Vec2DEditor label="向量 b" color={COLORS.vecB} value={vecB} onChange={handleChangeB} />
      <Divider />
      <ResultBlock label="a - b =" value={fv2(diff)} color={COLORS.vecResult} />
      <ResultBlock label="|a - b| =" value={f(mag2D(diff))} color={COLORS.vecResult} />
      <Divider />
      <TeachingPoints points={[
        'a - b = a + (-b)',
        '共起点，由 b 终点指向 a 终点',
        '坐标：对应坐标相减',
      ]} />
    </div>
  );
}

function ScalarParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const scalarK = useVectorStore((s) => s.scalarK);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setScalarK = useVectorStore((s) => s.setScalarK);
  const { execute } = useHistoryStore();
  const { f, fv2 } = useFmt();

  const scaled = scale2D(vecA, scalarK);
  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const handleChangeK = (v: number) => execute(new UpdateScalarCommand(scalarK, v, setScalarK));

  const kDesc = scalarK > 0 ? '方向不变，模变为 k 倍' : scalarK < 0 ? '方向相反，模变为 |k| 倍' : '结果为零向量';

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>标量 k</span>
        </div>
        <div className="pl-3 space-y-1.5">
          <ExprInput label="k" value={scalarK} onChange={handleChangeK} min={-5} max={5} />
          <input
            type="range"
            min={-5} max={5} step={0.1}
            value={scalarK}
            onChange={(e) => handleChangeK(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: COLORS.primary }}
          />
          <div style={{ fontSize: 14, color: COLORS.textMuted }}>{kDesc}</div>
        </div>
      </div>
      <Divider />
      <ResultBlock label="k·a =" value={fv2(scaled)} color={scalarK >= 0 ? COLORS.vecResult : COLORS.vecScalar} />
      <ResultBlock label="|k·a| =" value={f(mag2D(scaled))} />
      <Divider />
      <TeachingPoints points={[
        'k > 0：同向，模变为 k 倍',
        'k < 0：反向，模变为 |k| 倍',
        'k = 0：零向量',
        'b = ka ⟺ a ∥ b（a ≠ 0）',
      ]} />
    </div>
  );
}

function DotProductParams() {
  const vecA = useVectorStore((s) => s.vecA);
  const vecB = useVectorStore((s) => s.vecB);
  const showAngleArc = useVectorStore((s) => s.showAngleArc);
  const showProjection = useVectorStore((s) => s.showProjection);
  const showPolarization = useVectorStore((s) => s.showPolarization);
  const angleUnit = useVectorStore((s) => s.angleUnit);
  const toggleAngleArc = useVectorStore((s) => s.toggleAngleArc);
  const toggleProjection = useVectorStore((s) => s.toggleProjection);
  const togglePolarization = useVectorStore((s) => s.togglePolarization);
  const setAngleUnit = useVectorStore((s) => s.setAngleUnit);
  const setVecA = useVectorStore((s) => s.setVecA);
  const setVecB = useVectorStore((s) => s.setVecB);
  const { execute } = useHistoryStore();
  const { f, fv2 } = useFmt();

  const dotVal = dot2D(vecA, vecB);
  const angleRad = angle2D(vecA, vecB);
  const angleDeg = toDeg(angleRad);
  const projLen = mag2D(vecB) > 0 ? dotVal / mag2D(vecB) : 0;
  const projVec = projectVec2D(vecA, vecB);

  // 极化恒等式
  const sumVec = add2D(vecA, vecB);
  const diffVec = sub2D(vecA, vecB);
  const sumMag2 = mag2D(sumVec) ** 2;
  const diffMag2 = mag2D(diffVec) ** 2;
  const polarResult = (sumMag2 - diffMag2) / 4;

  const handleChangeA = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 a', vecA, v, setVecA));
  const handleChangeB = (v: Vec2D) => execute(new UpdateVec2DCommand('修改向量 b', vecB, v, setVecB));

  const perpendicular = Math.abs(dotVal) < 0.01 && mag2D(vecA) > 0.1 && mag2D(vecB) > 0.1;

  const displayAngle = angleUnit === 'deg' ? angleDeg : angleRad;
  const angleStr = angleUnit === 'deg'
    ? `${f(angleDeg, 1)}°`
    : `${f(angleRad, 3)} rad`;

  return (
    <div className="space-y-3">
      <Vec2DEditor label="向量 a" color={COLORS.vecA} value={vecA} onChange={handleChangeA} />
      <Vec2DEditor label="向量 b" color={COLORS.vecB} value={vecB} onChange={handleChangeB} />
      <Divider />
      {/* 计算方法一：坐标法 */}
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>坐标法</div>
      <ResultBlock label="a · b =" value={`${f(vecA[0])}×${f(vecB[0])} + ${f(vecA[1])}×${f(vecB[1])} = ${f(dotVal)}`} color={perpendicular ? COLORS.success : COLORS.vecResult} />
      <ResultBlock label="夹角 θ =" value={angleStr} />

      {/* 计算方法二：投影法 */}
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary, marginTop: 4 }}>投影法</div>
      <ResultBlock label="投影标量 =" value={`|a|cosθ = ${f(projLen)}`} color={COLORS.basis1} />
      <ResultBlock label="投影向量 =" value={fv2(projVec)} color={COLORS.basis1} />
      <ResultBlock label="a·b =" value={`|b|×投影 = ${f(mag2D(vecB))}×${f(projLen)} = ${f(dotVal)}`} />

      {/* 计算方法三：极化恒等式 */}
      {showPolarization && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary, marginTop: 4 }}>极化恒等式</div>
          <ResultBlock label="|a+b|² =" value={f(sumMag2)} color={COLORS.primary} />
          <ResultBlock label="|a-b|² =" value={f(diffMag2)} color={COLORS.vecScalar} />
          <ResultBlock label="a·b =" value={`(${f(sumMag2)}−${f(diffMag2)})/4 = ${f(polarResult)}`} />
        </>
      )}

      {perpendicular && (
        <div style={{ fontSize: 14, color: COLORS.success, fontWeight: 600, padding: '4px 8px', background: COLORS.successLight, borderRadius: RADIUS.sm }}>
          ✓ a ⊥ b（垂直）
        </div>
      )}
      <Divider />
      {/* 显示控制 */}
      <div className="space-y-1.5">
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>显示控制</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showAngleArc} onChange={toggleAngleArc} style={{ accentColor: COLORS.primary }} />
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>角度弧线</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showProjection} onChange={toggleProjection} style={{ accentColor: COLORS.primary }} />
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>投影线段</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showPolarization} onChange={togglePolarization} style={{ accentColor: COLORS.primary }} />
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>极化恒等式</span>
        </label>
        {/* 角度单位切换 */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>角度单位：</span>
          <button
            onClick={() => setAngleUnit('deg')}
            style={{
              fontSize: 14, padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer',
              background: angleUnit === 'deg' ? COLORS.primary : COLORS.bgMuted,
              color: angleUnit === 'deg' ? COLORS.white : COLORS.textSecondary,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            度 (°)
          </button>
          <button
            onClick={() => setAngleUnit('rad')}
            style={{
              fontSize: 14, padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer',
              background: angleUnit === 'rad' ? COLORS.primary : COLORS.bgMuted,
              color: angleUnit === 'rad' ? COLORS.white : COLORS.textSecondary,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            弧度
          </button>
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted }}>
          当前角度：{f(displayAngle, angleUnit === 'deg' ? 1 : 3)}{angleUnit === 'deg' ? '°' : ' rad'}
        </div>
      </div>
      <Divider />
      <TeachingPoints points={[
        'a·b = |a||b|cosθ（几何定义）',
        'a·b = x₁x₂ + y₁y₂（坐标计算）',
        'a·b = (|a+b|²−|a−b|²)/4（极化恒等式）',
        'a·b = 0 ⟺ a ⊥ b',
        '求夹角：cosθ = a·b / (|a||b|)',
        '投影标量 = |a|cosθ = a·b / |b|',
      ]} />
    </div>
  );
}

function DecompositionParams() {
  const decompTarget = useVectorStore((s) => s.decompTarget);
  const basis1 = useVectorStore((s) => s.basis1);
  const basis2 = useVectorStore((s) => s.basis2);
  const showDecompParallel = useVectorStore((s) => s.showDecompParallel);
  const toggleDecompParallel = useVectorStore((s) => s.toggleDecompParallel);
  const setDecompTarget = useVectorStore((s) => s.setDecompTarget);
  const setBasis1 = useVectorStore((s) => s.setBasis1);
  const setBasis2 = useVectorStore((s) => s.setBasis2);
  const { execute } = useHistoryStore();
  const { f } = useFmt();

  const coeffs = decomposeVector(decompTarget, basis1, basis2);

  const handleChangeTarget = (v: Vec2D) => execute(new UpdateVec2DCommand('修改目标向量', decompTarget, v, setDecompTarget));
  const handleChangeB1 = (v: Vec2D) => execute(new UpdateVec2DCommand('修改基底 e₁', basis1, v, setBasis1));
  const handleChangeB2 = (v: Vec2D) => execute(new UpdateVec2DCommand('修改基底 e₂', basis2, v, setBasis2));

  return (
    <div className="space-y-3">
      <Vec2DEditor label="目标向量 p" color={COLORS.decompTarget} value={decompTarget} onChange={handleChangeTarget} />
      <Vec2DEditor label="基底 e₁" color={COLORS.basis1} value={basis1} onChange={handleChangeB1} />
      <Vec2DEditor label="基底 e₂" color={COLORS.basis2} value={basis2} onChange={handleChangeB2} />
      <Divider />
      {coeffs ? (
        <>
          <ResultBlock label="c₁ =" value={f(coeffs[0], 4)} color={COLORS.basis1} />
          <ResultBlock label="c₂ =" value={f(coeffs[1], 4)} color={COLORS.basis2} />
          <div style={{ fontSize: 14, color: COLORS.text, padding: '4px 8px', background: COLORS.bgMuted, borderRadius: RADIUS.sm, lineHeight: 1.7 }}>
            p = {f(coeffs[0], 3)}·e₁ + {f(coeffs[1], 3)}·e₂
          </div>
        </>
      ) : (
        <div style={{ fontSize: 14, color: COLORS.error, fontWeight: 600, padding: '4px 8px', background: COLORS.errorLight, borderRadius: RADIUS.sm }}>
          ⚠ e₁ 与 e₂ 共线，无法作为基底
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={showDecompParallel} onChange={toggleDecompParallel} style={{ accentColor: COLORS.primary }} />
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>显示分解平行四边形</span>
      </label>
      <Divider />
      <TeachingPoints points={[
        '平面向量基本定理：任意两不共线向量可作基底',
        '分解唯一：给定基底下 p = c₁e₁ + c₂e₂ 的系数唯一',
        '正交基底下的分解即为坐标',
      ]} />
    </div>
  );
}

function Space3DParams() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const setVecA3 = useVectorStore((s) => s.setVecA3);
  const setVecB3 = useVectorStore((s) => s.setVecB3);
  const { execute } = useHistoryStore();
  const { f, fv3 } = useFmt();

  const sum = add3D(vecA3, vecB3);
  const dotVal = dot3D(vecA3, vecB3);
  const angleRad = angle3D(vecA3, vecB3);
  const perpendicular = Math.abs(dotVal) < 0.01 && mag3D(vecA3) > 0.1 && mag3D(vecB3) > 0.1;

  const handleChangeA = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 a', vecA3, v, setVecA3));
  const handleChangeB = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 b', vecB3, v, setVecB3));

  return (
    <div className="space-y-3">
      <Vec3DEditor label="向量 a" color={COLORS.vecA} value={vecA3} onChange={handleChangeA} />
      <Vec3DEditor label="向量 b" color={COLORS.vecB} value={vecB3} onChange={handleChangeB} />
      <Divider />
      <ResultBlock label="a + b =" value={fv3(sum)} color={COLORS.vecResult} />
      <ResultBlock label="a · b =" value={f(dotVal)} />
      <ResultBlock label="夹角 θ =" value={`${f(toDeg(angleRad))}°`} />
      <ResultBlock label="|a| =" value={f(mag3D(vecA3))} color={COLORS.vecA} />
      <ResultBlock label="|b| =" value={f(mag3D(vecB3))} color={COLORS.vecB} />
      {perpendicular && (
        <div style={{ fontSize: 14, color: COLORS.success, fontWeight: 600, padding: '4px 8px', background: COLORS.successLight, borderRadius: RADIUS.sm }}>
          ✓ a ⊥ b（垂直）
        </div>
      )}
      <Divider />
      <View3DControls />
      <Divider />
      <TeachingPoints points={[
        '三维向量模：|a| = √(x²+y²+z²)',
        '点积：a·b = x₁x₂+y₁y₂+z₁z₂',
        '垂直：a·b=0（非零向量）',
      ]} />
    </div>
  );
}

function CrossProductParams() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const setVecA3 = useVectorStore((s) => s.setVecA3);
  const setVecB3 = useVectorStore((s) => s.setVecB3);
  const { execute } = useHistoryStore();
  const { f, fv3 } = useFmt();

  const crossVec = cross3D(vecA3, vecB3);
  const crossMag = mag3D(crossVec);
  const dotVal = dot3D(vecA3, vecB3);
  const dotAcross = dot3D(vecA3, crossVec);
  const dotBcross = dot3D(vecB3, crossVec);
  const perpendicular = Math.abs(dotVal) < 0.01 && mag3D(vecA3) > 0.1 && mag3D(vecB3) > 0.1;

  const handleChangeA = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 a', vecA3, v, setVecA3));
  const handleChangeB = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 b', vecB3, v, setVecB3));

  return (
    <div className="space-y-3">
      <Vec3DEditor label="向量 a" color={COLORS.vecA} value={vecA3} onChange={handleChangeA} />
      <Vec3DEditor label="向量 b" color={COLORS.vecB} value={vecB3} onChange={handleChangeB} />
      <Divider />
      <ResultBlock label="a × b =" value={fv3(crossVec)} color={COLORS.vecResult} />
      <ResultBlock label="|a × b| =" value={f(crossMag)} color={COLORS.vecResult} />
      <ResultBlock label="平行四边形面积 =" value={f(crossMag)} />
      {perpendicular && (
        <div style={{ fontSize: 14, color: COLORS.success, fontWeight: 600, padding: '4px 8px', background: COLORS.successLight, borderRadius: RADIUS.sm }}>
          ✓ a ⊥ b（垂直）
        </div>
      )}
      {crossMag < 0.01 && (
        <div style={{ fontSize: 14, color: COLORS.error, fontWeight: 600, padding: '4px 8px', background: COLORS.errorLight, borderRadius: RADIUS.sm }}>
          ⚠ a ∥ b，叉积为零向量
        </div>
      )}
      {/* 验证：叉积垂直于两向量 */}
      <div style={{ fontSize: 14, color: COLORS.textMuted }}>
        验证：(a×b)·a = {f(dotAcross, 6)}，(a×b)·b = {f(dotBcross, 6)}
      </div>
      <Divider />
      <View3DControls />
      <Divider />
      <TeachingPoints points={[
        'a×b 垂直于 a 和 b 构成的平面',
        '方向由右手定则确定',
        '|a×b| = |a||b|sinθ = 平行四边形面积',
        'a×b = 0 ⟺ a ∥ b',
      ]} />
    </div>
  );
}

function Geometry3DParams() {
  const vecA3 = useVectorStore((s) => s.vecA3);
  const vecB3 = useVectorStore((s) => s.vecB3);
  const setVecA3 = useVectorStore((s) => s.setVecA3);
  const setVecB3 = useVectorStore((s) => s.setVecB3);
  const { execute } = useHistoryStore();
  const { f, fv3 } = useFmt();

  const crossVec = cross3D(vecA3, vecB3);
  const crossMag = mag3D(crossVec);
  const vecC3 = [0, 0, 2] as const;
  const diagonal = add3D(add3D(vecA3, vecB3), [vecC3[0], vecC3[1], vecC3[2]]);
  const dotVal = dot3D(vecA3, vecB3);
  const angleRad = angle3D(vecA3, vecB3);
  const baseArea = crossMag;
  const volume = baseArea * 2; // |c| = 2

  const handleChangeA = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 a', vecA3, v, setVecA3));
  const handleChangeB = (v: Vec3D) => execute(new UpdateVec3DCommand('修改向量 b', vecB3, v, setVecB3));

  const presets = getPresets('geometry3D');
  const pts = presets[0]?.teachingPoints ?? [];

  return (
    <div className="space-y-3">
      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.6, padding: '4px 8px', background: COLORS.bgMuted, borderRadius: RADIUS.sm }}>
        a、b 为平行六面体底面两边，高向量固定为 c=[0,0,2]
      </div>
      <Vec3DEditor label="底面边 a" color={COLORS.vecA} value={vecA3} onChange={handleChangeA} />
      <Vec3DEditor label="底面边 b" color={COLORS.vecB} value={vecB3} onChange={handleChangeB} />
      <Divider />
      <ResultBlock label="法向量 n =" value={fv3(crossVec)} color={COLORS.vecScalar} />
      <ResultBlock label="底面积 =" value={f(baseArea, 3)} color={COLORS.vecResult} />
      <ResultBlock label="体积 =" value={f(volume, 3)} color={COLORS.vecResult} />
      <ResultBlock label="空间对角线 =" value={fv3(diagonal)} color={COLORS.vecResult} />
      <ResultBlock label="|对角线| =" value={f(mag3D(diagonal), 3)} />
      <ResultBlock label="a·b =" value={f(dotVal)} />
      <ResultBlock label="夹角 θ =" value={`${f(toDeg(angleRad), 1)}°`} />
      <Divider />
      <View3DControls />
      <Divider />
      <TeachingPoints points={pts} />
    </div>
  );
}

// ─── 运算参数路由 ───

function OperationParams({ operation }: { operation: OperationType }) {
  switch (operation) {
    case 'concept': return <ConceptParams />;
    case 'coordinate': return <CoordinateParams />;
    case 'parallelogram': return <ParallelogramParams />;
    case 'triangle': return <TriangleParams />;
    case 'subtraction': return <SubtractionParams />;
    case 'scalar': return <ScalarParams />;
    case 'dotProduct': return <DotProductParams />;
    case 'decomposition': return <DecompositionParams />;
    case 'space3D': return <Space3DParams />;
    case 'crossProduct': return <CrossProductParams />;
    case 'geometry3D': return <Geometry3DParams />;
  }
}

// ─── 全局 UI 控制 ───

function GlobalUIControls() {
  const showGrid = useVectorStore((s) => s.showGrid);
  const toggleGrid = useVectorStore((s) => s.toggleGrid);
  const { showCoordLabels, toggleCoordLabels } = useUIStore();
  const decimalPlaces = useVectorStore((s) => s.decimalPlaces);
  const setDecimalPlaces = useVectorStore((s) => s.setDecimalPlaces);
  const surdMode = useVectorStore((s) => s.surdMode);
  const toggleSurdMode = useVectorStore((s) => s.toggleSurdMode);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Eye size={12} style={{ color: COLORS.textMuted }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>显示设置</span>
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} style={{ accentColor: COLORS.primary }} />
          <Grid3X3 size={11} style={{ color: COLORS.textMuted }} />
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>坐标网格</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showCoordLabels} onChange={toggleCoordLabels} style={{ accentColor: COLORS.primary }} />
          <span style={{ fontSize: 14, color: COLORS.textSecondary }}>坐标标注</span>
        </label>
      </div>
      {/* 小数位数 */}
      <div className="flex items-center gap-2 mt-2">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>小数位数</span>
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4] as const).map((n) => (
            <button
              key={n}
              onClick={() => setDecimalPlaces(n)}
              style={{
                width: 28,
                height: 28,
                borderRadius: RADIUS.sm,
                border: `1px solid ${decimalPlaces === n ? COLORS.primary : COLORS.border}`,
                backgroundColor: decimalPlaces === n ? COLORS.primary : 'transparent',
                color: decimalPlaces === n ? COLORS.white : COLORS.textSecondary,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      {/* 根号精确显示 */}
      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" checked={surdMode} onChange={toggleSurdMode} style={{ accentColor: COLORS.primary }} />
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>√ 精确显示</span>
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>（如 √2、1+√3）</span>
      </label>
    </div>
  );
}

// ─── 主参数面板 ───

export function ParamPanel() {
  const operation = useVectorStore((s) => s.operation);
  const meta = OPERATION_META[operation];
  const [paramsOpen, setParamsOpen] = useState(true);

  return (
    <aside
      style={{
        width: 280,
        minWidth: 280,
        maxWidth: 280,
        backgroundColor: COLORS.bg,
        borderLeft: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div
        className="flex items-center gap-2 px-3 py-3"
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.bgMuted,
        }}
      >
        <Settings size={14} style={{ color: COLORS.primary }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{meta.label}</div>
          <div style={{ fontSize: 14, color: COLORS.textMuted }}>{meta.category} · {meta.dimension}</div>
        </div>
      </div>

      {/* 可折叠参数区 */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
        onClick={() => setParamsOpen((o) => !o)}
      >
        {paramsOpen ? <ChevronDown size={13} style={{ color: COLORS.textMuted }} /> : <ChevronRight size={13} style={{ color: COLORS.textMuted }} />}
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.textSecondary }}>参数 & 结果</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {paramsOpen && (
          <div className="px-3 py-3">
            <OperationParams operation={operation} />
          </div>
        )}

        <div
          style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: '12px',
          }}
        >
          <GlobalUIControls />
        </div>
      </div>

      {/* 底部操作描述 */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: `1px solid ${COLORS.border}`,
          fontSize: 14,
          color: COLORS.textMuted,
          lineHeight: 1.5,
          boxShadow: SHADOWS.sm,
        }}
      >
        {meta.description}
      </div>
    </aside>
  );
}
