// pdf.js 6 calls Map / WeakMap `getOrInsert` and `getOrInsertComputed`, recent JavaScript additions that most
// browsers don't ship yet: without them a PDF opens as a blank page. Same behaviour as the proposals.
type Upsert<K, V> = { has(k: K): boolean; get(k: K): V | undefined; set(k: K, v: V): unknown };

for (const proto of [Map.prototype, WeakMap.prototype] as unknown as Record<string, unknown>[]) {
  if (typeof proto.getOrInsert !== 'function')
    proto.getOrInsert = function <K, V>(this: Upsert<K, V>, key: K, value: V) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    };
  if (typeof proto.getOrInsertComputed !== 'function')
    proto.getOrInsertComputed = function <K, V>(this: Upsert<K, V>, key: K, make: (k: K) => V) {
      if (!this.has(key)) this.set(key, make(key));
      return this.get(key);
    };
}

// pdf.js also sums with Math.sumPrecise (same addition); a plain sum is close enough for drawing a page.
const M = Math as unknown as { sumPrecise?: (values: Iterable<number>) => number };
if (typeof M.sumPrecise !== 'function') M.sumPrecise = values => { let total = 0; for (const v of values) total += v; return total; };

export {};
