import type {
  DiagramDirection,
  NodeShape,
  MermaidNode,
  MermaidEdge,
  MermaidSubgraph,
  FlowchartConfig,
} from '../types/diagram.js';
import { ROLE_COLORS, ROLE_EMOJIS } from '../types/diagram.js';
import type { FormulaRole } from '../types/formula.js';

// ============================================
// Mermaid 다이어그램 생성기
// ============================================

/**
 * Flowchart 다이어그램 생성
 */
export function generateFlowchart(config: FlowchartConfig): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`flowchart ${config.direction}`);

  // 서브그래프 먼저 추가
  if (config.subgraphs) {
    for (const subgraph of config.subgraphs) {
      lines.push(`    subgraph ${subgraph.id}["${subgraph.label}"]`);
      for (const nodeId of subgraph.nodes) {
        const node = config.nodes.find(n => n.id === nodeId);
        if (node) {
          lines.push(`        ${formatNode(node)}`);
        }
      }
      lines.push('    end');
    }
  }

  // 서브그래프에 포함되지 않은 노드 추가
  const subgraphNodeIds = new Set(
    config.subgraphs?.flatMap(s => s.nodes) || []
  );
  for (const node of config.nodes) {
    if (!subgraphNodeIds.has(node.id)) {
      lines.push(`    ${formatNode(node)}`);
    }
  }

  // 엣지 추가
  for (const edge of config.edges) {
    lines.push(`    ${formatEdge(edge)}`);
  }

  // 스타일 추가
  const styledNodes = config.nodes.filter(n => n.style);
  for (const node of styledNodes) {
    lines.push(`    style ${node.id} ${node.style}`);
  }

  return lines.join('\n');
}

/**
 * 노드 포맷팅
 */
function formatNode(node: MermaidNode): string {
  const label = escapeLabel(node.label);

  switch (node.shape) {
    case 'rounded':
      return `${node.id}("${label}")`;
    case 'circle':
      return `${node.id}(("${label}"))`;
    case 'diamond':
      return `${node.id}{"${label}"}`;
    case 'hexagon':
      return `${node.id}{{{"${label}"}}}`;
    case 'stadium':
      return `${node.id}(["${label}"])`;
    case 'rectangle':
    default:
      return `${node.id}["${label}"]`;
  }
}

/**
 * 엣지 포맷팅
 */
function formatEdge(edge: MermaidEdge): string {
  let arrow: string;

  switch (edge.style) {
    case 'dotted':
      arrow = edge.label ? `-. "${escapeLabel(edge.label)}" .->` : '-.->';
      break;
    case 'thick':
      arrow = edge.label ? `== "${escapeLabel(edge.label)}" ==>` : '==>';
      break;
    case 'solid':
    default:
      arrow = edge.label ? `-- "${escapeLabel(edge.label)}" -->` : '-->';
  }

  if (edge.arrow === 'none') {
    arrow = arrow.replace('>', '-').replace('>', '-');
  } else if (edge.arrow === 'both') {
    arrow = '<' + arrow;
  }

  return `${edge.from} ${arrow} ${edge.to}`;
}

/**
 * 라벨 이스케이프
 */
function escapeLabel(label: string): string {
  return label
    .replace(/"/g, "'")
    .replace(/\n/g, '<br/>')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 마크다운 블록으로 래핑
 */
export function wrapInMarkdown(mermaid: string): string {
  return '```mermaid\n' + mermaid + '\n```';
}

/**
 * 수식 역할에 따른 스타일 반환
 */
export function getRoleStyle(role: FormulaRole): string {
  const color = ROLE_COLORS[role];
  return `fill:${color},stroke:#333,stroke-width:1px`;
}

/**
 * 수식 역할에 따른 이모지 반환
 */
export function getRoleEmoji(role: FormulaRole): string {
  return ROLE_EMOJIS[role];
}

/**
 * 수식 ID를 Mermaid 호환 ID로 변환
 */
export function sanitizeId(id: string): string {
  return id
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1');
}

/**
 * 역할 흐름 다이어그램 생성
 */
export function generateRoleFlowDiagram(
  roleGroups: Record<FormulaRole, { id: string; latex: string }[]>,
  direction: DiagramDirection = 'TB'
): string {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const subgraphs: MermaidSubgraph[] = [];

  const roleOrder: FormulaRole[] = [
    'definition',
    'objective',
    'constraint',
    'derivation',
    'theorem',
    'approximation',
    'example',
    'baseline',
  ];

  const roleNames: Record<FormulaRole, string> = {
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

  let prevRoleNodes: string[] = [];

  for (const role of roleOrder) {
    const formulas = roleGroups[role] || [];
    if (formulas.length === 0) continue;

    const subgraphNodes: string[] = [];

    for (const formula of formulas.slice(0, 5)) { // 역할당 최대 5개
      const nodeId = sanitizeId(formula.id);
      const shortLatex = formula.latex.length > 30
        ? formula.latex.substring(0, 30) + '...'
        : formula.latex;

      nodes.push({
        id: nodeId,
        label: `${formula.id}<br/>${shortLatex}`,
        shape: 'rounded',
        style: getRoleStyle(role),
      });

      subgraphNodes.push(nodeId);
    }

    if (subgraphNodes.length > 0) {
      subgraphs.push({
        id: sanitizeId(role),
        label: roleNames[role],
        nodes: subgraphNodes,
      });

      // 이전 역할 그룹과 연결
      if (prevRoleNodes.length > 0 && subgraphNodes.length > 0) {
        edges.push({
          from: prevRoleNodes[0],
          to: subgraphNodes[0],
          style: 'dotted',
          arrow: 'normal',
        });
      }

      prevRoleNodes = subgraphNodes;
    }
  }

  return generateFlowchart({
    direction,
    nodes,
    edges,
    subgraphs,
  });
}

/**
 * 개념 관계도 생성
 */
export function generateConceptMapDiagram(
  concepts: { id: string; name: string; type: string; importance: string }[],
  relations: { source: string; target: string; type: string; label?: string }[],
  direction: DiagramDirection = 'LR'
): string {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];

  const typeStyles: Record<string, string> = {
    proposed: 'fill:#ffecb3,stroke:#ff9800',
    existing: 'fill:#e3f2fd,stroke:#2196f3',
    method: 'fill:#e8f5e9,stroke:#4caf50',
    metric: 'fill:#fce4ec,stroke:#e91e63',
    dataset: 'fill:#f3e5f5,stroke:#9c27b0',
  };

  const typeShapes: Record<string, NodeShape> = {
    proposed: 'hexagon',
    existing: 'rectangle',
    method: 'rounded',
    metric: 'diamond',
    dataset: 'stadium',
  };

  for (const concept of concepts) {
    nodes.push({
      id: sanitizeId(concept.id),
      label: concept.name,
      shape: typeShapes[concept.type] || 'rectangle',
      style: typeStyles[concept.type] || 'fill:#f5f5f5',
    });
  }

  const relationStyles: Record<string, EdgeStyle> = {
    is_a: 'solid',
    part_of: 'solid',
    uses: 'dotted',
    extends: 'thick',
    compared_to: 'dotted',
    derives_from: 'solid',
  };

  for (const relation of relations) {
    edges.push({
      from: sanitizeId(relation.source),
      to: sanitizeId(relation.target),
      label: relation.label || relation.type,
      style: relationStyles[relation.type] || 'solid',
      arrow: 'normal',
    });
  }

  return generateFlowchart({ direction, nodes, edges });
}

type EdgeStyle = 'solid' | 'dotted' | 'thick';
