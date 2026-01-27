import { extractFormulas } from './extractFormulas.js';
import { analyzeFormulaDependenciesWithLLM } from '../api/llmClient.js';
import {
  generateFlowchart,
  wrapInMarkdown,
  sanitizeId,
  getRoleStyle,
  getRoleEmoji,
} from '../generators/mermaidGenerator.js';
import type { DependencyDiagramResult, FormulaCluster, MermaidNode, MermaidEdge, MermaidSubgraph } from '../types/diagram.js';
import type { Formula, FormulaDependency } from '../types/formula.js';

// ============================================
// 수식 의존성 다이어그램 도구
// ============================================

export interface DependencyDiagramInput {
  pdfPath: string;
  diagramType?: 'flowchart' | 'graph';
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  includeVariables?: boolean;
  filterSection?: string;
}

/**
 * 수식 의존성 다이어그램 생성
 */
export async function generateDependencyDiagram(
  input: DependencyDiagramInput
): Promise<DependencyDiagramResult> {
  try {
    const {
      pdfPath,
      direction = 'TB',
      includeVariables = true,
      filterSection,
    } = input;

    // 수식 추출
    const extractResult = await extractFormulas({ pdfPath });

    if (!extractResult.success) {
      return {
        success: false,
        mermaid: '',
        markdown: '',
        analysis: {
          totalFormulas: 0,
          totalDependencies: 0,
          rootFormulas: [],
          leafFormulas: [],
          clusters: [],
        },
        error: extractResult.error,
      };
    }

    let formulas = extractResult.formulas;

    // 섹션 필터링
    if (filterSection) {
      formulas = formulas.filter(f =>
        f.section.toLowerCase().includes(filterSection.toLowerCase())
      );
    }

    if (formulas.length < 2) {
      return {
        success: false,
        mermaid: '',
        markdown: '',
        analysis: {
          totalFormulas: formulas.length,
          totalDependencies: 0,
          rootFormulas: [],
          leafFormulas: [],
          clusters: [],
        },
        error: 'Need at least 2 formulas to analyze dependencies',
      };
    }

    // 의존성 분석
    const dependencies = await analyzeDependencies(formulas, includeVariables);

    // 다이어그램 생성
    const { mermaid, analysis } = buildDependencyDiagram(formulas, dependencies, direction);

    return {
      success: true,
      mermaid,
      markdown: wrapInMarkdown(mermaid),
      analysis,
    };

  } catch (error) {
    return {
      success: false,
      mermaid: '',
      markdown: '',
      analysis: {
        totalFormulas: 0,
        totalDependencies: 0,
        rootFormulas: [],
        leafFormulas: [],
        clusters: [],
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 의존성 분석
 */
async function analyzeDependencies(
  formulas: Formula[],
  includeVariables: boolean
): Promise<FormulaDependency[]> {
  const dependencies: FormulaDependency[] = [];

  // 변수 기반 의존성 분석
  const varToFormula = new Map<string, string[]>();

  for (const formula of formulas) {
    for (const variable of formula.variables) {
      if (!varToFormula.has(variable.symbol)) {
        varToFormula.set(variable.symbol, []);
      }
      varToFormula.get(variable.symbol)!.push(formula.id);
    }
  }

  // 공유 변수로 의존성 추론
  for (const [variable, formulaIds] of varToFormula) {
    if (formulaIds.length >= 2) {
      for (let i = 0; i < formulaIds.length - 1; i++) {
        for (let j = i + 1; j < formulaIds.length; j++) {
          const existing = dependencies.find(
            d => d.from === formulaIds[i] && d.to === formulaIds[j]
          );
          if (existing) {
            existing.sharedVariables = existing.sharedVariables || [];
            existing.sharedVariables.push(variable);
          } else {
            dependencies.push({
              from: formulaIds[i],
              to: formulaIds[j],
              type: 'uses_variable',
              sharedVariables: [variable],
            });
          }
        }
      }
    }
  }

  // LLM 보조 분석 (선택적)
  if (formulas.length <= 20) {
    try {
      const llmDeps = await analyzeFormulaDependenciesWithLLM(formulas);
      for (const dep of llmDeps) {
        const existing = dependencies.find(
          d => d.from === dep.from && d.to === dep.to
        );
        if (!existing) {
          dependencies.push({
            from: dep.from,
            to: dep.to,
            type: dep.type as FormulaDependency['type'],
            description: dep.description,
          });
        }
      }
    } catch (e) {
      // LLM 분석 실패시 무시
    }
  }

  return dependencies;
}

/**
 * 의존성 다이어그램 구축
 */
function buildDependencyDiagram(
  formulas: Formula[],
  dependencies: FormulaDependency[],
  direction: 'TB' | 'BT' | 'LR' | 'RL'
): { mermaid: string; analysis: DependencyDiagramResult['analysis'] } {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const subgraphs: MermaidSubgraph[] = [];

  // 역할별로 서브그래프 구성
  const roleGroups = new Map<string, Formula[]>();
  for (const formula of formulas) {
    const role = formula.role;
    if (!roleGroups.has(role)) {
      roleGroups.set(role, []);
    }
    roleGroups.get(role)!.push(formula);
  }

  const roleNames: Record<string, string> = {
    definition: '📘 Definition',
    objective: '🎯 Objective',
    constraint: '🔒 Constraint',
    theorem: '📐 Theorem',
    derivation: '⚙️ Derivation',
    approximation: '≈ Approximation',
    example: '💡 Example',
    baseline: '📊 Baseline',
    unknown: '❓ Unknown',
  };

  for (const [role, roleFormulas] of roleGroups) {
    const subgraphNodes: string[] = [];

    for (const formula of roleFormulas.slice(0, 10)) {
      const nodeId = sanitizeId(formula.id);
      const label = formula.number || formula.id;
      const shortLatex = formula.latex.length > 25
        ? formula.latex.substring(0, 25) + '...'
        : formula.latex;

      nodes.push({
        id: nodeId,
        label: `${label}<br/>${shortLatex}`,
        shape: 'rounded',
        style: getRoleStyle(formula.role),
      });

      subgraphNodes.push(nodeId);
    }

    if (subgraphNodes.length > 0) {
      subgraphs.push({
        id: sanitizeId(role),
        label: roleNames[role] || role,
        nodes: subgraphNodes,
      });
    }
  }

  // 의존성 엣지 추가
  for (const dep of dependencies) {
    const fromId = sanitizeId(dep.from);
    const toId = sanitizeId(dep.to);

    // 노드가 존재하는지 확인
    if (!nodes.find(n => n.id === fromId) || !nodes.find(n => n.id === toId)) {
      continue;
    }

    let label = '';
    if (dep.sharedVariables && dep.sharedVariables.length > 0) {
      label = dep.sharedVariables.slice(0, 3).join(', ');
    }

    edges.push({
      from: fromId,
      to: toId,
      label,
      style: dep.type === 'derives_from' ? 'thick' : 'solid',
      arrow: 'normal',
    });
  }

  // 분석 결과 계산
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const formula of formulas) {
    inDegree.set(formula.id, 0);
    outDegree.set(formula.id, 0);
  }

  for (const dep of dependencies) {
    outDegree.set(dep.from, (outDegree.get(dep.from) || 0) + 1);
    inDegree.set(dep.to, (inDegree.get(dep.to) || 0) + 1);
  }

  const rootFormulas = formulas
    .filter(f => (inDegree.get(f.id) || 0) === 0)
    .map(f => f.id);

  const leafFormulas = formulas
    .filter(f => (outDegree.get(f.id) || 0) === 0)
    .map(f => f.id);

  // 클러스터 분석 (간단한 연결 컴포넌트)
  const clusters: FormulaCluster[] = [];
  for (const [role, roleFormulas] of roleGroups) {
    if (roleFormulas.length > 0) {
      clusters.push({
        id: role,
        formulas: roleFormulas.map(f => f.id),
        description: `${roleNames[role] || role} formulas`,
        role: role as any,
      });
    }
  }

  const mermaid = generateFlowchart({
    direction,
    nodes,
    edges,
    subgraphs,
  });

  return {
    mermaid,
    analysis: {
      totalFormulas: formulas.length,
      totalDependencies: dependencies.length,
      rootFormulas,
      leafFormulas,
      clusters,
    },
  };
}

/**
 * 결과 포맷팅
 */
export function formatDependencyResult(result: DependencyDiagramResult): string {
  if (!result.success) {
    return `❌ 의존성 다이어그램 생성 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 🔗 수식 의존성 다이어그램`,
    ``,
    `## 📊 분석 결과`,
    `- 총 수식 수: ${result.analysis.totalFormulas}`,
    `- 의존 관계 수: ${result.analysis.totalDependencies}`,
    `- 기초 수식 (루트): ${result.analysis.rootFormulas.join(', ') || '없음'}`,
    `- 최종 수식 (리프): ${result.analysis.leafFormulas.join(', ') || '없음'}`,
    ``,
    `## 📈 다이어그램`,
    ``,
    result.markdown,
    ``,
  ];

  if (result.analysis.clusters.length > 0) {
    lines.push(`## 📦 클러스터`);
    for (const cluster of result.analysis.clusters) {
      lines.push(`- **${cluster.description}**: ${cluster.formulas.slice(0, 5).join(', ')}${cluster.formulas.length > 5 ? '...' : ''}`);
    }
  }

  return lines.join('\n');
}
