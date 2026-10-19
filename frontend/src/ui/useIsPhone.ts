import { useEffect, useState } from 'react';
import { isPhoneViewport } from '../lib/device';

// Reactive phone check (viewport-size only — see lib/device). Re-evaluates on resize / orientation
// change and when "request desktop site" widens the viewport, so tablets and desktop always get the
// full app.
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhoneViewport);
  useEffect(() => {
    const on = () => setPhone(isPhoneViewport());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return phone;
}
