"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Frame, MatchEvent } from "@/engine/types";
import type { PitchTeam } from "./PitchCanvas";

interface Props {
  frames: Frame[];
  getTick: () => number;
  home: PitchTeam;
  away: PitchTeam;
  getHighlights: () => { type: MatchEvent["type"]; playerId?: number; side: MatchEvent["side"]; age: number }[];
  camera: "geral" | "close";
  /** chamado se o WebGL não estiver disponível (o pai volta para o 2D) */
  onUnsupported: () => void;
}

const L = 105; // comprimento do campo (m)
const WD = 68; // largura (m)
const SCALE = 1.45; // bonecos um pouco maiores que o real para leitura na tela
const ASPECT = 1050 / 680;

const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x5c3a21, 0xffdbac];
const HAIRS = [0x1b1b1b, 0x3b2314, 0x6b4423, 0xc9a15b, 0x111111];
const GK_KITS = [0xf59e0b, 0x16a34a];

function toWorld([x, y]: [number, number]): THREE.Vector3 {
  return new THREE.Vector3((x - 0.5) * L, 0, (y - 0.5) * WD);
}

function mat(color: THREE.ColorRepresentation, roughness = 0.65) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function limb(len: number, rTop: number, rBot: number, m: THREE.Material) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 7);
  g.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

interface Figure {
  root: THREE.Group;
  hips: THREE.Group[];
  knees: THREE.Group[];
  shoulders: THREE.Group[];
  shirt: THREE.MeshStandardMaterial;
  shorts: THREE.MeshStandardMaterial;
  socks: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  number: THREE.Sprite;
  numberValue: number | null;
  badge: THREE.Sprite;
  badgeType: string | null;
  phase: number;
  yaw: number;
  last: THREE.Vector3 | null;
}

/** Bonequinho low-poly (~1,8 m) com pivôs em quadris, joelhos e ombros para a animação de corrida. */
function makeFigure(): Figure {
  const root = new THREE.Group();
  const shirt = mat(0xffffff);
  const shorts = mat(0x000000);
  const socks = mat(0xffffff);
  const skin = mat(0xe0ac69, 0.8);
  const hair = mat(0x1b1b1b, 0.9);
  const boot = mat(0x111111, 0.4);
  const body = new THREE.Group();
  body.rotation.x = 0.08;
  root.add(body);

  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.12 * s, 0.92, 0);
    hip.add(limb(0.42, 0.095, 0.08, skin), limb(0.2, 0.115, 0.11, shorts));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(limb(0.42, 0.075, 0.06, socks));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), boot);
    b.position.set(0, -0.45, 0.06);
    b.castShadow = true;
    knee.add(b);
    hip.add(knee);
    body.add(hip);
    hips.push(hip);
    knees.push(knee);
  }
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), shorts);
  pelvis.position.y = 0.95;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.55, 8), shirt);
  torso.position.y = 1.32;
  torso.rotation.x = 0.12;
  const shoulderBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), shirt);
  shoulderBar.position.set(0, 1.56, 0.03);
  body.add(pelvis, torso, shoulderBar);

  const shoulders: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0.27 * s, 1.55, 0.03);
    sh.rotation.z = 0.12 * s;
    sh.add(limb(0.2, 0.07, 0.065, shirt), limb(0.28, 0.055, 0.05, skin));
    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    elbow.rotation.x = -0.9;
    elbow.add(limb(0.26, 0.048, 0.04, skin));
    sh.add(elbow);
    body.add(sh);
    shoulders.push(sh);
  }
  const neck = limb(0.08, 0.06, 0.06, skin);
  neck.position.y = 1.68;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
  head.scale.set(0.95, 1.1, 1);
  head.position.set(0, 1.8, 0.02);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.137, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairMesh.scale.set(0.97, 1.1, 1.02);
  hairMesh.position.set(0, 1.81, 0);
  hairMesh.rotation.x = -0.25;
  body.add(neck, head, hairMesh);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  root.scale.setScalar(SCALE);

  const number = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
  number.renderOrder = 10;
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
  badge.renderOrder = 11;
  badge.visible = false;

  return { root, hips, knees, shoulders, shirt, shorts, socks, skin, hair, number, numberValue: null, badge, badgeType: null, phase: Math.random() * 6, yaw: 0, last: null };
}

