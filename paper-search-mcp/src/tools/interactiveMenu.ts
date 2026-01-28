import { searchPapers, searchByAuthor, formatSearchResult, formatAuthorSearchResult } from './search.js';
import { getPaperDetails, formatPaperDetails } from './details.js';
import { getCitations, getReferences, getRelatedPapers, formatCitations, formatReferences, formatRelatedPapers } from './citations.js';
import { downloadPaper, formatDownloadResult } from './download.js';
import { exportPapers, exportBibTeX, formatExportResult, formatBibTeXResult } from './export.js';
import { searchOpenReview, getOpenReviewInfo, formatOpenReviewSearchResult, formatOpenReviewInfo } from './openreview.js';
import { summarizePaper, formatSummary } from './summarize.js';
import { searchCache } from '../cache/searchCache.js';
import { getPaperDetails as getPaperDetailsForExport } from './details.js';
import { ExportFormat, Paper } from '../types/paper.js';
import {
  MenuWizardStep,
  MenuWizardSession,
  MenuWizardStepResult,
  MenuWizardOption,
  ParamDefinition,
  ToolCategory,
  ToolInfo,
} from '../types/interactive.js';

// ─────────────────────────────────────────────
// 세션 관리
// ─────────────────────────────────────────────

const sessions = new Map<string, MenuWizardSession>();
const SESSION_TTL = 30 * 60 * 1000; // 30분

function generateSessionId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}

function getSession(sessionId: string): MenuWizardSession | null {
  cleanupExpiredSessions();
  return sessions.get(sessionId) || null;
}

