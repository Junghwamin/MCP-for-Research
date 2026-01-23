// 논문 저자 정보
export interface Author {
  name: string;
  authorId?: string;
  affiliations?: string[];
}

// 논문 기본 정보
export interface Paper {
  id: string;                    // arXiv ID 또는 Semantic Scholar ID
  title: string;
  authors: Author[];
  abstract: string;
  year: number;
  venue?: string;                // 학회/저널명
  citationCount?: number;
  referenceCount?: number;
  pdfUrl?: string;
  arxivId?: string;
  doi?: string;
  url?: string;
  publicationDate?: string;
  categories?: string[];         // arXiv 카테고리 (cs.AI, cs.LG 등)
}

// 검색 결과
export interface SearchResult {
  papers: Paper[];
  totalResults: number;
  offset: number;
  limit: number;
}

// 검색 옵션
export interface SearchOptions {
  query: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'date' | 'citations';
  yearFrom?: number;
  yearTo?: number;
  venue?: string;
  offset?: number;
}

// 인용 정보
export interface Citation {
  paper: Paper;
  isInfluential?: boolean;       // Semantic Scholar의 influential citation 여부
}

// OpenReview 리뷰 정보
export interface Review {
  rating: number;
  confidence: number;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
}

// OpenReview 논문 정보
export interface OpenReviewPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  venue: string;
  year: number;
  decision?: 'Accept' | 'Reject' | 'Pending';
  reviews: Review[];
  averageRating?: number;
  pdfUrl?: string;
}

// BibTeX 엔트리
export interface BibTeXEntry {
  type: 'article' | 'inproceedings' | 'misc';
  citationKey: string;
  fields: {
    title: string;
    author: string;
    year: string;
    journal?: string;
    booktitle?: string;
    volume?: string;
    pages?: string;
    doi?: string;
    url?: string;
    eprint?: string;           // arXiv ID
    archivePrefix?: string;    // arXiv
    primaryClass?: string;     // arXiv 카테고리
  };
}

// 캐시 엔트리
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// API 응답 타입
export interface ArxivEntry {
  id: string[];
  title: string[];
  summary: string[];
  author: Array<{ name: string[] }>;
  published: string[];
  updated: string[];
  'arxiv:primary_category'?: Array<{ $: { term: string } }>;
  category?: Array<{ $: { term: string } }>;
  link?: Array<{ $: { href: string; type?: string; title?: string } }>;
}

export interface ArxivResponse {
  feed: {
    entry?: ArxivEntry[];
    'opensearch:totalResults'?: string[];
  };
}

// Semantic Scholar API 응답 타입
export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  referenceCount?: number;
  authors?: Array<{
    authorId: string;
    name: string;
  }>;
  externalIds?: {
    ArXiv?: string;
    DOI?: string;
  };
  openAccessPdf?: {
    url: string;
  };
  publicationDate?: string;
  isOpenAccess?: boolean;
}

export interface SemanticScholarSearchResponse {
  total: number;
  offset: number;
  data: SemanticScholarPaper[];
}

// 내보내기 포맷
export type ExportFormat = 'json' | 'csv' | 'bibtex';

// 다운로드 결과
export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}
