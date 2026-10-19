import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import {
  WALLS,
  WALL_THICKNESS,
  CEILING_HEIGHT,
  WIDTH,
  DEPTH,
  BEDROOM_SOUTH_Z,
  BATH_WEST_X,
  CUPBOARD_NORTH_Z,
  GLAZED_WINDOWS,
  GLAZED_DOOR_HEIGHT,
  WINDOW_SILL,
  ROOM_LABELS,
  WALL_LABELS,
  SOLID_VOIDS,
  DOORS,
  DOOR_OPENINGS,
  WINDOW_OPENINGS,
  type GlazedWindow,
  type DoorLeaf,
} from '../lib/dimensions';
import { OAK_TILE_M, sharedTextures } from '../lib/textures';
import { FixedFixtures } from './FixedFixtures';
import { useLayoutStore } from '../state/layoutStore';

// World-space helper: the plan's (x, z) in meters map directly to Three's (x, z); y is up.
function wallMesh(seg: (typeof WALLS)[number], key: number, texture: THREE.Texture) {
  const isVertical = Math.abs(seg.x1 - seg.x2) < 1e-6;
  const length = isVertical ? Math.abs(seg.z2 - seg.z1) : Math.abs(seg.x2 - seg.x1);
  if (length < 0.01) return null;
  const midX = (seg.x1 + seg.x2) / 2;
  const midZ = (seg.z1 + seg.z2) / 2;
  // Walls carry their real thickness: 250 for the external and party walls, 70 for partitions.
  const t = seg.t ?? WALL_THICKNESS;
  const w = isVertical ? t : length + t;
  const d = isVertical ? length + t : t;
  return (
    <mesh key={key} position={[midX, CEILING_HEIGHT / 2, midZ]} castShadow receiveShadow>
      <boxGeometry args={[w, CEILING_HEIGHT, d]} />
      <meshStandardMaterial map={texture} roughness={0.8} />
    </mesh>
  );
}

/** A punched window — glass pane + dark frame — in either the north wall (axis 'x') or a side wall
 * (axis 'z'). Sits from the sill up to GLAZED_DOOR_HEIGHT; the wall header above is drawn as a
 * lintel. These are windows, not doors: there is no balcony (the railings in the photos are
 * French/Juliet railings). */
