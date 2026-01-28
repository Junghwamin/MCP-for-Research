import { searchArxiv, searchArxivByAuthor } from '../api/arxiv.js';
import { searchSemanticScholar, searchByAuthor as s2SearchByAuthor } from '../api/semanticScholar.js';
import { Paper, SearchOptions, SearchResult } from '../types/paper.js';
import { cachedFetch, createCacheKey } from '../cache/searchCache.js';

// 논문 검색 (arXiv + Semantic Scholar 통합)
export async function searchPapers(options: SearchOptions): Promise<SearchResult> {
  const cacheKey = createCacheKey('search', options);

  return cachedFetch(cacheKey, async () => {
    const { sortBy = 'relevance' } = options;

    // Semantic Scholar를 주 검색 엔진으로 사용 (인용 정보 포함)
    // arXiv는 보조로 사용
    const [s2Result, arxivResult] = await Promise.allSettled([
      searchSemanticScholar(options),
      searchArxiv(options),
    ]);

    const papers: Paper[] = [];
    const seenIds = new Set<string>();
    let totalResults = 0;

    // Semantic Scholar 결과 추가
    if (s2Result.status === 'fulfilled') {
      totalResults = s2Result.value.totalResults;
      for (const paper of s2Result.value.papers) {
        if (!seenIds.has(paper.id)) {
          papers.push(paper);
          seenIds.add(paper.id);
          // arXiv ID도 중복 체크에 추가
          if (paper.arxivId) {
            seenIds.add(paper.arxivId);
          }
        }
      }
    }

    // arXiv 결과 추가 (Semantic Scholar에 없는 것만)
    if (arxivResult.status === 'fulfilled') {
      for (const paper of arxivResult.value.papers) {
        if (!seenIds.has(paper.id) && !seenIds.has(paper.arxivId || '')) {
          papers.push(paper);
          seenIds.add(paper.id);
        }
      }
      if (totalResults === 0) {
        totalResults = arxivResult.value.totalResults;
      }
    }

    // 정렬
    if (sortBy === 'citations') {
      papers.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    } else if (sortBy === 'date') {
      papers.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    return {
      papers: papers.slice(0, options.maxResults || 10),
      totalResults,
      offset: options.offset || 0,
      limit: options.maxResults || 10,
    };
  });
}

// 저자로 검색
export async function searchByAuthor(authorName: string, limit: number = 10): Promise<Paper[]> {
  const cacheKey = createCacheKey('author', { authorName, limit });

  return cachedFetch(cacheKey, async () => {
    const [s2Result, arxivResult] = await Promise.allSettled([
      s2SearchByAuthor(authorName, limit),
      searchArxivByAuthor(authorName, limit),
    ]);

    const papers: Paper[] = [];
    const seenIds = new Set<string>();

    // Semantic Scholar 결과 우선
    if (s2Result.status === 'fulfilled') {
      for (const paper of s2Result.value) {
        if (!seenIds.has(paper.id)) {
          papers.push(paper);
          seenIds.add(paper.id);
          if (paper.arxivId) seenIds.add(paper.arxivId);
        }
      }
    }

    // arXiv 결과 추가
    if (arxivResult.status === 'fulfilled') {
      for (const paper of arxivResult.value) {
        if (!seenIds.has(paper.id)) {
          papers.push(paper);
          seenIds.add(paper.id);
        }
      }
    }

    // 연도순 정렬
    papers.sort((a, b) => (b.year || 0) - (a.year || 0));

    return papers.slice(0, limit);
  });
}

// 검색 결과 포맷팅 (MCP 응답용)
export function formatSearchResult(result: SearchResult): string {
  if (result.papers.length === 0) {
    return 'No papers found.';
  }

  const lines: string[] = [];
  lines.push(`Found ${result.totalResults} papers (showing ${result.papers.length}):\n`);

  for (let i = 0; i < result.papers.length; i++) {
    const paper = result.papers[i];
    lines.push(`${i + 1}. **${paper.title}**`);
    lines.push(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`);
    lines.push(`   Year: ${paper.year || 'N/A'} | Citations: ${paper.citationCount ?? 'N/A'}`);

    if (paper.venue) {
      lines.push(`   Venue: ${paper.venue}`);
    }

    if (paper.arxivId) {
      lines.push(`   arXiv: ${paper.arxivId}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}

// 저자 검색 결과 포맷팅
export function formatAuthorSearchResult(papers: Paper[], authorName: string): string {
  if (papers.length === 0) {
    return `No papers found for author: ${authorName}`;
  }

  const lines: string[] = [];
  lines.push(`Papers by ${authorName} (${papers.length} found):\n`);

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    lines.push(`${i + 1}. **${paper.title}** (${paper.year || 'N/A'})`);
    lines.push(`   Citations: ${paper.citationCount ?? 'N/A'}`);

    if (paper.venue) {
      lines.push(`   Venue: ${paper.venue}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}