const texCache = new Map<string, THREE.CanvasTexture>();
function labelTexture(key: string, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

function numberTexture(n: number, bg: string, fg: string) {
  return labelTexture(`n${n}${bg}${fg}`, (g) => {
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(8, 8, 112, 112, 18);
    g.fill();
    g.fillStyle = fg;
    g.font = "bold 72px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(n), 64, 70);
  });
}

function badgeTexture(type: string) {
  return labelTexture(`b${type}`, (g) => {
    if (type === "injury") {
      g.fillStyle = "#fff";
      g.fillRect(24, 24, 80, 80);
      g.fillStyle = "#ef4444";
      g.fillRect(52, 34, 24, 60);
      g.fillRect(34, 52, 60, 24);
    } else {
      g.fillStyle = type === "yellow" ? "#fde047" : "#ef4444";
      g.strokeStyle = "#000";
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(36, 14, 56, 100, 8);
      g.fill();
      g.stroke();
    }
  });
}

function hashId(id: number) {
  let h = id * 2654435761;
  h ^= h >>> 13;
  return Math.abs(h);
}

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

function buildStadium(scene: THREE.Scene) {
  // gramado com faixas e linhas
  const tex = document.createElement("canvas");
  tex.width = 2048;
  tex.height = 1326;
  const t = tex.getContext("2d")!;
  for (let i = 0; i < 18; i++) {
    t.fillStyle = i % 2 ? "#2f8c3d" : "#37a047";
    t.fillRect((i * tex.width) / 18, 0, tex.width / 18 + 1, tex.height);
  }
  t.strokeStyle = "rgba(255,255,255,.92)";
  t.lineWidth = 8;
  const s = tex.width / L;
  const f = (v: number) => v * s;
  t.strokeRect(f(1), f(1), f(L - 2), f(WD - 2));
  t.beginPath();
  t.moveTo(f(L / 2), f(1));
  t.lineTo(f(L / 2), f(WD - 1));
  t.stroke();
  t.beginPath();
  t.arc(f(L / 2), f(WD / 2), f(9.15), 0, Math.PI * 2);
  t.stroke();
  for (const side of [0, 1]) {
    t.strokeRect(f(side ? L - 1 - 16.5 : 1), f(WD / 2 - 20.16), f(16.5), f(40.32));
    t.strokeRect(f(side ? L - 1 - 5.5 : 1), f(WD / 2 - 9.16), f(5.5), f(18.32));
  }
  const grass = new THREE.CanvasTexture(tex);
  grass.anisotropy = 8;
  grass.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(L, WD), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.9 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(L + 30, WD + 30), new THREE.MeshStandardMaterial({ color: 0x2a7a36, roughness: 0.9 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  // gols
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    const gx = side * (L / 2 - 1);
    for (const z of [-3.66, 3.66]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.44), white);
      post.position.set(gx, 1.22, z);
      post.castShadow = true;
      scene.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.32), white);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(gx, 2.44, 0);
    scene.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }));
    net.position.set(gx + side, 1.22, 0);
    scene.add(net);
  }

  // arquibancadas e placas
  const stand = new THREE.MeshStandardMaterial({ color: 0x1b2337 });
  const crowd = new THREE.MeshStandardMaterial({ color: 0x3b4660 });
  const blocks: [number, number, number, number][] = [
    [0, -WD / 2 - 14, L + 30, 10],
    [0, WD / 2 + 14, L + 30, 10],
    [-L / 2 - 14, 0, 10, WD + 30],
    [L / 2 + 14, 0, 10, WD + 30],
  ];
  for (const [x, z, w, d] of blocks) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), stand);
    st.position.set(x, 3, z);
    scene.add(st);
    for (let k = 0; k < 3; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d / 3), crowd);
      step.position.set(x, 6 + k * 1.2, z);
      scene.add(step);
    }
  }
  const boards = new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x0d5a2c });
  for (const z of [-WD / 2 - 3.5, WD / 2 + 3.5]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(L + 6, 1, 0.3), boards);
    b.position.set(0, 0.5, z);
    scene.add(b);
  }
}

