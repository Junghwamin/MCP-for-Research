import { parsePDF, extractAbstract } from '../parsers/pdfParser.js';
import { extractConceptsWithLLM, analyzeConceptRelationsWithLLM } from '../api/llmClient.js';
import { generateConceptMapDiagram, wrapInMarkdown } from '../generators/mermaidGenerator.js';
import type { ConceptMapResult, Concept, ConceptRelation } from '../types/diagram.js';

// ============================================
// 개념 관계도 도구
// ============================================

export interface ConceptDiagramInput {
  pdfPath: string;
  maxConcepts?: number;
  relationTypes?: string[];
  includeDefinitions?: boolean;
  diagramStyle?: 'mindmap' | 'flowchart' | 'graph';
}

/**
 * 개념 관계도 생성
 */
export async function generateConceptMap(
  input: ConceptDiagramInput
): Promise<ConceptMapResult> {
  try {
    const {
      pdfPath,
      maxConcepts = 20,
      relationTypes,
      includeDefinitions = false,
      diagramStyle = 'flowchart',
    } = input;

    // PDF 파싱
    const pdfContent = await parsePDF(pdfPath);
    const abstract = extractAbstract(pdfContent.text);

    // 개념 추출
    const concepts = await extractConceptsWithLLM(
      pdfContent.text.substring(0, 15000),
      maxConcepts
    );

    if (concepts.length < 2) {
      return {
        success: false,
        mermaid: '',
        markdown: '',
        concepts: [],
        relations: [],
        analysis: {
          centralConcepts: [],
          novelConcepts: [],
          foundationConcepts: [],
        },
        error: 'Could not extract enough concepts from the paper',
      };
    }

    // 개념 관계 분석
    let relations = await analyzeConceptRelationsWithLLM(concepts, abstract);

    // 관계 유형 필터링
    if (relationTypes && relationTypes.length > 0) {
      relations = relations.filter(r => relationTypes.includes(r.type));
    }

    // 다이어그램 생성
    const mermaid = generateConceptMapDiagram(
      concepts,
      relations,
      'LR'
    );

    // 분석 결과 계산
    const analysis = analyzeConceptGraph(concepts, relations);

    return {
      success: true,
      mermaid,
      markdown: wrapInMarkdown(mermaid),
      concepts,
      relations,
      analysis,
    };

  } catch (error) {
    return {
      success: false,
      mermaid: '',
      markdown: '',
      concepts: [],
      relations: [],
      analysis: {
        centralConcepts: [],
        novelConcepts: [],
        foundationConcepts: [],
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 개념 그래프 분석
 */
function analyzeConceptGraph(
  concepts: Concept[],
  relations: ConceptRelation[]
): ConceptMapResult['analysis'] {
  // 연결 수 계산
  const connectionCount = new Map<string, number>();

  for (const concept of concepts) {
    connectionCount.set(concept.id, 0);
  }

  for (const relation of relations) {
    connectionCount.set(
      relation.source,
      (connectionCount.get(relation.source) || 0) + 1
    );
    connectionCount.set(
      relation.target,
      (connectionCount.get(relation.target) || 0) + 1
    );
  }

  // 가장 많이 연결된 개념
  const sortedByConnections = [...connectionCount.entries()]
    .sort((a, b) => b[1] - a[1]);

  const centralConcepts = sortedByConnections
    .slice(0, 5)
    .map(([id]) => {
      const concept = concepts.find(c => c.id === id);
      return concept?.name || id;
    });

  // 새로 제안된 개념
  const novelConcepts = concepts
    .filter(c => c.type === 'proposed')
    .map(c => c.name);

  // 기반 개념
  const foundationConcepts = concepts
    .filter(c => c.type === 'existing' && c.importance === 'high')
    .map(c => c.name);

  return {
    centralConcepts,
    novelConcepts,
    foundationConcepts,
  };
}

/**
 * 결과 포맷팅
 */
export function formatConceptMapResult(result: ConceptMapResult): string {
  if (!result.success) {
    return `❌ 개념 관계도 생성 실패: ${result.error}`;
  }

  const lines: string[] = [
    `# 🧠 개념 관계도`,
    ``,
    `## 📊 분석 결과`,
    `- 추출된 개념 수: ${result.concepts.length}`,
    `- 관계 수: ${result.relations.length}`,
    ``,
  ];

  if (result.analysis.centralConcepts.length > 0) {
    lines.push(`### 🎯 핵심 개념`);
    lines.push(result.analysis.centralConcepts.map(c => `- ${c}`).join('\n'));
    lines.push('');
  }

  if (result.analysis.novelConcepts.length > 0) {
    lines.push(`### 🆕 새로 제안된 개념`);
    lines.push(result.analysis.novelConcepts.map(c => `- ${c}`).join('\n'));
    lines.push('');
  }

  if (result.analysis.foundationConcepts.length > 0) {
    lines.push(`### 📚 기반 개념`);
    lines.push(result.analysis.foundationConcepts.map(c => `- ${c}`).join('\n'));
    lines.push('');
  }

  lines.push(`## 📈 다이어그램`);
  lines.push('');
  lines.push(result.markdown);
  lines.push('');

  // 개념 목록
  lines.push(`## 📝 개념 목록`);
  lines.push('');
  lines.push('| 개념 | 한국어 | 유형 | 중요도 |');
  lines.push('|------|--------|------|--------|');

  const typeEmojis: Record<string, string> = {
    proposed: '🆕',
    existing: '📚',
    method: '⚙️',
    metric: '📊',
    dataset: '📁',
  };

  for (const concept of result.concepts.slice(0, 20)) {
    const emoji = typeEmojis[concept.type] || '';
    lines.push(
      `| ${concept.name} | ${concept.koreanName || '-'} | ${emoji} ${concept.type} | ${concept.importance} |`
    );
  }

  return lines.join('\n');
}
