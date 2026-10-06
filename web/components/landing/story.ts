// Shared between the scroll engine (writes `t`) and the node field (reads it).
// t is the scroll position measured in scenes: 0 = top of scene 0, 1 = top of scene 1, and so on.
export const story = { t: 0 };

export interface FieldPose {
  x: number; // fraction of half the visible width, positive = right
  y: number; // fraction of half the visible height, positive = up
  scale: number;
  dim: number; // overall opacity of the field
  trip: number; // 0 = agent live, 1 = revoke landed
  spin: number; // extra rotation in radians
}

// One pose at the start of each scene, plus a final one. During scene i the field
// interpolates from POSES[i] to POSES[i + 1].
export const POSES: FieldPose[] = [
  { x: 0.38, y: 0, scale: 1.0, dim: 1, trip: 0, spin: 0 }, // hero
  { x: 0.38, y: 0, scale: 1.12, dim: 1, trip: 0, spin: 1.1 }, // watch
  { x: -0.42, y: 0.04, scale: 0.86, dim: 0.55, trip: 0, spin: 2.2 }, // decide
  { x: -0.42, y: 0, scale: 0.95, dim: 0.8, trip: 0, spin: 3.0 }, // act
  { x: 0.46, y: -0.04, scale: 0.62, dim: 0.34, trip: 1, spin: 3.6 }, // proof
  { x: 0, y: 0, scale: 1.5, dim: 0.2, trip: 1, spin: 4.2 }, // threat
  { x: 0, y: 0, scale: 1.3, dim: 0.28, trip: 1, spin: 4.7 }, // close
  { x: 0, y: 0, scale: 1.15, dim: 0.42, trip: 1, spin: 5.1 }, // end
];

const smooth = (v: number) => v * v * (3 - 2 * v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const window01 = (f: number, a: number, b: number) => smooth(Math.min(Math.max((f - a) / (b - a), 0), 1));

// Within a scene the field holds its pose while the text is read, then moves to the next pose
// near the end. The revoke in the Act scene lands earlier so it happens while its text is on screen.
const TRIP_WINDOW: Record<number, [number, number]> = { 3: [0.35, 0.7] };

export function poseAt(t: number): FieldPose {
  const clamped = Math.min(Math.max(t, 0), POSES.length - 1.0001);
  const i = Math.floor(clamped);
  const f = clamped - i;
  const k = window01(f, 0.8, 1);
  const [ta, tb] = TRIP_WINDOW[i] ?? [0.8, 1];
  const a = POSES[i];
  const b = POSES[i + 1];
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    scale: lerp(a.scale, b.scale, k),
    dim: lerp(a.dim, b.dim, k),
    trip: lerp(a.trip, b.trip, window01(f, ta, tb)),
    spin: lerp(a.spin, b.spin, k),
  };
}
