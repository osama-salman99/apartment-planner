import { useLayoutStore } from '../state/layoutStore';
import { findProductByArticle, useProducts } from '../state/productCatalog';
import type { PlacedItem, Product, ProductVariant } from '../lib/types';

const SWATCHES = [
  '#6b4a34', '#8a6a4d', '#c9a876', '#e5e1d8', '#3b3f45',
  '#6e655c', '#8a7c6c', '#5b3f2c', '#2e2b28', '#a9967f',
  '#3f2c20', '#d68a4c', '#5c7a6e', '#b23a3a', '#e8e4da',
];

// A dimension must stay >= 1 cm: clearing the field (+"" === 0) or typing a negative
// otherwise builds geometry with a 0/NaN radius, so the piece vanishes and its raycast
// bounds go NaN — you can't even click to reselect it. Position/rotation may be any
// integer, but still guard NaN (an empty field) to 0.
const dimCm = (v: string) => Math.max(1, Math.round(+v) || 1);
const numCm = (v: string) => Math.round(+v) || 0;

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * The sizes and finishes this piece is actually sold in.
 *
 * This replaces the free swatch grid for anything that came out of the catalogue: a MALM bed frame
 * comes in four mattress sizes and four finishes and nothing else, so offering fifteen arbitrary
 * hexes and a colour picker invited a plan built around a bed that cannot be bought. Picking a size
 * here also resizes the piece, because the size IS the footprint — which is the whole point of
 * planning a 5.95 m room around a 180 cm bed.
 */