function createSession(): MenuWizardSession {
  cleanupExpiredSessions();
  const session: MenuWizardSession = {
    id: generateSessionId(),
    currentStep: 'select_function',
    selectedFunction: null,
    toolInfo: null,
    collectedParams: {},
    currentParamIndex: 0,
    pendingParams: [],
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

// ─────────────────────────────────────────────
// 도구 카테고리 및 정의
// ─────────────────────────────────────────────

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'search',
    label: '검색',
    emoji: '\uD83D\uDD0D',
    tools: [
      {
        name: 'search_papers',
        label: '논문 검색',
        description: '키워드로 학술 논문을 검색합니다 (arXiv + Semantic Scholar)',
        emoji: '\uD83D\uDD0D',
        params: [
          {
            name: 'query',
            type: 'string',
            description: '검색 키워드 또는 문구',
            required: true,
          },
          {
            name: 'maxResults',
            type: 'number',
            description: '최대 결과 수 (기본값: 10, 최대: 50)',
            required: false,
            defaultValue: 10,
          },
          {
            name: 'sortBy',
            type: 'enum',
            description: '정렬 기준',
            required: false,
            defaultValue: 'relevance',
            enumValues: ['relevance', 'date', 'citations'],
          },
          {
            name: 'yearFrom',
            type: 'number',
            description: '시작 연도 (이 연도부터 필터링)',
            required: false,
          },
          {
            name: 'yearTo',
            type: 'number',
            description: '종료 연도 (이 연도까지 필터링)',
            required: false,
          },
          {
            name: 'venue',
            type: 'string',
            description: '학회/저널 필터 (예: "NeurIPS", "ICML")',
            required: false,
          },
        ],
      },
      {
        name: 'search_by_author',
        label: '저자별 검색',
        description: '특정 저자의 논문을 검색합니다',
        emoji: '\uD83D\uDC64',
        params: [
          {
            name: 'authorName',
            type: 'string',
            description: '저자 이름',
            required: true,
          },
          {
            name: 'limit',
            type: 'number',
            description: '최대 결과 수 (기본값: 10)',
            required: false,
            defaultValue: 10,
          },
        ],
      },
      {
        name: 'search_openreview',
        label: 'OpenReview 검색',
        description: 'OpenReview에서 학회별 논문을 검색합니다',
        emoji: '\uD83C\uDFDB\uFE0F',
        params: [
          {
            name: 'venue',
            type: 'string',
            description: '학회명 (neurips, iclr, icml, aaai, acl, emnlp, cvpr, iccv)',
            required: true,
          },
          {
            name: 'query',
            type: 'string',
            description: '검색 키워드 (선택)',
            required: false,
          },
          {
            name: 'year',
            type: 'number',
            description: '학회 연도 (선택)',
            required: false,
          },
          {
            name: 'limit',
            type: 'number',
            description: '최대 결과 수 (기본값: 20)',
            required: false,
            defaultValue: 20,
          },
        ],
      },
    ],
  },
  {
    id: 'details',
    label: '논문 상세',
    emoji: '\uD83D\uDCC4',
    tools: [
      {
        name: 'get_paper_details',
        label: '논문 상세 정보',
        description: '논문 ID로 상세 정보를 조회합니다',
        emoji: '\uD83D\uDCCB',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '논문 ID (arXiv ID 예: "2301.00001" 또는 Semantic Scholar ID)',
            required: true,
          },
        ],
      },
      {
        name: 'get_openreview_info',
        label: 'OpenReview 리뷰 정보',
        description: 'OpenReview에서 논문의 리뷰 정보를 조회합니다',
        emoji: '\u2B50',
        params: [
          {
            name: 'identifier',
            type: 'string',
            description: '논문 제목 또는 OpenReview ID',
            required: true,
          },
        ],
      },
      {
        name: 'summarize_paper',
        label: '논문 요약',
        description: '논문의 초록을 기반으로 구조화된 요약을 생성합니다',
        emoji: '\uD83D\uDCDD',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '요약할 논문 ID',
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: 'citations',
    label: '인용/관계',
    emoji: '\uD83D\uDD17',
    tools: [
      {
        name: 'get_citations',
        label: '인용 논문 조회',
        description: '해당 논문을 인용한 논문들을 조회합니다',
        emoji: '\uD83D\uDCE5',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '논문 ID',
            required: true,
          },
          {
            name: 'limit',
            type: 'number',
            description: '최대 결과 수 (기본값: 10)',
            required: false,
            defaultValue: 10,
          },
        ],
      },
      {
        name: 'get_references',
        label: '참조 논문 조회',
        description: '해당 논문이 참조하는 논문들을 조회합니다',
        emoji: '\uD83D\uDCE4',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '논문 ID',
            required: true,
          },
          {
            name: 'limit',
            type: 'number',
            description: '최대 결과 수 (기본값: 10)',
            required: false,
            defaultValue: 10,
          },
        ],
      },
      {
        name: 'get_related_papers',
        label: '관련 논문 조회',
        description: '해당 논문과 관련된 논문들을 추천합니다',
        emoji: '\uD83E\uDD1D',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '논문 ID',
            required: true,
          },
          {
            name: 'limit',
            type: 'number',
            description: '최대 결과 수 (기본값: 10)',
            required: false,
            defaultValue: 10,
          },
        ],
      },
    ],
  },
  {
    id: 'export',
    label: '내보내기/관리',
    emoji: '\uD83D\uDCBE',
    tools: [
      {
        name: 'download_paper',
        label: '논문 PDF 다운로드',
        description: '논문의 PDF를 지정 경로에 다운로드합니다',
        emoji: '\u2B07\uFE0F',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '다운로드할 논문 ID',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: 'PDF를 저장할 경로',
            required: true,
          },
        ],
      },
      {
        name: 'export_papers',
        label: '논문 목록 내보내기',
        description: '여러 논문을 JSON, CSV 또는 BibTeX 형식으로 내보냅니다',
        emoji: '\uD83D\uDCE6',
        params: [
          {
            name: 'paperIds',
            type: 'array',
            description: '내보낼 논문 ID 목록 (쉼표로 구분)',
            required: true,
            arrayItemType: 'string',
          },
          {
            name: 'format',
            type: 'enum',
            description: '내보내기 형식',
            required: true,
            enumValues: ['json', 'csv', 'bibtex'],
          },
          {
            name: 'outputPath',
            type: 'string',
            description: '저장할 파일 경로',
            required: true,
          },
        ],
      },
      {
        name: 'export_bibtex',
        label: 'BibTeX 내보내기',
        description: '단일 논문의 BibTeX 인용 정보를 생성합니다',
        emoji: '\uD83D\uDCDA',
        params: [
          {
            name: 'paperId',
            type: 'string',
            description: '논문 ID',
            required: true,
          },
        ],
      },
      {
        name: 'clear_cache',
        label: '캐시 초기화',
        description: '검색 캐시를 초기화하여 최신 결과를 가져옵니다',
        emoji: '\uD83D\uDDD1\uFE0F',
        params: [
          {
            name: 'pattern',
            type: 'string',
            description: '삭제할 캐시 패턴 (정규식, 비워두면 전체 삭제)',
            required: false,
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────
// 도구 조회 헬퍼
// ─────────────────────────────────────────────

function findToolByName(name: string): ToolInfo | null {
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      if (tool.name === name) {
        return tool;
      }
    }
  }
  return null;
}

function getAllToolNames(): string[] {
  const names: string[] = [];
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      names.push(tool.name);
    }
  }
  return names;
}

