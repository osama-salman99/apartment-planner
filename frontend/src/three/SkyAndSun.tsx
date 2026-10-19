import { useMemo, useRef } from 'react';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { useLayoutStore } from '../state/layoutStore';
import { WIDTH, DEPTH } from '../lib/dimensions';

const CENTER = new THREE.Vector3(WIDTH / 2, 1.2, DEPTH / 2);

function sunDirection(azimuthDeg: number, hourOfDay: number): THREE.Vector3 {
  // Amsterdam summer daylight: sunrise ~5:20, sunset ~21:50, solar noon elevation ~59°. So at
  // 18:00 in July the sun is still well up (~30°), not near the horizon.
  const t = THREE.MathUtils.clamp((hourOfDay - 5.3) / 16.5, 0, 1);
  const elevationDeg = Math.max(2, Math.sin(Math.PI * t) * 55);
  const az = THREE.MathUtils.degToRad(azimuthDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

export function SkyAndSun({ sky = true }: { sky?: boolean }) {
  const sun = useLayoutStore((s) => s.sun);
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.copy(CENTER);
    return obj;
  }, []);

  const dir = useMemo(() => sunDirection(sun.azimuthDeg, sun.hourOfDay), [sun.azimuthDeg, sun.hourOfDay]);
  const sunPos = useMemo(() => dir.clone().multiplyScalar(80).add(CENTER), [dir]);
  const lightPos = useMemo(() => dir.clone().multiplyScalar(12).add(CENTER), [dir]);

  const clear = 1 - sun.cloudiness;
  // The sun (which reaches the interior only through the window openings, casting real shadows)
  // is the dominant light; keep the flat sky fill low so the room is lit FROM the windows rather
  // than uniformly. A little fill remains so shadowed corners aren't pure black and the outdoor
  // facades stay readable.
  const sunIntensity = 1.6 + clear * 2.4;
  const ambientIntensity = 0.42 + sun.cloudiness * 0.5;
  const turbidity = 2 + sun.cloudiness * 14;

  return (
    <>
      {sky && <Sky sunPosition={sunPos.toArray()} turbidity={turbidity} rayleigh={1.2} mieCoefficient={0.008} mieDirectionalG={0.85} />}
      <hemisphereLight args={['#dceaf7', '#8a8272', ambientIntensity]} />
      <primitive object={target} />
      <directionalLight
        ref={lightRef}
        position={lightPos}
        target={target}
        intensity={sunIntensity}
        color={sun.cloudiness > 0.5 ? '#dfe6ec' : '#fff2df'}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-4.6}
        shadow-camera-right={4.6}
        shadow-camera-top={5.2}
        shadow-camera-bottom={-5.2}
        shadow-bias={-0.0004}
        shadow-normalBias={0.08}
      />
    </>
  );
}
