import type { PlacedItem, SunSettings } from '../lib/types';

/**
 * The saved-designs API.
 *
 * Everything under /api/designs is walled and answers 401 when signed out — that is the normal,
 * expected case on the public page, not an error, so every call here reports "unauthorised" as a
 * value rather than throwing.
 */

/** The immutable, always-present design. Synthetic: there is no row for it on the server. */
export const EMPTY_ID = 'empty';
export const EMPTY_NAME = 'Empty';

export interface DesignMeta {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Exactly what a design stores — the frontend owns this shape; the backend treats it as a blob. */
export interface DesignPayload {
  items: PlacedItem[];
  sun?: SunSettings;
  /**
   * Legacy: snap used to be saved with the design. It is a drafting aid, not part of the flat, and
   * a design that had it on turned it back on for every device that opened it — so it is now a
   * session-only toggle that always starts off. Kept in the type only to read old payloads.
   * @deprecated
   */
  gridSnap?: boolean;
}

export class Unauthorised extends Error {
  constructor() {
    super('Not signed in');
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
  });
  if (res.status === 401 || res.status === 403) throw new Unauthorised();
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchSession(): Promise<boolean> {
  try {
    const s = await req<{ authenticated: boolean }>('/api/session');
    return !!s.authenticated;
  } catch {
    return false;
  }
}

/** The flat's address. Only a signed-in visitor gets it (the server answers 401 otherwise). */
export interface Place {
  unit: string;
  street: string;
  postcode: string;
  city: string;
}

export async function fetchPlace(): Promise<Place | null> {
  try {
    return await req<Place>('/api/place');
  } catch {
    return null;
  }
}

export const listDesigns = () =>
  req<{ designs: DesignMeta[]; defaultId: string }>('/api/designs');

export const loadDesign = (id: string) =>
  req<DesignMeta & { data: DesignPayload | null }>(`/api/designs/${encodeURIComponent(id)}`);

export const createDesign = (name: string, data: DesignPayload) =>
  req<DesignMeta>('/api/designs', { method: 'POST', body: JSON.stringify({ name, data }) });

export const saveDesign = (id: string, data: DesignPayload) =>
  req<DesignMeta>(`/api/designs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  });

export const renameDesign = (id: string, name: string) =>
  req<DesignMeta>(`/api/designs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

export const deleteDesign = (id: string) =>
  req<void>(`/api/designs/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const setDefaultDesign = (id: string) =>
  req<{ defaultId: string }>('/api/default-design', {
    method: 'PUT',
    body: JSON.stringify({ id }),
  });

/** Where to send someone who wants to sign in, coming back to exactly this page. */
export const signInUrl = () =>
  `https://auth.osmosis.work/?next=${encodeURIComponent(window.location.href)}`;
