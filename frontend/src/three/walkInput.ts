// Shared movement flags set by the on-screen virtual arrows and read by WalkControls each frame.
// A plain mutable object (not React state) so pressing an arrow doesn't re-render the 3D scene.
export const walkInput = {
  fwd: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

export type WalkDir = keyof typeof walkInput;
