import type { WoonspotBedId } from './woonspotBeds';
import type { WoonspotSofaId } from './woonspotSofas';

export type FurnitureShape =
  | WoonspotSofaId
  | WoonspotBedId
  | 'bed'
  | 'bedding'
  | 'beddingMadeUp'
  | 'nightstand'
  | 'wardrobe'
  | 'paxCorner'
  | 'desk'
  | 'chair'
  | 'sofa'
  | 'trentinoU'
  | 'solidaOrdered'
  | 'armchair'
  | 'coffeeTable'
  | 'diningTable'
  | 'diningChair'
  | 'tvConsole'
  | 'bookshelf'
  | 'rug'
  | 'onsevigRug'
  | 'lamp'
  | 'plant'
  | 'ps5'
  | 'ps5Flat'
  | 'tclTv43'
  | 'box'
  | 'cylinder';

export interface CatalogEntry {
  id: FurnitureShape;
  label: string;
  defaultDims: { w: number; d: number; h: number }; // cm
  defaultColorHex: string;
  custom?: boolean;
}

// Drives 3D material realism (roughness/metalness) per product. Set by ingestion from the
// product's IKEA material description; the archetype mesh reads it to look like wood vs fabric
// vs metal vs glass rather than one flat plastic finish.
export type MaterialFamily =
  | 'wood'
  | 'fabric'
  | 'metal'
  | 'glass'
  | 'painted'
  | 'plastic'
  | 'other';

// One buyable combination of a product family: a size and a finish, with its own article number
// and price. IKEA sells MALM's "bed frame, high, with 2 storage boxes" as 16 of these — four
// mattress sizes in four finishes — and the size is what makes the footprint, so a variant carries
// its own dimensions rather than inheriting the family's.
//
// Why these hang off one Product instead of each being a Product of its own: the catalogue is
// already 3800 rows and the furniture library shows one card per row, so a row per variant would
// both balloon the file and put sixteen near-identical MALM cards in the grid. Grouping also gives
// the UI something it could not otherwise know — which colours and sizes a given piece actually
// comes in, as opposed to which arbitrary hex someone can tint it.
export interface ProductVariant {
  articleNo: string;
  colorName: string; // as IKEA words it, e.g. "zwartbruin"
  colorHex: string;
  sizeLabel: string; // IKEA's reference measurement, e.g. "180x200 cm" (the MATTRESS, not the frame)
  dims: { w: number; d: number; h: number }; // cm, the frame's own footprint for this size
  // Where the dimensions came from: measured off this article's own 3D model ('glb'), worked out
  // from a measured sibling of the same design ('derived'), taken from how far a bed frame typically
  // overhangs its mattress because nothing in the family was measured ('estimated'), or simply the
  // family's own ('inherited'). Anything but the first two is worth telling the user about — they are
  // planning a 2.38 m wide bedroom, where 10 cm decides whether a nightstand fits.
  dimsSource?: 'glb' | 'derived' | 'estimated' | 'inherited' | 'measure';
  priceEUR: number;
  productUrl: string;
  imageUrl?: string;
  // Only present on the one article the model was measured from — a glTF is scaled to its own real
  // size, so a 90x200 model cannot stand in for a 180x200 frame.
  modelUrl?: string;
  // Extra that comes in the box on this article and nothing else: a slatted base ("Luröy") or a
  // mattress. Same piece of furniture, different price.
  bundle?: string;
}

// A real IKEA SKU. This is immutable reference data produced by the catalog ingestion job
// (Phase 2) — the whole range lives in a generated products.json, NOT hand-written here.
// A Product is not itself placed in the room; placing one spawns a PlacedItem seeded from it
// (see productId below), which the user can then resize/recolor independently.
export interface Product {
  articleNo: string; // IKEA article number, e.g. "104.267.84"
  name: string; // series name, e.g. "MALM"
  typeName?: string; // human type, e.g. "Bed frame, high"
  category: string; // IKEA category label/path — the source signal for archetype mapping
  dims: { w: number; d: number; h: number }; // cm, real published dimensions
  priceEUR: number;
  imageUrl: string; // hero thumbnail
  productUrl: string; // ikea.com product page
  colorHex: string; // dominant color, used to tint the archetype mesh
  material?: MaterialFamily;
  archetype: FurnitureShape; // which procedural mesh renders it
  modelUrl?: string; // optional per-product glTF for hero pieces; usually absent
  // Height (cm) this product hangs at. Only set for things that don't stand on the floor: a
  // hanging plant's model hangs BELOW its own origin (the hook), so at y=0 it would be under the
  // floor. Placed items keep it in PlacedItem.y, where it stays editable like any other number.
  defaultY?: number;
  // Every size-and-finish this family is sold in, when the ingest could establish them. Absent for
  // the many rows where the range only ever offered one. The row's own dims/colorHex/articleNo are
  // one of these — the one the library card shows.
  variants?: ProductVariant[];
}

export interface PlacedItem {
  id: string;
  productId?: string; // articleNo of the source Product when placed from the catalog; absent for custom items
  // Which variant of that product is standing in the room, when the family has more than one. Kept
  // separately from productId because productId names the catalogue row (and so the variant list),
  // while this names the article actually chosen — they differ as soon as you switch size or colour.
  variantArticle?: string;
  modelUrl?: string; // local path to the real IKEA glTF model when available; renders instead of the archetype
  shape: FurnitureShape; // renderer archetype — the fallback silhouette while the model streams / if none exists
  name: string;
  w: number; // cm
  d: number; // cm
  h: number; // cm
  x: number; // cm, room-space (from the NW corner, +X = width axis)
  y?: number; // cm, vertical lift off the floor (e.g. a table lamp sitting on a nightstand); default 0
  // Is the Y field editable for this item? Locked by default — nearly everything stands on the
  // floor, and a mistyped height is hard to spot in a 3D view. Set when the item is something
  // that hangs (a product with defaultY) or when the user unlocks it by hand.
  yUnlocked?: boolean;
  z: number; // cm, room-space (+Z = depth axis)
  rotationDeg: number; // around Y, 0 = facing +Z
  // Left-right flip, for handed pieces: a chaise or corner sofa's deep wing swaps sides. Not a
  // rotation — turning an L through 180° puts it in the other corner, which is a different sofa.
  mirrored?: boolean;
  colorHex: string;
  lightType?: string; // for lamps: pendant | floorLamp | tableLamp | wallLamp | ceiling | spot
}

export type ViewMode = 'orbit' | 'plan' | 'window' | 'walk' | 'free';

export interface SunSettings {
  azimuthDeg: number; // 0-360, compass direction the light comes FROM
  hourOfDay: number; // 0-24
  cloudiness: number; // 0 (clear) - 1 (overcast)
}
