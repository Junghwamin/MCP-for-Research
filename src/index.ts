#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { translatePaper, formatTranslateResult } from './tools/translate.js';
import { summarizePaper, formatSummaryResult } from './tools/summarize.js';
import { extractImages, formatExtractResult } from './tools/extractImages.js';
import { translateTable, formatTableResult } from './tools/translateTable.js';
import { exportTranslation, formatExportResult } from './tools/export.js';
import { manageGlossary, formatGlossaryResult } from './tools/glossary.js';

import type {
  TranslatePaperInput,
  SummarizePaperInput,
  ExtractImagesInput,
  TranslateTableInput,
  ExportTranslationInput,
  ManageGlossaryInput,
} from './types/translation.js';

// ============================================
// MCP 도구 정의
// ============================================

const TOOLS: Tool[] = [
  // 1. 전체 논문 번역
  {
    name: 'translate_paper',
    description: 'Translate an entire academic paper (PDF) to target language. Extracts text section by section, preserves AI/ML terminology, and generates markdown output with images.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file to translate',
        },
        outputDir: {
          type: 'string',
          description: 'Directory for output files (default: same as PDF location)',
        },
        targetLanguage: {
          type: 'string',
          enum: ['ko', 'en', 'ja', 'zh'],
          description: 'Target language code (default: ko)',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'parallel', 'html'],
          description: 'Output format (default: markdown)',
        },
        preserveTerms: {
          type: 'boolean',
          description: 'Keep AI/ML technical terms in English (default: true)',
        },
        extractImages: {
          type: 'boolean',
          description: 'Extract and save all images separately (default: true)',
        },
        generateDocx: {
          type: 'boolean',
          description: 'Also generate styled DOCX document (default: true)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 2. 논문 요약
  {
    name: 'summarize_paper',
    description: 'Generate a quick summary of a paper before full translation. Returns 3-line summary, keywords, and key contributions.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        detailLevel: {
          type: 'string',
          enum: ['brief', 'detailed'],
          description: 'Summary detail level (default: brief)',
        },
        language: {
          type: 'string',
          enum: ['ko', 'en'],
          description: 'Summary language (default: ko)',
        },
      },
      required: ['pdfPath'],
    },
  },

  // 3. 이미지 추출
  {
    name: 'extract_paper_images',
    description: 'Extract all images (figures, diagrams) from a PDF paper with translated captions.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        outputDir: {
          type: 'string',
          description: 'Directory to save extracted images',
        },
        imageFormat: {
          type: 'string',
          enum: ['png', 'jpg', 'webp'],
          description: 'Output image format (default: png)',
        },
        translateCaptions: {
          type: 'boolean',
          description: 'Translate figure captions to Korean (default: true)',
        },
      },
      required: ['pdfPath', 'outputDir'],
    },
  },

  // 4. 테이블 번역
  {
    name: 'translate_table',
    description: 'Extract and translate a specific table from a paper.',
    inputSchema: {
      type: 'object',
      properties: {
        pdfPath: {
          type: 'string',
          description: 'Absolute path to the PDF file',
        },
        tableNumber: {
          type: 'number',
          description: 'Table number to translate (1-indexed)',
        },
        targetLanguage: {
          type: 'string',
          enum: ['ko', 'en', 'ja', 'zh'],
          description: 'Target language (default: ko)',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'csv', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
      required: ['pdfPath', 'tableNumber'],
    },
  },

  // 5. 번역 결과 내보내기 (DOCX)
  {
    name: 'export_translation',
    description: 'Export translated paper to DOCX format with proper styling (11pt font, images embedded, formatted tables).',
    inputSchema: {
      type: 'object',
      properties: {
        translatedMdPath: {
          type: 'string',
          description: 'Path to the translated markdown file',
        },
        outputPath: {
          type: 'string',
          description: 'Output file path (e.g., paper_translated.docx)',
        },
        format: {
          type: 'string',
          enum: ['docx', 'html', 'pdf'],
          description: 'Export format (default: docx)',
        },
        imagesDir: {
          type: 'string',
          description: 'Directory containing extracted images',
        },
        includeOriginal: {
          type: 'boolean',
          description: 'Include original text alongside translation (default: false)',
        },
      },
      required: ['translatedMdPath', 'outputPath'],
    },
  },

  // 6. 용어집 관리
  {
    name: 'manage_glossary',
    description: 'Manage AI/ML terminology glossary (view, search, add, update terms).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'search', 'add', 'update', 'import'],
          description: 'Action to perform',
        },
        term: {
          type: 'string',
          description: 'Term to search/add/update',
        },
        translation: {
          type: 'string',
          description: 'Korean translation (for add/update)',
        },
        definition: {
          type: 'string',
          description: 'Definition or explanation',
        },
        category: {
          type: 'string',
          description: 'Category (neural_network, transformer, optimization, nlp, cv, rl, generative, evaluation, general)',
        },
        glossaryPath: {
          type: 'string',
          description: 'Path to custom glossary file (for import)',
        },
      },
      required: ['action'],
    },
  },
];

