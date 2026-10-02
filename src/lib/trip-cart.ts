import { useSyncExternalStore } from "react";

export type CartItem = { service_id: string; title: string; provider: string; price: number; currency: string; date: string; quantity: number };
const KEY = "eb-trip-cart";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;
const EMPTY: CartItem[] = [];

function read(): CartItem[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartItem[]; } catch { cache = []; }
  return cache;
}
function write(items: CartItem[]) {
  cache = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export const tripCart = {
  add: (i: CartItem) => write([...read().filter((x) => !(x.service_id === i.service_id && x.date === i.date)), i]),
  remove: (idx: number) => write(read().filter((_, i) => i !== idx)),
  update: (idx: number, patch: Partial<CartItem>) => write(read().map((x, i) => (i === idx ? { ...x, ...patch } : x))),
  clear: () => write([]),
};

export function useTripCart() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => EMPTY,
  );
}
