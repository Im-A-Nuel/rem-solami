"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { poseAt, POSES, story, type FieldPose } from "./story";

const ACCENT = new THREE.Color("#4dd4ec");
const DANGER = new THREE.Color("#ef6a5e");
const EDGE_COOL = new THREE.Color("#7f97a8");

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(120,235,255,0.95)");
  grad.addColorStop(0.25, "rgba(77,212,236,0.38)");
  grad.addColorStop(1, "rgba(77,212,236,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/**
 * The network sphere: nodes are watched accounts and transactions, lines are the streams
 * between them, the lit core is the agent being guarded. When the panic transaction lands
 * (story pose `trip`), the lines that reached the core are severed and the pulse stops.
 */
export default function NodeField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      setFallback(true);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = () => window.innerWidth / window.innerHeight < 0.9;
    const nodeCount = window.innerWidth < 700 ? 58 : 88;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.z = 8;

    const root = new THREE.Group();
    scene.add(root);

    // Lights: one cool point light at the core gives the nodes a rim, one weak fill.
    const coreLight = new THREE.PointLight(0x4dd4ec, 9, 9, 1.6);
    root.add(coreLight);
    scene.add(new THREE.AmbientLight(0x6f8aa0, 0.35));
    const fill = new THREE.DirectionalLight(0xa9cde0, 0.55);
    fill.position.set(3, 4, 5);
    scene.add(fill);

    // Node layout: a loose shell plus scattered outliers, seeded so it is stable between loads.
    const rand = rng(7);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const outlier = rand() < 0.2;
      const r = outlier ? 2.5 + rand() * 1.0 : 1.35 + rand() * 1.15;
      pts.push(new THREE.Vector3(s * Math.cos(phi) * r, u * r, s * Math.sin(phi) * r));
    }

    // Edges: three nearest neighbours each, plus a few long crossing links.
    const edgeKey = new Set<string>();
    const edges: [number, number][] = [];
    const addEdge = (a: number, b: number) => {
      const k = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (a === b || edgeKey.has(k)) return;
      edgeKey.add(k);
      edges.push([a, b]);
    };
    pts.forEach((p, i) => {
      pts
        .map((q, j) => ({ j, d: p.distanceToSquared(q) }))
        .filter((o) => o.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 3)
        .forEach((o) => addEdge(i, o.j));
    });
    for (let i = 0; i < Math.floor(nodeCount / 4); i++) {
      addEdge(Math.floor(rand() * nodeCount), Math.floor(rand() * nodeCount));
    }

    const linePos = new Float32Array(edges.length * 6);
    const lineCol = new Float32Array(edges.length * 8);
    // Per edge: base alpha from distance to the core, and whether the revoke severs it.
    const baseAlpha: number[] = [];
    const nearCore: number[] = [];
    const severed: boolean[] = [];
    edges.forEach(([a, b], e) => {
      const pa = pts[a];
      const pb = pts[b];
      linePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], e * 6);
      const mid = Math.min(pa.length(), pb.length());
      baseAlpha.push(Math.min(0.6, Math.max(0.1, 0.62 - mid * 0.14)));
      nearCore.push(Math.max(0, 1 - mid / 2.4));
      severed.push(mid < 1.9 && rand() < 0.7);
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 4));
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
    );
    root.add(lines);

    const tmp = new THREE.Color();
    const paintEdges = (trip: number) => {
      const flash = Math.sin(Math.PI * trip);
      edges.forEach((_, e) => {
        const cut = severed[e];
        tmp.copy(EDGE_COOL).lerp(ACCENT, nearCore[e] * 0.85);
        if (cut) tmp.lerp(DANGER, flash * 0.9);
        const alpha = baseAlpha[e] * (cut ? 1 - trip : 1);
        for (let v = 0; v < 2; v++) {
          lineCol.set([tmp.r, tmp.g, tmp.b, alpha], e * 8 + v * 4);
        }
      });
      lineGeo.attributes.color.needsUpdate = true;
    };
    paintEdges(0);

    // Nodes
    const nodeGeo = new THREE.SphereGeometry(1, 20, 14);
    const nodes = new THREE.InstancedMesh(
      nodeGeo,
      new THREE.MeshStandardMaterial({ color: 0x0c1218, metalness: 0.4, roughness: 0.32 }),
      nodeCount,
    );
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => {
      const r = 0.05 + rand() * 0.07;
      m.compose(p, new THREE.Quaternion(), new THREE.Vector3(r, r, r));
      nodes.setMatrixAt(i, m);
    });
    root.add(nodes);

    // Core: a faceted glass-like body. Bright rim, deep centre, per-facet shading from flat normals.
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uInner: { value: new THREE.Color("#0b6f86") },
        uRim: { value: new THREE.Color("#d9fbff") },
        uHeat: { value: 0 },
        uLevel: { value: 1 },
      },
      vertexShader: `
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uInner; uniform vec3 uRim; uniform float uHeat; uniform float uLevel;
        varying vec3 vView;
        void main() {
          vec3 fn = normalize(cross(dFdx(vView), dFdy(vView)));
          float facing = abs(dot(fn, normalize(vView)));
          float rim = pow(1.0 - facing, 1.6);
          float facet = 0.72 + 0.28 * dot(fn, normalize(vec3(0.4, 0.8, 0.6)));
          vec3 hot = vec3(0.94, 0.42, 0.37);
          vec3 inner = mix(uInner, hot * 0.7, uHeat);
          vec3 rimCol = mix(uRim, hot, uHeat * 0.8);
          vec3 col = mix(inner * facet, rimCol, rim * 0.9) * uLevel;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), coreMat);
    const cage = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.74, 1)),
      new THREE.LineBasicMaterial({ color: 0xcdeaf5, transparent: true, opacity: 0.38 }),
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    glow.scale.setScalar(3.4);
    root.add(core, cage, glow);

    const cur: FieldPose = { ...POSES[0] };
    let lastTrip = -1;
    let halfW = 1;
    let halfH = 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, w < 700 ? 1.5 : 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      halfW = halfH * camera.aspect;
    };
    resize();
    window.addEventListener("resize", resize);

    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    const apply = (time: number, tilt: THREE.Vector2) => {
      const n = narrow();
      const x = n ? cur.x * 0.28 : cur.x;
      const y = n ? cur.y + 0.2 : cur.y;
      const s = n ? cur.scale * 0.78 : cur.scale;
      root.position.set(x * halfW, y * halfH, 0);
      root.scale.setScalar(s);
      root.rotation.y = time * 0.05 + cur.spin + tilt.x;
      root.rotation.x = 0.18 + tilt.y;

      const live = 1 - cur.trip;
      const pulse = 1 + Math.sin(time * 1.3) * 0.07 * live;
      glow.scale.setScalar(3.4 * pulse * (0.7 + 0.3 * live));
      (glow.material as THREE.SpriteMaterial).opacity = cur.dim * (0.35 + 0.65 * live);
      coreMat.uniforms.uLevel.value = (0.42 + 0.78 * live) * pulse;
      coreMat.uniforms.uHeat.value = Math.sin(Math.PI * cur.trip) * 0.9;
      coreLight.intensity = 9 * (0.3 + 0.7 * live) * cur.dim;
      (lines.material as THREE.LineBasicMaterial).opacity = cur.dim;
      (cage.material as THREE.LineBasicMaterial).opacity = 0.38 * cur.dim;
      (nodes.material as THREE.MeshStandardMaterial).opacity = 1;
      nodes.visible = cur.dim > 0.02;

      if (Math.abs(cur.trip - lastTrip) > 0.004) {
        paintEdges(cur.trip);
        lastTrip = cur.trip;
      }
      renderer.render(scene, camera);
    };

    const tilt = new THREE.Vector2();
    let raf = 0;
    let prev = performance.now();
    let time = 0;
    let running = true;

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      time += dt;
      const target = poseAt(story.t);
      const k = 1 - Math.exp(-dt * 4.5);
      (Object.keys(target) as (keyof FieldPose)[]).forEach((key) => {
        cur[key] += (target[key] - cur[key]) * k;
      });
      tilt.x += (pointer.x * 0.2 - tilt.x) * k;
      tilt.y += (pointer.y * 0.12 - tilt.y) * k;
      apply(time, tilt);
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      apply(0, tilt);
      const redraw = () => apply(0, tilt);
      window.addEventListener("resize", redraw);
      return () => {
        window.removeEventListener("resize", redraw);
        window.removeEventListener("resize", resize);
        renderer.dispose();
      };
    }

    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        prev = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      lineGeo.dispose();
      nodeGeo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
        style={{ display: fallback ? "none" : "block" }}
      />
      {fallback && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(38% 48% at 70% 50%, rgba(77,212,236,0.22), rgba(77,212,236,0) 70%)",
          }}
        />
      )}
    </>
  );
}
