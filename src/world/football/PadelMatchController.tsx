import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, COURTS, FENCE_Z, courtToWorld } from "../../football/config";
import { PadelSim } from "../../football/padel";
import { useUI, type Quality } from "../../state/ui";
import { cameraState } from "../cameraState";
import { GEO, mat } from "../materials";
import { COURT_BENCHES } from "./FootballCourt";
import { writeFolk } from "./folk";
import type { Pose } from "./people";

// Partido de pádel de demostración: dos jugadores (las mismas personitas del mall) con pala y una pelota
// amarilla, más tres espectadores junto a la pista. Mismo criterio que el fútbol: un solo useFrame, en pausa
// si la cancha no se ve.

const SHIRTS = ["#e0735f", "#2bb3b1"];
const SKINS = ["#c58c64", "#8d5a3b"];
const WATCHERS: {
  x: number;
  z: number;
  seated: boolean;
  shirt: string;
  skin: string;
}[] = [
  {
    x: COURT_BENCHES[0][0] - 0.45,
    z: COURT_BENCHES[0][1] - 0.05,
    seated: true,
    shirt: "#f4f1ea",
    skin: "#e5b48f",
  },
  {
    x: COURT_BENCHES[1][0],
    z: COURT_BENCHES[1][1] - 0.05,
    seated: true,
    shirt: "#5f9a6e",
    skin: "#8d5a3b",
  },
  {
    x: 5.2,
    z: FENCE_Z + 0.6,
    seated: false,
    shirt: "#6b5b95",
    skin: "#c58c64",
  },
];

/** Ángulo de la pala a lo largo del golpe: preparación atrás, golpe rápido hacia adelante y vuelta. */
function racketAngle(u: number): number {
  if (u < 0) return 0.5;
  if (u < 0.45) return 0.5 - 1.5 * (u / 0.45);
  if (u < 0.75) return -1 + 2.6 * ((u - 0.45) / 0.3);
  return 1.6 - 1.1 * Math.min(1, (u - 0.75) / 0.5);
}

