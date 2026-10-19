import * as THREE from 'three';

// Small procedural textures so the shell reads as "light oak floor / gray tile / white walls"
// (the real 360° tour's actual finishes) without shipping external image assets.

function canvas(size = 256): [HTMLCanvasElement, CanvasRenderingContext2D] {
  return canvasOf(size, size);
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

/**
 * Deterministic RNG, so a plank drawn twice comes out identical.
 *
 * That is what makes the sheet tile: the board that overhangs the bottom edge has to be the same
 * board that pokes in at the top, grain and all, and with Math.random it never would be.
 */
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A sheet has to cover enough floor that you don't read its repeat. At 10 × 2 boards the sheet was
// 1.89 m across, so the same run of board tones came round three times in the width of the flat and
// the dollhouse view showed vertical stripes; 13 × 3 pushes one sheet to 2.46 × 3.66 m, which is
// about two repeats across the widest room and one and a half down its length.
const PLANKS_ACROSS = 13;
const PLANKS_DOWN = 3;
/** How much real floor one sheet of the texture covers — the caller derives `repeat` from this. */
export const OAK_TILE_M = { w: 0.189 * PLANKS_ACROSS, d: 1.22 * PLANKS_DOWN };

/**
 * Board tones. The spread between planks in the photo is a few percent, so these sit close together
 * on purpose — a wide spread reads as reclaimed timber, which this floor is emphatically not. They
 * are all warm too: the first set had a greyer and a pinker tone in it, and because the tone is
 * constant down a whole board those two showed up as odd-coloured stripes rather than as variety.
 *
 * The hue is set by measurement, not taste. Sampling the shaded floor in the render against the same
 * patch of a photo of the empty flat matched on brightness and saturation but sat at 37° against the photo's 26° —
 * yellow-olive where the real floor is orange-brown — so each tone lost about ten points of green.
 */
const PLANK_TONES = ['#c39b7b', '#bd9574', '#c7a082', '#ba9170', '#c09877', '#c59e7f'];

/**
 * The floor: 1220 × 189 wood-look plank, laid along the length of the flat.
 *
 * Read off a photo of the flat empty, which shows the floor better
 * than anything else available — and shows four things the old procedural oak had wrong:
 *   - end joints are STAGGERED board by board, not one straight line across the room every 650 mm,
 *     which is what made the old floor read as tiling;
 *   - the seams are barely there. A faint tonal step with a micro-bevel catching light, not the
 *     dark groove the old one stroked at 35% opacity;
 *   - grain is long, soft and wavy down the board with the odd small knot, all very low contrast;
 *   - boards are 189 wide, not the 340 the old scale worked out to.
 * The surface is embossed rather than glossy, so it speckles instead of reflecting cleanly — hence
 * the noise layer and the bump map, and satin-matte roughness at the mesh.
 *
 * The plank SIZE is the standard 1220 × 189 for this product class rather than a measurement: both
 * ways of getting a real figure off these images failed (see the photo README — the splashback grout
 * lines and the plank seams are both below the recompression noise floor). It is consistent with
 * what the photo shows, which is a board around six and a half times longer than it is wide.
 */
export function makeOakFloor(): { color: THREE.Texture; bump: THREE.Texture } {
  const W = 1280;
  const PL = 636; // one board length, at the same texels-per-metre as the board width
  const H = PL * PLANKS_DOWN;
  const pw = W / PLANKS_ACROSS;

  const [colorCanvas, cx] = canvasOf(W, H);
  const [bumpCanvas, bx] = canvasOf(W, H);
  bx.fillStyle = '#808080'; // mid grey = flush with the surface
  bx.fillRect(0, 0, W, H);

  // Where each course starts. A real install keeps every joint well clear of its neighbours', and
  // quantising to 32 px (~76 mm) stops a board ending in a sliver.
  const offs: number[] = [];
  for (let i = 0; i < PLANKS_ACROSS; i++) {
    const r = rng(1000 + i * 31);
    let o = 0;
    for (let tries = 0; tries < 40; tries++) {
      o = (Math.round((r() * PL) / 32) * 32) % PL;
      const prev = offs[i - 1];
      if (prev === undefined) break;
      const gap = (o - prev + PL) % PL;
      if (gap > PL * 0.22 && gap < PL * 0.78) break;
    }
    offs.push(o);
  }

  const drawBoard = (ctx: CanvasRenderingContext2D, mode: 'color' | 'bump', i: number, k: number) => {
    // Seeded on the course index modulo the sheet, so the board hanging off the bottom edge is the
    // same board that appears at the top.
    const r = rng(i * 9176 + (((k % PLANKS_DOWN) + PLANKS_DOWN) % PLANKS_DOWN) * 7919 + 17);
    const x0 = i * pw;
    const y0 = offs[i] + k * PL;

    if (mode === 'color') {
      ctx.fillStyle = PLANK_TONES[Math.floor(r() * PLANK_TONES.length)];
      ctx.fillRect(x0, y0, pw + 1, PL);
    } else {
      r(); // keep both passes on the same sequence
    }

    // Grain: BROAD, soft, wandering bands down the board — oak's figure, not a bundle of fibres.
    // A first pass of very wide, almost invisible bands lays down the cathedral pattern; a second of
    // narrower ones gives it edges. Both stay within a few percent of the board's tone: a strong
    // grain is what made an earlier attempt read as bamboo.
    const bands = 3 + Math.floor(r() * 3);
    const streaks = 8 + Math.floor(r() * 5);
    for (let g = 0; g < bands + streaks; g++) {
      const broad = g < bands;
      const gx = x0 + pw * (0.05 + r() * 0.9);
      const light = r() > 0.5;
      const width = broad ? 26 + r() * 34 : 5 + r() * 16;
      const alpha = (broad ? 0.018 : 0.03) + r() * (broad ? 0.02 : 0.035);
      // A wide sideways wander is what turns a stroke into figure rather than a line.
      const w1 = (r() - 0.5) * pw * 1.3;
      const w2 = (r() - 0.5) * pw * 1.3;
      ctx.strokeStyle =
        mode === 'color'
          ? light
            ? `rgba(255,236,208,${alpha * 0.8})`
            : `rgba(104,74,46,${alpha * 1.2})`
          : light
            ? `rgba(255,255,255,${alpha * 1.4})`
            : `rgba(0,0,0,${alpha * 1.4})`;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, y0 - 8);
      ctx.bezierCurveTo(gx + w1, y0 + PL * 0.35, gx + w2, y0 + PL * 0.68, gx + w1 * 0.3, y0 + PL + 8);
      ctx.stroke();
    }

    // A knot on roughly one board in three, small and soft. Any more and they read as a pattern of
    // beans rather than the occasional flaw the photo shows.
    if (r() < 0.34) {
      const kx = x0 + pw * (0.25 + r() * 0.5);
      const ky = y0 + PL * (0.1 + r() * 0.8);
      const kr = 1.6 + r() * 1.8;
      ctx.save();
      ctx.translate(kx, ky);
      ctx.scale(1, 2.4 + r());
      ctx.beginPath();
      ctx.arc(0, 0, kr, 0, Math.PI * 2);
      ctx.fillStyle = mode === 'color' ? 'rgba(88,62,38,0.17)' : 'rgba(0,0,0,0.22)';
      ctx.fill();
      ctx.restore();
    }

    // End joint at the head of the board: a hairline, plus the bevel highlight just past it.
    ctx.fillStyle = mode === 'color' ? 'rgba(92,66,44,0.16)' : 'rgba(0,0,0,0.55)';
    ctx.fillRect(x0, y0, pw + 1, 1);
    ctx.fillStyle = mode === 'color' ? 'rgba(255,248,236,0.10)' : 'rgba(255,255,255,0.16)';
    ctx.fillRect(x0, y0 + 1, pw + 1, 1);
  };

  for (const [ctx, mode] of [
    [cx, 'color'],
    [bx, 'bump'],
  ] as const) {
    for (let i = 0; i < PLANKS_ACROSS; i++) {
      for (let k = -1; k <= PLANKS_DOWN; k++) drawBoard(ctx, mode, i, k);
    }
    // Side seams run the whole sheet — a hairline shadow with the next board's bevel catching light
    // beside it. This is the pair that reads as a joint in the photo; a single dark line reads as a
    // gap, which a click floor does not have.
    for (let i = 0; i < PLANKS_ACROSS; i++) {
      const x = i * pw;
      ctx.fillStyle = mode === 'color' ? 'rgba(88,62,42,0.20)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, 0, 1, H);
      ctx.fillStyle = mode === 'color' ? 'rgba(255,248,236,0.12)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 1, 0, 1, H);
    }
  }

  // The embossed grain: fine speckle over everything, so the floor scatters light instead of
  // reflecting it. Drawn as a small noise tile rather than a million-pixel pass.
  const [noise, nx] = canvasOf(128, 128);
  const img = nx.createImageData(128, 128);
  const nr = rng(4242);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = 128 + (nr() - 0.5) * 180;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  for (const [ctx, alpha] of [
    [cx, 0.05],
    [bx, 0.22],
  ] as const) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = 0; y < H; y += 128) for (let x = 0; x < W; x += 128) ctx.drawImage(noise, x, y);
    ctx.restore();
  }

  const finish = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // A floor is seen at grazing angles more than anything else in the scene; without this the far
    // half of the room blurs into a smear and no amount of texture detail survives.
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { color: finish(colorCanvas, true), bump: finish(bumpCanvas, false) };
}

