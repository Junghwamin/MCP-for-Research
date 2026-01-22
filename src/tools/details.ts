import { getArxivPaper } from '../api/arxiv.js';
import { getSemanticScholarPaper } from '../api/semanticScholar.js';
import { Paper } from '../types/paper.js';
import { cachedFetch, createCacheKey } from '../cache/searchCache.js';

// 논문 상세 정보 가져오기
export async function getPaperDetails(paperId: string): Promise<Paper | null> {
  const cacheKey = createCacheKey('details', { paperId });

  return cachedFetch(cacheKey, async () => {
    // arXiv ID 형식인지 확인
    const isArxivId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(paperId);

    if (isArxivId) {
      // arXiv와 Semantic Scholar 모두에서 정보 가져오기
      const [arxivResult, s2Result] = await Promise.allSettled([
        getArxivPaper(paperId),
        getSemanticScholarPaper(paperId),
      ]);

      // 결과 병합
      let paper: Paper | null = null;

      if (arxivResult.status === 'fulfilled' && arxivResult.value) {
        paper = arxivResult.value;
      }

      if (s2Result.status === 'fulfilled' && s2Result.value) {
        if (paper) {
          // arXiv 정보와 Semantic Scholar 정보 병합
          paper = {
            ...paper,
            citationCount: s2Result.value.citationCount,
            referenceCount: s2Result.value.referenceCount,
            venue: s2Result.value.venue || paper.venue,
          };
        } else {
          paper = s2Result.value;
        }
      }

      return paper;
    } else {
      // Semantic Scholar ID로 검색
      const s2Paper = await getSemanticScholarPaper(paperId);

      if (s2Paper && s2Paper.arxivId) {
        // arXiv 정보도 가져오기
        const arxivPaper = await getArxivPaper(s2Paper.arxivId);
        if (arxivPaper) {
          return {
            ...s2Paper,
            pdfUrl: s2Paper.pdfUrl || arxivPaper.pdfUrl,
            categories: arxivPaper.categories,
          };
        }
      }

      return s2Paper;
    }
  });
}

// 논문 상세 정보 포맷팅
export function formatPaperDetails(paper: Paper): string {
  const lines: string[] = [];

  lines.push(`# ${paper.title}\n`);

  // 저자
  lines.push(`**Authors:** ${paper.authors.map(a => a.name).join(', ')}\n`);

  // 메타데이터
  lines.push('## Metadata');
  lines.push(`- **Year:** ${paper.year || 'N/A'}`);

  if (paper.venue) {
    lines.push(`- **Venue:** ${paper.venue}`);
  }

  lines.push(`- **Citations:** ${paper.citationCount ?? 'N/A'}`);
  lines.push(`- **References:** ${paper.referenceCount ?? 'N/A'}`);

  if (paper.arxivId) {
    lines.push(`- **arXiv ID:** ${paper.arxivId}`);
  }

  if (paper.doi) {
    lines.push(`- **DOI:** ${paper.doi}`);
  }

  if (paper.categories && paper.categories.length > 0) {
    lines.push(`- **Categories:** ${paper.categories.join(', ')}`);
  }

  // 링크
  lines.push('\n## Links');

  if (paper.url) {
    lines.push(`- **URL:** ${paper.url}`);
  }

  if (paper.pdfUrl) {
    lines.push(`- **PDF:** ${paper.pdfUrl}`);
  }

  // 초록
  lines.push('\n## Abstract');
  lines.push(paper.abstract || 'No abstract available.');

  // ID (다른 도구에서 사용할 수 있도록)
  lines.push(`\n---\n**Paper ID:** ${paper.id}`);

  return lines.join('\n');
}
