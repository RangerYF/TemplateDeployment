/**
 * Skill metadata — shared constants for skill identification.
 */

export type SkillId = '' | 'm02' | 'm03' | 'm04';

export const SKILL_META: Record<Exclude<SkillId, ''>, { name: string; color: string }> = {
  m02: { name: 'M02 函数图形实验室', color: '#32D583' },
  m03: { name: 'M03 解析几何画板',   color: '#3B82F6' },
  m04: { name: 'M04 三角函数演示台', color: '#A78BFA' },
};

export function resolveSkill(): SkillId {
  const seg = window.location.pathname.replace(/^\//, '').toLowerCase().split('/')[0];
  if (seg === 'm02' || seg === 'm03' || seg === 'm04') return seg;
  return '';
}
