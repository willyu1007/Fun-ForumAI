/**
 * Minimal LRU Map based on Map insertion-order semantics.
 * delete+set moves a key to the end (most recently used).
 * When capacity is exceeded, the first (least recently used) key is evicted.
 */
export class LruMap<K, V> {
  private readonly map = new Map<K, V>()

  constructor(private readonly capacity: number) {
    if (capacity < 1) throw new RangeError('LruMap capacity must be >= 1')
  }

  get size(): number {
    return this.map.size
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): this {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value as K
      this.map.delete(oldest)
    }
    this.map.set(key, value)
    return this
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }
}
