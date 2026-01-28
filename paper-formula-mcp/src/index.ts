#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { extractFormulas, formatExtractFormulasResult } from './tools/extractFormulas.js';
import { explainFormula, formatExplainResult } from './tools/explainFormula.js';
import { generateDependencyDiagram, formatDependencyResult } from './tools/dependencyDiagram.js';
import { generateConceptMap, formatConceptMapResult } from './tools/conceptDiagram.js';
import { generateEvolutionDiagram, formatEvolutionResult } from './tools/evolutionDiagram.js';
import { analyzeVariables, formatVariableResult } from './tools/analyzeVariables.js';
import { analyzeRoles, formatRoleResult } from './tools/analyzeRoles.js';
import { generateTextbook, formatTextbookResult } from './tools/generateTextbook.js';
import { startTextbookWizard, textbookWizardAnswer, formatWizardResult } from './tools/interactiveTextbook.js';

import type {
  ExtractFormulasResult,
  ExplainFormulaResult,
  VariableAnalysisResult,
  RoleAnalysisResult,
} from './types/formula.js';

import type {
  DependencyDiagramResult,
  ConceptMapResult,
  EvolutionDiagramResult,
} from './types/diagram.js';

import type {
  GenerateTextbookResult,
  WizardStepResult,
} from './types/textbook.js';

// ============================================
// MCP 도구 정의
// ============================================

