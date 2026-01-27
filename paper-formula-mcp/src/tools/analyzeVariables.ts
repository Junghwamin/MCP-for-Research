import { extractFormulas } from './extractFormulas.js';
import { generateFlowchart, wrapInMarkdown, sanitizeId } from '../generators/mermaidGenerator.js';
import type { VariableAnalysisResult, VariableUsage, Formula } from '../types/formula.js';
import type { MermaidNode, MermaidEdge } from '../types/diagram.js';

// ============================================
// 변수 분석 도구
// ============================================

export interface AnalyzeVariablesInput {
  pdfPath: string;
  outputFormat?: 'mermaid' | 'table' | 'json';
  filterSymbols?: string[];
}

/**
 * 변수 사용 분석
 */
export async function analyzeVariables(
  input: AnalyzeVariablesInput
): Promise<VariableAnalysisResult> {
  try {
    const {
      pdfPath,
      outputFormat = 'mermaid',
      filterSymbols,
    } = input;

    // 수식 추출
    const extractResult = await extractFormulas({ pdfPath });

    if (!extractResult.success) {
      return {
        success: false,
        variables: [],
        stats: {
          totalVariables: 0,
          definedVariables: 0,
          undefinedVariables: 0,
          mostUsedVariables: [],
        },
        error: extractResult.error,
      };
    }

    // 변수 사용 분석
    const variableUsages = analyzeVariableUsage(extractResult.formulas);

    // 필터링
    let filteredVariables = variableUsages;
    if (filterSymbols && filterSymbols.length > 0) {
      filteredVariables = variableUsages.filter(v =>
        filterSymbols.includes(v.symbol)
      );
    }

    // 통계 계산
    const stats = calculateVariableStats(filteredVariables);

    // 출력 형식에 따른 결과 생성
    let mermaid: string | undefined;
    let table: string | undefined;

    if (outputFormat === 'mermaid') {
      mermaid = generateVariableDiagram(filteredVariables, extractResult.formulas);
    } else if (outputFormat === 'table') {
      table = generateVariableTable(filteredVariables);
    }

    return {
      success: true,
      variables: filteredVariables,
      mermaid,
      markdown: mermaid ? wrapInMarkdown(mermaid) : undefined,
      table,
      stats,
    };

  } catch (error) {
    return {
      success: false,
      variables: [],
      stats: {
        totalVariables: 0,
        definedVariables: 0,
        undefinedVariables: 0,
        mostUsedVariables: [],
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 변수 사용 분석
 */
function analyzeVariableUsage(formulas: Formula[]): VariableUsage[] {
  const usageMap = new Map<string, VariableUsage>();

  for (const formula of formulas) {
    for (const variable of formula.variables) {
      const key = variable.symbol;

      if (!usageMap.has(key)) {
        usageMap.set(key, {
          symbol: variable.symbol,
          latex: variable.latex,
          meaning: variable.meaning || '',
          definedIn: [],
          usedIn: [],
          firstAppearance: formula.section,
        });
      }

      const usage = usageMap.get(key)!;

      // 정의인지 사용인지 판단
      if (formula.role === 'definition') {
        if (!usage.definedIn.includes(formula.id)) {
          usage.definedIn.push(formula.id);
        }
      }

      if (!usage.usedIn.includes(formula.id)) {
        usage.usedIn.push(formula.id);
      }
    }
  }

  return [...usageMap.values()];
}

/**
 * 변수 통계 계산
 */
function calculateVariableStats(variables: VariableUsage[]): VariableAnalysisResult['stats'] {
  const definedVariables = variables.filter(v => v.definedIn.length > 0).length;
  const undefinedVariables = variables.filter(v => v.definedIn.length === 0).length;

  // 가장 많이 사용된 변수
  const sorted = [...variables].sort((a, b) => b.usedIn.length - a.usedIn.length);
  const mostUsedVariables = sorted.slice(0, 5).map(v => v.symbol);

  return {
    totalVariables: variables.length,
    definedVariables,
    undefinedVariables,
    mostUsedVariables,
  };
}

/**
 * 변수 다이어그램 생성
 */
function generateVariableDiagram(
  variables: VariableUsage[],
  formulas: Formula[]
): string {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  // 변수 노드
  for (const variable of variables.slice(0, 15)) {
    nodes.push({
      id: `var_${sanitizeId(variable.symbol)}`,
      label: `${variable.symbol}`,
      shape: 'circle',
      style: variable.definedIn.length > 0
        ? 'fill:#e8f5e9,stroke:#4caf50'
        : 'fill:#ffebee,stroke:#f44336',
    });
  }

  // 수식 노드 (변수가 사용된 수식만)
  const relevantFormulaIds = new Set<string>();
  for (const variable of variables.slice(0, 15)) {
    for (const fId of variable.usedIn.slice(0, 3)) {
      relevantFormulaIds.add(fId);
    }
  }

  for (const formula of formulas) {
    if (relevantFormulaIds.has(formula.id)) {
      nodes.push({
        id: sanitizeId(formula.id),
        label: formula.number || formula.id,
        shape: 'rectangle',
        style: 'fill:#e3f2fd,stroke:#2196f3',
      });
    }
  }

  // 변수 → 수식 연결
  for (const variable of variables.slice(0, 15)) {
    const varNodeId = `var_${sanitizeId(variable.symbol)}`;

    for (const fId of variable.usedIn.slice(0, 3)) {
      if (relevantFormulaIds.has(fId)) {
        edges.push({
          from: varNodeId,
          to: sanitizeId(fId),
          style: variable.definedIn.includes(fId) ? 'thick' : 'dotted',
          arrow: 'normal',
        });
      }
    }
  }

  return generateFlowchart({
    direction: 'LR',
    nodes,
    edges,
  });
}

/**
 * 변수 테이블 생성
 */
function generateVariableTable(variables: VariableUsage[]): string {
  const lines: string[] = [
    '| 기호 | LaTeX | 정의 위치 | 사용 위치 | 첫 등장 |',
    '|------|-------|-----------|-----------|---------|',
  ];

  for (const v of variables) {
    const definedIn = v.definedIn.slice(0, 3).join(', ') || '-';
    const usedIn = v.usedIn.slice(0, 3).join(', ') + (v.usedIn.length > 3 ? '...' : '');

    lines.push(
      `| ${v.symbol} | \`${v.latex}\` | ${definedIn} | ${usedIn} | ${v.firstAppearance} |`
    );
  }

  return lines.join('\n');
}

/**
 * 결과 포맷팅
 */
export function formatVariableResult(result: VariableAnalysisResult): string {
  if (!result.success) {
    return `❌ 변수 분석 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 📊 변수 분석 결과`,
    ``,
    `## 📈 통계`,
    `- 총 변수 수: ${result.stats.totalVariables}`,
    `- 정의된 변수: ${result.stats.definedVariables}`,
    `- 미정의 변수: ${result.stats.undefinedVariables}`,
    `- 가장 많이 사용된 변수: ${result.stats.mostUsedVariables.join(', ')}`,
    ``,
  ];

  if (result.table) {
    lines.push(`## 📝 변수 테이블`);
    lines.push('');
    lines.push(result.table);
    lines.push('');
  }

  if (result.markdown) {
    lines.push(`## 📈 변수-수식 관계도`);
    lines.push('');
    lines.push(result.markdown);
    lines.push('');
  }

  // 미정의 변수 경고
  const undefinedVars = result.variables.filter(v => v.definedIn.length === 0);
  if (undefinedVars.length > 0) {
    lines.push(`## ⚠️ 미정의 변수`);
    lines.push('다음 변수들은 명시적인 정의 없이 사용되었습니다:');
    lines.push('');
    for (const v of undefinedVars.slice(0, 10)) {
      lines.push(`- \`${v.symbol}\`: ${v.usedIn.slice(0, 3).join(', ')} 에서 사용`);
    }
  }

  return lines.join('\n');
}