function VariantPicker({ item, product, disabled }: { item: PlacedItem; product: Product; disabled: boolean }) {
  const applyVariant = useLayoutStore((s) => s.applyVariant);
  const variants = product.variants ?? [];
  // An item placed before this existed has no variantArticle, so fall back to the article it was
  // placed from; failing that, match on the dimensions and colour actually in the room.
  const current =
    variants.find((v) => v.articleNo === (item.variantArticle ?? item.productId)) ??
    variants.find((v) => v.dims.w === Math.round(item.w) && v.colorHex.toLowerCase() === item.colorHex.toLowerCase());

  const sizes = uniq(variants.map((v) => v.sizeLabel));
  const activeSize = current?.sizeLabel ?? sizes[0];
  // Only the finishes made in the size on show — a colour that exists in 90x200 but not in 180x200
  // is not an option once you are looking at the 180.
  const coloursHere = variants.filter((v) => v.sizeLabel === activeSize);

  const pick = (variant: ProductVariant | undefined) => {
    if (variant && !disabled) applyVariant(item.id, variant);
  };
  const switchSize = (sizeLabel: string) => {
    const inSize = variants.filter((v) => v.sizeLabel === sizeLabel);
    // Keep the finish across a size change where that finish is made in the new size; otherwise the
    // first one there, so the chip always does something rather than looking broken.
    pick(inSize.find((v) => v.colorName === current?.colorName) ?? inSize[0]);
  };

  return (
    <div className={`panel-section ${disabled ? 'section-off' : ''}`}>
      <div className="panel-title">Size &amp; finish</div>
      {sizes.length > 1 && (
        <div className="btn-row variant-sizes">
          {sizes.map((s) => (
            <button
              key={s}
              className={`btn ${s === activeSize ? 'btn-accent' : ''}`}
              disabled={disabled}
              onClick={() => switchSize(s)}
            >
              {s.replace(/\s*cm$/, '')}
            </button>
          ))}
        </div>
      )}
      <div className="color-swatches" style={{ marginTop: sizes.length > 1 ? 8 : 0 }}>
        {coloursHere.map((v) => (
          <div
            key={v.articleNo}
            className={`swatch ${v.articleNo === current?.articleNo ? 'active' : ''}`}
            style={{ background: v.colorHex }}
            title={`${v.colorName} — €${v.priceEUR}${v.bundle ? ` (met ${v.bundle})` : ''}`}
            onClick={() => pick(v)}
          />
        ))}
      </div>
      {current && (
        <div className="variant-note">
          {/* Not everything IKEA sells states a size (a sofa comes one way), and "beige, — €349"
              reads like a bug, so the size is only named when there is one. */}
          {current.colorName}
          {current.sizeLabel ? `, ${current.sizeLabel}` : ''} — €{current.priceEUR}
          {current.bundle ? ` (incl. ${current.bundle})` : ''}
          <br />
          <span className="variant-sub">
            art. {current.articleNo} · {current.dims.w}×{current.dims.d}×{current.dims.h} cm
            {current.modelUrl ? ' · 3D model' : ''}
            {/* Say so when the footprint was worked out rather than measured. In a 2.38 m wide
                bedroom the difference between 9 and 15 cm of overhang decides whether a nightstand
                fits, so it should not read as a published figure. */}
            {current.dimsSource === 'estimated' ? ' · size estimated' : ''}
            {current.dimsSource === 'inherited' ? ' · size not confirmed' : ''}
            {current.dimsSource === 'measure' ? " · size as IKEA states it" : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function ItemInspector() {
  const selectedId = useLayoutStore((s) => s.selectedId);
  const item = useLayoutStore((s) => s.items.find((i) => i.id === s.selectedId));
  // How many pieces are held. Above one, this panel edits the anchor only — so the parts of it that
  // would silently apply to just one member of a group are shut off (see `group` below).
  const groupCount = useLayoutStore((s) => (s.selectedId ? 1 + s.alsoSelectedIds.length : 0));
  const updateItem = useLayoutStore((s) => s.updateItem);
  const removeItem = useLayoutStore((s) => s.removeItem);
  const duplicateItem = useLayoutStore((s) => s.duplicateItem);
  const alsoSelectedIds = useLayoutStore((s) => s.alsoSelectedIds);
  const moveSelection = useLayoutStore((s) => s.moveSelection);
  const gizmoMode = useLayoutStore((s) => s.gizmoMode);
  const setGizmoMode = useLayoutStore((s) => s.setGizmoMode);
  const products = useProducts();
  const product = findProductByArticle(products, item?.variantArticle ?? item?.productId);
  const variants = product?.variants ?? [];

  if (!selectedId || !item) {
    return (
      <div className="empty-state">
        Nothing selected. Add something from the library on the left, or click a piece already
        in the room to edit its size, position, rotation and color here.
      </div>
    );
  }

  // A multi-selection exists to move an arrangement, so only the numbers that mean the same thing
  // for every piece stay live: X/Z (nudge them all) and delete. Sizes are deliberately not
  // group-editable — "make these three 10 cm deeper" is never what you mean; each piece is a real
  // product with its own real dimensions.
  const group = groupCount > 1;
  const nudge = (dx: number, dz: number) => moveSelection(dx, dz);

  return (
    <div>
      {group && (
        <div className="panel-section">
          <div className="group-note">
            <strong>{groupCount} pieces selected.</strong> Drag any of them to move the whole group.
            Sizes, rotation and colour stay per-piece — cmd-click back down to one to edit them.
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="panel-title">Name</div>
        <input
          type="text"
          value={group ? `${groupCount} pieces` : item.name}
          disabled={group}
          onChange={(e) => updateItem(item.id, { name: e.target.value })}
        />
      </div>

      <div className={`panel-section ${group ? 'section-off' : ''}`}>
        <div className="panel-title">Dimensions (cm)</div>
        <div className="dim-grid">
          <div className="field">
            <label>Width</label>
            <input type="number" min={1} disabled={group} value={Math.round(item.w)} onChange={(e) => updateItem(item.id, { w: dimCm(e.target.value) })} />
          </div>
          <div className="field">
            <label>Depth</label>
            <input type="number" min={1} disabled={group} value={Math.round(item.d)} onChange={(e) => updateItem(item.id, { d: dimCm(e.target.value) })} />
          </div>
          <div className="field">
            <label>Height</label>
            <input type="number" min={1} disabled={group} value={Math.round(item.h)} onChange={(e) => updateItem(item.id, { h: dimCm(e.target.value) })} />
          </div>
        </div>
      </div>

      {/* Position and rotation are separate sections: they are separate decisions ("where against
          which wall" vs "which way is it facing"), each drives its own gizmo, and sharing one
          three-column grid put the single rotation field in the same row as the two coordinates as
          if Deg were a third axis. */}
      <div className="panel-section">
        <div className="panel-title">Position (cm)</div>
        <div className="dim-grid">
          {/* In a group these type the ANCHOR's coordinate and carry the others along by the same
              delta, which is the typed equivalent of dragging one member — the arrangement holds. */}
          <div className="field">
            <label>X{group ? ' (all)' : ''}</label>
            <input type="number" value={Math.round(item.x)} onChange={(e) => nudge(numCm(e.target.value) - item.x, 0)} />
          </div>
          <div className="field">
            <label>Z{group ? ' (all)' : ''}</label>
            <input type="number" value={Math.round(item.z)} onChange={(e) => nudge(0, numCm(e.target.value) - item.z)} />
          </div>
          {/* Height off the floor. Almost everything stands on it, and a stray keystroke that
              floats a wardrobe 40 cm up is a confusing thing to debug — so Y is locked shut by
              default and each item is unlocked on purpose. What needs it: the FEJKA hanging plant
              (it hangs from its hook, so Y is the only thing that places it at all), a wall shelf,
              a picture, a TV on a bracket. Negative is clamped away — below the floor there is
              nothing to see. */}
          <div className="field">
            <label>
              Y (up){' '}
              <button
                type="button"
                className="link-btn"
                title={item.yUnlocked ? 'Lock height back to the floor' : 'Unlock height for this item'}
                onClick={() => updateItem(item.id, { yUnlocked: !item.yUnlocked })}
              >
                {item.yUnlocked ? 'lock' : 'unlock'}
              </button>
            </label>
            <input
              type="number"
              min={0}
              disabled={group || !item.yUnlocked}
              value={Math.round(item.y ?? 0)}
              onChange={(e) => updateItem(item.id, { y: Math.max(0, numCm(e.target.value)) })}
            />
          </div>
        </div>
      </div>

      <div className={`panel-section ${group ? 'section-off' : ''}`}>
        <div className="panel-title">Rotation</div>
        <div className="dim-grid">
          <div className="field">
            <label>Degrees</label>
            <input
              type="number"
              disabled={group}
              value={Math.round(item.rotationDeg)}
              onChange={(e) => updateItem(item.id, { rotationDeg: numCm(e.target.value) })}
            />
          </div>
        </div>
        {/* The four square-on orientations, which is what almost every piece in a room this tight
            actually wants — quicker and exact next to a free-spin gizmo. */}
        <div className="btn-row" style={{ marginTop: 8 }}>
          {[0, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              className={`btn ${Math.round(item.rotationDeg) % 360 === deg ? 'btn-accent' : ''}`}
              disabled={group}
              onClick={() => updateItem(item.id, { rotationDeg: deg })}
            >
              {deg}°
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          {/* One toggle rather than a pair of mode buttons: the drag-arrows button said "Move with
              the gizmo" next to two X/Z fields that already move the item, and dragging the piece
              itself moves it too — so it was a third way to do the same thing with a name that
              explained nothing. Off, the selected item carries the drag arrows; on, it carries the
              rotation ring instead. */}
          <button
            className={`btn ${gizmoMode === 'rotate' ? 'btn-accent' : ''}`}
            disabled={group}
            title="Show the rotation ring on the selected item instead of the drag arrows"
            onClick={() => setGizmoMode(gizmoMode === 'rotate' ? 'translate' : 'rotate')}
          >
            Rotate with the gizmo
          </button>
          {/* Handedness, not orientation: a chaise or corner sofa comes left- or right-hand, and
              turning it 180° moves it to the other corner instead of swapping the wing. */}
          <button
            className={`btn ${item.mirrored ? 'btn-accent' : ''}`}
            disabled={group}
            title="Flip left-right — swaps which side a chaise or corner sofa's deep wing is on"
            onClick={() => updateItem(item.id, { mirrored: !item.mirrored })}
          >
            Mirror
          </button>
        </div>
      </div>

      {/* A real product shows its real range; a custom box or a catalogue row whose variants were
          never established keeps the free swatches, where any tint is as valid as any other. */}
      {variants.length > 1 && product ? (
        <VariantPicker item={item} product={product} disabled={group} />
      ) : (
        <div className={`panel-section ${group ? 'section-off' : ''}`}>
          <div className="panel-title">Color / material</div>
          <div className="color-swatches">
            {SWATCHES.map((hex) => (
              <div
                key={hex}
                className={`swatch ${item.colorHex.toLowerCase() === hex ? 'active' : ''}`}
                style={{ background: hex }}
                onClick={() => { if (!group) updateItem(item.id, { colorHex: hex }); }}
              />
            ))}
          </div>
          <div className="hex-input">
            <input type="color" disabled={group} value={item.colorHex} onChange={(e) => updateItem(item.id, { colorHex: e.target.value })} />
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{item.colorHex}</span>
          </div>
        </div>
      )}

      <div className="panel-section">
        <div className="btn-row">
          {/* Duplicate is single-piece: duplicating a group would need the copies to keep the
              arrangement and become the new selection, which is a feature, not a side effect. */}
          <button className="btn" disabled={group} onClick={() => duplicateItem(item.id)}>
            Duplicate
          </button>
          {/* Delete does apply to the whole group — clearing an arrangement in one go is exactly
              the kind of thing you select several pieces for. */}
          <button
            className="btn btn-danger"
            onClick={() => {
              const ids = [selectedId, ...alsoSelectedIds];
              ids.forEach((id) => removeItem(id));
            }}
          >
            {group ? `Delete ${groupCount}` : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
