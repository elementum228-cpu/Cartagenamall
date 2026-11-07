import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COURT, COURTS, FENCE_Z, courtToWorld } from "../../football/config";
import { KICK_TIME, MatchSim } from "../../football/match";
import { useUI, type Quality } from "../../state/ui";
import { cameraState } from "../cameraState";
import { GEO, mat } from "../materials";
import { writeFolk } from "./folk";
import { COURT_BENCHES } from "./FootballCourt";
import { FootballPlayer, type Lod, type PersonLook, type Pose } from "./people";

// Controlador central del partido de demostración: un solo useFrame avanza la simulación
// (football/match.ts) y escribe las matrices de jugadores, espectadores y balón. Detalle según la
// distancia de la cámara (LOD) y en pausa si la cancha no se ve (otro piso o vista inactiva).

const TEAM = [
  { shirt: "#e0735f", keeper: "#f5b544" },
  { shirt: "#2bb3b1", keeper: "#6b5b95" },
];
const SHORTS = "#2b2f36";
const SKIN = ["#8d5a3b", "#c58c64", "#e5b48f", "#a86b45"];
const HAIR = ["#2a1f19", "#4a3426", "#1d1d1f", "#7a5232"];

/** Espectadores fuera del cerramiento: sentados en las bancas o de pie junto a la malla. */
const SPECTATORS: {
  x: number;
  z: number;
  seated: boolean;
  look: PersonLook;
}[] = [
  {
    x: COURT_BENCHES[0][0] - 0.45,
    z: COURT_BENCHES[0][1] - 0.05,
    seated: true,
    look: { shirt: "#f4f1ea", shorts: "#3b82a6", skin: SKIN[1], hair: HAIR[0] },
  },
  {
    x: COURT_BENCHES[0][0] + 0.45,
    z: COURT_BENCHES[0][1] - 0.05,
    seated: true,
    look: { shirt: "#c2607f", shorts: "#2f3e4e", skin: SKIN[2], hair: HAIR[3] },
  },
  {
    x: COURT_BENCHES[1][0],
    z: COURT_BENCHES[1][1] - 0.05,
    seated: true,
    look: { shirt: "#5f9a6e", shorts: "#2f3e4e", skin: SKIN[0], hair: HAIR[2] },
  },
  {
    x: -5.6,
    z: FENCE_Z + 0.55,
    seated: false,
    look: { shirt: "#f5b544", shorts: "#2f3e4e", skin: SKIN[3], hair: HAIR[1] },
  },
  {
    x: 5.4,
    z: FENCE_Z + 0.6,
    seated: false,
    look: { shirt: "#6b5b95", shorts: "#3a4450", skin: SKIN[2], hair: null },
  },
];