// ─────────────────────────────────────────────
// 도구 실행기
// ─────────────────────────────────────────────

const toolExecutors: Record<string, (params: Record<string, any>) => Promise<string>> = {
  search_papers: async (params) => {
    const result = await searchPapers({
      query: params.query as string,
      maxResults: Math.min((params.maxResults as number) || 10, 50),
      sortBy: (params.sortBy as 'relevance' | 'date' | 'citations') || 'relevance',
      yearFrom: params.yearFrom as number | undefined,
      yearTo: params.yearTo as number | undefined,
      venue: params.venue as string | undefined,
    });
    return formatSearchResult(result);
  },

  search_by_author: async (params) => {
    const papers = await searchByAuthor(
      params.authorName as string,
      (params.limit as number) || 10
    );
    return formatAuthorSearchResult(papers, params.authorName as string);
  },

  search_openreview: async (params) => {
    const papers = await searchOpenReview(
      params.venue as string,
      params.query as string | undefined,
      params.year as number | undefined,
      (params.limit as number) || 20
    );
    return formatOpenReviewSearchResult(papers, params.venue as string);
  },

  get_paper_details: async (params) => {
    const paper = await getPaperDetails(params.paperId as string);
    if (!paper) {
      return `Paper not found: ${params.paperId}`;
    }
    return formatPaperDetails(paper);
  },

  get_openreview_info: async (params) => {
    const paper = await getOpenReviewInfo(params.identifier as string);
    if (!paper) {
      return `Paper not found on OpenReview: ${params.identifier}`;
    }
    return formatOpenReviewInfo(paper);
  },

  summarize_paper: async (params) => {
    const result = await summarizePaper(params.paperId as string);
    return formatSummary(result);
  },

  get_citations: async (params) => {
    const citations = await getCitations(
      params.paperId as string,
      (params.limit as number) || 10
    );
    return formatCitations(citations, params.paperId as string);
  },

  get_references: async (params) => {
    const references = await getReferences(
      params.paperId as string,
      (params.limit as number) || 10
    );
    return formatReferences(references, params.paperId as string);
  },

  get_related_papers: async (params) => {
    const related = await getRelatedPapers(
      params.paperId as string,
      (params.limit as number) || 10
    );
    return formatRelatedPapers(related, params.paperId as string);
  },

  download_paper: async (params) => {
    const result = await downloadPaper(
      params.paperId as string,
      params.outputPath as string
    );
    return formatDownloadResult(result, params.paperId as string);
  },

  export_papers: async (params) => {
    const paperIds = params.paperIds as string[];
    const format = params.format as ExportFormat;
    const outputPath = params.outputPath as string;

    const papers: Paper[] = [];
    for (const id of paperIds) {
      const paper = await getPaperDetailsForExport(id);
      if (paper) {
        papers.push(paper);
      }
    }

    const result = await exportPapers(papers, format, outputPath);
    return formatExportResult(result, format);
  },

  export_bibtex: async (params) => {
    const result = await exportBibTeX(params.paperId as string);
    return formatBibTeXResult(result, params.paperId as string);
  },

  clear_cache: async (params) => {
    const pattern = params.pattern as string | undefined;
    if (pattern) {
      const count = searchCache.clearPattern(pattern);
      return `Cleared ${count} cache entries matching pattern: ${pattern}`;
    } else {
      searchCache.clear();
      return 'Cache cleared successfully';
    }
  },
};

