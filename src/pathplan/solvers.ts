// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/solvers.c */

const EPS = 1e-7;

class Solver {
  static aeq0(x: number): boolean {
    return x < EPS && x > -EPS;
  }

  static solve1(c: number[], r: number[]): number {
    if (Solver.aeq0(c[1])) return Solver.aeq0(c[0]) ? 4 : 0;
    r[0] = -c[0] / c[1];
    return 1;
  }

  static solve2(c: number[], r: number[]): number {
    if (Solver.aeq0(c[2])) return Solver.solve1(c, r);
    const b2a = c[1] / (2 * c[2]);
    const disc = b2a * b2a - c[0] / c[2];
    if (disc < 0) return 0;
    if (disc > 0) {
      r[0] = -b2a + Math.sqrt(disc);
      r[1] = -2 * b2a - r[0];
      return 2;
    }
    r[0] = -b2a;
    return 1;
  }

  static solve3neg(disc: number, q: number, b3a: number, r: number[]): number {
    const rr = 0.5 * Math.sqrt(-disc + q * q);
    const theta = Math.atan2(Math.sqrt(-disc), -q);
    const temp = 2 * Math.cbrt(rr);
    r[0] = temp * Math.cos(theta / 3) - b3a;
    r[1] = temp * Math.cos((theta + 2 * Math.PI) / 3) - b3a;
    r[2] = temp * Math.cos((theta - 2 * Math.PI) / 3) - b3a;
    return 3;
  }

  static solve3pos(disc: number, q: number, b3a: number, r: number[]): number {
    const al = 0.5 * (Math.sqrt(disc) - q);
    r[0] = Math.cbrt(al) + Math.cbrt(-q - al) - b3a;
    if (disc > 0) return 1;
    r[1] = r[2] = -0.5 * (r[0] + b3a) - b3a;
    return 3;
  }

  static solve3(c: number[], r: number[]): number {
    const a = c[3], b = c[2], cv = c[1], d = c[0];
    if (Solver.aeq0(a)) return Solver.solve2(c, r);
    const b3a = b / (3 * a), p0 = b3a * b3a;
    const q = 2 * b3a * p0 - b3a * cv / a + d / a;
    const p = cv / (3 * a) - p0;
    const disc = q * q + 4 * p * p * p;
    return disc < 0 ? Solver.solve3neg(disc, q, b3a, r)
                    : Solver.solve3pos(disc, q, b3a, r);
  }
}

/** Solve cubic c[3]*x^3 + c[2]*x^2 + c[1]*x + c[0] = 0.
 *  Returns root count; 4 means all x satisfy. @see lib/pathplan/solvers.c:solve3 */
export function solve3(coeff: number[], roots: number[]): number {
  return Solver.solve3(coeff, roots);
}