// ============================================
// MCP 서버 설정
// ============================================

const server = new Server(
  {
    name: 'paper-translate-mcp',
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
      // 전체 논문 번역
      case 'translate_paper': {
        const input: TranslatePaperInput = {
          pdfPath: args?.pdfPath as string,
          outputDir: args?.outputDir as string | undefined,
          targetLanguage: (args?.targetLanguage as 'ko' | 'en' | 'ja' | 'zh') || 'ko',
          outputFormat: (args?.outputFormat as 'markdown' | 'parallel' | 'html') || 'markdown',
          preserveTerms: (args?.preserveTerms as boolean) ?? true,
          extractImages: (args?.extractImages as boolean) ?? true,
          generateDocx: (args?.generateDocx as boolean) ?? true,
        };
        const result = await translatePaper(input);
        return {
          content: [{ type: 'text', text: formatTranslateResult(result) }],
        };
      }

      // 논문 요약
      case 'summarize_paper': {
        const input: SummarizePaperInput = {
          pdfPath: args?.pdfPath as string,
          detailLevel: (args?.detailLevel as 'brief' | 'detailed') || 'brief',
          language: (args?.language as 'ko' | 'en') || 'ko',
        };
        const result = await summarizePaper(input);
        return {
          content: [{ type: 'text', text: formatSummaryResult(result) }],
        };
      }

      // 이미지 추출
      case 'extract_paper_images': {
        const input: ExtractImagesInput = {
          pdfPath: args?.pdfPath as string,
          outputDir: args?.outputDir as string,
          imageFormat: (args?.imageFormat as 'png' | 'jpg' | 'webp') || 'png',
          translateCaptions: (args?.translateCaptions as boolean) ?? true,
        };
        const result = await extractImages(input);
        return {
          content: [{ type: 'text', text: formatExtractResult(result) }],
        };
      }

      // 테이블 번역
      case 'translate_table': {
        const input: TranslateTableInput = {
          pdfPath: args?.pdfPath as string,
          tableNumber: args?.tableNumber as number,
          targetLanguage: (args?.targetLanguage as 'ko' | 'en' | 'ja' | 'zh') || 'ko',
          outputFormat: (args?.outputFormat as 'markdown' | 'csv' | 'json') || 'markdown',
        };
        const result = await translateTable(input);
        return {
          content: [{ type: 'text', text: formatTableResult(result) }],
        };
      }

      // 번역 결과 내보내기
      case 'export_translation': {
        const input: ExportTranslationInput = {
          translatedMdPath: args?.translatedMdPath as string,
          outputPath: args?.outputPath as string,
          format: (args?.format as 'docx' | 'html' | 'pdf') || 'docx',
          imagesDir: args?.imagesDir as string | undefined,
          includeOriginal: (args?.includeOriginal as boolean) ?? false,
        };
        const result = await exportTranslation(input);
        return {
          content: [{ type: 'text', text: formatExportResult(result) }],
        };
      }

      // 용어집 관리
      case 'manage_glossary': {
        const input: ManageGlossaryInput = {
          action: args?.action as 'list' | 'search' | 'add' | 'update' | 'import',
          term: args?.term as string | undefined,
          translation: args?.translation as string | undefined,
          definition: args?.definition as string | undefined,
          category: args?.category as any,
          glossaryPath: args?.glossaryPath as string | undefined,
        };
        const result = await manageGlossary(input);
        return {
          content: [{ type: 'text', text: formatGlossaryResult(result) }],
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
  console.error('Paper Translate MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