// ─────────────────────────────────────────────
// 위자드 단계별 처리
// ─────────────────────────────────────────────

function buildCategoryMenu(): MenuWizardStepResult & { sessionId: string } {
  const session = createSession();

  const lines: string[] = [];
  lines.push('# 인터랙티브 기능 선택 마법사');
  lines.push('');
  lines.push('사용할 기능을 선택하세요. 아래 도구 이름을 입력하면 됩니다.');
  lines.push('');

  const options: MenuWizardOption[] = [];

  for (const category of TOOL_CATEGORIES) {
    lines.push(`## ${category.emoji} ${category.label}`);
    lines.push('');

    for (const tool of category.tools) {
      lines.push(`- **\`${tool.name}\`** ${tool.emoji} ${tool.label}`);
      lines.push(`  ${tool.description}`);

      options.push({
        value: tool.name,
        label: `${tool.emoji} ${tool.label}`,
        description: tool.description,
      });
    }

    lines.push('');
  }

  lines.push('---');
  lines.push('도구 이름을 입력하여 선택하세요 (예: `search_papers`)');

  return {
    sessionId: session.id,
    currentStep: 'select_function',
    message: lines.join('\n'),
    options,
    isComplete: false,
  };
}

function buildParamPrompt(session: MenuWizardSession): MenuWizardStepResult {
  const paramDef = session.pendingParams[session.currentParamIndex];
  if (!paramDef) {
    return buildConfirmPrompt(session);
  }

  const lines: string[] = [];
  const toolInfo = session.toolInfo!;

  lines.push(`## ${toolInfo.emoji} ${toolInfo.label} - 매개변수 입력`);
  lines.push('');
  lines.push(`**매개변수 ${session.currentParamIndex + 1}/${session.pendingParams.length}:** \`${paramDef.name}\``);
  lines.push(`**설명:** ${paramDef.description}`);
  lines.push(`**타입:** ${paramDef.type}${paramDef.required ? ' (필수)' : ' (선택)'}`);

  if (paramDef.defaultValue !== undefined) {
    lines.push(`**기본값:** ${paramDef.defaultValue}`);
  }

  lines.push('');

  const options: MenuWizardOption[] = [];

  if (paramDef.type === 'enum' && paramDef.enumValues) {
    lines.push('선택 가능한 값:');
    for (const val of paramDef.enumValues) {
      lines.push(`- \`${val}\``);
      options.push({ value: val, label: val });
    }
    lines.push('');
  }

  if (paramDef.type === 'boolean') {
    lines.push('선택하세요:');
    lines.push('- `yes` (예)');
    lines.push('- `no` (아니오)');
    options.push({ value: 'yes', label: '예', emoji: '\u2705' });
    options.push({ value: 'no', label: '아니오', emoji: '\u274C' });
    lines.push('');
  }

  if (paramDef.type === 'array') {
    lines.push('여러 값을 쉼표(,)로 구분하여 입력하세요.');
    lines.push('예: `2301.00001, 2302.00002, 2303.00003`');
    lines.push('');
  }

  if (!paramDef.required) {
    lines.push('`skip`을 입력하면 기본값을 사용합니다.');
    options.push({ value: 'skip', label: '건너뛰기 (기본값 사용)', emoji: '\u23E9' });
  }

  return {
    sessionId: session.id,
    currentStep: 'collect_params',
    message: lines.join('\n'),
    options: options.length > 0 ? options : undefined,
    isComplete: false,
  };
}

