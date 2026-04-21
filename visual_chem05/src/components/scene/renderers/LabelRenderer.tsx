/**
 * LabelRenderer - Shows element symbol + charge labels in 3D
 * using drei's <Html> component.
 */

import { Html } from '@react-three/drei';
import type { AtomInstance } from '@/engine/types';

interface LabelRendererProps {
  atoms: AtomInstance[];
}

/** Map charge strings to superscript display form. */
function formatCharge(charge?: string): string {
  if (!charge) return '';
  // Convert "+1" -> "⁺", "-1" -> "⁻", "+2" -> "²⁺", "-2" -> "²⁻" etc.
  const superDigits: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  const sign = charge.startsWith('-') ? '⁻' : '⁺';
  const digits = charge.replace(/[+-]/g, '');

  // If charge magnitude is 1, just show sign
  if (digits === '1' || digits === '') {
    return sign;
  }

  const superNum = digits
    .split('')
    .map((d) => superDigits[d] ?? d)
    .join('');
  return superNum + sign;
}

export function LabelRenderer({ atoms }: LabelRendererProps) {
  return (
    <group>
      {atoms.map((atom) => {
        const chargeStr = formatCharge(atom.charge);
        const label = atom.element + chargeStr;

        return (
          <Html
            key={atom.index}
            position={atom.position as unknown as [number, number, number]}
            center
            distanceFactor={10}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                color: '#1A1A2E',
                fontSize: 10,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                padding: '1px 3px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
                border: '1px solid rgba(0,0,0,0.1)',
                transform: 'translate(50%, -50%)',
              }}
            >
              {label}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
