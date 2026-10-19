// The store keeps furniture dimensions/positions in centimeters (the unit you'd actually
// order furniture in); the 3D scene works in meters. Convert only at the render boundary.
export const cmToM = (cm: number) => cm / 100;
export const mToCm = (m: number) => m * 100;

export function formatCm(cm: number): string {
  return `${Math.round(cm)}`;
}