/** Balón low-poly: icosaedro con caras blancas y negras (se lee como balón de fútbol). */
function ballGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1); // ya viene sin índices (una cara = 3 vértices)
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let f = 0; f < n / 3; f++) {
    const dark = f % 5 === 0 || f % 7 === 3;
    for (let k = 0; k < 3; k++)
      colors.set(
        dark ? [0.12, 0.12, 0.13] : [0.97, 0.97, 0.96],
        (f * 3 + k) * 3,
      );
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export function FootballMatchController({
  quality,
  reduceMotion,
  court = 0,
}: {
  quality: Quality;
  reduceMotion: boolean;
  court?: number;
}) {
  // cada cancha juega su propio partido (otra semilla: no se mueven igual)
  const sim = useMemo(() => new MatchSim(2026 + court * 977), [court]);
  const looks = useMemo<PersonLook[]>(
    () => [
      ...sim.players.map((p, i) => ({
        shirt: p.keeper ? TEAM[p.team].keeper : TEAM[p.team].shirt,
        shorts: SHORTS,
        skin: SKIN[(i * 3) % SKIN.length],
        hair: i % 4 === 3 ? null : HAIR[i % HAIR.length],
      })),
      ...SPECTATORS.map((s) => s.look),
    ],
    [sim],
  );
  const people = looks.length;
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const ball = useRef<THREE.Mesh>(null);
  const ballShadow = useRef<THREE.Mesh>(null);
  const frame = useRef(0);
  const geo = useMemo(
    () => ({
      ball: ballGeometry(),
      ballMat: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        flatShading: true,
      }),
    }),
    [],
  );
  const root = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);

  // colores por persona: camiseta y piel
  useLayoutEffect(() => {
    const c = new THREE.Color();
    looks.forEach((l, k) => {
      bodies.current?.setColorAt(k, c.set(l.shirt));
      heads.current?.setColorAt(k, c.set(l.skin));
    });
    for (const m of [bodies.current, heads.current])
      if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  }, [looks]);

  useFrame((state, rawDt) => {
    const { activeFloor, overview } = useUI.getState();
    // pausa: vista inactiva o explorando el piso 2 (la cancha no se ve)
    if (!cameraState.active || (activeFloor !== "P1" && !overview)) return;
    const dt = Math.min(rawDt, 0.1);
    const ratio = cameraState.zoom / cameraState.fitZoom;
    const lod: Lod =
      quality === "low" || reduceMotion || overview || ratio < 0.85
        ? "low"
        : ratio < 1.5 || quality === "medium"
          ? "medium"
          : "high";
    sim.step(dt);
    // menor frecuencia de actualización de las poses con menos detalle
    frame.current++;
    const every = lod === "high" ? 1 : lod === "medium" ? 2 : 3;
    if (frame.current % every !== 0) return;
    const t = state.clock.elapsedTime;
    const rot = COURTS[court].rotation;
    const y0 = COURT.y + 0.07;
    const folk = { bodies: bodies.current, heads: heads.current };

    sim.players.forEach((p, k) => {
      const pose = FootballPlayer.pose(
        p.anim,
        t,
        p.phase,
        1 - p.kickT / KICK_TIME,
        lod,
      );
      q.setFromAxisAngle(axis.set(0, 1, 0), p.heading + rot);
      const [wx, wz] = courtToWorld(p.x, p.z, court);
      root.compose(
        new THREE.Vector3(wx, y0, wz),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      writeFolk(folk, k, root, pose);
    });
    // espectadores: miran el balón; en un gol, levantan los brazos (cada uno a su ritmo)
    const goal = sim.phase === "goal";
    SPECTATORS.forEach((s, j) => {
      const k = sim.players.length + j;
      const heading = Math.atan2(sim.ball.x - s.x, sim.ball.z - s.z);
      const cheer = goal && lod !== "low" && j % 2 === sim.goals % 2;
      const wave = Math.sin(t * 8 + j);
      const pose: Pose = {
        y: cheer && !s.seated ? Math.abs(wave) * 0.12 : s.seated ? -0.13 : 0,
        crouch: 0,
        lean: s.seated ? -0.05 : 0,
        legL: 0,
        legR: 0,
        armL: s.seated ? -0.5 : 0,
        armR: s.seated ? -0.5 : 0,
        raiseL: cheer ? 2.5 + wave * 0.2 : 0.1,
        raiseR: cheer ? 2.5 - wave * 0.2 : 0.1,
        seated: s.seated,
      };
      q.setFromAxisAngle(axis.set(0, 1, 0), heading + rot);
      const [wx, wz] = courtToWorld(s.x, s.z, court);
      root.compose(
        new THREE.Vector3(wx, COURT.y + (s.seated ? 0.05 : 0.02), wz),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      writeFolk(folk, k, root, pose);
    });
    if (folk.bodies) folk.bodies.instanceMatrix.needsUpdate = true;
    if (folk.heads) folk.heads.instanceMatrix.needsUpdate = true;

    // balón: posición, altura y rodadura sobre su eje
    const b = sim.ball;
    const [bx, bz] = courtToWorld(b.x, b.z, court);
    if (ball.current) {
      ball.current.position.set(bx, COURT.y + 0.18 + b.y, bz);
      // eje de rodadura llevado al piso (mismo giro que la cancha)
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      ball.current.quaternion.setFromAxisAngle(
        axis.set(
          b.rollAxis[0] * c + b.rollAxis[1] * sn,
          0,
          -b.rollAxis[0] * sn + b.rollAxis[1] * c,
        ),
        b.roll,
      );
    }
    if (ballShadow.current) {
      ballShadow.current.position.set(bx, COURT.y + 0.082, bz);
      ballShadow.current.scale.setScalar(0.22 * (1 - Math.min(0.5, b.y * 0.6)));
    }
  });

  return (
    <group>
      {/* las mismas personitas del mall: cuerpo y cabeza */}
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
      <mesh
        ref={ball}
        geometry={geo.ball}
        material={geo.ballMat}
        scale={0.11}
        castShadow={quality === "high"}
        raycast={() => null}
      />
      <mesh
        ref={ballShadow}
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
