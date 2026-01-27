import { extractFormulas } from './extractFormulas.js';
import { analyzeRoleFlowWithLLM } from '../api/llmClient.js';
import { generateRoleFlowDiagram, wrapInMarkdown } from '../generators/mermaidGenerator.js';
import type { RoleAnalysisResult, Formula, FormulaRole } from '../types/formula.js';

// ============================================
// 수식 역할 분석 도구
// ============================================

export interface AnalyzeRolesInput {
  pdfPath: string;
  groupByRole?: boolean;
  showFlow?: boolean;
}

/**
 * 수식 역할 분석
 */
export async function analyzeRoles(
  input: AnalyzeRolesInput
): Promise<RoleAnalysisResult> {
  try {
    const {
      pdfPath,
      groupByRole = true,
      showFlow = true,
    } = input;

    // 수식 추출
    const extractResult = await extractFormulas({ pdfPath });

    if (!extractResult.success) {
      return {
        success: false,
        roleGroups: {} as Record<FormulaRole, Formula[]>,
        flowDiagram: '',
        markdown: '',
        analysis: {
          dominantRoles: [],
          logicalFlow: '',
        },
        error: extractResult.error,
      };
    }

    // 역할별 그룹화
    const roleGroups: Record<FormulaRole, Formula[]> = {
      definition: [],
      objective: [],
      constraint: [],
      theorem: [],
      derivation: [],
      approximation: [],
      example: [],
      baseline: [],
      unknown: [],
    };

    for (const formula of extractResult.formulas) {
      roleGroups[formula.role].push(formula);
    }

    // 주요 역할 분석
    const roleCounts = Object.entries(roleGroups)
      .map(([role, formulas]) => ({ role: role as FormulaRole, count: formulas.length }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const dominantRoles = roleCounts.slice(0, 3).map(r => r.role);

    // 역할 흐름 다이어그램 생성
    let flowDiagram = '';
    if (showFlow) {
      const simplifiedGroups: Record<FormulaRole, { id: string; latex: string }[]> = {} as any;
      for (const [role, formulas] of Object.entries(roleGroups)) {
        simplifiedGroups[role as FormulaRole] = formulas.map(f => ({
          id: f.id,
          latex: f.latex,
        }));
      }
      flowDiagram = generateRoleFlowDiagram(simplifiedGroups, 'TB');
    }

    // LLM으로 논리 흐름 분석
    let logicalFlow = '';
    if (showFlow && extractResult.formulas.length >= 2) {
      try {
        logicalFlow = await analyzeRoleFlowWithLLM(extractResult.formulas);
      } catch (e) {
        logicalFlow = generateDefaultFlowDescription(dominantRoles);
      }
    }

    return {
      success: true,
      roleGroups,
      flowDiagram,
      markdown: flowDiagram ? wrapInMarkdown(flowDiagram) : '',
      analysis: {
        dominantRoles,
        logicalFlow,
      },
    };

  } catch (error) {
    return {
      success: false,
      roleGroups: {} as Record<FormulaRole, Formula[]>,
      flowDiagram: '',
      markdown: '',
      analysis: {
        dominantRoles: [],
        logicalFlow: '',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 기본 흐름 설명 생성
 */
function generateDefaultFlowDescription(dominantRoles: FormulaRole[]): string {
  const roleDescriptions: Record<FormulaRole, string> = {
    definition: '기본 개념과 변수를 정의',
    objective: '최적화할 목적 함수를 설정',
    constraint: '제약 조건을 명시',
    theorem: '주요 정리와 결과를 제시',
    derivation: '수식을 유도하고 전개',
    approximation: '근사와 추정을 수행',
    example: '구체적인 예시를 제공',
    baseline: '기존 방법과 비교',
    unknown: '',
  };

  const descriptions = dominantRoles
    .filter(r => roleDescriptions[r])
    .map(r => roleDescriptions[r]);

  if (descriptions.length === 0) {
    return '논문의 수식 구조를 분석 중입니다.';
  }

  return `이 논문은 주로 ${descriptions.join('하고, ')}합니다.`;
}

/**
 * 결과 포맷팅
 */
export function formatRoleResult(result: RoleAnalysisResult): string {
  if (!result.success) {
    return `❌ 역할 분석 실패: ${result.error}`;
  }

  const roleNames: Record<FormulaRole, string> = {
    definition: '📘 정의 (Definition)',
    objective: '🎯 목적 함수 (Objective)',
    constraint: '🔒 제약 조건 (Constraint)',
    theorem: '📐 정리 (Theorem)',
    derivation: '⚙️ 유도 (Derivation)',
    approximation: '≈ 근사 (Approximation)',
    example: '💡 예시 (Example)',
    baseline: '📊 기준선 (Baseline)',
    unknown: '❓ 미분류 (Unknown)',
  };

  const lines: string[] = [
    `# 🎭 수식 역할 분석`,
    ``,
    `## 📊 역할별 분포`,
    ``,
  ];

  // 역할별 개수 표시
  const roleOrder: FormulaRole[] = [
    'definition', 'objective', 'constraint', 'theorem',
    'derivation', 'approximation', 'example', 'baseline', 'unknown'
  ];

  for (const role of roleOrder) {
    const formulas = result.roleGroups[role];
    if (formulas && formulas.length > 0) {
      lines.push(`### ${roleNames[role]} (${formulas.length}개)`);
      lines.push('');

      for (const formula of formulas.slice(0, 5)) {
        const idStr = formula.number || formula.id;
        const shortLatex = formula.latex.length > 50
          ? formula.latex.substring(0, 50) + '...'
          : formula.latex;
        lines.push(`- **${idStr}**: \`${shortLatex}\``);
      }

      if (formulas.length > 5) {
        lines.push(`- _... 외 ${formulas.length - 5}개_`);
      }

      lines.push('');
    }
  }

  // 분석 결과
  if (result.analysis.dominantRoles.length > 0) {
    lines.push(`## 🎯 주요 역할`);
    lines.push(result.analysis.dominantRoles.map(r => `- ${roleNames[r]}`).join('\n'));
    lines.push('');
  }

  if (result.analysis.logicalFlow) {
    lines.push(`## 🔄 논리 흐름`);
    lines.push(result.analysis.logicalFlow);
    lines.push('');
  }

  // 다이어그램
  if (result.markdown) {
    lines.push(`## 📈 역할 흐름 다이어그램`);
    lines.push('');
    lines.push(result.markdown);
  }

  return lines.join('\n');
}
