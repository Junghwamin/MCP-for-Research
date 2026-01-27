import { parsePDF, extractSections, extractTitle } from '../parsers/pdfParser.js';
import { extractFormulasFromText, convertToFormula } from '../parsers/latexParser.js';
import type { Formula, ExtractFormulasResult, FormulaRole } from '../types/formula.js';

// ============================================
// 수식 추출 도구
// ============================================

export interface ExtractFormulasInput {
  pdfPath: string;
  includeInline?: boolean;
  includeNumbered?: boolean;
}

/**
 * PDF에서 수식 추출
 */
export async function extractFormulas(input: ExtractFormulasInput): Promise<ExtractFormulasResult> {
  try {
    const { pdfPath, includeInline = true, includeNumbered = false } = input;

    // PDF 파싱
    const pdfContent = await parsePDF(pdfPath);
    const title = extractTitle(pdfContent.text, pdfContent.metadata);
    const sections = extractSections(pdfContent.text);

    const allFormulas: Formula[] = [];
    let formulaCounter = 0;
    let inlineCounter = 0;

    // 각 섹션에서 수식 추출
    for (const section of sections) {
      const rawFormulas = extractFormulasFromText(section.content);

      for (const raw of rawFormulas) {
        // 필터링 옵션 적용
        if (!includeInline && raw.type === 'inline') continue;
        if (includeNumbered && !raw.number) continue;

        // ID 생성
        let id: string;
        if (raw.number) {
          id = `eq${raw.number.replace(/[()]/g, '')}`;
        } else if (raw.type === 'inline') {
          inlineCounter++;
          id = `inline_${inlineCounter}`;
        } else {
          formulaCounter++;
          id = `eq${formulaCounter}`;
        }

        const formula = convertToFormula(raw, id, section.name, section.pageNumber);
        allFormulas.push(formula);
      }
    }

    // 통계 계산
    const stats = calculateStats(allFormulas);

    return {
      success: true,
      paperTitle: title,
      formulas: allFormulas,
      stats,
    };

  } catch (error) {
    return {
      success: false,
      paperTitle: '',
      formulas: [],
      stats: {
        totalFormulas: 0,
        numberedEquations: 0,
        inlineFormulas: 0,
        byRole: {} as Record<FormulaRole, number>,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 수식 통계 계산
 */
function calculateStats(formulas: Formula[]): ExtractFormulasResult['stats'] {
  const byRole: Record<FormulaRole, number> = {
    definition: 0,
    objective: 0,
    constraint: 0,
    theorem: 0,
    derivation: 0,
    approximation: 0,
    example: 0,
    baseline: 0,
    unknown: 0,
  };

  let numberedEquations = 0;
  let inlineFormulas = 0;

  for (const formula of formulas) {
    byRole[formula.role]++;

    if (formula.number) {
      numberedEquations++;
    }
    if (formula.type === 'inline') {
      inlineFormulas++;
    }
  }

  return {
    totalFormulas: formulas.length,
    numberedEquations,
    inlineFormulas,
    byRole,
  };
}

/**
 * 결과 포맷팅
 */
export function formatExtractFormulasResult(result: ExtractFormulasResult): string {
  if (!result.success) {
    return `❌ 수식 추출 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 📐 수식 추출 결과`,
    ``,
    `**논문**: ${result.paperTitle}`,
    ``,
    `## 📊 통계`,
    `- 총 수식 수: ${result.stats.totalFormulas}`,
    `- 번호 있는 수식: ${result.stats.numberedEquations}`,
    `- 인라인 수식: ${result.stats.inlineFormulas}`,
    ``,
    `### 역할별 분포`,
  ];

  const roleEmojis: Record<FormulaRole, string> = {
    definition: '📘',
    objective: '🎯',
    constraint: '🔒',
    theorem: '📐',
    derivation: '⚙️',
    approximation: '≈',
    example: '💡',
    baseline: '📊',
    unknown: '❓',
  };

  const roleNames: Record<FormulaRole, string> = {
    definition: '정의 (Definition)',
    objective: '목적 함수 (Objective)',
    constraint: '제약 조건 (Constraint)',
    theorem: '정리 (Theorem)',
    derivation: '유도 (Derivation)',
    approximation: '근사 (Approximation)',
    example: '예시 (Example)',
    baseline: '기준선 (Baseline)',
    unknown: '미분류 (Unknown)',
  };

  for (const [role, count] of Object.entries(result.stats.byRole)) {
    if (count > 0) {
      const emoji = roleEmojis[role as FormulaRole];
      const name = roleNames[role as FormulaRole];
      lines.push(`- ${emoji} ${name}: ${count}개`);
    }
  }

  lines.push('');
  lines.push(`## 📝 수식 목록`);
  lines.push('');

  // 역할별로 그룹화하여 출력
  const byRole = new Map<FormulaRole, Formula[]>();
  for (const formula of result.formulas) {
    if (!byRole.has(formula.role)) {
      byRole.set(formula.role, []);
    }
    byRole.get(formula.role)!.push(formula);
  }

  for (const [role, formulas] of byRole) {
    if (formulas.length === 0) continue;

    const emoji = roleEmojis[role];
    const name = roleNames[role];
    lines.push(`### ${emoji} ${name}`);
    lines.push('');

    for (const formula of formulas.slice(0, 10)) { // 각 역할당 최대 10개
      const idStr = formula.number || formula.id;
      lines.push(`**${idStr}** (${formula.section})`);
      lines.push('```latex');
      lines.push(formula.latex);
      lines.push('```');

      if (formula.variables.length > 0) {
        const vars = formula.variables.map(v => `\`${v.symbol}\``).join(', ');
        lines.push(`변수: ${vars}`);
      }

      lines.push('');
    }

    if (formulas.length > 10) {
      lines.push(`_... 외 ${formulas.length - 10}개_`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