function buildConfirmPrompt(session: MenuWizardSession): MenuWizardStepResult {
  session.currentStep = 'confirm';

  const toolInfo = session.toolInfo!;
  const lines: string[] = [];

  lines.push(`## ${toolInfo.emoji} ${toolInfo.label} - 실행 확인`);
  lines.push('');
  lines.push('### 수집된 매개변수:');
  lines.push('');

  const paramEntries = Object.entries(session.collectedParams);
  if (paramEntries.length === 0) {
    lines.push('- (매개변수 없음)');
  } else {
    for (const [key, value] of paramEntries) {
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      lines.push(`- **${key}:** \`${displayValue}\``);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('실행하시겠습니까?');
  lines.push('- `yes` - 실행');
  lines.push('- `edit` - 매개변수 수정');
  lines.push('- `restart` - 처음부터 다시');

  const options: MenuWizardOption[] = [
    { value: 'yes', label: '실행', emoji: '\u25B6\uFE0F' },
    { value: 'edit', label: '매개변수 수정', emoji: '\u270F\uFE0F' },
    { value: 'restart', label: '처음부터 다시', emoji: '\uD83D\uDD04' },
  ];

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message: lines.join('\n'),
    options,
    isComplete: false,
  };
}

function buildEditParamList(session: MenuWizardSession): MenuWizardStepResult {
  const toolInfo = session.toolInfo!;
  const lines: string[] = [];

  lines.push(`## ${toolInfo.emoji} ${toolInfo.label} - 매개변수 수정`);
  lines.push('');
  lines.push('수정할 매개변수의 번호를 입력하세요:');
  lines.push('');

  const options: MenuWizardOption[] = [];

  for (let i = 0; i < session.pendingParams.length; i++) {
    const param = session.pendingParams[i];
    const currentValue = session.collectedParams[param.name];
    const displayValue = currentValue !== undefined
      ? (Array.isArray(currentValue) ? currentValue.join(', ') : String(currentValue))
      : '(미설정)';

    lines.push(`${i + 1}. **${param.name}** = \`${displayValue}\``);
    options.push({
      value: String(i + 1),
      label: `${param.name}: ${displayValue}`,
    });
  }

  lines.push('');
  lines.push('`done`을 입력하면 확인 화면으로 돌아갑니다.');
  options.push({ value: 'done', label: '수정 완료', emoji: '\u2705' });

  return {
    sessionId: session.id,
    currentStep: 'collect_params',
    message: lines.join('\n'),
    options,
    isComplete: false,
  };
}

// ─────────────────────────────────────────────
// 매개변수 값 파싱
// ─────────────────────────────────────────────

function parseParamValue(
  answer: string,
  paramDef: ParamDefinition
): { success: boolean; value?: any; error?: string } {
  const trimmed = answer.trim();

  switch (paramDef.type) {
    case 'string':
      if (trimmed.length === 0) {
        return { success: false, error: '값을 입력하세요.' };
      }
      return { success: true, value: trimmed };

    case 'number': {
      const num = Number(trimmed);
      if (isNaN(num)) {
        return { success: false, error: `"${trimmed}"은(는) 유효한 숫자가 아닙니다. 숫자를 입력하세요.` };
      }
      return { success: true, value: num };
    }

    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (lower === 'yes' || lower === 'true' || lower === '예' || lower === 'y') {
        return { success: true, value: true };
      }
      if (lower === 'no' || lower === 'false' || lower === '아니오' || lower === 'n') {
        return { success: true, value: false };
      }
      return { success: false, error: '`yes` 또는 `no`를 입력하세요.' };
    }

    case 'enum': {
      if (paramDef.enumValues && paramDef.enumValues.includes(trimmed)) {
        return { success: true, value: trimmed };
      }
      const validValues = paramDef.enumValues ? paramDef.enumValues.join(', ') : '';
      return {
        success: false,
        error: `"${trimmed}"은(는) 유효한 값이 아닙니다. 선택 가능: ${validValues}`,
      };
    }

    case 'array': {
      const items = trimmed
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);

      if (items.length === 0) {
        return { success: false, error: '하나 이상의 값을 쉼표로 구분하여 입력하세요.' };
      }
      return { success: true, value: items };
    }

    default:
      return { success: true, value: trimmed };
  }
}

// ─────────────────────────────────────────────
// 메인 API
// ─────────────────────────────────────────────

export async function startInteractive(): Promise<MenuWizardStepResult> {
  return buildCategoryMenu();
}

