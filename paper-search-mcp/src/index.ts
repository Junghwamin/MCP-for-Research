#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

// Tools
import { searchPapers, searchByAuthor, formatSearchResult, formatAuthorSearchResult } from './tools/search.js';
import { getPaperDetails, formatPaperDetails } from './tools/details.js';
import { getCitations, getReferences, getRelatedPapers, formatCitations, formatReferences, formatRelatedPapers } from './tools/citations.js';
import { downloadPaper, formatDownloadResult } from './tools/download.js';
import { exportPapers, exportBibTeX, formatExportResult, formatBibTeXResult } from './tools/export.js';
import { searchOpenReview, getOpenReviewInfo, formatOpenReviewSearchResult, formatOpenReviewInfo, formatSupportedVenues } from './tools/openreview.js';
import { summarizePaper, formatSummary } from './tools/summarize.js';
import { searchCache } from './cache/searchCache.js';
import { ExportFormat, Paper } from './types/paper.js';

// Tool 정의
const TOOLS: Tool[] = [
  {
    name: 'search_papers',
    description: 'Search for academic papers by keywords with advanced filters. Returns papers from arXiv and Semantic Scholar.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (keywords or phrases)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 10, max: 50)',
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date', 'citations'],
          description: 'Sort order (default: relevance)',
          default: 'relevance',
        },
        yearFrom: {
          type: 'number',
          description: 'Filter papers from this year onwards',
        },
        yearTo: {
          type: 'number',
          description: 'Filter papers up to this year',
        },
        venue: {
          type: 'string',
          description: 'Filter by venue/conference (e.g., "NeurIPS", "ICML")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_paper_details',
    description: 'Get detailed information about a specific paper by its ID (arXiv ID or Semantic Scholar ID)',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID (arXiv ID like "2301.00001" or Semantic Scholar ID)',
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'search_by_author',
    description: 'Search for papers by a specific author name',
    inputSchema: {
      type: 'object',
      properties: {
        authorName: {
          type: 'string',
          description: 'Author name to search for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
          default: 10,
        },
      },
      required: ['authorName'],
    },
  },
  {
    name: 'get_citations',
    description: 'Get papers that cite a specific paper (incoming citations)',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to get citations for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of citations to return (default: 10)',
          default: 10,
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'get_references',
    description: 'Get papers that a specific paper references (outgoing citations)',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to get references for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of references to return (default: 10)',
          default: 10,
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'get_related_papers',
    description: 'Get papers related to a specific paper (similar/recommended papers)',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to find related papers for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of related papers to return (default: 10)',
          default: 10,
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'download_paper',
    description: 'Download the PDF of a paper to a specified path',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to download',
        },
        outputPath: {
          type: 'string',
          description: 'Path where to save the PDF file',
        },
      },
      required: ['paperId', 'outputPath'],
    },
  },
  {
    name: 'export_papers',
    description: 'Export a list of papers to a file (JSON, CSV, or BibTeX format)',
    inputSchema: {
      type: 'object',
      properties: {
        paperIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of paper IDs to export',
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'bibtex'],
          description: 'Export format',
        },
        outputPath: {
          type: 'string',
          description: 'Path where to save the exported file',
        },
      },
      required: ['paperIds', 'format', 'outputPath'],
    },
  },
  {
    name: 'export_bibtex',
    description: 'Get BibTeX citation for a single paper (returns as text, ready to copy)',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to get BibTeX for',
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'get_openreview_info',
    description: 'Get review information for a paper from OpenReview (ratings, reviews, decision)',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          description: 'Paper title or OpenReview ID',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'search_openreview',
    description: 'Search for papers on OpenReview by venue/conference',
    inputSchema: {
      type: 'object',
      properties: {
        venue: {
          type: 'string',
          description: 'Venue to search (neurips, iclr, icml, aaai, acl, emnlp, cvpr, iccv)',
        },
        query: {
          type: 'string',
          description: 'Search query (optional)',
        },
        year: {
          type: 'number',
          description: 'Year of the conference (optional)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
          default: 20,
        },
      },
      required: ['venue'],
    },
  },
  {
    name: 'summarize_paper',
    description: 'Generate a structured summary of a paper based on its abstract',
    inputSchema: {
      type: 'object',
      properties: {
        paperId: {
          type: 'string',
          description: 'Paper ID to summarize',
        },
      },
      required: ['paperId'],
    },
  },
  {
    name: 'clear_cache',
    description: 'Clear the search cache to get fresh results',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Optional pattern to clear specific cache entries (regex)',
        },
      },
    },
  },
];

