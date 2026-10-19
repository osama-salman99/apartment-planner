// Phone detection — viewport-size only, no user-agent sniffing.
//
// The mobile layout is only appropriate for genuinely phone-sized screens. We key off the SHORTER
// viewport side rather than the UA because:
//   - Android tablets carry "Android" in their UA, so a UA test wrongly flagged them as phones.
//   - "Request desktop site" changes the UA/viewport width; a size test honours it naturally.
// A phone's short side is ≤ ~430px (even the largest); a tablet's is ≥ ~600px (7" and up). The
// 600px cutoff sits in the gap with wide margin, so phones get the mobile view and every tablet or
// desktop gets the full app.
export const PHONE_MAX_SHORT_SIDE = 600;

export function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return Math.min(window.innerWidth, window.innerHeight) < PHONE_MAX_SHORT_SIDE;
}