export async function interactiveAnswer(input: {
  sessionId: string;
  answer: string;
}): Promise<MenuWizardStepResult> {
  const { sessionId, answer } = input;
  const session = getSession(sessionId);

  if (!session) {
    return {
      sessionId,
      currentStep: 'select_function',
      message: '세션이 만료되었거나 존재하지 않습니다. 새로운 세션을 시작하세요.',
      isComplete: false,
    };
  }

  const trimmedAnswer = answer.trim();

  switch (session.currentStep) {
    // ── 단계 1: 기능 선택 ──
    case 'select_function': {
      const toolInfo = findToolByName(trimmedAnswer);

      if (!toolInfo) {
        const allNames = getAllToolNames();
        return {
          sessionId: session.id,
          currentStep: 'select_function',
          message: [
            `"${trimmedAnswer}"은(는) 유효한 도구가 아닙니다.`,
            '',
            '사용 가능한 도구:',
            ...allNames.map(n => `- \`${n}\``),
            '',
            '위 도구 이름 중 하나를 입력하세요.',
          ].join('\n'),
          isComplete: false,
        };
      }

      session.selectedFunction = toolInfo.name;
      session.toolInfo = toolInfo;
      session.collectedParams = {};
      session.currentParamIndex = 0;

      // 필수 매개변수를 먼저, 선택 매개변수를 나중에
      const requiredParams = toolInfo.params.filter(p => p.required);
      const optionalParams = toolInfo.params.filter(p => !p.required);
      session.pendingParams = [...requiredParams, ...optionalParams];

      if (session.pendingParams.length === 0) {
        // 매개변수가 없으면 바로 확인 단계로
        return buildConfirmPrompt(session);
      }

      session.currentStep = 'collect_params';
      return buildParamPrompt(session);
    }

    // ── 단계 2: 매개변수 수집 ──
    case 'collect_params': {
      // 수정 모드에서 "done" 입력 시 확인으로
      if (trimmedAnswer.toLowerCase() === 'done') {
        return buildConfirmPrompt(session);
      }

      // 수정 모드: 번호 입력으로 특정 매개변수 재수집
      const editIndex = Number(trimmedAnswer);
      if (
        !isNaN(editIndex) &&
        editIndex >= 1 &&
        editIndex <= session.pendingParams.length &&
        // 편집 모드 감지: 이미 모든 매개변수를 수집한 경우
        session.currentParamIndex >= session.pendingParams.length
      ) {
        session.currentParamIndex = editIndex - 1;
        return buildParamPrompt(session);
      }

      const currentParam = session.pendingParams[session.currentParamIndex];
      if (!currentParam) {
        return buildConfirmPrompt(session);
      }

      // skip 처리
      if (trimmedAnswer.toLowerCase() === 'skip') {
        if (currentParam.required) {
          return {
            sessionId: session.id,
            currentStep: 'collect_params',
            message: `**${currentParam.name}**은(는) 필수 매개변수입니다. 건너뛸 수 없습니다.\n\n${currentParam.description}`,
            isComplete: false,
          };
        }

        if (currentParam.defaultValue !== undefined) {
          session.collectedParams[currentParam.name] = currentParam.defaultValue;
        }

        session.currentParamIndex++;

        if (session.currentParamIndex >= session.pendingParams.length) {
          return buildConfirmPrompt(session);
        }

        return buildParamPrompt(session);
      }

      // 값 파싱
      const parseResult = parseParamValue(trimmedAnswer, currentParam);

      if (!parseResult.success) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: [
            `입력 오류: ${parseResult.error}`,
            '',
            `**매개변수:** \`${currentParam.name}\``,
            `**설명:** ${currentParam.description}`,
            `**타입:** ${currentParam.type}`,
          ].join('\n'),
          isComplete: false,
        };
      }

      session.collectedParams[currentParam.name] = parseResult.value;
      session.currentParamIndex++;

      if (session.currentParamIndex >= session.pendingParams.length) {
        return buildConfirmPrompt(session);
      }

      return buildParamPrompt(session);
    }

    // ── 단계 3: 확인 및 실행 ──
    case 'confirm': {
      const action = trimmedAnswer.toLowerCase();

      if (action === 'yes' || action === 'y' || action === '예') {
        session.currentStep = 'executing';

        const toolName = session.selectedFunction!;
        const executor = toolExecutors[toolName];

        if (!executor) {
          return {
            sessionId: session.id,
            currentStep: 'complete',
            message: `도구 "${toolName}"의 실행기를 찾을 수 없습니다.`,
            isComplete: true,
          };
        }

        try {
          const executionResult = await executor(session.collectedParams);

          session.currentStep = 'complete';

          return {
            sessionId: session.id,
            currentStep: 'complete',
            message: [
              `## 실행 완료: ${session.toolInfo!.emoji} ${session.toolInfo!.label}`,
              '',
              '---',
              '',
              executionResult,
            ].join('\n'),
            isComplete: true,
            result: executionResult,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          session.currentStep = 'complete';

          return {
            sessionId: session.id,
            currentStep: 'complete',
            message: [
              `## 실행 오류: ${session.toolInfo!.emoji} ${session.toolInfo!.label}`,
              '',
              `오류가 발생했습니다: ${errorMessage}`,
              '',
              '새로운 세션을 시작하여 다시 시도하세요.',
            ].join('\n'),
            isComplete: true,
          };
        }
      }

      if (action === 'restart' || action === '다시') {
        sessions.delete(session.id);
        return buildCategoryMenu();
      }

      if (action === 'edit' || action === '수정') {
        session.currentStep = 'collect_params';
        // 편집 모드: currentParamIndex를 끝으로 설정하여 편집 리스트 표시
        session.currentParamIndex = session.pendingParams.length;
        return buildEditParamList(session);
      }

      return {
        sessionId: session.id,
        currentStep: 'confirm',
        message: '`yes`, `edit`, 또는 `restart` 중 하나를 입력하세요.',
        options: [
          { value: 'yes', label: '실행', emoji: '\u25B6\uFE0F' },
          { value: 'edit', label: '매개변수 수정', emoji: '\u270F\uFE0F' },
          { value: 'restart', label: '처음부터 다시', emoji: '\uD83D\uDD04' },
        ],
        isComplete: false,
      };
    }

    // ── 이미 완료된 세션 ──
    case 'executing':
    case 'complete': {
      return {
        sessionId: session.id,
        currentStep: 'complete',
        message: '이 세션은 이미 완료되었습니다. `start_interactive`를 호출하여 새 세션을 시작하세요.',
        isComplete: true,
      };
    }

    default: {
      return {
        sessionId: session.id,
        currentStep: 'select_function',
        message: '알 수 없는 단계입니다. 새로운 세션을 시작하세요.',
        isComplete: false,
      };
    }
  }
}