/** Campo 3D (câmera de estádio) com bonequinhos low-poly animados. */
export default function Pitch3D({ frames, getTick, home, away, getHighlights, camera, onUnsupported }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ frames, home, away, getTick, getHighlights, camera });
  useEffect(() => {
    propsRef.current = { frames, home, away, getTick, getHighlights, camera };
  });
  const unsupportedRef = useRef(onUnsupported);
  useEffect(() => {
    unsupportedRef.current = onUnsupported;
  });

  useEffect(() => {
    const host = ref.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      unsupportedRef.current();
      return;
    }
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "block h-full w-full";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 120, 220);
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x203020, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-30, 60, 25);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50 });
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    buildStadium(scene);

    const cam = new THREE.PerspectiveCamera(34, ASPECT, 0.1, 400);
    const camTarget = new THREE.Vector3(0, 0, 0);
    const camPos = new THREE.Vector3(-22, 30, 52);

    const figures: Figure[] = Array.from({ length: 22 }, () => {
      const f = makeFigure();
      scene.add(f.root, f.number, f.badge);
      return f;
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x222222 }));
    ball.castShadow = true;
    scene.add(ball);
    // anel no gramado para achar a bola de longe
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 5;
    scene.add(ring);

    const resize = () => {
      const w = host.clientWidth;
      const h = Math.round(w / ASPECT);
      renderer.setSize(w, h, false);
      host.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const tmp = new THREE.Vector3();
    const draw = () => {
      const { frames, home, away, getTick, getHighlights, camera } = propsRef.current;
      if (frames.length) {
        const t = Math.max(0, Math.min(frames.length - 1, getTick()));
        const i0 = Math.floor(t);
        const i1 = Math.min(frames.length - 1, i0 + 1);
        const k = t - i0;
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const f0 = frames[i0];
        const f1 = frames[i1];
        const lerp = (a: [number, number] | null, b: [number, number] | null): [number, number] | null => {
          if (!a || !b) return b ?? a;
          return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
        };
        const b2 = lerp(f0.b, f1.b)!;
        const bw = toWorld(b2);
        ball.position.set(bw.x, 0.7, bw.z);
        ring.position.set(bw.x, 0.03, bw.z);

        const highlights = getHighlights();
        const hlById = new Map<number, string>();
        for (const h of highlights) {
          if (!h.playerId) continue;
          if (h.type === "yellow") hlById.set(h.playerId, "yellow");
          if (h.type === "red" || h.type === "second_yellow") hlById.set(h.playerId, "red");
          if (h.type === "injury") hlById.set(h.playerId, "injury");
        }

        for (let i = 0; i < 22; i++) {
          const fig = figures[i];
          const team = i < 11 ? home : away;
          const slot = i % 11;
          const p = lerp(f0.p[i], f1.p[i]);
          if (!p) {
            fig.root.visible = fig.number.visible = fig.badge.visible = false;
            fig.last = null;
            continue;
          }
          fig.root.visible = fig.number.visible = true;
          const w = toWorld(p);
          // cores do uniforme (goleiro com cor própria) e pele/cabelo estáveis por jogador
          const id = team.ids[slot] ?? i;
          const isGk = slot === 0;
          fig.shirt.color.set(isGk ? GK_KITS[i < 11 ? 0 : 1] : team.fill);
          fig.shorts.color.set(isGk ? 0x111111 : team.stroke);
          fig.socks.color.set(isGk ? GK_KITS[i < 11 ? 0 : 1] : team.fill);
          const hsh = hashId(id);
          fig.skin.color.setHex(SKINS[hsh % SKINS.length]);
          fig.hair.color.setHex(HAIRS[(hsh >> 4) % HAIRS.length]);
          const shirtNo = team.shirts[slot];
          if (shirtNo !== fig.numberValue && shirtNo !== null) {
            fig.numberValue = shirtNo;
            const bg = i < 11 ? "#ffffff" : "#111111";
            (fig.number.material as THREE.SpriteMaterial).map = numberTexture(shirtNo, bg, lum(bg) > 160 ? "#111111" : "#ffffff");
            (fig.number.material as THREE.SpriteMaterial).needsUpdate = true;
          }

          // movimento: direção, passada e balanço de braços/pernas
          const moved = fig.last ? tmp.subVectors(w, fig.last).length() : 0;
          let targetYaw = Math.atan2(bw.x - w.x, bw.z - w.z);
          if (fig.last && moved > 0.01) targetYaw = Math.atan2(w.x - fig.last.x, w.z - fig.last.z);
          let dy = targetYaw - fig.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          fig.yaw += dy * 0.15;
          fig.phase += Math.min(moved, 0.6) * 2.2;
          const amp = Math.min(0.75, 0.12 + moved * 4);
          const swing = Math.sin(fig.phase) * amp;
          fig.hips[0].rotation.x = -swing;
          fig.hips[1].rotation.x = swing;
          fig.knees[0].rotation.x = Math.max(0, swing) * 0.9 + 0.15;
          fig.knees[1].rotation.x = Math.max(0, -swing) * 0.9 + 0.15;
          fig.shoulders[0].rotation.x = swing * 0.9;
          fig.shoulders[1].rotation.x = -swing * 0.9;
          fig.root.position.set(w.x, Math.abs(Math.sin(fig.phase)) * amp * 0.06, w.z);
          fig.root.rotation.y = fig.yaw;
          fig.last = w;

          const close = camera === "close";
          fig.number.scale.setScalar(close ? 0.55 : 1.25);
          fig.number.position.set(w.x, close ? 3.3 : 3.7, w.z);
          const hl = id !== null ? hlById.get(id) : undefined;
          if (hl) {
            if (fig.badgeType !== hl) {
              (fig.badge.material as THREE.SpriteMaterial).map = badgeTexture(hl);
              (fig.badge.material as THREE.SpriteMaterial).needsUpdate = true;
              fig.badgeType = hl;
            }
            fig.badge.visible = true;
            fig.badge.scale.setScalar(close ? 0.8 : 1.8);
            fig.badge.position.set(w.x, close ? 4.1 : 5.4, w.z);
          } else fig.badge.visible = false;
        }

        // câmera de transmissão acompanhando a bola
        if (camera === "close") {
          camTarget.lerp(new THREE.Vector3(bw.x - 4, 1, bw.z + 6), 0.08);
          camPos.lerp(new THREE.Vector3(bw.x - 14, 9, bw.z + 22), 0.06);
          cam.fov = 30;
        } else {
          // telas estreitas (celular): câmera mais perto para os bonecos continuarem legíveis
          const near = host.clientWidth < 640 ? 0.62 : 1;
          const fx = Math.max(-L / 2 + 14, Math.min(L / 2 - 14, bw.x));
          camTarget.lerp(new THREE.Vector3(fx, 0, bw.z * 0.7 + 2), 0.06);
          camPos.lerp(new THREE.Vector3(fx - 12 * near, 30 * near, 52 * near + bw.z * 0.6), 0.06);
          cam.fov = 34;
        }
        cam.updateProjectionMatrix();
        cam.position.copy(camPos);
        cam.lookAt(camTarget);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={ref} className="w-full overflow-hidden rounded-xl bg-[#0b1220]" style={{ aspectRatio: `${ASPECT}` }} />;
}
