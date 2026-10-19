#!/usr/bin/env python3
"""Give IKEA's real IDANAS ottoman-bed model the Naggen beige colourway.

IKEA publishes a glTF for the ottoman bed only in Gunnared dark grey (art 70447182). The beige SKU
(50588088) is the SAME bed — same frame, same 180x200 size, same button-tufted
sloping headboard — in a different fabric, and its PDP carries no model at all. So rather than
approximate the bed procedurally, keep IKEA's geometry and retone its baked base-colour texture:
map the texture's luminance onto a beige ramp, which preserves every bit of weave, seam and
ambient shadow detail while changing the cloth's colour. Normals and the ORM map are untouched.

Writes a new GLB; the original is not modified.
    python3 retone.py <in.glb> <out.glb>
"""
import io
import json
import struct
import sys

from PIL import Image, ImageOps

SRC, DST = sys.argv[1], sys.argv[2]
# Sampled off IKEA's own hero photo of 50588088: the lit cloth reads ~#b4a890..#c0b49c. The ramp
# runs from a deep shadow greige to a warm near-white so the mid-tones land on that.
BLACK, MID, WHITE = (58, 52, 42), (184, 172, 150), (250, 247, 238)

raw = open(SRC, 'rb').read()
assert raw[:4] == b'glTF', 'not a GLB'
json_len = struct.unpack('<I', raw[12:16])[0]
gltf = json.loads(raw[20:20 + json_len])
bin_start = 20 + json_len + 8  # skip the BIN chunk header
bin_len = struct.unpack('<I', raw[20 + json_len:20 + json_len + 4])[0]
blob = raw[bin_start:bin_start + bin_len]

# The base-colour image of the one material.
mat = gltf['materials'][0]
tex_i = mat['pbrMetallicRoughness']['baseColorTexture']['index']
img_i = gltf['textures'][tex_i]['source']
img = gltf['images'][img_i]
bv = gltf['bufferViews'][img['bufferView']]
old = blob[bv['byteOffset']:bv['byteOffset'] + bv['byteLength']]

src_im = Image.open(io.BytesIO(old))
fmt = src_im.format
print(f'basecolor: {img.get("name")} {src_im.size} {fmt} {len(old)} bytes')
toned = ImageOps.colorize(src_im.convert('L'), black=BLACK, white=WHITE, mid=MID)
out = io.BytesIO()
if fmt == 'PNG':
    toned.save(out, 'PNG', optimize=True)
else:
    toned.save(out, 'JPEG', quality=92, subsampling=1)
new = out.getvalue()
print(f'retoned -> {len(new)} bytes')

# Rebuild the BIN chunk: every bufferView is copied in order at a fresh 4-byte-aligned offset, so
# the replacement image is free to be a different size from the one it replaces.
target = img['bufferView']
parts, cursor = [], 0
for i, v in enumerate(gltf['bufferViews']):
    data = new if i == target else blob[v['byteOffset']:v['byteOffset'] + v['byteLength']]
    pad = (-cursor) % 4
    if pad:
        parts.append(b'\0' * pad)
        cursor += pad
    v['byteOffset'] = cursor
    v['byteLength'] = len(data)
    parts.append(data)
    cursor += len(data)
new_blob = b''.join(parts)
new_blob += b'\0' * ((-len(new_blob)) % 4)
gltf['buffers'][0]['byteLength'] = len(new_blob)

js = json.dumps(gltf, separators=(',', ':')).encode('utf8')
js += b' ' * ((-len(js)) % 4)
glb = (
    b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(new_blob))
    + struct.pack('<I', len(js)) + b'JSON' + js
    + struct.pack('<I', len(new_blob)) + b'BIN\0' + new_blob
)
open(DST, 'wb').write(glb)
print(f'wrote {DST}: {len(glb)} bytes (was {len(raw)})')
