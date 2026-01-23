import { CacheEntry } from '../types/paper.js';

// 기본 TTL: 30분 (밀리초)
const DEFAULT_TTL = 30 * 60 * 1000;

// 최대 캐시 항목 수
const MAX_CACHE_SIZE = 100;

class SearchCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private accessOrder: string[] = [];

  // 캐시에서 데이터 가져오기
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // TTL 확인
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.delete(key);
      return null;
    }

    // 접근 순서 업데이트 (LRU)
    this.updateAccessOrder(key);

    return entry.data as T;
  }

  // 캐시에 데이터 저장
  set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
    // 캐시 크기 제한 확인
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  // 특정 키 삭제
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }
    return deleted;
  }

  // 캐시 전체 초기화
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  // 특정 패턴에 매칭되는 키 삭제
  clearPattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  // 캐시 통계
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
      keys: Array.from(this.cache.keys()),
    };
  }

  // 접근 순서 업데이트
  private updateAccessOrder(key: string): void {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  // 가장 오래된 항목 제거 (LRU)
  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

// 싱글톤 인스턴스
const searchCache = new SearchCache();

// 캐시 키 생성 헬퍼
export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');

  return `${prefix}:${sortedParams}`;
}

// 캐시된 함수 실행
export async function cachedFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 캐시에서 먼저 확인
  const cached = searchCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 없으면 fetch 실행
  const data = await fetchFn();

  // 캐시에 저장
  searchCache.set(cacheKey, data, ttl);

  return data;
}

export { searchCache };
export default searchCache;
