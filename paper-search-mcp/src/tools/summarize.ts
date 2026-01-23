import { getPaperDetails } from './details.js';
import { Paper } from '../types/paper.js';

// 논문 요약 생성 (초록 기반)
export async function summarizePaper(paperId: string): Promise<{
  success: boolean;
  summary?: PaperSummary;
  error?: string;
}> {
  try {
    const paper = await getPaperDetails(paperId);

    if (!paper) {
      return {
        success: false,
        error: `Paper not found: ${paperId}`,
      };
    }

    const summary = generateSummary(paper);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface PaperSummary {
  title: string;
  authors: string;
  year: number;
  venue?: string;
  citationCount?: number;
  keyInfo: {
    purpose?: string;
    method?: string;
    results?: string;
    contribution?: string;
  };
  abstractSummary: string;
}

// 초록에서 핵심 정보 추출
function generateSummary(paper: Paper): PaperSummary {
  const abstract = paper.abstract || '';

  // 문장 분리
  const sentences = abstract
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  // 핵심 정보 추출 (휴리스틱 기반)
  const keyInfo: PaperSummary['keyInfo'] = {};

  // 목적/동기 추출 (첫 1-2문장 또는 특정 키워드 포함 문장)
  const purposeKeywords = ['propose', 'present', 'introduce', 'aim', 'goal', 'address', 'tackle', 'solve'];
  const purposeSentence = sentences.find(s =>
    purposeKeywords.some(k => s.toLowerCase().includes(k))
  ) || sentences[0];
  if (purposeSentence) {
    keyInfo.purpose = purposeSentence;
  }

  // 방법론 추출
  const methodKeywords = ['method', 'approach', 'technique', 'algorithm', 'model', 'framework', 'architecture', 'using', 'leverage', 'employ'];
  const methodSentence = sentences.find(s =>
    methodKeywords.some(k => s.toLowerCase().includes(k)) &&
    s !== purposeSentence
  );
  if (methodSentence) {
    keyInfo.method = methodSentence;
  }

  // 결과 추출
  const resultKeywords = ['result', 'achieve', 'outperform', 'improve', 'show', 'demonstrate', 'experiment', 'evaluate', 'performance'];
  const resultSentence = sentences.find(s =>
    resultKeywords.some(k => s.toLowerCase().includes(k)) &&
    s !== purposeSentence &&
    s !== methodSentence
  );
  if (resultSentence) {
    keyInfo.results = resultSentence;
  }

  // 기여 추출
  const contributionKeywords = ['contribution', 'novel', 'first', 'new', 'state-of-the-art', 'sota', 'significant'];
  const contributionSentence = sentences.find(s =>
    contributionKeywords.some(k => s.toLowerCase().includes(k)) &&
    s !== purposeSentence &&
    s !== methodSentence &&
    s !== resultSentence
  );
  if (contributionSentence) {
    keyInfo.contribution = contributionSentence;
  }

  // 요약 (처음 3문장)
  const abstractSummary = sentences.slice(0, 3).join(' ');

  return {
    title: paper.title,
    authors: paper.authors.map(a => a.name).join(', '),
    year: paper.year,
    venue: paper.venue,
    citationCount: paper.citationCount,
    keyInfo,
    abstractSummary,
  };
}

// 요약 결과 포맷팅
export function formatSummary(
  result: { success: boolean; summary?: PaperSummary; error?: string }
): string {
  if (!result.success || !result.summary) {
    return `Failed to generate summary\nError: ${result.error}`;
  }

  const summary = result.summary;
  const lines: string[] = [];

  lines.push(`# Summary: ${summary.title}\n`);
  lines.push(`**Authors:** ${summary.authors}`);
  lines.push(`**Year:** ${summary.year}${summary.venue ? ` | **Venue:** ${summary.venue}` : ''}`);

  if (summary.citationCount !== undefined) {
    lines.push(`**Citations:** ${summary.citationCount}`);
  }

  lines.push('\n## Key Information\n');

  if (summary.keyInfo.purpose) {
    lines.push(`### Purpose/Goal`);
    lines.push(summary.keyInfo.purpose);
    lines.push('');
  }

  if (summary.keyInfo.method) {
    lines.push(`### Method/Approach`);
    lines.push(summary.keyInfo.method);
    lines.push('');
  }

  if (summary.keyInfo.results) {
    lines.push(`### Results`);
    lines.push(summary.keyInfo.results);
    lines.push('');
  }

  if (summary.keyInfo.contribution) {
    lines.push(`### Contribution`);
    lines.push(summary.keyInfo.contribution);
    lines.push('');
  }

  lines.push('## Brief Summary');
  lines.push(summary.abstractSummary);

  return lines.join('\n');
}