export function PadelMatchController({
  quality,
  reduceMotion,
  court = 1,
}: {
  quality: Quality;
  reduceMotion: boolean;
  court?: number;
}) {
  const sim = useMemo(() => new PadelSim(31 + court * 7), [court]);
  const people = 2 + WATCHERS.length;
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const rackets = useRef<(THREE.Group | null)[]>([null, null]);
  const root = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const ballMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d9f23a",
        roughness: 0.6,
        emissive: "#7a8a10",
        emissiveIntensity: 0.35,
      }),
    [],
  );

  useLayoutEffect(() => {
    const c = new THREE.Color();
    const all = [
      ...SHIRTS.map((s, i) => ({ shirt: s, skin: SKINS[i] })),
      ...WATCHERS,
    ];
    all.forEach((p, k) => {
      bodies.current?.setColorAt(k, c.set(p.shirt));
      heads.current?.setColorAt(k, c.set(p.skin));
    });
    for (const m of [bodies.current, heads.current])
      if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state, rawDt) => {
    const { activeFloor, overview } = useUI.getState();
    if (!cameraState.active || (activeFloor !== "P1" && !overview)) return;
    const dt = Math.min(rawDt, 0.1);
    sim.step(reduceMotion ? dt * 0.5 : dt);
    const t = state.clock.elapsedTime;
    const rot = COURTS[court].rotation;
    const y0 = COURT.y + 0.07;
    const folk = { bodies: bodies.current, heads: heads.current };

    sim.players.forEach((p, k) => {
      const run = Math.min(1, p.speed / 3);
      const swing =
        p.swingU >= 0 ? Math.sin(Math.min(1, p.swingU) * Math.PI) : 0;
      const pose: Pose = {
        y: Math.abs(Math.sin(p.phase)) * 0.06 * run,
        crouch: 0.03 + swing * 0.04,
        lean: 0.08 + run * 0.1 + swing * 0.12,
        legL: Math.sin(p.phase) * run,
        legR: -Math.sin(p.phase) * run,
        armL: 0,
        armR: 0,
        raiseL: 0,
        raiseR: 0,
        seated: false,
      };
      const hw = p.heading + rot;
      q.setFromAxisAngle(axis.set(0, 1, 0), hw);
      const [wx, wz] = courtToWorld(p.x, p.z, court);
      root.compose(
        new THREE.Vector3(wx, y0, wz),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      writeFolk(folk, k, root, pose);
      // pala en la mano derecha
      const r = rackets.current[k];
      if (r) {
        const a = racketAngle(p.swingU);
        const s = Math.sin(hw);
        const c = Math.cos(hw);
        const fw = 0.2 + 0.12 * Math.sin(a);
        r.position.set(
          wx + c * 0.27 + s * fw,
          y0 + 0.52 + pose.y,
          wz - s * 0.27 + c * fw,
        );
        r.rotation.set(0, hw, 0);
        r.children[0].rotation.set(a, 0, 0);
      }
    });
    // espectadores: miran la pelota
    WATCHERS.forEach((w, j) => {
      const k = 2 + j;
      const [bx] = courtToWorld(sim.ball.x, sim.ball.z, court);
      const [wxW, wzW] = courtToWorld(w.x, w.z, court);
      const [bxW, bzW] = courtToWorld(sim.ball.x, sim.ball.z, court);
      void bx;
      const heading = Math.atan2(bxW - wxW, bzW - wzW);
      const cheer = Math.sin(t * 6 + j) * 0.5 + 0.5;
      const pose: Pose = {
        y: !w.seated && sim.rallies % 7 === 6 ? cheer * 0.1 : 0,
        crouch: 0,
        lean: w.seated ? -0.05 : 0,
        legL: 0,
        legR: 0,
        armL: 0,
        armR: 0,
        raiseL: 0,
        raiseR: 0,
        seated: w.seated,
      };
      q.setFromAxisAngle(axis.set(0, 1, 0), heading);
      root.compose(
        new THREE.Vector3(wxW, COURT.y + (w.seated ? 0.05 : 0.02), wzW),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      writeFolk(folk, k, root, pose);
    });
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;

    const b = sim.ball;
    const [bx, bz] = courtToWorld(b.x, b.z, court);
    ball.current?.position.set(bx, COURT.y + 0.1 + b.y, bz);
    if (shadow.current) {
      shadow.current.position.set(bx, COURT.y + 0.082, bz);
      shadow.current.scale.setScalar(0.2 * (1 - Math.min(0.5, b.y * 0.2)));
    }
  });

  const faces = ["#e0735f", "#2bb3b1"];
  return (
    <group>
      <instancedMesh
        ref={bodies}
        args={[GEO.capsule, mat("#ffffff"), people]}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={heads}
        args={[GEO.sphereSmooth, mat("#ffffff"), people]}
        frustumCulled={false}
        raycast={() => null}
      />
      {[0, 1].map((i) => (
        <group key={i} ref={(el) => void (rackets.current[i] = el)}>
          {/* el hijo gira para el golpe: mango (abajo) y cabeza ovalada (arriba) */}
          <group>
            <mesh
              geometry={GEO.box}
              material={mat("#f0f0ee")}
              position={[0, 0.12, 0]}
              scale={[0.04, 0.24, 0.04]}
              raycast={() => null}
            />
            <mesh
              geometry={GEO.sphereSmooth}
              material={mat("#1f262d")}
              position={[0, 0.38, 0]}
              scale={[0.07, 0.3, 0.26]}
              raycast={() => null}
            />
            <mesh
              geometry={GEO.sphereSmooth}
              material={mat(faces[i])}
              position={[0.0, 0.38, 0]}
              scale={[0.09, 0.22, 0.19]}
              raycast={() => null}
            />
          </group>
        </group>
      ))}
      <mesh
        ref={ball}
        geometry={GEO.sphereSmooth}
        material={ballMat}
        scale={0.1}
        castShadow={quality === "high"}
        raycast={() => null}
      />
      <mesh
        ref={shadow}
        geometry={SHADOW_DISC}
        material={BALL_SHADOW}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      />
    </group>
  );
}

const SHADOW_DISC = new THREE.CircleGeometry(0.5, 12);
const BALL_SHADOW = new THREE.MeshBasicMaterial({
  color: "#000000",
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
});
