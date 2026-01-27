import { extractFormulas } from './extractFormulas.js';
import { explainFormulaWithLLM } from '../api/llmClient.js';
import type { ExplainFormulaResult, Formula } from '../types/formula.js';

// ============================================
// 수식 설명 도구
// ============================================

export interface ExplainFormulaInput {
  pdfPath: string;
  formulaId?: string;
  latex?: string;
  detailLevel?: 'brief' | 'detailed' | 'educational';
  language?: 'ko' | 'en';
}

/**
 * 수식 설명 생성
 */
export async function explainFormula(input: ExplainFormulaInput): Promise<ExplainFormulaResult> {
  try {
    const {
      pdfPath,
      formulaId,
      latex,
      detailLevel = 'detailed',
      language = 'ko',
    } = input;

    let targetFormula: Formula | undefined;

    // 수식 찾기
    if (formulaId || !latex) {
      // PDF에서 수식 추출
      const extractResult = await extractFormulas({ pdfPath });

      if (!extractResult.success) {
        return {
          success: false,
          formula: { latex: latex || '' },
          explanation: {
            summary: '',
            components: [],
            meaning: '',
            intuition: '',
            role: '',
            relatedFormulas: [],
          },
          language,
          error: extractResult.error,
        };
      }

      if (formulaId) {
        // ID로 수식 찾기
        targetFormula = extractResult.formulas.find(
          f => f.id === formulaId || f.number === formulaId || f.number === `(${formulaId})`
        );

        if (!targetFormula) {
          return {
            success: false,
            formula: { latex: '' },
            explanation: {
              summary: '',
              components: [],
              meaning: '',
              intuition: '',
              role: '',
              relatedFormulas: [],
            },
            language,
            error: `Formula not found: ${formulaId}. Available IDs: ${extractResult.formulas.slice(0, 10).map(f => f.id).join(', ')}`,
          };
        }
      } else {
        // 첫 번째 수식 사용
        targetFormula = extractResult.formulas[0];

        if (!targetFormula) {
          return {
            success: false,
            formula: { latex: '' },
            explanation: {
              summary: '',
              components: [],
              meaning: '',
              intuition: '',
              role: '',
              relatedFormulas: [],
            },
            language,
            error: 'No formulas found in the document',
          };
        }
      }
    } else {
      // 직접 입력된 LaTeX 사용
      targetFormula = {
        id: 'direct_input',
        latex: latex!,
        type: 'equation',
        role: 'unknown',
        context: '',
        section: 'Direct Input',
        pageNumber: 0,
        variables: [],
        confidence: 0,
      };
    }

    // LLM으로 설명 생성
    const explanation = await explainFormulaWithLLM(targetFormula, language, detailLevel);

    return {
      success: true,
      formula: {
        id: targetFormula.id,
        latex: targetFormula.latex,
        role: targetFormula.role,
      },
      explanation,
      language,
    };

  } catch (error) {
    return {
      success: false,
      formula: { latex: input.latex || '' },
      explanation: {
        summary: '',
        components: [],
        meaning: '',
        intuition: '',
        role: '',
        relatedFormulas: [],
      },
      language: input.language || 'ko',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 결과 포맷팅
 */
export function formatExplainResult(result: ExplainFormulaResult): string {
  if (!result.success) {
    return `❌ 수식 설명 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 📐 수식 설명`,
    ``,
  ];

  if (result.formula.id) {
    lines.push(`**수식 ID**: ${result.formula.id}`);
  }

  if (result.formula.role && result.formula.role !== 'unknown') {
    const roleNames: Record<string, string> = {
      definition: '📘 정의 (Definition)',
      objective: '🎯 목적 함수 (Objective)',
      constraint: '🔒 제약 조건 (Constraint)',
      theorem: '📐 정리 (Theorem)',
      derivation: '⚙️ 유도 (Derivation)',
      approximation: '≈ 근사 (Approximation)',
      example: '💡 예시 (Example)',
      baseline: '📊 기준선 (Baseline)',
    };
    lines.push(`**역할**: ${roleNames[result.formula.role] || result.formula.role}`);
  }

  lines.push('');
  lines.push('## LaTeX 수식');
  lines.push('```latex');
  lines.push(result.formula.latex);
  lines.push('```');
  lines.push('');

  const exp = result.explanation;

  if (exp.summary) {
    lines.push(`## 📋 요약`);
    lines.push(exp.summary);
    lines.push('');
  }

  if (exp.components.length > 0) {
    lines.push(`## 🔤 구성 요소`);
    lines.push('');
    lines.push('| 기호 | 설명 | 타입 |');
    lines.push('|------|------|------|');
    for (const comp of exp.components) {
      lines.push(`| \`${comp.symbol}\` | ${comp.explanation} | ${comp.type} |`);
    }
    lines.push('');
  }

  if (exp.meaning) {
    lines.push(`## 📖 의미`);
    lines.push(exp.meaning);
    lines.push('');
  }

  if (exp.intuition) {
    lines.push(`## 💡 직관적 이해`);
    lines.push(exp.intuition);
    lines.push('');
  }

  if (exp.role) {
    lines.push(`## 🎭 논문에서의 역할`);
    lines.push(exp.role);
    lines.push('');
  }

  if (exp.relatedFormulas.length > 0) {
    lines.push(`## 🔗 관련 수식`);
    lines.push(exp.relatedFormulas.map(f => `- ${f}`).join('\n'));
    lines.push('');
  }

  return lines.join('\n');
}
