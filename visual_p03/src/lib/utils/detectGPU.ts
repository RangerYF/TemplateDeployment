export type GPUTier = 'high' | 'low';

export function detectGPU(): GPUTier {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const renderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string).toLowerCase();
      if (renderer.includes('swiftshader') || renderer.includes('llvmpipe') || renderer.includes('software')) {
        return 'low';
      }
    }
    return 'high';
  } catch {
    return 'low';
  }
}