// MCP 서버 생성
const server = new Server(
  {
    name: 'paper-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Tool 호출 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_papers': {
        const result = await searchPapers({
          query: args?.query as string,
          maxResults: Math.min((args?.maxResults as number) || 10, 50),
          sortBy: (args?.sortBy as 'relevance' | 'date' | 'citations') || 'relevance',
          yearFrom: args?.yearFrom as number | undefined,
          yearTo: args?.yearTo as number | undefined,
          venue: args?.venue as string | undefined,
        });
        return {
          content: [{ type: 'text', text: formatSearchResult(result) }],
        };
      }

      case 'get_paper_details': {
        const paper = await getPaperDetails(args?.paperId as string);
        if (!paper) {
          return {
            content: [{ type: 'text', text: `Paper not found: ${args?.paperId}` }],
          };
        }
        return {
          content: [{ type: 'text', text: formatPaperDetails(paper) }],
        };
      }

      case 'search_by_author': {
        const papers = await searchByAuthor(
          args?.authorName as string,
          (args?.limit as number) || 10
        );
        return {
          content: [{ type: 'text', text: formatAuthorSearchResult(papers, args?.authorName as string) }],
        };
      }

      case 'get_citations': {
        const citations = await getCitations(
          args?.paperId as string,
          (args?.limit as number) || 10
        );
        return {
          content: [{ type: 'text', text: formatCitations(citations, args?.paperId as string) }],
        };
      }

      case 'get_references': {
        const references = await getReferences(
          args?.paperId as string,
          (args?.limit as number) || 10
        );
        return {
          content: [{ type: 'text', text: formatReferences(references, args?.paperId as string) }],
        };
      }

      case 'get_related_papers': {
        const related = await getRelatedPapers(
          args?.paperId as string,
          (args?.limit as number) || 10
        );
        return {
          content: [{ type: 'text', text: formatRelatedPapers(related, args?.paperId as string) }],
        };
      }

      case 'download_paper': {
        const result = await downloadPaper(
          args?.paperId as string,
          args?.outputPath as string
        );
        return {
          content: [{ type: 'text', text: formatDownloadResult(result, args?.paperId as string) }],
        };
      }

      case 'export_papers': {
        const paperIds = args?.paperIds as string[];
        const format = args?.format as ExportFormat;
        const outputPath = args?.outputPath as string;

        // 각 논문의 상세 정보 가져오기
        const papers: Paper[] = [];
        for (const id of paperIds) {
          const paper = await getPaperDetails(id);
          if (paper) {
            papers.push(paper);
          }
        }

        const result = await exportPapers(papers, format, outputPath);
        return {
          content: [{ type: 'text', text: formatExportResult(result, format) }],
        };
      }

      case 'export_bibtex': {
        const result = await exportBibTeX(args?.paperId as string);
        return {
          content: [{ type: 'text', text: formatBibTeXResult(result, args?.paperId as string) }],
        };
      }

      case 'get_openreview_info': {
        const paper = await getOpenReviewInfo(args?.identifier as string);
        if (!paper) {
          return {
            content: [{ type: 'text', text: `Paper not found on OpenReview: ${args?.identifier}\n\n${formatSupportedVenues()}` }],
          };
        }
        return {
          content: [{ type: 'text', text: formatOpenReviewInfo(paper) }],
        };
      }

      case 'search_openreview': {
        const papers = await searchOpenReview(
          args?.venue as string,
          args?.query as string | undefined,
          args?.year as number | undefined,
          (args?.limit as number) || 20
        );
        return {
          content: [{ type: 'text', text: formatOpenReviewSearchResult(papers, args?.venue as string) }],
        };
      }

      case 'summarize_paper': {
        const result = await summarizePaper(args?.paperId as string);
        return {
          content: [{ type: 'text', text: formatSummary(result) }],
        };
      }

      case 'clear_cache': {
        const pattern = args?.pattern as string | undefined;
        if (pattern) {
          const count = searchCache.clearPattern(pattern);
          return {
            content: [{ type: 'text', text: `Cleared ${count} cache entries matching pattern: ${pattern}` }],
          };
        } else {
          searchCache.clear();
          return {
            content: [{ type: 'text', text: 'Cache cleared successfully' }],
          };
        }
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

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Paper Search MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
