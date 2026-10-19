import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  ALL_DIMS,
  COMPACT_ROOMS,
  DIM_COLOR as COLOR,
  ROOM_AREAS,
  WALL_DIMS,
  cmLabel,
  type DimLine,
} from '../lib/dimensionLines';

const projected = new THREE.Vector3();

/**
 * Where a figure lands on screen, with a behind-the-camera guard.
 *
 * drei's default projection has none: a point behind you comes back with both axes mirrored, so
 * standing inside the flat in Walk or Free, the figures for the wall at your back would appear
 * pinned to the far edge of the screen, reading as if they measured whatever is in front of you.
 * Overlay modes never noticed because a top-down camera has nothing behind it. Pushing those labels
 * off-canvas is the cheapest correct fix, and it costs one dot product per label per frame.
 */
function projectAhead(
  el: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
): [number, number] {
  projected.setFromMatrixPosition(el.matrixWorld).project(camera);
  if (projected.z > 1) return [-99999, -99999];
  return [
    projected.x * (size.width / 2) + size.width / 2,
    -(projected.y * (size.height / 2)) + size.height / 2,
  ];
}

/**
 * The measuring overlay: every clear length in the apartment, drawn as proper dimension lines with
 * end ticks and a centimetre figure. Colour encodes what a line measures, so the drawing stays
 * readable when forty numbers are on screen at once.
 */

const LINE = 0.014; // drawn thickness of a dimension line
const TICK = 0.13; // length of the end ticks
const Y = 0.035; // just clear of the floor; depthTest is off so furniture never hides a figure

function DimensionMesh({ d }: { d: DimLine }) {
  const color = COLOR[d.kind];
  const len = d.to - d.from;
  const mid = (d.from + d.to) / 2;
  // The line is centred; the figure may sit off-centre along it (see DimLine.bias).
  const labelAlong = d.from + len * (d.bias ?? 0.5);
  const horizontal = d.axis === 'x';
  const pos: [number, number, number] = horizontal ? [mid, Y, d.at] : [d.at, Y, mid];
  const barArgs: [number, number, number] = horizontal ? [len, LINE, LINE] : [LINE, LINE, len];
  const tickArgs: [number, number, number] = horizontal ? [LINE, LINE, TICK] : [TICK, LINE, LINE];
  const ends: [number, number, number][] = horizontal
    ? [
        [d.from, Y, d.at],
        [d.to, Y, d.at],
      ]
    : [
        [d.at, Y, d.from],
        [d.at, Y, d.to],
      ];
  return (
    <group>
      <mesh position={pos} renderOrder={900}>
        <boxGeometry args={barArgs} />
        <meshBasicMaterial color={color} depthTest={false} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      {ends.map((p, i) => (
        <mesh key={i} position={p} renderOrder={900}>
          <boxGeometry args={tickArgs} />
          <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
      <Html
        position={horizontal ? [labelAlong, Y, pos[2] + (d.off ?? 0)] : [pos[0] + (d.off ?? 0), Y, labelAlong]}
        center
        transform={false}
        occlude={false}
        zIndexRange={[40, 0]}
        calculatePosition={projectAhead}
      >
        <span className={`dim-figure dim-${d.kind}`}>{d.label ?? cmLabel(len)}</span>
      </Html>
    </group>
  );
}

export function DimensionLayer() {
  return (
    <group>
      {ALL_DIMS.map((d, i) => (
        <DimensionMesh key={i} d={d} />
      ))}
      {COMPACT_ROOMS.map((r) => (
        <Html
          key={r.name}
          position={[r.x, Y, r.z]}
          center
          transform={false}
          occlude={false}
          zIndexRange={[40, 0]}
          calculatePosition={projectAhead}
        >
          <span className="dim-figure dim-room dim-compact">
            {r.w} × {r.d}
          </span>
        </Html>
      ))}
    </group>
  );
}

/**
 * One flat colour per room, laid over the floor — the wash the readout plate's area swatches key to.
 *
 * A patch per rectangle rather than per room, so the L-shaped bathroom gets both its parts in one
 * colour. It sits 4 mm above the floor and writes no depth, which keeps it under the snap grid and
 * stops it fighting the floor texture for the same pixels; furniture still shadows onto it normally.
 *
 * The swatches on the plate are this layer's key, so the colour that reaches the screen has to be
 * the colour in the legend. Two things were stopping that. The scene renders through ACES filmic
 * tone mapping at 1.25 exposure, which desaturates hard — that alone turned the blue living room
 * sage and the purple bedroom mauve — so this material opts out, exactly as the dimension lines do.
 * And at 0.34 the oak underneath pulled everything towards olive; 0.66 lets the grid and a hint of
 * grain through while each room still reads as the colour named beside its figure.
 */
export function RoomAreaLayer() {
  return (
    <group>
      {ROOM_AREAS.flatMap((room) =>
        room.rects.map((r) => (
          <mesh
            key={`${room.name}-${r.name}-${r.x1}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[(r.x1 + r.x2) / 2, 0.004, (r.z1 + r.z2) / 2]}
          >
            <planeGeometry args={[r.x2 - r.x1, r.z2 - r.z1]} />
            <meshBasicMaterial
              color={room.color}
              transparent
              opacity={0.66}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

/**
 * The wall overlay: each run's length and thickness. Its own component rather than a flag on
 * DimensionLayer, because it has its own toggle and the two can be shown independently.
 */
export function WallDimensionLayer() {
  return (
    <group>
      {WALL_DIMS.map((d, i) => (
        <DimensionMesh key={i} d={d} />
      ))}
    </group>
  );
}