const TOOLS: Tool[] = [
  // 1. 수식 추출
  {
    name: 'extract_formulas',
    description: 'Extract all mathematical formulas from a PDF paper with LaTeX notation, context, and role classification (definition, objective, theorem, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        includeInline: {
          type: 'boolean',
          description: 'Include inline formulas (default: true)',
        },
        includeNumbered: {
          type: 'boolean',
          description: 'Include only numbered equations (default: false)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 2. 수식 설명
  {
    name: 'explain_formula',
    description: 'Explain a mathematical formula in detail using LLM, including its components, meaning, role in the paper, and intuitive understanding',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        formulaId: {
          type: 'string',
          description: 'Formula ID (e.g., "eq1", "eq2.3")',
        },
        latex: {
          type: 'string',
          description: 'Direct LaTeX input (alternative to formulaId)',
        },
        detailLevel: {
          type: 'string',
          enum: ['brief', 'detailed', 'educational'],
          description: 'Explanation detail level (default: detailed)',
        },
        language: {
          type: 'string',
          enum: ['ko', 'en'],
          description: 'Output language (default: ko)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 3. 수식 의존성 다이어그램
  {
    name: 'generate_formula_dependency',
    description: 'Generate a Mermaid diagram showing dependencies between formulas (which formula uses/derives from which)',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        diagramType: {
          type: 'string',
          enum: ['flowchart', 'graph'],
          description: 'Mermaid diagram type (default: flowchart)',
        },
        direction: {
          type: 'string',
          enum: ['TB', 'BT', 'LR', 'RL'],
          description: 'Graph direction (default: TB - Top to Bottom)',
        },
        includeVariables: {
          type: 'boolean',
          description: 'Show shared variables as edge labels (default: true)',
        },
        filterSection: {
          type: 'string',
          description: 'Filter by section name (optional)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 4. 개념 관계도
  {
    name: 'generate_concept_map',
    description: 'Generate a Mermaid diagram showing relationships between key concepts in the paper (is_a, part_of, uses, extends, compared_to)',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        maxConcepts: {
          type: 'number',
          description: 'Maximum number of concepts to include (default: 20)',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of relations to show: "is_a", "part_of", "uses", "extends", "compared_to"',
        },
        includeDefinitions: {
          type: 'boolean',
          description: 'Include concept definitions in nodes (default: false)',
        },
        diagramStyle: {
          type: 'string',
          enum: ['mindmap', 'flowchart', 'graph'],
          description: 'Diagram style (default: flowchart)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 5. 논문 발전 관계도
  {
    name: 'generate_evolution_diagram',
    description: 'Generate a Mermaid diagram showing the evolution and relationships between papers (citations, extensions, comparisons)',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the main PDF file',
        },
        additionalPapers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths to additional related papers (optional)',
        },
        paperIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paper IDs from paper-search-mcp (arXiv IDs)',
        },
        depth: {
          type: 'number',
          description: 'How many levels of references to include (default: 2)',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types: "extends", "improves", "compares", "applies", "cites"',
        },
        timelineView: {
          type: 'boolean',
          description: 'Show papers in chronological order (default: true)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 6. 변수 분석
  {
    name: 'analyze_formula_variables',
    description: 'Analyze variable definitions and usage across all formulas, showing where each variable is defined and used',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        outputFormat: {
          type: 'string',
          enum: ['mermaid', 'table', 'json'],
          description: 'Output format (default: mermaid)',
        },
        filterSymbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter to specific symbols (optional)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 7. 역할 분석
  {
    name: 'analyze_formula_roles',
    description: 'Analyze the roles of formulas in the paper (definition, objective, constraint, theorem, derivation) and generate a logical flow diagram',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        groupByRole: {
          type: 'boolean',
          description: 'Group formulas by their role (default: true)',
        },
        showFlow: {
          type: 'boolean',
          description: 'Show logical flow between roles (default: true)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 8. 교과서 생성
  {
    name: 'generate_textbook',
    description: 'Generate an educational textbook from a paper\'s formulas. Builds from basic concepts (elementary level) up to the paper\'s advanced math. Includes worked examples, exercises with full solution processes and answers, visual diagrams, and a glossary.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        targetLevel: {
          type: 'string',
          enum: ['auto', 'elementary', 'middle', 'high', 'undergraduate', 'graduate'],
          description: 'Target audience level. "auto" builds progressively from elementary to graduate (default: auto)',
        },
        language: {
          type: 'string',
          enum: ['ko', 'en'],
          description: 'Textbook language (default: ko)',
        },
        maxChapters: {
          type: 'number',
          description: 'Maximum number of chapters (default: 8)',
        },
        includeExercises: {
          type: 'boolean',
          description: 'Include exercises with full solutions and answers (default: true)',
        },
        includeExamples: {
          type: 'boolean',
          description: 'Include worked examples (default: true)',
        },
        focusFormulas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific formula IDs to focus on (optional)',
        },
        outputPath: {
          type: 'string',
          description: 'File path to save the textbook markdown (optional)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 9. 인터랙티브 교과서 마법사 시작
  {
    name: 'start_textbook_wizard',
    description: 'Start an interactive textbook generation wizard. Analyzes the PDF and guides you through step-by-step choices (target level, language, focus area, depth, style) to create a customized educational textbook. Returns a session ID for subsequent interactions.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 10. 교과서 마법사 답변
  {
    name: 'textbook_wizard_answer',
    description: 'Answer a question in the interactive textbook wizard. Pass the session ID from start_textbook_wizard and your selected option value. The wizard progresses through: level → language → focus → depth → style → confirm → generate.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID from start_textbook_wizard',
        },
        answer: {
          type: 'string',
          description: 'Your answer/selection value (e.g., "auto", "ko", "all", "standard", "friendly", "yes")',
        },
      },
      required: ['sessionId', 'answer'],
    },
  },
];

// ============================================
// MCP 서버 설정
// ============================================

const server = new Server(
  {
    name: 'paper-formula-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 반환
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // 수식 추출
      case 'extract_formulas': {
        const result = await extractFormulas({
          pdfPath: args?.pdfPath as string,
          includeInline: (args?.includeInline as boolean) ?? true,
          includeNumbered: (args?.includeNumbered as boolean) ?? false,
        });
        return {
          content: [{ type: 'text', text: formatExtractFormulasResult(result) }],
        };
      }

      // 수식 설명
      case 'explain_formula': {
        const result = await explainFormula({
          pdfPath: args?.pdfPath as string,
          formulaId: args?.formulaId as string | undefined,
          latex: args?.latex as string | undefined,
          detailLevel: (args?.detailLevel as 'brief' | 'detailed' | 'educational') || 'detailed',
          language: (args?.language as 'ko' | 'en') || 'ko',
        });
        return {
          content: [{ type: 'text', text: formatExplainResult(result) }],
        };
      }

      // 수식 의존성 다이어그램
      case 'generate_formula_dependency': {
        const result = await generateDependencyDiagram({
          pdfPath: args?.pdfPath as string,
          diagramType: (args?.diagramType as 'flowchart' | 'graph') || 'flowchart',
          direction: (args?.direction as 'TB' | 'BT' | 'LR' | 'RL') || 'TB',
          includeVariables: (args?.includeVariables as boolean) ?? true,
          filterSection: args?.filterSection as string | undefined,
        });
        return {
          content: [{ type: 'text', text: formatDependencyResult(result) }],
        };
      }

      // 개념 관계도
      case 'generate_concept_map': {
        const result = await generateConceptMap({
          pdfPath: args?.pdfPath as string,
          maxConcepts: (args?.maxConcepts as number) || 20,
          relationTypes: args?.relationTypes as string[] | undefined,
          includeDefinitions: (args?.includeDefinitions as boolean) ?? false,
          diagramStyle: (args?.diagramStyle as 'mindmap' | 'flowchart' | 'graph') || 'flowchart',
        });
        return {
          content: [{ type: 'text', text: formatConceptMapResult(result) }],
        };
      }

      // 논문 발전 관계도
      case 'generate_evolution_diagram': {
        const result = await generateEvolutionDiagram({
          pdfPath: args?.pdfPath as string,
          additionalPapers: args?.additionalPapers as string[] | undefined,
          paperIds: args?.paperIds as string[] | undefined,
          depth: (args?.depth as number) || 2,
          relationTypes: args?.relationTypes as string[] | undefined,
          timelineView: (args?.timelineView as boolean) ?? true,
        });
        return {
          content: [{ type: 'text', text: formatEvolutionResult(result) }],
        };
      }

      // 변수 분석
      case 'analyze_formula_variables': {
        const result = await analyzeVariables({
          pdfPath: args?.pdfPath as string,
          outputFormat: (args?.outputFormat as 'mermaid' | 'table' | 'json') || 'mermaid',
          filterSymbols: args?.filterSymbols as string[] | undefined,
        });
        return {
          content: [{ type: 'text', text: formatVariableResult(result) }],
        };
      }

      // 역할 분석
      case 'analyze_formula_roles': {
        const result = await analyzeRoles({
          pdfPath: args?.pdfPath as string,
          groupByRole: (args?.groupByRole as boolean) ?? true,
          showFlow: (args?.showFlow as boolean) ?? true,
        });
        return {
          content: [{ type: 'text', text: formatRoleResult(result) }],
        };
      }

      // 교과서 생성
      case 'generate_textbook': {
        const result = await generateTextbook({
          pdfPath: args?.pdfPath as string,
          targetLevel: (args?.targetLevel as any) || 'auto',
          language: (args?.language as 'ko' | 'en') || 'ko',
          maxChapters: (args?.maxChapters as number) || 8,
          includeExercises: (args?.includeExercises as boolean) ?? true,
          includeExamples: (args?.includeExamples as boolean) ?? true,
          focusFormulas: args?.focusFormulas as string[] | undefined,
          outputPath: args?.outputPath as string | undefined,
        });
        return {
          content: [{ type: 'text', text: formatTextbookResult(result) }],
        };
      }

      // 인터랙티브 교과서 마법사 시작
      case 'start_textbook_wizard': {
        const result = await startTextbookWizard({
          pdfPath: args?.pdfPath as string,
        });
        return {
          content: [{ type: 'text', text: formatWizardResult(result) }],
        };
      }

      // 교과서 마법사 답변 처리
      case 'textbook_wizard_answer': {
        const result = await textbookWizardAnswer({
          sessionId: args?.sessionId as string,
          answer: args?.answer as string,
        });
        return {
          content: [{ type: 'text', text: formatWizardResult(result) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// ============================================
// 서버 시작
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Paper Formula MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
