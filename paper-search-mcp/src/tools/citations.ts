import {
  getCitations as s2GetCitations,
  getReferences as s2GetReferences,
  getRecommendations,
} from '../api/semanticScholar.js';
import { Citation, Paper } from '../types/paper.js';
import { cachedFetch, createCacheKey } from '../cache/searchCache.js';

// 인용 논문 가져오기 (이 논문을 인용한 논문들)
export async function getCitations(paperId: string, limit: number = 10): Promise<Citation[]> {
  const cacheKey = createCacheKey('citations', { paperId, limit });

  return cachedFetch(cacheKey, async () => {
    return await s2GetCitations(paperId, limit);
  });
}

// 참조 논문 가져오기 (이 논문이 참조하는 논문들)
export async function getReferences(paperId: string, limit: number = 10): Promise<Citation[]> {
  const cacheKey = createCacheKey('references', { paperId, limit });

  return cachedFetch(cacheKey, async () => {
    return await s2GetReferences(paperId, limit);
  });
}

// 관련 논문 가져오기
export async function getRelatedPapers(paperId: string, limit: number = 10): Promise<Paper[]> {
  const cacheKey = createCacheKey('related', { paperId, limit });

  return cachedFetch(cacheKey, async () => {
    return await getRecommendations(paperId, limit);
  });
}

// 인용 논문 포맷팅
export function formatCitations(citations: Citation[], paperId: string): string {
  if (citations.length === 0) {
    return `No citations found for paper ${paperId}`;
  }

  const lines: string[] = [];
  lines.push(`## Papers citing ${paperId} (${citations.length} found)\n`);

  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];
    const paper = citation.paper;
    const influential = citation.isInfluential ? ' ⭐ Influential' : '';

    lines.push(`${i + 1}. **${paper.title}**${influential}`);
    lines.push(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`);
    lines.push(`   Year: ${paper.year || 'N/A'} | Citations: ${paper.citationCount ?? 'N/A'}`);

    if (paper.venue) {
      lines.push(`   Venue: ${paper.venue}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}

// 참조 논문 포맷팅
export function formatReferences(references: Citation[], paperId: string): string {
  if (references.length === 0) {
    return `No references found for paper ${paperId}`;
  }

  const lines: string[] = [];
  lines.push(`## References from ${paperId} (${references.length} found)\n`);

  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const paper = ref.paper;
    const influential = ref.isInfluential ? ' ⭐ Influential' : '';

    lines.push(`${i + 1}. **${paper.title}**${influential}`);
    lines.push(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`);
    lines.push(`   Year: ${paper.year || 'N/A'} | Citations: ${paper.citationCount ?? 'N/A'}`);

    if (paper.venue) {
      lines.push(`   Venue: ${paper.venue}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}

// 관련 논문 포맷팅
export function formatRelatedPapers(papers: Paper[], paperId: string): string {
  if (papers.length === 0) {
    return `No related papers found for ${paperId}`;
  }

  const lines: string[] = [];
  lines.push(`## Related papers to ${paperId} (${papers.length} found)\n`);

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];

    lines.push(`${i + 1}. **${paper.title}**`);
    lines.push(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`);
    lines.push(`   Year: ${paper.year || 'N/A'} | Citations: ${paper.citationCount ?? 'N/A'}`);

    if (paper.venue) {
      lines.push(`   Venue: ${paper.venue}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}
