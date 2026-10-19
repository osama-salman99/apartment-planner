import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WIDTH, DEPTH, ENTRANCE_X0, ENTRANCE_X1, IN_Z1 } from '../lib/dimensions';
import { walkInput } from './walkInput';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Eye height for a 172 cm person (standing eye level ≈ height − 12 cm).
const EYE_HEIGHT = 1.6;

/**
 * Where Walk starts: one step inside the front door, on its centre line, looking up the apartment
 * the way you actually see it when you come in off the gallery. There is no hall, so the door opens
 * straight into the living/kitchen — the whole flat is in front of you from here, which is exactly
 * the view worth judging a layout from. The initial yaw of π already faces -Z (the façade), i.e.
 * straight ahead from this door.
 *
 * WalkControls is keyed on the view mode in Scene, so it remounts on every entry into Walk and this
 * is the pose each time — leaving Walk and coming back puts you at the door again rather than
 * wherever you happened to stop.
 */
const ENTRY_POSE: [number, number, number] = [
  (ENTRANCE_X0 + ENTRANCE_X1) / 2,
  EYE_HEIGHT,
  IN_Z1 - 0.7,
];

/**
 * First-person controller. `free=false` (Walk): move at eye height on the floor plane, clamped to
 * the apartment footprint. `free=true` (Free): the same horizontal movement, but unclamped and with
 * height under your control — W/S/A/D travel on the plan, Space rises and C descends (E/Q are
 * aliases), no bounds, any perspective. Left-drag looks around in both. (Interior walls aren't
 * solid yet, so you can pass through them.)
 */
export function WalkControls({ free = false }: { free?: boolean }) {
  const { camera, gl } = useThree();
  const yaw = useRef(Math.PI); // face -Z (toward the windows) to start
  const pitch = useRef(free ? -0.35 : -0.03);
  const pos = useRef(
    free ? new THREE.Vector3(WIDTH / 2, 3.2, DEPTH + 3) : new THREE.Vector3(...ENTRY_POSE),
  );
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  // Free looks anywhere — straight down at the plan, straight up at the ceiling — so the pitch stops
  // just short of vertical. It stops SHORT rather than at exactly ±90° because lookAt degenerates
  // when the view direction is parallel to the camera's up vector, which snaps the roll at the pole.
  // Walk keeps a neck-shaped limit; it is meant to feel like standing in the room.
  const PITCH_LIMIT = free ? Math.PI / 2 - 0.01 : 1.2;

  useEffect(() => {
    const dom = gl.domElement;
    const typing = () => {
      const el = document.activeElement;
      return el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
    };
    const MOVE = /^(Key[WASDQCE]|Arrow(Up|Down|Left|Right)|Space)$/;
    const kd = (e: KeyboardEvent) => {
      if (typing()) return;
      keys.current[e.code] = true;
      if (MOVE.test(e.code)) e.preventDefault(); // stop Space/arrows scrolling the page
    };
    const ku = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const md = (e: MouseEvent) => {
      if (e.button === 0) {
        dragging.current = true;
        last.current = { x: e.clientX, y: e.clientY };
      }
    };
    const mu = () => {
      dragging.current = false;
    };
    const mm = (e: MouseEvent) => {
      if (!dragging.current) return;
      // Yaw is unbounded, so the view turns through a full 360° either way.
      yaw.current -= (e.clientX - last.current.x) * 0.005;
      // Standard (non-inverted) vertical look in both modes: drag up = look up.
      pitch.current = clamp(pitch.current - (e.clientY - last.current.y) * 0.005, -PITCH_LIMIT, PITCH_LIMIT);
      last.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    dom.addEventListener('mousedown', md);
    window.addEventListener('mouseup', mu);
    window.addEventListener('mousemove', mm);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      dom.removeEventListener('mousedown', md);
      window.removeEventListener('mouseup', mu);
      window.removeEventListener('mousemove', mm);
      keys.current = {};
    };
  }, [gl, PITCH_LIMIT]);

  useFrame((_, dt) => {
    const k = keys.current;
    const boost = k['ShiftLeft'] || k['ShiftRight'] ? 2.5 : 1;
    const step = (free ? 4 : 2.4) * boost * Math.min(dt, 0.05);
    const cp = Math.cos(pitch.current);
    // Forward is horizontal in BOTH modes: looking down and pressing W should not sink you through
    // the floor. Height is Space/C's job alone, which keeps "where am I" and "what am I looking at"
    // independent — the same split as a CAD orbit or a creative-mode flyer. Pitch still steers the
    // view, it just no longer steers the movement.
    const fwd = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    // Camera's true right axis (Y × -forward). Must be (-cos, 0, sin), not (cos, 0, -sin), or
    // left/right strafing — keyboard, arrows, and the on-screen pad alike — comes out mirrored.
    const right = new THREE.Vector3(-Math.cos(yaw.current), 0, Math.sin(yaw.current));
    if (k['KeyW'] || k['ArrowUp'] || walkInput.fwd) pos.current.addScaledVector(fwd, step);
    if (k['KeyS'] || k['ArrowDown'] || walkInput.back) pos.current.addScaledVector(fwd, -step);
    if (k['KeyD'] || k['ArrowRight'] || walkInput.right) pos.current.addScaledVector(right, step);
    if (k['KeyA'] || k['ArrowLeft'] || walkInput.left) pos.current.addScaledVector(right, -step);
    if (free) {
      if (k['KeyE'] || k['Space'] || walkInput.up) pos.current.y += step;
      if (k['KeyQ'] || k['KeyC'] || walkInput.down) pos.current.y -= step;
    } else {
      pos.current.x = clamp(pos.current.x, 0.2, WIDTH - 0.2);
      pos.current.z = clamp(pos.current.z, 0.2, DEPTH - 0.2);
      pos.current.y = EYE_HEIGHT;
    }
    camera.position.copy(pos.current);
    camera.lookAt(
      pos.current.x + Math.sin(yaw.current) * cp,
      pos.current.y + Math.sin(pitch.current),
      pos.current.z + Math.cos(yaw.current) * cp,
    );
  });

  return null;
}