// ─────────────────────────────────────────────
// 결과 포맷팅
// ─────────────────────────────────────────────

export function formatMenuWizardResult(result: MenuWizardStepResult): string {
  const lines: string[] = [];

  lines.push(result.message);
  lines.push('');

  if (!result.isComplete) {
    lines.push('---');
    lines.push(`**Session ID:** \`${result.sessionId}\``);
    lines.push(`**현재 단계:** ${formatStepName(result.currentStep)}`);

    if (result.options && result.options.length > 0) {
      lines.push('');
      lines.push('**선택 가능한 옵션:**');
      for (const option of result.options) {
        const emoji = option.emoji ? `${option.emoji} ` : '';
        const desc = option.description ? ` - ${option.description}` : '';
        lines.push(`- \`${option.value}\` ${emoji}${option.label}${desc}`);
      }
    }

    lines.push('');
    lines.push('`interactive_answer` 도구를 사용하여 응답하세요.');
  }

  return lines.join('\n');
}

function formatStepName(step: MenuWizardStep): string {
  switch (step) {
    case 'select_function':
      return '기능 선택';
    case 'collect_params':
      return '매개변수 입력';
    case 'confirm':
      return '실행 확인';
    case 'executing':
      return '실행 중';
    case 'complete':
      return '완료';
    default:
      return step;
  }
}
