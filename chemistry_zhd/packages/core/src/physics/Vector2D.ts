export class Vector2D {
  constructor(public x: number, public y: number) {}

  static zero(): Vector2D {
    return new Vector2D(0, 0);
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector2D {
    return new Vector2D(
      magnitude * Math.cos(angle),
      magnitude * Math.sin(angle)
    );
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(v: Vector2D): Vector2D {
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2D): Vector2D {
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  scale(s: number): Vector2D {
    return new Vector2D(this.x * s, this.y * s);
  }

  dot(v: Vector2D): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vector2D): number {
    return this.x * v.y - this.y * v.x;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vector2D {
    const m = this.magnitude();
    if (m === 0) return Vector2D.zero();
    return this.scale(1 / m);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  distanceTo(v: Vector2D): number {
    return this.sub(v).magnitude();
  }

  lerp(v: Vector2D, t: number): Vector2D {
    return new Vector2D(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t
    );
  }

  projectOnto(v: Vector2D): Vector2D {
    const denom = v.magnitudeSq();
    if (denom === 0) return Vector2D.zero();
    return v.scale(this.dot(v) / denom);
  }

  perpendicular(): Vector2D {
    return new Vector2D(-this.y, this.x);
  }

  negate(): Vector2D {
    return new Vector2D(-this.x, -this.y);
  }

  toString(): string {
    return `(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}
