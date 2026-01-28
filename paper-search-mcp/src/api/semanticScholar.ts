import axios from 'axios';
import {
  Paper,
  SearchOptions,
  SearchResult,
  Citation,
  SemanticScholarPaper,
  SemanticScholarSearchResponse,
  Author,
} from '../types/paper.js';

const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1';
const RATE_LIMIT_DELAY = 1000; // 1초 대기

let lastRequestTime = 0;

// Rate limiting
async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// 요청할 필드 목록
const PAPER_FIELDS = [
  'paperId',
  'title',
  'abstract',
  'year',
  'venue',
  'citationCount',
  'referenceCount',
  'authors',
  'externalIds',
  'openAccessPdf',
  'publicationDate',
  'isOpenAccess',
].join(',');

// Semantic Scholar 논문을 Paper 타입으로 변환
function convertToPaper(s2Paper: SemanticScholarPaper): Paper {
  const authors: Author[] = s2Paper.authors?.map(a => ({
    name: a.name,
    authorId: a.authorId,
  })) || [];

  return {
    id: s2Paper.paperId,
    title: s2Paper.title,
    abstract: s2Paper.abstract || '',
    authors,
    year: s2Paper.year || 0,
    venue: s2Paper.venue,
    citationCount: s2Paper.citationCount,
    referenceCount: s2Paper.referenceCount,
    arxivId: s2Paper.externalIds?.ArXiv,
    doi: s2Paper.externalIds?.DOI,
    pdfUrl: s2Paper.openAccessPdf?.url,
    publicationDate: s2Paper.publicationDate,
    url: `https://www.semanticscholar.org/paper/${s2Paper.paperId}`,
  };
}

// 키워드로 논문 검색
export async function searchSemanticScholar(options: SearchOptions): Promise<SearchResult> {
  await rateLimitWait();

  const {
    query,
    maxResults = 10,
    yearFrom,
    yearTo,
    venue,
    offset = 0,
  } = options;

  const params: Record<string, string> = {
    query,
    fields: PAPER_FIELDS,
    limit: maxResults.toString(),
    offset: offset.toString(),
  };

  // 연도 필터
  if (yearFrom || yearTo) {
    const from = yearFrom || 1900;
    const to = yearTo || new Date().getFullYear();
    params.year = `${from}-${to}`;
  }

  // 학회 필터
  if (venue) {
    params.venue = venue;
  }

  try {
    const response = await axios.get<SemanticScholarSearchResponse>(
      `${S2_API_BASE}/paper/search`,
      { params }
    );

    const papers = response.data.data.map(convertToPaper);

    return {
      papers,
      totalResults: response.data.total,
      offset: response.data.offset,
      limit: maxResults,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Semantic Scholar API rate limit exceeded. Please wait and try again.');
      }
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}

// 논문 ID로 상세 정보 가져오기
export async function getSemanticScholarPaper(paperId: string): Promise<Paper | null> {
  await rateLimitWait();

  try {
    // paperId가 arXiv ID인 경우 처리
    let endpoint = `${S2_API_BASE}/paper/${paperId}`;
    if (paperId.match(/^\d{4}\.\d{4,5}(v\d+)?$/)) {
      // arXiv ID 형식
      endpoint = `${S2_API_BASE}/paper/arXiv:${paperId.replace(/v\d+$/, '')}`;
    }

    const response = await axios.get<SemanticScholarPaper>(endpoint, {
      params: { fields: PAPER_FIELDS },
    });

    return convertToPaper(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}

// 인용 논문 가져오기 (이 논문을 인용한 논문들)
export async function getCitations(paperId: string, limit: number = 10): Promise<Citation[]> {
  await rateLimitWait();

  try {
    let endpoint = `${S2_API_BASE}/paper/${paperId}/citations`;
    if (paperId.match(/^\d{4}\.\d{4,5}(v\d+)?$/)) {
      endpoint = `${S2_API_BASE}/paper/arXiv:${paperId.replace(/v\d+$/, '')}/citations`;
    }

    const response = await axios.get(endpoint, {
      params: {
        fields: `citingPaper.${PAPER_FIELDS},isInfluential`,
        limit: limit.toString(),
      },
    });

    return response.data.data.map((item: { citingPaper: SemanticScholarPaper; isInfluential: boolean }) => ({
      paper: convertToPaper(item.citingPaper),
      isInfluential: item.isInfluential,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return [];
      }
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}

// 참조 논문 가져오기 (이 논문이 참조하는 논문들)
export async function getReferences(paperId: string, limit: number = 10): Promise<Citation[]> {
  await rateLimitWait();

  try {
    let endpoint = `${S2_API_BASE}/paper/${paperId}/references`;
    if (paperId.match(/^\d{4}\.\d{4,5}(v\d+)?$/)) {
      endpoint = `${S2_API_BASE}/paper/arXiv:${paperId.replace(/v\d+$/, '')}/references`;
    }

    const response = await axios.get(endpoint, {
      params: {
        fields: `citedPaper.${PAPER_FIELDS},isInfluential`,
        limit: limit.toString(),
      },
    });

    return response.data.data.map((item: { citedPaper: SemanticScholarPaper; isInfluential: boolean }) => ({
      paper: convertToPaper(item.citedPaper),
      isInfluential: item.isInfluential,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return [];
      }
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}

// 관련 논문 추천
export async function getRecommendations(paperId: string, limit: number = 10): Promise<Paper[]> {
  await rateLimitWait();

  try {
    // Semantic Scholar의 추천 API 사용
    // 참조 논문과 인용 논문을 조합하여 관련 논문 추출
    const [citations, references] = await Promise.all([
      getCitations(paperId, Math.ceil(limit / 2)),
      getReferences(paperId, Math.ceil(limit / 2)),
    ]);

    const relatedPapers: Paper[] = [];
    const seenIds = new Set<string>();

    // 영향력 있는 인용 논문 우선
    citations
      .filter(c => c.isInfluential)
      .forEach(c => {
        if (!seenIds.has(c.paper.id)) {
          relatedPapers.push(c.paper);
          seenIds.add(c.paper.id);
        }
      });

    // 영향력 있는 참조 논문
    references
      .filter(r => r.isInfluential)
      .forEach(r => {
        if (!seenIds.has(r.paper.id)) {
          relatedPapers.push(r.paper);
          seenIds.add(r.paper.id);
        }
      });

    // 나머지 논문 추가
    [...citations, ...references].forEach(c => {
      if (!seenIds.has(c.paper.id) && relatedPapers.length < limit) {
        relatedPapers.push(c.paper);
        seenIds.add(c.paper.id);
      }
    });

    return relatedPapers.slice(0, limit);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}

// 저자로 검색
export async function searchByAuthor(authorName: string, limit: number = 10): Promise<Paper[]> {
  await rateLimitWait();

  try {
    // 저자 검색
    const authorResponse = await axios.get(`${S2_API_BASE}/author/search`, {
      params: {
        query: authorName,
        limit: '5',
      },
    });

    if (!authorResponse.data.data || authorResponse.data.data.length === 0) {
      return [];
    }

    const authorId = authorResponse.data.data[0].authorId;

    // 저자의 논문 가져오기
    await rateLimitWait();
    const papersResponse = await axios.get(`${S2_API_BASE}/author/${authorId}/papers`, {
      params: {
        fields: PAPER_FIELDS,
        limit: limit.toString(),
      },
    });

    return papersResponse.data.data.map(convertToPaper);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Semantic Scholar API error: ${error.message}`);
    }
    throw error;
  }
}
