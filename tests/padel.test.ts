import { describe, expect, it } from "vitest";
import { HALF_L, HALF_W } from "../src/football/config";
import { PADEL, PadelSim } from "../src/football/padel";

describe("PadelSim", () => {
  it("la pelota y los jugadores se quedan dentro de la cancha durante muchos golpes", () => {
    const sim = new PadelSim(5);
    let hits = 0;
    let last = sim.hitter;
    let crossedNet = 0;
    let prevSide = Math.sign(sim.ball.x);
    for (let i = 0; i < 60 * 120; i++) {
      sim.step(1 / 60);
      const b = sim.ball;
      expect(Math.abs(b.x)).toBeLessThanOrEqual(HALF_L + 0.01);
      expect(Math.abs(b.z)).toBeLessThanOrEqual(HALF_W);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThan(5);
      for (const p of sim.players) {
        expect(Math.abs(p.x)).toBeLessThan(HALF_L);
        expect(Math.abs(p.z)).toBeLessThan(HALF_W);
        expect(Number.isFinite(p.heading)).toBe(true);
      }
      if (sim.hitter !== last) {
        hits++;
        last = sim.hitter;
      }
      const side = Math.sign(b.x);
      if (side !== 0 && side !== prevSide) {
        crossedNet++;
        // al cruzar la red la pelota va por encima de ella
        expect(b.y).toBeGreaterThan(PADEL.netH);
        prevSide = side;
      }
    }
    expect(hits).toBeGreaterThan(30);
    expect(crossedNet).toBeGreaterThan(30);
  });

  it("cada jugador se queda en su mitad de la cancha (con la red en medio)", () => {
    const sim = new PadelSim(9);
    for (let i = 0; i < 60 * 60; i++) {
      sim.step(1 / 60);
      expect(sim.players[0].x).toBeLessThan(0.2);
      expect(sim.players[1].x).toBeGreaterThan(-0.2);
    }
  });
});
