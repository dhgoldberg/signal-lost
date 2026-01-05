// Mulberry32 seeded RNG (fast, deterministic)
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, maxInclusive: number) {
      return Math.floor(this.next() * (maxInclusive - min + 1)) + min;
    },
    pick<T>(arr: T[]) {
      return arr[this.int(0, arr.length - 1)];
    },
    shuffle<T>(arr: T[]) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.int(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
