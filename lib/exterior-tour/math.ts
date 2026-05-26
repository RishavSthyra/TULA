export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export const EPSILON = 1e-6;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

export function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scaleVec3(value: Vec3, scalar: number): Vec3 {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

export function negativeVec3(value: Vec3): Vec3 {
  return scaleVec3(value, -1);
}

export function dotVec3(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function dotPlanar(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y;
}

export function lengthPlanar(value: Vec3) {
  return Math.hypot(value.x, value.y);
}

export function distancePlanar(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalizePlanar(
  value: Vec3,
  fallback: Vec3 = vec3(1, 0, 0),
): Vec3 {
  const length = lengthPlanar(value);
  if (length < EPSILON) {
    return { ...fallback };
  }

  return {
    x: value.x / length,
    y: value.y / length,
    z: 0,
  };
}

export function perpendicularRight(value: Vec3) {
  return normalizePlanar({ x: value.y, y: -value.x, z: 0 }, vec3(0, -1, 0));
}

export function wrapAngleRad(value: number) {
  let wrapped = value;
  while (wrapped <= -Math.PI) wrapped += Math.PI * 2;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  return wrapped;
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
