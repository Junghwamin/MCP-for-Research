import { parsePDF, extractTitle, extractAbstract, extractReferences } from '../parsers/pdfParser.js';
import { analyzePaperRelationsWithLLM, PaperInfo } from '../api/llmClient.js';
import { generateFlowchart, wrapInMarkdown, sanitizeId } from '../generators/mermaidGenerator.js';
import type { EvolutionDiagramResult, PaperNode, PaperRelation, MermaidNode, MermaidEdge, MermaidSubgraph } from '../types/diagram.js';

// ============================================
// 논문 발전 관계도 도구
// ============================================

export interface EvolutionDiagramInput {
  pdfPath: string;
  additionalPapers?: string[];
  paperIds?: string[];
  depth?: number;
  relationTypes?: string[];
  timelineView?: boolean;
}

/**
 * 논문 발전 관계도 생성
 */
export async function generateEvolutionDiagram(
  input: EvolutionDiagramInput
): Promise<EvolutionDiagramResult> {
  try {
    const {
      pdfPath,
      additionalPapers = [],
      depth = 2,
      relationTypes,
      timelineView = true,
    } = input;

    // 메인 논문 파싱
    const mainPdfContent = await parsePDF(pdfPath);
    const mainTitle = extractTitle(mainPdfContent.text, mainPdfContent.metadata);
    const mainAbstract = extractAbstract(mainPdfContent.text);
    const references = extractReferences(mainPdfContent.text);

    // 메인 논문 정보
    const mainPaper: PaperInfo = {
      id: 'main',
      title: mainTitle,
      abstract: mainAbstract,
      year: extractYear(mainPdfContent.text) || new Date().getFullYear(),
    };

    // 참조 논문 정보 추출
    const relatedPapers: PaperInfo[] = references.slice(0, 10).map((ref, i) => {
      const year = extractYearFromReference(ref);
      const title = extractTitleFromReference(ref);
      return {
        id: `ref_${i + 1}`,
        title: title || `Reference ${i + 1}`,
        abstract: ref,
        year: year || 2020,
      };
    });

    // 추가 논문 파싱
    for (const paperPath of additionalPapers.slice(0, 5)) {
      try {
        const pdfContent = await parsePDF(paperPath);
        const title = extractTitle(pdfContent.text, pdfContent.metadata);
        const abstract = extractAbstract(pdfContent.text);
        const year = extractYear(pdfContent.text);

        relatedPapers.push({
          id: `add_${relatedPapers.length}`,
          title,
          abstract,
          year: year || new Date().getFullYear(),
        });
      } catch (e) {
        // 파싱 실패시 무시
      }
    }

    // LLM으로 관계 분석
    const { relations, methodEvolution } = await analyzePaperRelationsWithLLM(
      mainPaper,
      relatedPapers
    );

    // 관계 유형 필터링
    let filteredRelations = relations;
    if (relationTypes && relationTypes.length > 0) {
      filteredRelations = relations.filter(r => relationTypes.includes(r.type));
    }

    // 논문 노드 생성
    const paperNodes: PaperNode[] = [
      {
        id: 'main',
        title: mainPaper.title,
        shortTitle: shortenTitle(mainPaper.title),
        authors: [],
        year: mainPaper.year || new Date().getFullYear(),
        isMainPaper: true,
      },
      ...relatedPapers.map(p => ({
        id: p.id,
        title: p.title,
        shortTitle: shortenTitle(p.title),
        authors: [],
        year: p.year || 2020,
        isMainPaper: false,
      })),
    ];

    // 다이어그램 생성
    const mermaid = buildEvolutionDiagram(paperNodes, filteredRelations, timelineView);

    // 타임라인 정보
    const years = paperNodes.map(p => p.year).filter(y => y > 0);
    const timeline = {
      earliest: Math.min(...years),
      latest: Math.max(...years),
      mainPaperYear: mainPaper.year || new Date().getFullYear(),
    };

    // 분석 결과
    const analysis = {
      foundationPapers: filteredRelations
        .filter(r => r.type === 'extends' || r.type === 'cites')
        .map(r => r.target),
      competitorPapers: filteredRelations
        .filter(r => r.type === 'compares')
        .map(r => r.target),
      followUpPapers: filteredRelations
        .filter(r => r.type === 'improves')
        .map(r => r.source === 'main' ? r.target : r.source),
      methodEvolution,
    };

    return {
      success: true,
      mermaid,
      markdown: wrapInMarkdown(mermaid),
      papers: paperNodes,
      relations: filteredRelations,
      timeline,
      analysis,
    };

  } catch (error) {
    return {
      success: false,
      mermaid: '',
      markdown: '',
      papers: [],
      relations: [],
      timeline: { earliest: 0, latest: 0, mainPaperYear: 0 },
      analysis: {
        foundationPapers: [],
        competitorPapers: [],
        followUpPapers: [],
        methodEvolution: '',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 제목 단축
 */
function shortenTitle(title: string, maxLength: number = 30): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

/**
 * 텍스트에서 연도 추출
 */
function extractYear(text: string): number | undefined {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0]) : undefined;
}

/**
 * 참조에서 연도 추출
 */
function extractYearFromReference(ref: string): number | undefined {
  const yearMatch = ref.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0]) : undefined;
}

