import { useEffect, useMemo, useState } from 'react';
import { useDesignsStore } from '../state/designsStore';
import { CATALOG, WOONSPOT_BED_CATALOG, WOONSPOT_CATALOG } from '../state/furnitureCatalog';
import { useLayoutStore } from '../state/layoutStore';
import { categoryFacets, filterProducts, useProducts } from '../state/productCatalog';
import type { CatalogEntry, FurnitureShape, Product } from '../lib/types';
import { CategoryIcons } from './icons';

// Products rendered per "Load more" press. Deliberately a button rather than infinite scroll: the
// catalog is nearly 4000 items, and a list that grows as you scroll never lets you reach the basic
// shapes below it — you keep chasing the bottom of the panel.
const PAGE = 60;

function ProductCard({
  product,
  onAdd,
  showPrice,
}: {
  product: Product;
  onAdd: () => void;
  showPrice: boolean;
}) {
  const [broken, setBroken] = useState(false);
  // The finishes this piece is sold in, one square each. Deduplicated by colour because the variant
  // list is per size AND colour — MALM's sixteen articles are four colours, and sixteen squares on a
  // card that small would be a stripe.
  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of product.variants ?? []) if (!seen.has(v.colorHex)) seen.set(v.colorHex, v.colorName);
    return [...seen.entries()];
  }, [product.variants]);
  return (
    <button className="product-card" onClick={onAdd} title={`${product.name} — ${product.category}`}>
      <div className="product-thumb" style={{ background: broken ? product.colorHex : undefined }}>
        {!broken && product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <span className="product-thumb-fallback">{product.name.slice(0, 2)}</span>
        )}
      </div>
      <div className="product-meta">
        <span className="product-name">{product.name}</span>
        <span className="product-type">{product.typeName}</span>
        {showPrice && <span className="product-price">€{product.priceEUR}</span>}
        {/* A hint, not a control: the card's one job is to add the piece, and the size and finish are
            chosen properly in the right-hand panel once it is in the room. It is here so a scan of
            the grid shows that this frame comes in black-brown at all. */}
        {colors.length > 1 && (
          <span className="product-colors" title={`Comes in: ${colors.map(([, n]) => n).join(', ')}`}>
            {colors.map(([hex, name]) => (
              <i key={hex} style={{ background: hex }} aria-label={name} />
            ))}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * A grid of specific WoonSpot XXL products — sofas or boxsprings. Their labels are shortened to fit
 * two per row, but the *type* suffix is kept where dropping it would collide (Capri comes as both a
 * loungebank and a U-bank), and the footprint — plus the price, when signed in — sits under the name.
 */
function WoonspotGrid({
  entries,
  onAdd,
  showPrice,
}: {
  entries: (CatalogEntry & { priceEUR: number; slug: string })[];
  onAdd: (id: FurnitureShape) => void;
  showPrice: boolean;
}) {
  return (
    <div className="library-grid">
      {entries.map((entry) => {
        const Icon = CategoryIcons[entry.id] ?? CategoryIcons.box;
        const { w, d } = entry.defaultDims;
        const short = entry.label.replace(/ Loungebank$/, '').replace(/ Hoekbank$/, ' hoek').replace(/ U-bank$/, ' U');
        return (
          <button
            key={entry.id}
            className="library-item"
            onClick={() => onAdd(entry.id)}
            title={`${entry.label} — ${w} × ${d} cm${showPrice ? `, €${entry.priceEUR}` : ''}`}
          >
            <Icon />
            <span>{short}</span>
            <span className="library-sub">
              {w}×{d}
              {showPrice && ` · €${entry.priceEUR}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LibraryPanel() {
  const addFromCatalog = useLayoutStore((s) => s.addFromCatalog);
  const addProduct = useLayoutStore((s) => s.addProduct);
  const addCustom = useLayoutStore((s) => s.addCustom);

  // Prices are only for the person planning the flat: a visitor who is not signed in gets the
  // catalog and the dimensions, but no price anywhere.
  const showPrice = useDesignsStore((s) => s.authenticated);

  const products = useProducts();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<FurnitureShape | 'all'>('all');
  const [visible, setVisible] = useState(PAGE);

  const facets = useMemo(() => (products ? categoryFacets(products) : []), [products]);
  const filtered = useMemo(
    () => (products ? filterProducts(products, query, cat) : []),
    [products, query, cat],
  );

  // Reset the window whenever the filter changes.
  useEffect(() => setVisible(PAGE), [query, cat]);

  const [customOpen, setCustomOpen] = useState(false);
  const [name, setName] = useState('');
  const [customShape, setCustomShape] = useState<'box' | 'cylinder'>('box');
  const [w, setW] = useState(60);
  const [d, setD] = useState(60);
  const [h, setH] = useState(60);

  return (
    <div className="panel panel-library">
      <div className="panel-title">IKEA catalog</div>

      <input
        className="product-search"
        type="search"
        placeholder={products ? `Search ${products.length} products…` : 'Loading catalog…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="cat-chips">
        <button className={`cat-chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>
          All
        </button>
        {facets.map((f) => (
          <button
            key={f.archetype}
            className={`cat-chip ${cat === f.archetype ? 'active' : ''}`}
            onClick={() => setCat(f.archetype)}
          >
            {f.label} <span className="cat-count">{f.count}</span>
          </button>
        ))}
      </div>

      {!products ? (
        <div className="empty-state">Loading IKEA catalog…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No products match.</div>
      ) : (
        <>
          <div className="product-grid">
            {filtered.slice(0, visible).map((p) => (
              <ProductCard key={p.articleNo} product={p} onAdd={() => addProduct(p)} showPrice={showPrice} />
            ))}
          </div>
          {visible < filtered.length ? (
            <button className="product-more" onClick={() => setVisible((v) => v + PAGE)}>
              Load {Math.min(PAGE, filtered.length - visible)} more
              <span className="product-more-left">
                {visible} of {filtered.length} shown
              </span>
            </button>
          ) : (
            filtered.length > PAGE && (
              <p className="product-more-end">All {filtered.length} shown</p>
            )
          )}
        </>
      )}

      <div className="panel-title" style={{ marginTop: 18 }}>
        WoonSpot XXL sofas
      </div>
      <WoonspotGrid entries={WOONSPOT_CATALOG} onAdd={addFromCatalog} showPrice={showPrice} />

      <div className="panel-title" style={{ marginTop: 18 }}>
        WoonSpot XXL boxsprings
      </div>
      <WoonspotGrid entries={WOONSPOT_BED_CATALOG} onAdd={addFromCatalog} showPrice={showPrice} />

      <div className="panel-title" style={{ marginTop: 18 }}>
        Basic shapes
      </div>
      <div className="library-grid">
        {CATALOG.map((entry) => {
          const Icon = CategoryIcons[entry.id] ?? CategoryIcons.box;
          return (
            <button key={entry.id} className="library-item" onClick={() => addFromCatalog(entry.id)}>
              <Icon />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>

      <div className="panel-title" style={{ marginTop: 18 }}>
        Add custom item
      </div>
      {!customOpen ? (
        <button className="btn" style={{ width: '100%' }} onClick={() => setCustomOpen(true)}>
          + New item
        </button>
      ) : (
        <div className="custom-item-form">
          <div className="field-row">
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Piano" />
          </div>
          <div className="field-row">
            <label>Shape</label>
            <select value={customShape} onChange={(e) => setCustomShape(e.target.value as 'box' | 'cylinder')}>
              <option value="box">Box</option>
              <option value="cylinder">Cylinder</option>
            </select>
          </div>
          <div className="dim-grid">
            <div className="field">
              <label>W cm</label>
              <input type="number" value={w} onChange={(e) => setW(+e.target.value)} />
            </div>
            <div className="field">
              <label>D cm</label>
              <input type="number" value={d} onChange={(e) => setD(+e.target.value)} />
            </div>
            <div className="field">
              <label>H cm</label>
              <input type="number" value={h} onChange={(e) => setH(+e.target.value)} />
            </div>
          </div>
          <div className="btn-row">
            <button
              className="btn btn-accent"
              onClick={() => {
                addCustom(name, customShape, w, d, h);
                setName('');
                setCustomOpen(false);
              }}
            >
              Add
            </button>
            <button className="btn" onClick={() => setCustomOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
