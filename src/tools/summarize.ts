import { parsePDF, analyzePaperStructure } from '../parsers/pdfParser.js';
import { generateSummary } from '../api/translator.js';
import type { SummarizePaperInput, SummaryResult } from '../types/translation.js';

// ============================================
// 논문 요약 도구
// ============================================

/**
 * 논문 요약 생성
 */
export async function summarizePaper(input: SummarizePaperInput): Promise<SummaryResult> {
  try {
    // 1. PDF 파싱
    const { text, metadata } = await parsePDF(input.pdfPath);

    // 2. 구조 분석
    const structure = analyzePaperStructure(text, metadata);

    // 3. 요약에 사용할 텍스트 준비
    // Abstract + Introduction + Conclusion 위주로 요약
    let summaryText = '';

    if (structure.abstract) {
      summaryText += `Abstract:\n${structure.abstract}\n\n`;
    }

    // Introduction 섹션 찾기
    const introSection = structure.sections.find(s =>
      s.name.toLowerCase().includes('introduction')
    );
    if (introSection) {
      summaryText += `Introduction:\n${introSection.content.slice(0, 3000)}\n\n`;
    }

    // Conclusion 섹션 찾기
    const conclusionSection = structure.sections.find(s =>
      s.name.toLowerCase().includes('conclusion')
    );
    if (conclusionSection) {
      summaryText += `Conclusion:\n${conclusionSection.content}\n\n`;
    }

    // 4. 요약 생성
    const summary = await generateSummary({
      text: summaryText,
      title: structure.title,
      language: input.language || 'ko',
      detailLevel: input.detailLevel || 'brief',
    });

    return {
      success: true,
      title: structure.title,
      summary,
      language: input.language || 'ko',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      title: '',
      summary: {
        threeLines: [],
        keywords: [],
        contributions: [],
        targetAudience: [],
      },
      language: input.language || 'ko',
      error: errorMessage,
    };
  }
}

/**
 * 요약 결과 포맷팅
 */
export function formatSummaryResult(result: SummaryResult): string {
  if (!result.success) {
    return `❌ 요약 생성 실패: ${result.error}`;
  }

  const lines = [
    '## 📌 논문 요약',
    '',
    `**제목**: ${result.title}`,
    '',
    '### 핵심 내용 (3줄)',
  ];

  result.summary.threeLines.forEach((line, i) => {
    lines.push(`${i + 1}. ${line}`);
  });

  lines.push('', '### 키워드');
  lines.push(result.summary.keywords.map(k => `\`${k}\``).join(', '));

  if (result.summary.contributions.length > 0) {
    lines.push('', '### 주요 기여점');
    result.summary.contributions.forEach(c => {
      lines.push(`- ${c}`);
    });
  }

  if (result.summary.targetAudience.length > 0) {
    lines.push('', '### 이 논문을 읽어야 할 사람');
    result.summary.targetAudience.forEach(t => {
      lines.push(`- ${t}`);
    });
  }

  return lines.join('\n');
}
