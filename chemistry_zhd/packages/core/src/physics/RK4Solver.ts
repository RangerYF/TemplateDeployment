export type StateArray = number[];
export type DerivativeFunction = (t: number, state: StateArray) => StateArray;

/**
 * 4th-order Runge-Kutta integrator for ODEs.
 * state is a flat array of numbers (e.g. [x, y, vx, vy]).
 * derivFn computes derivatives: (t, state) => dstate/dt
 */
export function rk4Step(
  derivFn: DerivativeFunction,
  t: number,
  state: StateArray,
  dt: number
): StateArray {
  const n = state.length;
  const k1 = derivFn(t, state);

  const s2 = new Array(n);
  for (let i = 0; i < n; i++) s2[i] = state[i] + 0.5 * dt * k1[i];
  const k2 = derivFn(t + 0.5 * dt, s2);

  const s3 = new Array(n);
  for (let i = 0; i < n; i++) s3[i] = state[i] + 0.5 * dt * k2[i];
  const k3 = derivFn(t + 0.5 * dt, s3);

  const s4 = new Array(n);
  for (let i = 0; i < n; i++) s4[i] = state[i] + dt * k3[i];
  const k4 = derivFn(t + dt, s4);

  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = state[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
  return result;
}
