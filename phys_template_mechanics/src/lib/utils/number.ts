interface NumberBounds {
  min?: number
  max?: number
}

interface NormalizedNumberOptions extends NumberBounds {
  precision?: number
}

/**
 * Parse user input to finite number.
 * Returns null for empty/intermediate/invalid input.
 */
export function parseFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '+' || trimmed === '.' || trimmed === '-.' || trimmed === '+.') {
    return null
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return parsed
}

export function clampNumber(value: number, bounds: NumberBounds = {}): number {
  let result = value
  if (bounds.min !== undefined) {
    result = Math.max(bounds.min, result)
  }
  if (bounds.max !== undefined) {
    result = Math.min(bounds.max, result)
  }
  return result
}

export function normalizeNumberInput(
  raw: string,
  options: NormalizedNumberOptions = {},
): number | null {
  const parsed = parseFiniteNumber(raw)
  if (parsed === null) return null
  let normalized = clampNumber(parsed, options)
  if (options.precision !== undefined && options.precision >= 0) {
    const factor = 10 ** options.precision
    normalized = Math.round(normalized * factor) / factor
  }
  return normalized
}
