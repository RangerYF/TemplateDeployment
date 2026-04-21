export class Viewport {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly width: number;
  readonly height: number;

  constructor(
    xMin: number, xMax: number,
    yMin: number, yMax: number,
    width: number, height: number,
  ) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.width = width;
    this.height = height;
  }

  get xRange(): number { return this.xMax - this.xMin; }
  get yRange(): number { return this.yMax - this.yMin; }

  // Math coordinates → Canvas pixels (Y-axis flip)
  toCanvas(mathX: number, mathY: number): [number, number] {
    const cx = (mathX - this.xMin) / this.xRange * this.width;
    const cy = this.height - (mathY - this.yMin) / this.yRange * this.height;
    return [cx, cy];
  }

  // Canvas pixels → Math coordinates (Y-axis flip inverse)
  toMath(canvasX: number, canvasY: number): [number, number] {
    const mx = canvasX / this.width * this.xRange + this.xMin;
    const my = (this.height - canvasY) / this.height * this.yRange + this.yMin;
    return [mx, my];
  }

  withSize(width: number, height: number): Viewport {
    return new Viewport(this.xMin, this.xMax, this.yMin, this.yMax, width, height);
  }

  withRange(xMin: number, xMax: number, yMin: number, yMax: number): Viewport {
    return new Viewport(xMin, xMax, yMin, yMax, this.width, this.height);
  }

  zoomAt(mathX: number, mathY: number, factor: number): Viewport {
    const newXRange = this.xRange * factor;
    const newYRange = this.yRange * factor;
    const xRatio = (mathX - this.xMin) / this.xRange;
    const yRatio = (mathY - this.yMin) / this.yRange;
    return new Viewport(
      mathX - xRatio * newXRange,
      mathX + (1 - xRatio) * newXRange,
      mathY - yRatio * newYRange,
      mathY + (1 - yRatio) * newYRange,
      this.width, this.height,
    );
  }

  pan(dMathX: number, dMathY: number): Viewport {
    return new Viewport(
      this.xMin - dMathX, this.xMax - dMathX,
      this.yMin - dMathY, this.yMax - dMathY,
      this.width, this.height,
    );
  }

  clone(): Viewport {
    return new Viewport(
      this.xMin, this.xMax, this.yMin, this.yMax,
      this.width, this.height,
    );
  }
}
