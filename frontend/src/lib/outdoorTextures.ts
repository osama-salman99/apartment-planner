import * as THREE from 'three';

// Procedural textures for the outdoor backdrop, built to match what the unit's own real photo
// actually shows through the window: a light concrete/asphalt parking lot with a grass median,
// warm-render and brick mid-rises, and a still-under-development, newly-landscaped feel.

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function fbmNoise(ctx: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    img.data[i] = Math.max(0, Math.min(255, base[0] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, base[1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, base[2] + n));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Asphalt parking surface: dark warm-gray, fine grain, oil stains, faded painted bays. */
export function makeAsphaltTexture(): THREE.Texture {
  const [c, ctx] = canvas(1024);
  fbmNoise(ctx, 1024, 1024, [116, 114, 110], 26);
  // coarse blotches / patches
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = 40 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() > 0.5;
    g.addColorStop(0, dark ? 'rgba(70,68,66,0.25)' : 'rgba(150,148,144,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // painted parking bays (two banks facing a drive aisle)
  ctx.strokeStyle = 'rgba(232,230,222,0.5)';
  ctx.lineWidth = 4;
  for (const [y0, y1] of [[60, 300], [724, 964]] as const) {
    for (let x = 40; x <= 984; x += 66) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeGrassTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  fbmNoise(ctx, 256, 256, [104, 128, 74], 34);
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const g = 110 + Math.random() * 70;
    ctx.strokeStyle = `rgba(${g - 40},${g},${g - 55},0.3)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 2 - Math.random() * 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeConcretePaverTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  fbmNoise(ctx, 256, 256, [176, 172, 165], 18);
  ctx.strokeStyle = 'rgba(120,116,110,0.4)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Stucco/render facade base — warm off-white with subtle mottling. */
export function makeRenderFacadeTexture(hex: string): THREE.Texture {
  const c = new THREE.Color(hex);
  const [cv, ctx] = canvas(256);
  fbmNoise(ctx, 256, 256, [c.r * 255, c.g * 255, c.b * 255], 14);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A render facade with a regular grid of windows — used for the flat's own building below it. */
export function makeWindowFacadeTexture(floors: number, cols: number): THREE.Texture {
  const [c, ctx] = canvas(256, Math.max(256, floors * 42));
  const H = c.height;
  ctx.fillStyle = '#cbc4b6';
  ctx.fillRect(0, 0, 256, H);
  const rowH = H / floors;
  const colW = 256 / cols;
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const lit = Math.random() > 0.7;
      ctx.fillStyle = lit ? 'rgba(255,240,210,0.7)' : '#243039';
      ctx.fillRect(i * colW + colW * 0.22, f * rowH + rowH * 0.2, colW * 0.56, rowH * 0.58);
      ctx.strokeStyle = 'rgba(60,58,52,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(i * colW + colW * 0.22, f * rowH + rowH * 0.2, colW * 0.56, rowH * 0.58);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Brick facade base — running-bond courses in a warm brick tone. */
export function makeBrickTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = '#9c6b4e';
  ctx.fillRect(0, 0, 256, 256);
  const bw = 32;
  const bh = 12;
  for (let row = 0, y = 0; y < 256; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 256; x += bw) {
      const shade = -18 + Math.random() * 36;
      ctx.fillStyle = `rgb(${156 + shade},${107 + shade * 0.7},${78 + shade * 0.5})`;
      ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
