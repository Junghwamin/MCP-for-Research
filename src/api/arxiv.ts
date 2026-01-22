import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { Paper, SearchOptions, SearchResult, ArxivResponse, ArxivEntry } from '../types/paper.js';

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';
const RATE_LIMIT_DELAY = 3000; // 3초 대기 (arXiv 권장)

let lastRequestTime = 0;

// Rate limiting을 위한 대기 함수
async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// arXiv 엔트리를 Paper 타입으로 변환
function parseArxivEntry(entry: ArxivEntry): Paper {
  const id = entry.id[0].split('/abs/')[1] || entry.id[0];
  const arxivId = id.replace('http://arxiv.org/abs/', '').replace('https://arxiv.org/abs/', '');

  // PDF 링크 찾기
  let pdfUrl: string | undefined;
  if (entry.link) {
    const pdfLink = entry.link.find(l => l.$.title === 'pdf' || l.$.type === 'application/pdf');
    pdfUrl = pdfLink?.$.href || `https://arxiv.org/pdf/${arxivId}.pdf`;
  } else {
    pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
  }

  // 카테고리 추출
  const categories: string[] = [];
  if (entry['arxiv:primary_category']) {
    categories.push(entry['arxiv:primary_category'][0].$.term);
  }
  if (entry.category) {
    entry.category.forEach(cat => {
      if (!categories.includes(cat.$.term)) {
        categories.push(cat.$.term);
      }
    });
  }

  // 연도 추출
  const publishedDate = entry.published[0];
  const year = new Date(publishedDate).getFullYear();

  return {
    id: arxivId,
    arxivId,
    title: entry.title[0].replace(/\s+/g, ' ').trim(),
    abstract: entry.summary[0].replace(/\s+/g, ' ').trim(),
    authors: entry.author.map(a => ({ name: a.name[0] })),
    year,
    publicationDate: publishedDate,
    pdfUrl,
    url: `https://arxiv.org/abs/${arxivId}`,
    categories,
  };
}

// arXiv 검색
export async function searchArxiv(options: SearchOptions): Promise<SearchResult> {
  await rateLimitWait();

  const { query, maxResults = 10, sortBy = 'relevance', yearFrom, yearTo, offset = 0 } = options;

  // 검색 쿼리 구성
  let searchQuery = `all:${query}`;

  // 연도 필터 (arXiv는 submittedDate로 필터링)
  // 참고: arXiv API는 날짜 범위 필터가 제한적이므로, 결과를 가져온 후 필터링

  // 정렬 옵션
  let sortByParam = 'relevance';
  let sortOrder = 'descending';
  if (sortBy === 'date') {
    sortByParam = 'submittedDate';
    sortOrder = 'descending';
  }

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: offset.toString(),
    max_results: maxResults.toString(),
    sortBy: sortByParam,
    sortOrder: sortOrder,
  });

  try {
    const response = await axios.get(`${ARXIV_API_BASE}?${params.toString()}`);
    const parsed: ArxivResponse = await parseStringPromise(response.data);

    if (!parsed.feed.entry) {
      return {
        papers: [],
        totalResults: 0,
        offset,
        limit: maxResults,
      };
    }

    let papers = parsed.feed.entry.map(parseArxivEntry);

    // 연도 필터링 (post-processing)
    if (yearFrom || yearTo) {
      papers = papers.filter(paper => {
        if (yearFrom && paper.year < yearFrom) return false;
        if (yearTo && paper.year > yearTo) return false;
        return true;
      });
    }

    const totalResults = parseInt(parsed.feed['opensearch:totalResults']?.[0] || '0', 10);

    return {
      papers,
      totalResults,
      offset,
      limit: maxResults,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`arXiv API error: ${error.message}`);
    }
    throw error;
  }
}

// arXiv ID로 논문 상세 정보 가져오기
export async function getArxivPaper(arxivId: string): Promise<Paper | null> {
  await rateLimitWait();

  // arXiv ID 정규화 (버전 번호 제거 옵션)
  const normalizedId = arxivId.replace(/v\d+$/, '');

  const params = new URLSearchParams({
    id_list: normalizedId,
  });

  try {
    const response = await axios.get(`${ARXIV_API_BASE}?${params.toString()}`);
    const parsed: ArxivResponse = await parseStringPromise(response.data);

    if (!parsed.feed.entry || parsed.feed.entry.length === 0) {
      return null;
    }

    return parseArxivEntry(parsed.feed.entry[0]);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`arXiv API error: ${error.message}`);
    }
    throw error;
  }
}

// 저자로 검색
export async function searchArxivByAuthor(authorName: string, limit: number = 10): Promise<Paper[]> {
  await rateLimitWait();

  const params = new URLSearchParams({
    search_query: `au:${authorName}`,
    start: '0',
    max_results: limit.toString(),
    sortBy: 'submittedDate',
    sortOrder: 'descending',
  });

  try {
    const response = await axios.get(`${ARXIV_API_BASE}?${params.toString()}`);
    const parsed: ArxivResponse = await parseStringPromise(response.data);

    if (!parsed.feed.entry) {
      return [];
    }

    return parsed.feed.entry.map(parseArxivEntry);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`arXiv API error: ${error.message}`);
    }
    throw error;
  }
}

// PDF 다운로드 URL 가져오기
export function getArxivPdfUrl(arxivId: string): string {
  const normalizedId = arxivId.replace(/v\d+$/, '');
  return `https://arxiv.org/pdf/${normalizedId}.pdf`;
}