export function makeTileTexture(hex = '#9aa0a6', grout = '#7a8086', size = 64): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = hex;
  const gap = 3;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      ctx.fillRect(x + gap / 2, y + gap / 2, size - gap, size - gap);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeWallTexture(): THREE.Texture {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = '#f3f1eb';
  ctx.fillRect(0, 0, 128, 128);
  const img = ctx.getImageData(0, 0, 128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Kitchen splashback: plain WHITE 150 × 150 tiles in a STACK bond — joints aligned both ways — with
 * a thin warm-grey grout, four rows filling the 600 between worktop and wall units.
 *
 * Read off the empty-flat photo, which is much sharper than the walkthrough frames: the joints line
 * up vertically as well as horizontally and the tiles measure square, four rows to the 600 gap ⇒
 * 150. A previous pass called them 300 × 150 in a running bond from the video alone; that was wrong
 * in both the size and the bond.
 *
 * One canvas sheet covers 600 × 600 mm (4 × 4 tiles), so the caller repeats it once per 0.6 m in
 * each direction.
 *
 * It needs its own texture rather than reusing the bathroom's. That one is grey, and the splashback
 * was drawing it with `color="#ffffff"`, which multiplies rather than replaces — so a white tint on
 * a grey texture still rendered grey.
 */
export function makeSplashbackTexture(splashLength = 2.4, splashHeight = 0.6): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#c9c5be'; // grout
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#f6f5f2';
  const t = 64; // 150 mm, square
  const gap = 2;
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * t + gap / 2, row * t + gap / 2, t - gap, t - gap);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(splashLength / 0.6, splashHeight / 0.6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The printed woodgrain foil on a laminated board — BESTÅ, LACK and most of the flat-pack range.
 *
 * Bump only, no colour: on a black-brown or a white foil the grain's own colour variation is far
 * below what you can see across a room, but the relief under the satin finish is exactly what stops
 * a panel reading as moulded plastic. One sheet covers 600 × 600 mm, so the caller repeats it per
 * panel rather than stretching one sheet over a 2.4 m front.
 */
export function makeBoardGrain(): THREE.Texture {
  const [c, ctx] = canvas(256);
  const r = rng(9713);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  // Fine straight grain, drawn along the board's length.
  for (let i = 0; i < 1400; i++) {
    const y = r() * 256;
    const len = 30 + r() * 226;
    const g = 128 + (r() - 0.5) * 44;
    ctx.strokeStyle = `rgba(${g | 0},${g | 0},${g | 0},${0.25 + r() * 0.4})`;
    ctx.lineWidth = 0.4 + r() * 0.7;
    ctx.beginPath();
    ctx.moveTo(r() * 256 - len / 2, y);
    ctx.lineTo(r() * 256 + len / 2, y + (r() - 0.5) * 1.6);
    ctx.stroke();
  }
  // A few cathedral figures — the wide, shallow arcs a flat-sawn print always carries.
  for (let i = 0; i < 5; i++) {
    const y = r() * 256;
    ctx.strokeStyle = `rgba(96,96,96,${0.2 + r() * 0.2})`;
    ctx.lineWidth = 1.2 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.bezierCurveTo(70, y - 16 - r() * 14, 180, y + 16 + r() * 14, 266, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let cached: {
  oak?: THREE.Texture;
  oakBump?: THREE.Texture;
  tile?: THREE.Texture;
  wall?: THREE.Texture;
  countertop?: THREE.Texture;
  splashback?: THREE.Texture;
  boardGrain?: THREE.Texture;
} = {};

export function sharedTextures() {
  if (!cached.oak) {
    const floor = makeOakFloor();
    cached.oak = floor.color;
    cached.oakBump = floor.bump;
  }
  cached.tile ??= makeTileTexture();
  cached.wall ??= makeWallTexture();
  cached.countertop ??= makeCountertopTexture();
  cached.splashback ??= makeSplashbackTexture();
  cached.boardGrain ??= makeBoardGrain();
  return cached as Required<typeof cached>;
}

export function makeCountertopTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#15171a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const b = 20 + Math.random() * 40;
    ctx.fillStyle = `rgba(${b},${b},${b},${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