function GlazedWindowMesh({ win }: { win: GlazedWindow }) {
  const frameColor = '#1c1e22';
  const w = win.to - win.from;
  const sill = win.sill ?? WINDOW_SILL;
  const head = GLAZED_DOOR_HEIGHT;
  // A raised sill gets a projecting board you can stand things on (the bedroom windows); a
  // near-floor one is a French window, which outside has a Juliet railing instead.
  const hasSillBoard = sill > 0.25;
  const h = head - sill;
  const midRun = (win.from + win.to) / 2;
  const midY = (sill + head) / 2;
  // Position + orientation depend on which wall the window is in.
  const pos: [number, number, number] = win.axis === 'x' ? [midRun, 0, win.at] : [win.at, 0, midRun];
  const rotY = win.axis === 'x' ? 0 : Math.PI / 2; // side-wall windows face along ±X
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {/* glass pane — plain transparent material, not `transmission` (relies on a back-buffer
          sample that software-rendered / older-GPU contexts can render as solid black) */}
      <mesh position={[0, midY, 0]}>
        <planeGeometry args={[w - 0.08, h - 0.08]} />
        <meshPhysicalMaterial color="#dceaf5" roughness={0.08} metalness={0} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* frame: head and sill rails */}
      <mesh position={[0, head - 0.02, 0]}>
        <boxGeometry args={[w, 0.05, 0.08]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, sill + 0.02, 0]}>
        <boxGeometry args={[w, 0.05, 0.08]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} />
      </mesh>
      {[-w / 2, w / 2].map((x, i) => (
        <mesh key={i} position={[x, midY, 0]}>
          <boxGeometry args={[0.05, h, 0.08]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {/* mullion */}
      <mesh position={[0, midY, 0]}>
        <boxGeometry args={[0.04, h, 0.06]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.3} />
      </mesh>
      {/* spandrel below the sill */}
      <mesh position={[0, sill / 2, 0]}>
        <boxGeometry args={[w, sill, WALL_THICKNESS]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.85} />
      </mesh>
      {hasSillBoard && (
        <mesh position={[0, sill, 0.11]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.06, 0.04, 0.26]} />
          <meshStandardMaterial color="#f4f2ec" roughness={0.6} />
        </mesh>
      )}
      {!hasSillBoard && (
        <group position={[0, 0, -0.14]}>
          {[1.02, 0.68, 0.34].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <boxGeometry args={[w + 0.1, 0.03, 0.03]} />
              <meshStandardMaterial color="#4a4d52" roughness={0.5} metalness={0.4} />
            </mesh>
          ))}
          {[-w / 2, w / 2].map((x, i) => (
            <mesh key={`p${i}`} position={[x, 0.53, 0]}>
              <boxGeometry args={[0.04, 1.06, 0.04]} />
              <meshStandardMaterial color="#4a4d52" roughness={0.5} metalness={0.4} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** A hinged door leaf, slightly ajar — plain white flush door with a chrome handle, matching
 * the unit's interior doors. */
function DoorLeafMesh({ door }: { door: DoorLeaf }) {
  const { hx, hz, w, rot, sliding } = door;
  const h = sliding ? 2.1 : 2.05;
  // A sliding door sits on a track roughly centred on the divider; it lives in its own opening
  // (no wall behind), so it needs only a hair of offset — a big offset made it read as a slab
  // stuck proud of the wall.
  const depthOffset = sliding ? 0.02 : 0;
  return (
    <group position={[hx + depthOffset, 0, hz]} rotation={[0, rot, 0]}>
      <mesh position={[w / 2, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.04]} />
        <meshStandardMaterial color="#f0ede6" roughness={0.55} />
      </mesh>
      {/* handle: a flush pull for the slider, a lever for a hinged leaf */}
      {sliding ? (
        <mesh position={[w - 0.12, 1.05, 0.03]}>
          <boxGeometry args={[0.02, 0.28, 0.02]} />
          <meshStandardMaterial color="#b9bcc0" metalness={0.7} roughness={0.3} />
        </mesh>
      ) : (
        <mesh position={[w - 0.09, 1.05, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.03, 0.03]} />
          <meshStandardMaterial color="#b9bcc0" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

export function ApartmentShell() {
  const tex = sharedTextures();
  const viewMode = useLayoutStore((s) => s.viewMode);
  const hideWalls = useLayoutStore((s) => s.hideWalls);
  const showCeiling = useLayoutStore((s) => s.showCeiling);
  const showWallLabels = useLayoutStore((s) => s.showWallLabels);
  const showLabels = useLayoutStore((s) => s.showLabels);
  const showDimensions = useLayoutStore((s) => s.showDimensions);

  // One sheet of the plank texture covers a known patch of real floor, so the repeat is derived from
  // the room rather than eyeballed — get this wrong and the boards come out the wrong width.
  const oakFloor = useMemo(() => {
    const scale = (src: THREE.Texture) => {
      const t = src.clone();
      t.repeat.set(WIDTH / OAK_TILE_M.w, DEPTH / OAK_TILE_M.d);
      t.needsUpdate = true;
      return t;
    };
    return { color: scale(tex.oak), bump: scale(tex.oakBump) };
  }, [tex.oak, tex.oakBump]);

  const wallTex = useMemo(() => {
    const t = tex.wall.clone();
    t.needsUpdate = true;
    return t;
  }, [tex.wall]);

  return (
    <group>
      {/* main oak floor: bedroom + lounge + kitchen + the storage/electricity closets */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[WIDTH / 2, 0, DEPTH / 2]} receiveShadow>
        <planeGeometry args={[WIDTH, DEPTH]} />
        {/* Satin-matte with a shallow emboss: the photo shows a soft sheen band near the window but
            no mirror reflection, and the surface texture is felt rather than seen. */}
        <meshStandardMaterial
          map={oakFloor.color}
          bumpMap={oakFloor.bump}
          bumpScale={0.35}
          roughness={0.62}
          metalness={0}
        />
      </mesh>

      {/* Tiled floor across the whole bathroom block — bathroom, WC and utility — from the
          bedroom's head wall to the back of the gallery-entered meter cupboards. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          (BATH_WEST_X + 0.035 + 5.7) / 2,
          0.002,
          (BEDROOM_SOUTH_Z + 0.035 + CUPBOARD_NORTH_Z - 0.05) / 2,
        ]}
        receiveShadow
      >
        <planeGeometry args={[5.7 - BATH_WEST_X - 0.035, CUPBOARD_NORTH_Z - 0.05 - BEDROOM_SOUTH_Z - 0.035]} />
        <meshStandardMaterial map={tex.tile} roughness={0.35} />
      </mesh>

      {/* Ceiling — on by default. Its single face points down into the room, so it is only ever
          drawn from inside: the overhead 3D/plan cameras look at a culled backface and see straight
          through to the floor, while a walk-through gets a real ceiling overhead. It casts no
          shadow, so having it on doesn't darken the flat either. */}
      {showCeiling && (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[WIDTH / 2, CEILING_HEIGHT, DEPTH / 2]}
          receiveShadow
        >
          <planeGeometry args={[WIDTH, DEPTH]} />
          <meshStandardMaterial color="#f2efe9" roughness={0.95} />
        </mesh>
      )}

      {/* Walls, lintels, and door leaves — hidden when "Hide walls" is on for an unobstructed
          doll-house view of the floor and furniture. The glazed doors (windows) stay so the
          window line and outdoor view remain readable. */}
      {!hideWalls && WALLS.map((seg, i) => wallMesh(seg, i, wallTex))}

      {/* The two voids, filled solid to the ceiling: the 200 soil-stack strip behind the toilet and
          the sealed 900 × 675 shaft. Neither can be entered or used, and drawn as tiled floor they
          looked like two small rooms left unfitted. Grouped with the walls so "Hide walls" opens
          them up along with everything else. */}
      {!hideWalls &&
        SOLID_VOIDS.map((v) => (
          <mesh
            key={`void-${v.name}`}
            position={[(v.x1 + v.x2) / 2, CEILING_HEIGHT / 2, (v.z1 + v.z2) / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[v.x2 - v.x1, CEILING_HEIGHT, v.z2 - v.z1]} />
            <meshStandardMaterial map={wallTex} roughness={0.8} />
          </mesh>
        ))}

      {/* Wall headers (lintels) above every door and window — the wall continues from the top
          of the opening up to the ceiling. */}
      {!hideWalls &&
        [...DOOR_OPENINGS, ...WINDOW_OPENINGS].map((o, i) => {
          const len = o.to - o.from;
          const mid = (o.from + o.to) / 2;
          const hh = CEILING_HEIGHT - o.headY;
          const yy = o.headY + hh / 2;
          const pos: [number, number, number] = o.axis === 'z' ? [o.at, yy, mid] : [mid, yy, o.at];
          const ot = o.t ?? WALL_THICKNESS;
          const size: [number, number, number] =
            o.axis === 'z' ? [ot, hh, len + ot] : [len + ot, hh, ot];
          return (
            <mesh key={`lintel-${i}`} position={pos} castShadow receiveShadow>
              <boxGeometry args={size} />
              <meshStandardMaterial map={wallTex} roughness={0.8} />
            </mesh>
          );
        })}

      {GLAZED_WINDOWS.map((w, i) => (
        <GlazedWindowMesh key={i} win={w} />
      ))}

      {!hideWalls &&
        DOORS.map((d, i) => (
          <DoorLeafMesh key={i} door={d} />
        ))}

      <FixedFixtures />

      {/* Room names are off unless asked for — the rooms read from their own shape, and nine labels
          sat on top of the furniture. Still suppressed while Dimensions is on, where the figures
          need the room. */}
      {showLabels && !showDimensions && (viewMode === 'orbit' || viewMode === 'plan') && ROOM_LABELS.map((r) => (
        <Html key={r.name} position={[r.x, 0.02, r.z]} center transform={false} occlude={false}>
          <div
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(232,234,237,0.55)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {r.name}
          </div>
        </Html>
      ))}

      {showWallLabels && (viewMode === 'orbit' || viewMode === 'plan') && WALL_LABELS.map((w) => (
        <Html key={w.name} position={[w.x, 0.02, w.z]} center transform={false} occlude={false}>
          <div
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(214,138,76,0.85)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {w.name}
          </div>
        </Html>
      ))}
    </group>
  );
}
