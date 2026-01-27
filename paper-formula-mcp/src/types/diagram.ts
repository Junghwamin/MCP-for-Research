/**
 * Diagram-related type definitions
 */

import { Formula, FormulaDependency, FormulaRole } from './formula.js';

// Mermaid 다이어그램 방향
export type DiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

// Mermaid 다이어그램 유형
export type DiagramType = 'flowchart' | 'graph' | 'mindmap';

// Mermaid 노드 모양
export type NodeShape = 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'hexagon' | 'stadium';

// Mermaid 엣지 스타일
export type EdgeStyle = 'solid' | 'dotted' | 'thick';

// Mermaid 노드
export interface MermaidNode {
  id: string;
  label: string;
  shape: NodeShape;
  style?: string;           // CSS 스타일 (예: "fill:#e1f5fe")
  subgraph?: string;        // 소속 서브그래프
}

// Mermaid 엣지
export interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  arrow: 'normal' | 'none' | 'both';
}

// Mermaid 서브그래프
export interface MermaidSubgraph {
  id: string;
  label: string;
  nodes: string[];          // 노드 ID들
}

// Flowchart 설정
export interface FlowchartConfig {
  direction: DiagramDirection;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  subgraphs?: MermaidSubgraph[];
  title?: string;
}

// 수식 클러스터 (연결된 수식 그룹)
export interface FormulaCluster {
  id: string;
  formulas: string[];       // 수식 ID들
  description: string;      // LLM이 생성한 클러스터 설명
  role?: FormulaRole;       // 대표 역할
}

// 수식 의존성 다이어그램 결과
export interface DependencyDiagramResult {
  success: boolean;
  mermaid: string;          // Mermaid 다이어그램 코드
  markdown: string;         // 마크다운 호환 출력 (```mermaid 블록)
  analysis: {
    totalFormulas: number;
    totalDependencies: number;
    rootFormulas: string[];     // 다른 수식에 의존하지 않는 기초 수식
    leafFormulas: string[];     // 다른 수식이 의존하지 않는 최종 수식
    clusters: FormulaCluster[];
  };
  error?: string;
}

// 개념 정보
export interface Concept {
  id: string;
  name: string;
  koreanName?: string;
  definition?: string;
  type: 'proposed' | 'existing' | 'method' | 'metric' | 'dataset';
  importance: 'high' | 'medium' | 'low';
}

// 개념 관계
export interface ConceptRelation {
  source: string;           // 개념 ID
  target: string;           // 개념 ID
  type: 'is_a' | 'part_of' | 'uses' | 'extends' | 'compared_to' | 'derives_from';
  label?: string;
}

// 개념 관계도 결과
export interface ConceptMapResult {
  success: boolean;
  mermaid: string;
  markdown: string;
  concepts: Concept[];
  relations: ConceptRelation[];
  analysis: {
    centralConcepts: string[];    // 가장 많이 연결된 핵심 개념
    novelConcepts: string[];      // 논문에서 새로 제안된 개념
    foundationConcepts: string[]; // 기반이 되는 기존 개념
  };
  error?: string;
}

// 논문 노드
export interface PaperNode {
  id: string;
  title: string;
  shortTitle: string;         // 다이어그램용 짧은 제목
  authors: string[];
  year: number;
  venue?: string;
  isMainPaper: boolean;
  contribution?: string;      // 주요 기여점
}

// 논문 관계
export interface PaperRelation {
  source: string;             // 논문 ID
  target: string;             // 논문 ID
  type: 'extends' | 'improves' | 'compares' | 'applies' | 'cites' | 'baseline';
  description?: string;
}

// 논문 발전 관계도 결과
export interface EvolutionDiagramResult {
  success: boolean;
  mermaid: string;
  markdown: string;
  papers: PaperNode[];
  relations: PaperRelation[];
  timeline: {
    earliest: number;
    latest: number;
    mainPaperYear: number;
  };
  analysis: {
    foundationPapers: string[];   // 주요 기반 논문
    competitorPapers: string[];   // 비교 대상 논문
    followUpPapers: string[];     // 후속 연구
    methodEvolution: string;      // LLM이 생성한 방법론 발전 설명
  };
  error?: string;
}

// 역할별 색상 매핑
export const ROLE_COLORS: Record<FormulaRole, string> = {
  definition: '#e3f2fd',      // 파란색 계열
  objective: '#fff3e0',       // 주황색 계열
  constraint: '#fce4ec',      // 분홍색 계열
  theorem: '#e8f5e9',         // 초록색 계열
  derivation: '#f3e5f5',      // 보라색 계열
  approximation: '#fff8e1',   // 노란색 계열
  example: '#f5f5f5',         // 회색 계열
  baseline: '#eceff1',        // 회색 계열
  unknown: '#ffffff',         // 흰색
};

// 역할별 이모지
export const ROLE_EMOJIS: Record<FormulaRole, string> = {
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
