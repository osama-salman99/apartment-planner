import * as THREE from 'three';
import { cmToM } from '../lib/units';

/**
 * Shared upholstery construction for the fabric sofas — the quilted-puff grid, the bouclé texture
 * and the shading helper. Extracted from TrentinoSofa so the whole WoonSpot XXL range can be built
 * from one set of primitives instead of one component per model.
 */

/** Reveal between two puffs — this is what makes the quilting read at all. */
export const QUILT_GAP = 0.6;

export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/** Toward black rather than a darker shade of the fabric: a shadow gap, not a wooden pallet. */
export function plinthColor(hex: string): string {
  return `#${new THREE.Color(hex).lerp(new THREE.Color('#000000'), 0.72).getHexString()}`;
}

/**
 * Bouclé is a looped pile — flat colour reads as vinyl, and these sofas are nothing but
 * upholstery, so they need a fabric break-up. Drawn once into a canvas (fixed-seed PRNG, so it is
 * the same on every load) and shared by every puff; near-white, because it multiplies the item's
 * own colour.
 */
let boucleTexture: THREE.CanvasTexture | null = null;
export function boucle(): THREE.CanvasTexture | null {
  if (boucleTexture) return boucleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  let seed = 20260810;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4200; i++) {
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 1.4 + rnd() * 2.2, 0, Math.PI * 2);
    g.strokeStyle = rnd() > 0.45 ? 'rgba(255,255,255,0.85)' : 'rgba(196,188,175,0.32)';
    g.lineWidth = 1.1;
    g.stroke();
  }
  boucleTexture = new THREE.CanvasTexture(canvas);
  boucleTexture.wrapS = boucleTexture.wrapT = THREE.RepeatWrapping;
  boucleTexture.repeat.set(3, 3);
  return boucleTexture;
}

/** Cell centres (cm, in the region's own coordinates) for a run of `len` at roughly `cell` each. */
export function cells(len: number, cell: number): { at: number; size: number }[] {
  const n = Math.max(1, Math.round(len / cell));
  const size = len / n;
  return Array.from({ length: n }, (_, i) => ({ at: i * size + size / 2, size }));
}

export interface Puff {
  key: string;
  args: [number, number, number];
  position: [number, number, number];
}

/** A clear volume in the item's own cm coordinates, to be filled with upholstery. */
export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

/**
 * One upholstered volume, quilted: filled with puffs on a grid across X/Z and in `rows` courses
 * up its height. Sizes in cm; the caller gives the box's clear extents and this fills it. A cell
 * larger than the box gives exactly one puff, which is how "tight" upholstery is expressed.
 */
export function quilt(
  key: string,
  box: Box,
  cellX: number,
  cellZ: number,
  rows: number,
): Puff[] {
  const out: Puff[] = [];
  if (box.x1 <= box.x0 || box.z1 <= box.z0 || box.y1 <= box.y0) return out;
  const xs = cells(box.x1 - box.x0, cellX);
  const zs = cells(box.z1 - box.z0, cellZ);
  const rowH = (box.y1 - box.y0) / rows;
  xs.forEach((cx, i) =>
    zs.forEach((cz, j) => {
      for (let r = 0; r < rows; r++) {
        out.push({
          key: `${key}-${i}-${j}-${r}`,
          args: [
            cmToM(cx.size - QUILT_GAP),
            cmToM(rowH - QUILT_GAP),
            cmToM(cz.size - QUILT_GAP),
          ],
          position: [
            cmToM(box.x0 + cx.at),
            cmToM(box.y0 + r * rowH + rowH / 2),
            cmToM(box.z0 + cz.at),
          ],
        });
      }
    }),
  );
  return out;
}
