import {
  searchOpenReview as apiSearchOpenReview,
  getOpenReviewInfo as apiGetOpenReviewInfo,
  getSupportedVenues,
} from '../api/openreview.js';
import { OpenReviewPaper } from '../types/paper.js';
import { cachedFetch, createCacheKey } from '../cache/searchCache.js';

// OpenReview에서 논문 검색
export async function searchOpenReview(
  venue: string,
  query?: string,
  year?: number,
  limit: number = 20
): Promise<OpenReviewPaper[]> {
  const cacheKey = createCacheKey('openreview_search', { venue, query, year, limit });

  return cachedFetch(cacheKey, async () => {
    return await apiSearchOpenReview(venue, query, year, limit);
  });
}

// OpenReview 논문 정보 조회
export async function getOpenReviewInfo(identifier: string): Promise<OpenReviewPaper | null> {
  const cacheKey = createCacheKey('openreview_info', { identifier });

  return cachedFetch(cacheKey, async () => {
    return await apiGetOpenReviewInfo(identifier);
  });
}

// OpenReview 검색 결과 포맷팅
export function formatOpenReviewSearchResult(
  papers: OpenReviewPaper[],
  venue: string
): string {
  if (papers.length === 0) {
    const supported = getSupportedVenues();
    return `No papers found for venue: ${venue}\n\nSupported venues: ${supported.join(', ')}`;
  }

  const lines: string[] = [];
  lines.push(`## OpenReview papers from ${venue.toUpperCase()} (${papers.length} found)\n`);

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];

    lines.push(`${i + 1}. **${paper.title}**`);
    lines.push(`   Authors: ${paper.authors.join(', ')}`);
    lines.push(`   Year: ${paper.year} | Decision: ${paper.decision || 'Pending'}`);

    if (paper.averageRating !== undefined) {
      lines.push(`   Average Rating: ${paper.averageRating}/10`);
    }

    if (paper.reviews.length > 0) {
      lines.push(`   Reviews: ${paper.reviews.length}`);
    }

    lines.push(`   ID: ${paper.id}`);
    lines.push('');
  }

  return lines.join('\n');
}

// OpenReview 논문 상세 정보 포맷팅
export function formatOpenReviewInfo(paper: OpenReviewPaper): string {
  const lines: string[] = [];

  lines.push(`# ${paper.title}\n`);
  lines.push(`**Authors:** ${paper.authors.join(', ')}\n`);

  // 메타데이터
  lines.push('## Metadata');
  lines.push(`- **Venue:** ${paper.venue}`);
  lines.push(`- **Year:** ${paper.year}`);
  lines.push(`- **Decision:** ${paper.decision || 'Pending'}`);

  if (paper.averageRating !== undefined) {
    lines.push(`- **Average Rating:** ${paper.averageRating}/10`);
  }

  if (paper.pdfUrl) {
    lines.push(`- **PDF:** ${paper.pdfUrl}`);
  }

  // 초록
  lines.push('\n## Abstract');
  lines.push(paper.abstract || 'No abstract available.');

  // 리뷰
  if (paper.reviews.length > 0) {
    lines.push('\n## Reviews');

    for (let i = 0; i < paper.reviews.length; i++) {
      const review = paper.reviews[i];
      lines.push(`\n### Reviewer ${i + 1}`);
      lines.push(`- **Rating:** ${review.rating}/10`);
      lines.push(`- **Confidence:** ${review.confidence}/5`);

      if (review.summary) {
        lines.push(`- **Summary:** ${review.summary.slice(0, 200)}...`);
      }

      if (review.strengths && review.strengths.length > 0) {
        lines.push('- **Strengths:**');
        review.strengths.slice(0, 3).forEach(s => {
          lines.push(`  - ${s.slice(0, 100)}...`);
        });
      }

      if (review.weaknesses && review.weaknesses.length > 0) {
        lines.push('- **Weaknesses:**');
        review.weaknesses.slice(0, 3).forEach(w => {
          lines.push(`  - ${w.slice(0, 100)}...`);
        });
      }
    }
  }

  lines.push(`\n---\n**OpenReview ID:** ${paper.id}`);

  return lines.join('\n');
}

// 지원 학회 목록 포맷팅
export function formatSupportedVenues(): string {
  const venues = getSupportedVenues();
  return `Supported venues for OpenReview search:\n${venues.map(v => `- ${v.toUpperCase()}`).join('\n')}\n\nExample: search_openreview with venue="neurips", year=2024`;
}