/**
 * 참조에서 제목 추출
 */
function extractTitleFromReference(ref: string): string {
  // "Title." 또는 "Title," 패턴 찾기
  const titleMatch = ref.match(/[A-Z][^.]+\./);
  if (titleMatch) {
    return titleMatch[0].replace(/\.$/, '').trim();
  }
  return ref.substring(0, 50);
}

/**
 * 발전 관계도 구축
 */
function buildEvolutionDiagram(
  papers: PaperNode[],
  relations: PaperRelation[],
  timelineView: boolean
): string {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const subgraphs: MermaidSubgraph[] = [];

  if (timelineView) {
    // 연도별로 그룹화
    const yearGroups = new Map<number, PaperNode[]>();

    for (const paper of papers) {
      const year = paper.year;
      if (!yearGroups.has(year)) {
        yearGroups.set(year, []);
      }
      yearGroups.get(year)!.push(paper);
    }

    // 연도순 정렬
    const sortedYears = [...yearGroups.keys()].sort();

    for (const year of sortedYears) {
      const yearPapers = yearGroups.get(year)!;
      const subgraphNodes: string[] = [];

      for (const paper of yearPapers) {
        const nodeId = sanitizeId(paper.id);
        nodes.push({
          id: nodeId,
          label: paper.shortTitle,
          shape: paper.isMainPaper ? 'hexagon' : 'rounded',
          style: paper.isMainPaper
            ? 'fill:#c8e6c9,stroke:#4caf50,stroke-width:2px'
            : 'fill:#e3f2fd,stroke:#2196f3',
        });
        subgraphNodes.push(nodeId);
      }

      subgraphs.push({
        id: `year_${year}`,
        label: String(year),
        nodes: subgraphNodes,
      });
    }
  } else {
    // 타임라인 없이 노드만
    for (const paper of papers) {
      const nodeId = sanitizeId(paper.id);
      nodes.push({
        id: nodeId,
        label: `${paper.shortTitle}<br/>(${paper.year})`,
        shape: paper.isMainPaper ? 'hexagon' : 'rounded',
        style: paper.isMainPaper
          ? 'fill:#c8e6c9,stroke:#4caf50,stroke-width:2px'
          : 'fill:#e3f2fd,stroke:#2196f3',
      });
    }
  }

  // 관계 엣지
  const relationStyles: Record<string, 'solid' | 'dotted' | 'thick'> = {
    extends: 'thick',
    improves: 'thick',
    compares: 'dotted',
    applies: 'solid',
    cites: 'dotted',
    baseline: 'dotted',
  };

  for (const relation of relations) {
    edges.push({
      from: sanitizeId(relation.source),
      to: sanitizeId(relation.target),
      label: relation.type,
      style: relationStyles[relation.type] || 'solid',
      arrow: 'normal',
    });
  }

  return generateFlowchart({
    direction: 'TB',
    nodes,
    edges,
    subgraphs: timelineView ? subgraphs : undefined,
  });
}

/**
 * 결과 포맷팅
 */
export function formatEvolutionResult(result: EvolutionDiagramResult): string {
  if (!result.success) {
    return `❌ 발전 관계도 생성 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 📜 논문 발전 관계도`,
    ``,
    `## 📊 분석 결과`,
    `- 분석된 논문 수: ${result.papers.length}`,
    `- 관계 수: ${result.relations.length}`,
    `- 기간: ${result.timeline.earliest} - ${result.timeline.latest}`,
    ``,
  ];

  if (result.analysis.foundationPapers.length > 0) {
    lines.push(`### 📚 기반 논문`);
    lines.push(result.analysis.foundationPapers.slice(0, 5).map(p => `- ${p}`).join('\n'));
    lines.push('');
  }

  if (result.analysis.competitorPapers.length > 0) {
    lines.push(`### ⚔️ 비교 대상 논문`);
    lines.push(result.analysis.competitorPapers.slice(0, 5).map(p => `- ${p}`).join('\n'));
    lines.push('');
  }

  if (result.analysis.methodEvolution) {
    lines.push(`### 🔄 방법론 발전`);
    lines.push(result.analysis.methodEvolution);
    lines.push('');
  }

  lines.push(`## 📈 다이어그램`);
  lines.push('');
  lines.push(result.markdown);

  return lines.join('\n');
}
