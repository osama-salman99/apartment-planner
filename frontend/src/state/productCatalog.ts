import { useEffect, useState } from 'react';
import type { FurnitureShape, Product } from '../lib/types';
import { WOONSPOT_BEDS, type WoonspotBedId } from '../lib/woonspotBeds';
import { WOONSPOT_SOFAS, type WoonspotSofaId } from '../lib/woonspotSofas';

// The full IKEA range is a generated static asset (scripts/ingest-ikea.mjs + the asset pipeline),
// served from the /media Caddy volume — models/images/products.json live outside the JS bundle and
// the app heap.
//
// There used to be a hand-maintained CATALOG_VERSION here, appended as ?v= to bust a cache. It had
// to go: /media was served with a one-year immutable Cache-Control for everything, so republishing
// the catalogue reached nobody until someone edited this constant, committed it and waited for a
// deploy — a code change and a release to ship a data change, which is exactly what keeping these
// assets out of the build was supposed to avoid. Caddy now serves *.json under /media with a
// 60-second revalidating cache (the models and images, whose names are article numbers and whose
// bytes never change, keep the immutable year), so a republished catalogue is live within a minute
// on its own. Do not reintroduce a version parameter here; if the catalogue looks stale, check the
// Cache-Control that /media/products.json is actually being served with.
let cache: Product[] | null = null;
let inflight: Promise<Product[]> | null = null;

/**
 * SKUs that have their own bespoke mesh rather than the archetype the ingestion job inferred from
 * the IKEA category. Applied on load, so picking the product out of the range renders the real
 * thing — the archetype in the generated file stays whatever the category said, since that is also
 * what drives the category filter's grouping.
 */
const ARCHETYPE_BY_ARTICLE: Record<string, FurnitureShape> = {
  '70626744': 'onsevigRug', // ONSEVIG Ø160 — the pattern is the product
};

export async function loadProducts(): Promise<Product[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch('/media/products.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Product[]) => {
        cache = (Array.isArray(d) ? d : []).map((p) =>
          ARCHETYPE_BY_ARTICLE[p.articleNo] ? { ...p, archetype: ARCHETYPE_BY_ARTICLE[p.articleNo] } : p,
        );
        return cache;
      })
      .catch(() => {
        cache = [];
        return cache;
      });
  }
  return inflight;
}

/**
 * Find the catalogue row a placed item came from, so the inspector can offer that product's real
 * sizes and colours.
 *
 * Indexed by the row's own article number AND by every one of its variants': an item placed before
 * variants existed, or one switched to a different size, carries a variant's article in productId,
 * and looking that up must still land on the family rather than silently offering nothing.
 */
export function findProductByArticle(products: Product[] | null, articleNo?: string): Product | null {
  if (!products || !articleNo) return null;
  const direct = products.find((p) => p.articleNo === articleNo);
  if (direct) return direct;
  return products.find((p) => p.variants?.some((v) => v.articleNo === articleNo)) ?? null;
}

export function useProducts(): Product[] | null {
  const [products, setProducts] = useState<Product[] | null>(cache);
  useEffect(() => {
    let alive = true;
    loadProducts().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);
  return products;
}

// Friendly labels for the archetype category filter.
export const ARCHETYPE_LABELS: Record<FurnitureShape, string> = {
  sofa: 'Sofas',
  // Not IKEA SKUs — the WoonSpot XXL range, so these facets are never non-zero. They only exist
  // to keep the record exhaustive.
  ...(Object.fromEntries(WOONSPOT_SOFAS.map((s) => [s.id, 'Sofas'])) as Record<WoonspotSofaId, string>),
  ...(Object.fromEntries(WOONSPOT_BEDS.map((b) => [b.id, 'Beds'])) as Record<WoonspotBedId, string>),
  trentinoU: 'Sofas',
  solidaOrdered: 'Sofas',
  armchair: 'Armchairs',
  bed: 'Beds',
  // Not SKUs — the mattress that goes on a frame, from the basics library, so these facets stay empty.
  bedding: 'Mattress',
  beddingMadeUp: 'Mattress',
  diningTable: 'Tables',
  diningChair: 'Dining chairs',
  chair: 'Chairs',
  desk: 'Desks',
  bookshelf: 'Shelving',
  wardrobe: 'Wardrobes',
  // No catalog product maps onto it (it is one specific planner configuration), so this label
  // only exists to keep the record exhaustive — the facet is never non-zero.
  paxCorner: 'Wardrobes',
  nightstand: 'Drawers',
  tvConsole: 'TV units',
  coffeeTable: 'Coffee tables',
  rug: 'Rugs',
  onsevigRug: 'Rugs',
  lamp: 'Lamps',
  plant: 'Plants',
  // Not an IKEA SKU either — it lives in the basics library, so this facet stays empty too.
  ps5: 'Consoles',
  ps5Flat: 'Consoles',
  tclTv43: 'TVs',
  box: 'Other',
  cylinder: 'Other',
};

export interface CategoryFacet {
  archetype: FurnitureShape;
  label: string;
  count: number;
}

export function categoryFacets(products: Product[]): CategoryFacet[] {
  const counts = new Map<FurnitureShape, number>();
  for (const p of products) counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1);
  return [...counts.entries()]
    .map(([archetype, count]) => ({ archetype, label: ARCHETYPE_LABELS[archetype] ?? archetype, count }))
    .sort((a, b) => b.count - a.count);
}

export function filterProducts(products: Product[], query: string, archetype: FurnitureShape | 'all'): Product[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    if (archetype !== 'all' && p.archetype !== archetype) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.typeName ?? '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });
}
