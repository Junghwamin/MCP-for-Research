import axios from 'axios';
import { OpenReviewPaper, Review } from '../types/paper.js';

const OPENREVIEW_API_BASE = 'https://api2.openreview.net';
const RATE_LIMIT_DELAY = 500;

let lastRequestTime = 0;

async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

// 학회 venue ID 매핑
const VENUE_MAPPING: Record<string, string[]> = {
  'neurips': ['NeurIPS.cc', 'NIPS.cc'],
  'iclr': ['ICLR.cc'],
  'icml': ['ICML.cc'],
  'aaai': ['AAAI.org'],
  'acl': ['aclweb.org/ACL'],
  'emnlp': ['aclweb.org/EMNLP'],
  'cvpr': ['thecvf.com/CVPR'],
  'iccv': ['thecvf.com/ICCV'],
};

// OpenReview에서 논문 검색
export async function searchOpenReview(
  venue: string,
  query?: string,
  year?: number,
  limit: number = 20
): Promise<OpenReviewPaper[]> {
  await rateLimitWait();

  const venueKey = venue.toLowerCase();
  const venueIds = VENUE_MAPPING[venueKey] || [venue];

  try {
    const results: OpenReviewPaper[] = [];

    for (const venueId of venueIds) {
      let venuePath = venueId;
      if (year) {
        venuePath = `${venueId}/${year}`;
      }

      const params: Record<string, string | number> = {
        'content.venue': venuePath,
        limit,
        details: 'replyCount,invitation',
      };

      if (query) {
        params['content.title'] = query;
      }

      const response = await axios.get(`${OPENREVIEW_API_BASE}/notes`, { params });

      if (response.data.notes) {
        for (const note of response.data.notes) {
          const paper = await parseOpenReviewNote(note);
          if (paper) {
            results.push(paper);
          }
        }
      }

      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`OpenReview API error: ${error.message}`);
    }
    throw error;
  }
}

// 논문 ID나 제목으로 OpenReview 정보 조회
export async function getOpenReviewInfo(identifier: string): Promise<OpenReviewPaper | null> {
  await rateLimitWait();

  try {
    // 먼저 ID로 검색 시도
    let response = await axios.get(`${OPENREVIEW_API_BASE}/notes`, {
      params: { id: identifier },
    });

    if (!response.data.notes || response.data.notes.length === 0) {
      // 제목으로 검색 시도
      response = await axios.get(`${OPENREVIEW_API_BASE}/notes`, {
        params: {
          'content.title': identifier,
          limit: 5,
        },
      });
    }

    if (!response.data.notes || response.data.notes.length === 0) {
      return null;
    }

    const note = response.data.notes[0];
    return await parseOpenReviewNote(note, true);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`OpenReview API error: ${error.message}`);
    }
    throw error;
  }
}

// OpenReview note를 파싱
async function parseOpenReviewNote(
  note: any,
  includeReviews: boolean = false
): Promise<OpenReviewPaper | null> {
  try {
    const content = note.content || {};

    const paper: OpenReviewPaper = {
      id: note.id,
      title: content.title?.value || content.title || '',
      authors: parseAuthors(content.authors),
      abstract: content.abstract?.value || content.abstract || '',
      venue: content.venue?.value || content.venue || extractVenue(note.invitation),
      year: extractYear(note),
      reviews: [],
      pdfUrl: content.pdf?.value ? `https://openreview.net${content.pdf.value}` : undefined,
    };

    // 결정 상태 추출
    paper.decision = extractDecision(content);

    // 리뷰 정보 가져오기
    if (includeReviews) {
      paper.reviews = await getReviewsForPaper(note.id);
      if (paper.reviews.length > 0) {
        paper.averageRating = calculateAverageRating(paper.reviews);
      }
    }

    return paper;
  } catch (error) {
    console.error('Error parsing OpenReview note:', error);
    return null;
  }
}

// 저자 정보 파싱
function parseAuthors(authors: any): string[] {
  if (!authors) return [];
  if (Array.isArray(authors)) {
    return authors.map(a => (typeof a === 'string' ? a : a.value || a.name || ''));
  }
  if (authors.value && Array.isArray(authors.value)) {
    return authors.value;
  }
  return [];
}

// invitation에서 venue 추출
function extractVenue(invitation: string): string {
  if (!invitation) return '';
  const parts = invitation.split('/');
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return invitation;
}

// 연도 추출
function extractYear(note: any): number {
  if (note.content?.year?.value) {
    return parseInt(note.content.year.value, 10);
  }
  if (note.content?.year) {
    return parseInt(note.content.year, 10);
  }
  if (note.invitation) {
    const yearMatch = note.invitation.match(/\/(\d{4})\//);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10);
    }
  }
  if (note.cdate) {
    return new Date(note.cdate).getFullYear();
  }
  return new Date().getFullYear();
}

// 결정 상태 추출
function extractDecision(content: any): 'Accept' | 'Reject' | 'Pending' | undefined {
  const decision = content.decision?.value || content.decision;
  if (!decision) return 'Pending';

  const decisionLower = decision.toLowerCase();
  if (decisionLower.includes('accept')) return 'Accept';
  if (decisionLower.includes('reject')) return 'Reject';
  return 'Pending';
}

// 논문의 리뷰 가져오기
async function getReviewsForPaper(paperId: string): Promise<Review[]> {
  await rateLimitWait();

  try {
    const response = await axios.get(`${OPENREVIEW_API_BASE}/notes`, {
      params: {
        forum: paperId,
        details: 'replyCount',
      },
    });

    const reviews: Review[] = [];

    if (response.data.notes) {
      for (const note of response.data.notes) {
        // 리뷰인지 확인 (invitation에 'Review' 포함)
        if (note.invitation && note.invitation.toLowerCase().includes('review')) {
          const review = parseReview(note);
          if (review) {
            reviews.push(review);
          }
        }
      }
    }

    return reviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}

// 리뷰 파싱
function parseReview(note: any): Review | null {
  try {
    const content = note.content || {};

    // 평점 추출 (다양한 필드명 처리)
    let rating = 0;
    const ratingField = content.rating?.value || content.rating ||
                        content.recommendation?.value || content.recommendation ||
                        content.score?.value || content.score;

    if (ratingField) {
      const ratingMatch = ratingField.toString().match(/(\d+)/);
      if (ratingMatch) {
        rating = parseInt(ratingMatch[1], 10);
      }
    }

    // confidence 추출
    let confidence = 0;
    const confidenceField = content.confidence?.value || content.confidence;
    if (confidenceField) {
      const confMatch = confidenceField.toString().match(/(\d+)/);
      if (confMatch) {
        confidence = parseInt(confMatch[1], 10);
      }
    }

    return {
      rating,
      confidence,
      summary: content.summary?.value || content.summary,
      strengths: parseListField(content.strengths || content.pros),
      weaknesses: parseListField(content.weaknesses || content.cons),
    };
  } catch (error) {
    return null;
  }
}

// 목록 필드 파싱
function parseListField(field: any): string[] | undefined {
  if (!field) return undefined;
  const value = field.value || field;
  if (typeof value === 'string') {
    return value.split('\n').filter(s => s.trim());
  }
  if (Array.isArray(value)) {
    return value;
  }
  return undefined;
}

// 평균 평점 계산
function calculateAverageRating(reviews: Review[]): number {
  const validRatings = reviews.filter(r => r.rating > 0);
  if (validRatings.length === 0) return 0;

  const sum = validRatings.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / validRatings.length) * 10) / 10;
}

// 지원하는 학회 목록 반환
export function getSupportedVenues(): string[] {
  return Object.keys(VENUE_MAPPING);
}
