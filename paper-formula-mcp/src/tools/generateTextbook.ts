/**
 * 논문 수식 기반 교과서 생성 도구
 * PDF에서 수식을 추출하고 LLM을 사용하여 기초부터 논문 수준까지의 교과서를 생성
 */

import path from 'path';
import { extractFormulas } from './extractFormulas.js';
import { generateTextbookWithLLM } from '../api/llmClient.js';
import { writeFile } from 'fs/promises';
import type {
  GenerateTextbookInput,
  GenerateTextbookResult,
  TextbookLevel,
  TextbookLanguage,
} from '../types/textbook.js';
import type { Formula } from '../types/formula.js';

// ============================================
// 교과서 생성 도구
// ============================================

export async function generateTextbook(input: GenerateTextbookInput): Promise<GenerateTextbookResult> {
  try {
    const {
      pdfPath,
      targetLevel = 'auto',
      language = 'ko',
      maxChapters = 8,
      includeExercises = true,
      includeExamples = true,
      focusFormulas,
      outputPath,
    } = input;

    // 1. PDF에서 수식 추출
    const extractResult = await extractFormulas({
      pdfPath,
      includeInline: false,
      includeNumbered: false,
    });

    if (!extractResult.success) {
      return {
        success: false,
        markdown: '',
        stats: { totalChapters: 0, totalSections: 0, totalExercises: 0, coveredFormulas: 0, totalFormulas: 0 },
        error: `수식 추출 실패: ${extractResult.error}`,
      };
    }

    // 2. 대상 수식 선택
    let targetFormulas = extractResult.formulas;
    if (focusFormulas && focusFormulas.length > 0) {
      targetFormulas = targetFormulas.filter(f =>
        focusFormulas.includes(f.id) || focusFormulas.some(fid => f.id.includes(fid))
      );
    }

    // inline 제외, 중요 수식 우선
    targetFormulas = prioritizeFormulas(targetFormulas);

    if (targetFormulas.length === 0) {
      return {
        success: false,
        markdown: '',
        stats: { totalChapters: 0, totalSections: 0, totalExercises: 0, coveredFormulas: 0, totalFormulas: extractResult.formulas.length },
        error: '교과서를 생성할 수식을 찾지 못했습니다. focusFormulas 필터를 확인해주세요.',
      };
    }

    // 3. LLM으로 교과서 구조 및 내용 생성
    const textbookMarkdown = await generateTextbookWithLLM({
      paperTitle: extractResult.paperTitle,
      formulas: targetFormulas,
      targetLevel,
      language,
      maxChapters,
      includeExercises,
      includeExamples,
    });

    // 4. 통계 계산
    const chapterCount = (textbookMarkdown.match(/^# /gm) || []).length;
    const sectionCount = (textbookMarkdown.match(/^## /gm) || []).length;
    const exerciseCount = (textbookMarkdown.match(/연습문제|Exercise|문제/g) || []).length;

    // 5. 파일 저장 (outputPath가 있으면)
    if (outputPath) {
      await writeFile(outputPath, textbookMarkdown, 'utf-8');
    }

    return {
      success: true,
      markdown: textbookMarkdown,
      stats: {
        totalChapters: chapterCount,
        totalSections: sectionCount,
        totalExercises: exerciseCount,
        coveredFormulas: targetFormulas.length,
        totalFormulas: extractResult.formulas.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      markdown: '',
      stats: { totalChapters: 0, totalSections: 0, totalExercises: 0, coveredFormulas: 0, totalFormulas: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 수식 우선순위 정렬 (중요한 수식을 먼저)
 */
function prioritizeFormulas(formulas: Formula[]): Formula[] {
  const rolePriority: Record<string, number> = {
    definition: 1,
    objective: 2,
    theorem: 3,
    constraint: 4,
    derivation: 5,
    approximation: 6,
    example: 7,
    baseline: 8,
    unknown: 9,
  };

  return [...formulas]
    .filter(f => f.type !== 'inline')
    .sort((a, b) => {
      const pa = rolePriority[a.role] || 9;
      const pb = rolePriority[b.role] || 9;
      return pa - pb;
    })
    .slice(0, 30); // 최대 30개 수식
}

/**
 * 결과 포맷팅
 */
export function formatTextbookResult(result: GenerateTextbookResult): string {
  if (!result.success) {
    return `❌ 교과서 생성 실패: ${result.error}`;
  }

  const header = [
    `# 📖 교과서 생성 완료`,
    ``,
    `## 📊 통계`,
    `- 총 장(Chapter) 수: ${result.stats.totalChapters}`,
    `- 총 섹션 수: ${result.stats.totalSections}`,
    `- 연습문제 수: ${result.stats.totalExercises}`,
    `- 다룬 수식: ${result.stats.coveredFormulas}/${result.stats.totalFormulas}개`,
    ``,
    `---`,
    ``,
  ].join('\n');

  return header + result.markdown;
}
