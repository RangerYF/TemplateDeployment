function normalizeBasePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash <= 0) {
    return trimmed.endsWith('.html') ? '/' : `${trimmed}/`
  }
  if (trimmed.endsWith('.html')) {
    return `${trimmed.slice(0, lastSlash + 1)}`
  }
  return `${trimmed}/`
}

export function getRuntimeBasePath(): string {
  if (typeof window === 'undefined') return '/'
  return normalizeBasePath(window.location.pathname)
}

export function resolveAssetUrl(assetPath: string): string {
  if (!assetPath) return getRuntimeBasePath()
  if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath
  }

  const base = getRuntimeBasePath()
  const relative = assetPath.replace(/^\/+/, '')
  return `${base}${relative}`
}
