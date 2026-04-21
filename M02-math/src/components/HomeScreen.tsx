/**
 * HomeScreen — module selector landing page
 *
 * Three cards for M02 / M03 / M04.  Clicking one calls navigate() which
 * pushes a clean path (/m02 etc.) and App.tsx re-renders the right Layout.
 */

import { navigate } from '@/lib/navigate';
import { COLORS } from '@/styles/colors';
import { SHADOWS } from '@/styles/tokens';

const MODULES = [
  {
    id:    'm02',
    title: 'M02 函数图形实验室',
    desc:  '自由函数输入 · 参数变换 · 特征点标注 · 导数切线 · 分段函数 · 动画',
    color: COLORS.primary,
  },
  {
    id:    'm03',
    title: 'M03 解析几何画板',
    desc:  '椭圆 · 双曲线 · 抛物线 · 焦点 · 准线 · 离心率动画 · 预设曲线',
    color: COLORS.cosColor,
  },
  {
    id:    'm04',
    title: 'M04 三角函数演示台',
    desc:  '单位圆 · 函数图像同步 · 变换参数 · 五点法 · 辅助角 · 三角形解算',
    color: COLORS.angleArc,
  },
] as const;

export function HomeScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.surfaceHover,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 6 }}>
        EduMath Lab
      </h1>
      <p style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 40 }}>
        选择一个模块开始使用
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {MODULES.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(`/${m.id}`)}
            style={{
              width: 240,
              padding: '24px 20px',
              background: COLORS.surface,
              border: `2px solid ${m.color}33`,
              borderRadius: 18,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'box-shadow 0.15s, border-color 0.15s',
              boxShadow: SHADOWS.md,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = m.color;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${m.color}33`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${m.color}33`;
              (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOWS.md;
            }}
          >
            <div style={{
              display: 'inline-block',
              padding: '3px 8px',
              background: `${m.color}18`,
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              color: m.color,
              letterSpacing: '0.5px',
              marginBottom: 10,
            }}>
              {m.id.toUpperCase()}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 6 }}>
              {m.title.slice(4)}
            </p>
            <p style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              {m.desc}
            </p>
            <div style={{
              marginTop: 16,
              fontSize: 12,
              fontWeight: 600,
              color: m.color,
            }}>
              进入 →
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
