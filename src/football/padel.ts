import { HALF_L, HALF_W } from "./config";

// Pádel de demostración: dos jugadores, uno a cada lado de la red (x = 0), se pasan la pelota. Cada golpe
// va con bote en el campo contrario y, a veces, rebota en el vidrio del fondo. Sin física: la pelota sigue
// tramos con arco y los jugadores salen a su encuentro. Determinista por semilla.

export const PADEL = {
  /** Altura de la red en el centro. */
  netH: 0.88,
  /** Altura de la pelota al ser golpeada. */
  hitY: 0.9,
  /** Duración de la volea de un golpe (segundos): el brazo sale unos instantes antes del contacto. */
  swing: 0.38,
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PadelPlayer {
  x: number;
  z: number;
  /** Giro (rad, sobre y) con el que mira: hacia la red y la pelota. */
  heading: number;
  /** 0 a 1 durante el golpe; -1 si no golpea. */
  swingU: number;
  /** Corriendo (para el rebote del cuerpo). */
  speed: number;
  phase: number;
}

interface Leg {
  from: [number, number, number];
  to: [number, number, number];
  apex: number;
  dur: number;
}

export class PadelSim {
  players: PadelPlayer[] = [
    { x: -2.8, z: 0, heading: Math.PI / 2, swingU: -1, speed: 0, phase: 0 },
    { x: 2.8, z: 0.4, heading: -Math.PI / 2, swingU: -1, speed: 0, phase: 1.7 },
  ];
  ball = { x: -2.5, y: 0.9, z: 0.1 };
  /** Quién golpea ahora (0: lado −x, 1: lado +x). */
  hitter = 0;
  rallies = 0;
  private rnd: () => number;
  private legs: Leg[] = [];
  private leg = 0;
  private t = 0;
  private total = 0;
  /** Punto donde el receptor devolverá la pelota. */
  private meet: [number, number] = [0, 0];
  private elapsed = 0;

  constructor(seed = 77) {
    this.rnd = mulberry(seed);
    this.plan();
  }

  private plan() {
    const r = this.rnd;
    const h = this.hitter;
    const s = h === 0 ? 1 : -1; // lado al que va la pelota
    const p = this.players[h];
    const from: [number, number, number] = [
      p.x + s * 0.35,
      PADEL.hitY,
      p.z + 0.1,
    ];
    const zMax = HALF_W - 0.7;
    // bote en el campo contrario; con cierta frecuencia, hacia el vidrio del fondo
    const wall = r() < 0.5;
    const bx = wall ? s * (HALF_L - 1.9 - r() * 0.8) : s * (1.6 + r() * 3.2);
    const bz = (r() * 2 - 1) * zMax;
    const legs: Leg[] = [];
    const d = (
      a: [number, number, number],
      b: [number, number, number],
      k = 7.5,
    ) => Math.max(0.3, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / k);
    const bounce: [number, number, number] = [bx, 0.05, bz];
    legs.push({
      from,
      to: bounce,
      apex: 2.3 + r() * 0.4,
      dur: d(from, bounce),
    });
    let meet: [number, number, number];
    if (wall) {
      const wz = bz + (r() * 2 - 1) * 1.2;
      const wallPt: [number, number, number] = [
        s * HALF_L,
        1.2 + r() * 0.5,
        Math.max(-zMax, Math.min(zMax, wz)),
      ];
      legs.push({
        from: bounce,
        to: wallPt,
        apex: 0.5,
        dur: d(bounce, wallPt, 6),
      });
      meet = [
        s * (HALF_L - 2.6 - r() * 0.6),
        PADEL.hitY,
        wallPt[2] + (r() * 2 - 1) * 1.1,
      ];
      legs.push({
        from: wallPt,
        to: meet,
        apex: 0.35,
        dur: d(wallPt, meet, 5.5),
      });
    } else {
      meet = [bx + s * (0.9 + r() * 0.5), PADEL.hitY, bz + (r() * 2 - 1) * 0.6];
      legs.push({
        from: bounce,
        to: meet,
        apex: 0.7,
        dur: d(bounce, meet, 5.5),
      });
    }
    meet[2] = Math.max(-zMax, Math.min(zMax, meet[2]));
    this.meet = [meet[0], meet[2]];
    this.legs = legs;
    this.leg = 0;
    this.t = 0;
    this.total = legs.reduce((a, l) => a + l.dur, 0);
    this.elapsed = 0;
  }

  step(dt: number) {
    const rcv = 1 - this.hitter;
    const P = this.players;
    this.elapsed += dt;
    // pelota
    this.t += dt;
    let leg = this.legs[this.leg];
    while (leg && this.t >= leg.dur) {
      this.t -= leg.dur;
      this.leg++;
      leg = this.legs[this.leg];
    }
    if (!leg) {
      // el receptor golpea: ahora le toca devolver
      this.hitter = rcv;
      this.rallies++;
      this.players[this.hitter].swingU = 1; // termina el gesto
      this.plan();
      leg = this.legs[0];
    }
    const u = Math.min(1, this.t / leg.dur);
    this.ball.x = leg.from[0] + (leg.to[0] - leg.from[0]) * u;
    this.ball.z = leg.from[2] + (leg.to[2] - leg.from[2]) * u;
    // altura: recta entre extremos más un arco (parábola)
    this.ball.y =
      leg.from[1] +
      (leg.to[1] - leg.from[1]) * u +
      4 * leg.apex * u * (1 - u) * (this.leg === 0 ? 1 : 0.6);
    if (this.ball.y < 0.05) this.ball.y = 0.05;

    // jugadores
    const toGo = Math.max(0.05, this.total - this.elapsed);
    P.forEach((pl, i) => {
      const own = i === 0 ? -1 : 1;
      let tx: number, tz: number;
      if (i === rcv) {
        // sale al punto de encuentro y llega justo para el golpe
        tx = this.meet[0];
        tz = this.meet[1];
      } else {
        // el que acaba de golpear vuelve a posición, siguiendo la pelota con el cuerpo
        tx = own * (2.2 + 0.6 * Math.sin(this.elapsed * 0.9));
        tz = Math.max(
          -HALF_W + 0.8,
          Math.min(HALF_W - 0.8, this.ball.z * 0.55),
        );
      }
      const dx = tx - pl.x;
      const dz = tz - pl.z;
      const dist = Math.hypot(dx, dz);
      const max = i === rcv ? Math.min(7, dist / (toGo * 0.8)) : 3;
      const step = Math.min(dist, max * dt);
      if (dist > 1e-3) {
        pl.x += (dx / dist) * step;
        pl.z += (dz / dist) * step;
      }
      pl.speed = dt > 0 ? step / dt : 0;
      pl.phase += pl.speed * dt * 4;
      // mira hacia la red (y la pelota si viene hacia él)
      const fx = -own * 1;
      pl.heading = Math.atan2(
        fx,
        0.35 * (this.ball.z - pl.z) * -own * 0 + (this.ball.z - pl.z) * 0.25,
      );
      // golpe: el gesto empieza `swing` segundos antes del contacto
      if (i === rcv) {
        const left = this.total - this.elapsed;
        pl.swingU = left < PADEL.swing ? 1 - left / PADEL.swing : -1;
      } else if (pl.swingU >= 0) {
        pl.swingU += dt / 0.3;
        if (pl.swingU > 1.4) pl.swingU = -1;
      }
    });
  }
}
