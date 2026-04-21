/**
 * SVG 元素导出为 PNG 并下载
 * @param svgElement - 要导出的 SVG DOM 元素
 * @param filename - 下载文件名（不含扩展名）
 * @param scale - 缩放倍率（默认 2x 适配高 DPI）
 */
export function exportSvgAsPng(
  svgElement: SVGSVGElement,
  filename: string,
  scale = 2,
): void {
  // 优先使用 viewBox 的原始宽高比，避免被 CSS 容器压扁
  const viewBox = svgElement.viewBox.baseVal;
  let naturalW: number;
  let naturalH: number;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    naturalW = viewBox.width;
    naturalH = viewBox.height;
  } else {
    const svgRect = svgElement.getBoundingClientRect();
    naturalW = svgRect.width;
    naturalH = svgRect.height;
  }

  // 保证最小导出分辨率：长边至少 MIN_EXPORT_PX 像素
  const MIN_EXPORT_PX = 1200;
  const maxSide = Math.max(naturalW, naturalH);
  const upscale = maxSide * scale < MIN_EXPORT_PX
    ? MIN_EXPORT_PX / maxSide
    : scale;

  const canvasWidth = Math.round(naturalW * upscale);
  const canvasHeight = Math.round(naturalH * upscale);

  // 克隆 SVG 并设置足够大的像素尺寸，确保渲染清晰
  const cloned = svgElement.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('width', String(canvasWidth));
  cloned.setAttribute('height', String(canvasHeight));
  // 移除 CSS transform（pan/zoom），导出时始终显示完整视图
  cloned.style.transform = '';
  cloned.style.transformOrigin = '';

  const svgData = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };

  img.src = url;
}
