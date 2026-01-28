// ============================================
// 인터랙티브 기능 선택 마법사
// ============================================

import { translatePaper, formatTranslateResult } from './translate.js';
import { summarizePaper, formatSummaryResult } from './summarize.js';
import { extractImages, formatExtractResult } from './extractImages.js';
import { translateTable, formatTableResult } from './translateTable.js';
import { exportTranslation, formatExportResult } from './export.js';
import { manageGlossary, formatGlossaryResult } from './glossary.js';
import { SamplingFunction } from '../api/translator.js';
import type {
  TranslatePaperInput,
  SummarizePaperInput,
  ExtractImagesInput,
  TranslateTableInput,
  ExportTranslationInput,
  ManageGlossaryInput,
} from '../types/translation.js';
import type {
  MenuWizardStep,
  MenuWizardSession,
  MenuWizardStepResult,
  MenuWizardOption,
  ParamDefinition,
  ToolCategory,
  ToolInfo,
} from '../types/interactive.js';

// ============================================
// MCP Sampler (Direct API 사용)
// ============================================

const mcpSampler: SamplingFunction = null;

// ============================================
// 세션 관리
// ============================================

const sessions = new Map<string, MenuWizardSession>();
const SESSION_TTL_MS = 30 * 60 * 1000; // 30분

function generateSessionId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

function getSession(sessionId: string): MenuWizardSession | null {
  cleanupExpiredSessions();
  return sessions.get(sessionId) || null;
}

// ============================================
// 도구 카테고리 및 매개변수 정의
// ============================================

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'translation',
    label: '번역',
    emoji: '\uD83C\uDF10',
    tools: [
      {
        name: 'translate_paper',
        label: '전체 논문 번역',
        description: 'PDF 논문을 선택한 언어로 전체 번역합니다. 마크다운, 이미지, DOCX 출력을 지원합니다.',
        emoji: '\uD83D\uDCC4',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'outputDir',
            type: 'string',
            description: '출력 파일 저장 디렉토리 (기본값: PDF 파일과 같은 위치)',
            required: false,
          },
          {
            name: 'targetLanguage',
            type: 'enum',
            description: '번역 대상 언어',
            required: false,
            defaultValue: 'ko',
            enumValues: ['ko', 'en', 'ja', 'zh'],
          },
          {
            name: 'outputFormat',
            type: 'enum',
            description: '출력 형식',
            required: false,
            defaultValue: 'markdown',
            enumValues: ['markdown', 'parallel', 'html'],
          },
          {
            name: 'preserveTerms',
            type: 'boolean',
            description: 'AI/ML 기술 용어를 영어로 유지',
            required: false,
            defaultValue: true,
          },
          {
            name: 'extractImages',
            type: 'boolean',
            description: '이미지를 별도로 추출하여 저장',
            required: false,
            defaultValue: true,
          },
          {
            name: 'generateDocx',
            type: 'boolean',
            description: '스타일이 적용된 DOCX 문서도 생성',
            required: false,
            defaultValue: true,
          },
        ],
      },
      {
        name: 'translate_table',
        label: '테이블 번역',
        description: '논문의 특정 테이블을 추출하여 번역합니다.',
        emoji: '\uD83D\uDCCA',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'tableNumber',
            type: 'number',
            description: '번역할 테이블 번호 (1부터 시작)',
            required: true,
          },
          {
            name: 'targetLanguage',
            type: 'enum',
            description: '번역 대상 언어',
            required: false,
            defaultValue: 'ko',
            enumValues: ['ko', 'en', 'ja', 'zh'],
          },
          {
            name: 'outputFormat',
            type: 'enum',
            description: '출력 형식',
            required: false,
            defaultValue: 'markdown',
            enumValues: ['markdown', 'csv', 'json'],
          },
        ],
      },
    ],
  },
  {
    id: 'analysis',
    label: '분석',
    emoji: '\uD83D\uDD0E',
    tools: [
      {
        name: 'summarize_paper',
        label: '논문 요약',
        description: '논문의 핵심 내용을 3줄 요약, 키워드, 주요 기여점으로 정리합니다.',
        emoji: '\uD83D\uDCDD',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'detailLevel',
            type: 'enum',
            description: '요약 상세도',
            required: false,
            defaultValue: 'brief',
            enumValues: ['brief', 'detailed'],
          },
          {
            name: 'language',
            type: 'enum',
            description: '요약 언어',
            required: false,
            defaultValue: 'ko',
            enumValues: ['ko', 'en'],
          },
        ],
      },
      {
        name: 'extract_paper_images',
        label: '이미지 추출',
        description: 'PDF에서 모든 이미지(그림, 다이어그램)를 추출하고 캡션을 번역합니다.',
        emoji: '\uD83D\uDDBC\uFE0F',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'outputDir',
            type: 'string',
            description: '추출된 이미지를 저장할 디렉토리',
            required: true,
          },
          {
            name: 'imageFormat',
            type: 'enum',
            description: '이미지 출력 형식',
            required: false,
            defaultValue: 'png',
            enumValues: ['png', 'jpg', 'webp'],
          },
          {
            name: 'translateCaptions',
            type: 'boolean',
            description: '그림 캡션을 한국어로 번역',
            required: false,
            defaultValue: true,
          },
        ],
      },
    ],
  },
  {
    id: 'management',
    label: '관리',
    emoji: '\u2699\uFE0F',
    tools: [
      {
        name: 'export_translation',
        label: '번역 결과 내보내기',
        description: '번역된 마크다운을 DOCX, HTML, PDF 형식으로 내보냅니다.',
        emoji: '\uD83D\uDCE4',
        params: [
          {
            name: 'translatedMdPath',
            type: 'string',
            description: '번역된 마크다운 파일 경로',
            required: true,
          },
          {
            name: 'outputPath',
            type: 'string',
            description: '출력 파일 경로 (예: paper_translated.docx)',
            required: true,
          },
          {
            name: 'format',
            type: 'enum',
            description: '내보내기 형식',
            required: false,
            defaultValue: 'docx',
            enumValues: ['docx', 'html', 'pdf'],
          },
          {
            name: 'imagesDir',
            type: 'string',
            description: '추출된 이미지가 있는 디렉토리',
            required: false,
          },
          {
            name: 'includeOriginal',
            type: 'boolean',
            description: '원문도 함께 포함',
            required: false,
            defaultValue: false,
          },
        ],
      },
      {
        name: 'manage_glossary',
        label: '용어집 관리',
        description: 'AI/ML 용어집을 조회, 검색, 추가, 수정합니다.',
        emoji: '\uD83D\uDCD6',
        params: [
          {
            name: 'action',
            type: 'enum',
            description: '수행할 작업',
            required: true,
            enumValues: ['list', 'search', 'add', 'update', 'import'],
          },
          {
            name: 'term',
            type: 'string',
            description: '검색/추가/수정할 용어',
            required: false,
          },
          {
            name: 'translation',
            type: 'string',
            description: '한국어 번역 (추가/수정 시)',
            required: false,
          },
          {
            name: 'definition',
            type: 'string',
            description: '정의 또는 설명',
            required: false,
          },
          {
            name: 'category',
            type: 'string',
            description: '카테고리 (neural_network, transformer, optimization, nlp, cv, rl, generative, evaluation, general)',
            required: false,
          },
          {
            name: 'glossaryPath',
            type: 'string',
            description: '사용자 정의 용어집 파일 경로 (import 시)',
            required: false,
          },
        ],
      },
    ],
  },
];

// ============================================
// 도구 실행기 매핑
// ============================================

const toolExecutors: Record<string, (params: Record<string, any>) => Promise<string>> = {
  translate_paper: async (params) => {
    const input: TranslatePaperInput = {
      pdfPath: params.pdfPath as string,
      outputDir: params.outputDir as string | undefined,
      targetLanguage: (params.targetLanguage as 'ko' | 'en' | 'ja' | 'zh') || 'ko',
      outputFormat: (params.outputFormat as 'markdown' | 'parallel' | 'html') || 'markdown',
      preserveTerms: (params.preserveTerms as boolean) ?? true,
      extractImages: (params.extractImages as boolean) ?? true,
      generateDocx: (params.generateDocx as boolean) ?? true,
    };
    const result = await translatePaper(input, mcpSampler);
    return formatTranslateResult(result);
  },

  summarize_paper: async (params) => {
    const input: SummarizePaperInput = {
      pdfPath: params.pdfPath as string,
      detailLevel: (params.detailLevel as 'brief' | 'detailed') || 'brief',
      language: (params.language as 'ko' | 'en') || 'ko',
    };
    const result = await summarizePaper(input, mcpSampler);
    return formatSummaryResult(result);
  },

  extract_paper_images: async (params) => {
    const input: ExtractImagesInput = {
      pdfPath: params.pdfPath as string,
      outputDir: params.outputDir as string,
      imageFormat: (params.imageFormat as 'png' | 'jpg' | 'webp') || 'png',
      translateCaptions: (params.translateCaptions as boolean) ?? true,
    };
    const result = await extractImages(input, mcpSampler);
    return formatExtractResult(result);
  },

  translate_table: async (params) => {
    const input: TranslateTableInput = {
      pdfPath: params.pdfPath as string,
      tableNumber: params.tableNumber as number,
      targetLanguage: (params.targetLanguage as 'ko' | 'en' | 'ja' | 'zh') || 'ko',
      outputFormat: (params.outputFormat as 'markdown' | 'csv' | 'json') || 'markdown',
    };
    const result = await translateTable(input, mcpSampler);
    return formatTableResult(result);
  },

  export_translation: async (params) => {
    const input: ExportTranslationInput = {
      translatedMdPath: params.translatedMdPath as string,
      outputPath: params.outputPath as string,
      format: (params.format as 'docx' | 'html' | 'pdf') || 'docx',
      imagesDir: params.imagesDir as string | undefined,
      includeOriginal: (params.includeOriginal as boolean) ?? false,
    };
    const result = await exportTranslation(input);
    return formatExportResult(result);
  },

  manage_glossary: async (params) => {
    const input: ManageGlossaryInput = {
      action: params.action as 'list' | 'search' | 'add' | 'update' | 'import',
      term: params.term as string | undefined,
      translation: params.translation as string | undefined,
      definition: params.definition as string | undefined,
      category: params.category as any,
      glossaryPath: params.glossaryPath as string | undefined,
    };
    const result = await manageGlossary(input);
    return formatGlossaryResult(result);
  },
};

// ============================================
// 도구 조회 헬퍼
// ============================================

function findToolInfo(toolName: string): ToolInfo | null {
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      if (tool.name === toolName) {
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

// ============================================
// 마법사 시작
// ============================================

export async function startInteractive(): Promise<MenuWizardStepResult> {
  cleanupExpiredSessions();

  const sessionId = generateSessionId();
  const session: MenuWizardSession = {
    id: sessionId,
    currentStep: 'select_function',
    selectedFunction: null,
    toolInfo: null,
    collectedParams: {},
    currentParamIndex: 0,
    pendingParams: [],
    createdAt: Date.now(),
  };
  sessions.set(sessionId, session);

  const options: MenuWizardOption[] = [];
  for (const category of TOOL_CATEGORIES) {
    // 카테고리 헤더를 옵션으로 표시 (선택 불가 표시용)
    for (const tool of category.tools) {
      options.push({
        value: tool.name,
        label: `${tool.emoji} ${tool.label}`,
        description: tool.description,
        emoji: category.emoji,
      });
    }
  }

  let message = '# Paper Translate MCP - 기능 선택 마법사\n\n';
  message += '사용할 기능을 선택해주세요:\n\n';

  for (const category of TOOL_CATEGORIES) {
    message += `## ${category.emoji} ${category.label}\n`;
    for (const tool of category.tools) {
      message += `- **\`${tool.name}\`** - ${tool.emoji} ${tool.label}: ${tool.description}\n`;
    }
    message += '\n';
  }

  message += '---\n';
  message += '사용할 기능의 이름을 입력해주세요 (예: `translate_paper`).';

  return {
    sessionId,
    currentStep: 'select_function',
    message,
    options,
    isComplete: false,
  };
}

// ============================================
// 마법사 답변 처리
// ============================================

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
      message: '세션이 만료되었거나 존재하지 않습니다. `start_interactive`를 다시 호출해주세요.',
      isComplete: false,
    };
  }

  switch (session.currentStep) {
    case 'select_function':
      return handleSelectFunction(session, answer);

    case 'collect_params':
      return handleCollectParams(session, answer);

    case 'confirm':
      return handleConfirm(session, answer);

    default:
      return {
        sessionId,
        currentStep: session.currentStep,
        message: '알 수 없는 상태입니다. `start_interactive`를 다시 호출해주세요.',
        isComplete: false,
      };
  }
}

// ============================================
// 단계별 핸들러: 기능 선택
// ============================================

function handleSelectFunction(
  session: MenuWizardSession,
  answer: string
): MenuWizardStepResult {
  const toolName = answer.trim().toLowerCase();
  const allNames = getAllToolNames();

  if (!allNames.includes(toolName)) {
    const options: MenuWizardOption[] = allNames.map((name) => {
      const info = findToolInfo(name)!;
      return {
        value: name,
        label: `${info.emoji} ${info.label}`,
        description: info.description,
      };
    });

    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: `"${answer}"는 유효한 기능 이름이 아닙니다.\n\n사용 가능한 기능: ${allNames.map(n => `\`${n}\``).join(', ')}\n\n다시 선택해주세요.`,
      options,
      isComplete: false,
    };
  }

  const toolInfo = findToolInfo(toolName)!;
  session.selectedFunction = toolName;
  session.toolInfo = toolInfo;
  session.collectedParams = {};
  session.currentParamIndex = 0;

  // 필수 매개변수를 먼저, 선택 매개변수를 나중에 정렬
  const requiredParams = toolInfo.params.filter((p) => p.required);
  const optionalParams = toolInfo.params.filter((p) => !p.required);
  session.pendingParams = [...requiredParams, ...optionalParams];

  if (session.pendingParams.length === 0) {
    // 매개변수가 없으면 바로 확인 단계로
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  session.currentStep = 'collect_params';
  return buildParamPrompt(session);
}

// ============================================
// 단계별 핸들러: 매개변수 수집
// ============================================

function handleCollectParams(
  session: MenuWizardSession,
  answer: string
): MenuWizardStepResult {
  const currentParam = session.pendingParams[session.currentParamIndex];

  if (!currentParam) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  const trimmed = answer.trim();

  // 선택적 매개변수의 "skip" 처리
  if (!currentParam.required && (trimmed.toLowerCase() === 'skip' || trimmed === '건너뛰기')) {
    if (currentParam.defaultValue !== undefined) {
      session.collectedParams[currentParam.name] = currentParam.defaultValue;
    }
    session.currentParamIndex++;
    if (session.currentParamIndex >= session.pendingParams.length) {
      session.currentStep = 'confirm';
      return buildConfirmStep(session);
    }
    return buildParamPrompt(session);
  }

  // 타입별 파싱
  switch (currentParam.type) {
    case 'string': {
      if (currentParam.required && trimmed.length === 0) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: `"${currentParam.name}"은(는) 필수 항목입니다. 값을 입력해주세요.`,
          isComplete: false,
        };
      }
      session.collectedParams[currentParam.name] = trimmed;
      break;
    }

    case 'number': {
      const num = Number(trimmed);
      if (isNaN(num)) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: `"${trimmed}"은(는) 유효한 숫자가 아닙니다. 숫자를 다시 입력해주세요.\n\n**${currentParam.name}**: ${currentParam.description}`,
          isComplete: false,
        };
      }
      session.collectedParams[currentParam.name] = num;
      break;
    }

    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (['true', 'yes', '예', 'y', '1'].includes(lower)) {
        session.collectedParams[currentParam.name] = true;
      } else if (['false', 'no', '아니오', '아니요', 'n', '0'].includes(lower)) {
        session.collectedParams[currentParam.name] = false;
      } else {
        const options: MenuWizardOption[] = [
          { value: '예', label: '예 (true)' },
          { value: '아니오', label: '아니오 (false)' },
        ];
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: `"${trimmed}"은(는) 유효한 불리언 값이 아닙니다.\n\n"예" 또는 "아니오"로 답해주세요.`,
          options,
          isComplete: false,
        };
      }
      break;
    }

    case 'enum': {
      const enumValues = currentParam.enumValues || [];
      if (!enumValues.includes(trimmed)) {
        const options: MenuWizardOption[] = enumValues.map((v) => ({
          value: v,
          label: v,
        }));
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: `"${trimmed}"은(는) 유효한 값이 아닙니다.\n\n사용 가능한 값: ${enumValues.map(v => `\`${v}\``).join(', ')}`,
          options,
          isComplete: false,
        };
      }
      session.collectedParams[currentParam.name] = trimmed;
      break;
    }

    case 'array': {
      const items = trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      if (currentParam.required && items.length === 0) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: `"${currentParam.name}"은(는) 필수 항목입니다. 쉼표로 구분하여 입력해주세요.`,
          isComplete: false,
        };
      }
      session.collectedParams[currentParam.name] = items;
      break;
    }
  }

  // 다음 매개변수로 이동
  session.currentParamIndex++;
  if (session.currentParamIndex >= session.pendingParams.length) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }
  return buildParamPrompt(session);
}

// ============================================
// 단계별 핸들러: 확인
// ============================================

async function handleConfirm(
  session: MenuWizardSession,
  answer: string
): Promise<MenuWizardStepResult> {
  const trimmed = answer.trim().toLowerCase();

  if (['yes', 'y', '예', '확인', 'confirm'].includes(trimmed)) {
    return await executeSelectedTool(session);
  }

  if (['restart', '다시', '처음부터', 'reset'].includes(trimmed)) {
    session.currentStep = 'select_function';
    session.selectedFunction = null;
    session.toolInfo = null;
    session.collectedParams = {};
    session.currentParamIndex = 0;
    session.pendingParams = [];

    return startInteractive();
  }

  if (['edit', '수정', '편집', 'modify'].includes(trimmed)) {
    return buildEditParamList(session);
  }

  const options: MenuWizardOption[] = [
    { value: 'yes', label: '예 - 실행', emoji: '\u2705' },
    { value: 'edit', label: '수정 - 매개변수 편집', emoji: '\u270F\uFE0F' },
    { value: 'restart', label: '다시 - 처음부터 시작', emoji: '\uD83D\uDD04' },
  ];

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message: '"yes" (실행), "edit" (수정), 또는 "restart" (처음부터)를 입력해주세요.',
    options,
    isComplete: false,
  };
}

// ============================================
// 매개변수 프롬프트 빌더
// ============================================

function buildParamPrompt(session: MenuWizardSession): MenuWizardStepResult {
  const param = session.pendingParams[session.currentParamIndex];
  const toolInfo = session.toolInfo!;
  const paramNumber = session.currentParamIndex + 1;
  const totalParams = session.pendingParams.length;

  let message = `## ${toolInfo.emoji} ${toolInfo.label} - 매개변수 입력 (${paramNumber}/${totalParams})\n\n`;
  message += `**${param.name}** ${param.required ? '(필수)' : '(선택)'}\n`;
  message += `${param.description}\n`;

  if (param.defaultValue !== undefined) {
    message += `기본값: \`${param.defaultValue}\`\n`;
  }

  let options: MenuWizardOption[] | undefined;

  switch (param.type) {
    case 'enum': {
      const enumValues = param.enumValues || [];
      message += `\n사용 가능한 값: ${enumValues.map(v => `\`${v}\``).join(', ')}`;
      options = enumValues.map((v) => ({
        value: v,
        label: v,
      }));
      break;
    }
    case 'boolean': {
      message += '\n"예" 또는 "아니오"로 답해주세요.';
      options = [
        { value: '예', label: '예 (true)' },
        { value: '아니오', label: '아니오 (false)' },
      ];
      break;
    }
    case 'number': {
      message += '\n숫자를 입력해주세요.';
      break;
    }
    case 'array': {
      message += '\n쉼표로 구분하여 입력해주세요.';
      break;
    }
    case 'string': {
      message += '\n값을 입력해주세요.';
      break;
    }
  }

  if (!param.required) {
    message += '\n\n"skip" 또는 "건너뛰기"를 입력하면 기본값을 사용합니다.';
    if (options) {
      options.push({ value: 'skip', label: '건너뛰기 (기본값 사용)' });
    } else {
      options = [{ value: 'skip', label: '건너뛰기 (기본값 사용)' }];
    }
  }

  return {
    sessionId: session.id,
    currentStep: 'collect_params',
    message,
    options,
    isComplete: false,
  };
}

// ============================================
// 확인 단계 빌더
// ============================================

function buildConfirmStep(session: MenuWizardSession): MenuWizardStepResult {
  const toolInfo = session.toolInfo!;

  let message = `## ${toolInfo.emoji} ${toolInfo.label} - 실행 확인\n\n`;
  message += `선택한 기능: **${toolInfo.label}** (\`${toolInfo.name}\`)\n\n`;
  message += '### 매개변수 요약\n\n';

  if (Object.keys(session.collectedParams).length === 0) {
    message += '(매개변수 없음)\n';
  } else {
    for (const [key, value] of Object.entries(session.collectedParams)) {
      const paramDef = toolInfo.params.find((p) => p.name === key);
      const label = paramDef ? paramDef.description : key;
      const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
      message += `- **${key}**: \`${displayValue}\` - ${label}\n`;
    }
  }

  message += '\n---\n';
  message += '실행하시겠습니까?\n\n';
  message += '- **yes** - 실행\n';
  message += '- **edit** - 매개변수 수정\n';
  message += '- **restart** - 처음부터 다시 시작\n';

  const options: MenuWizardOption[] = [
    { value: 'yes', label: '예 - 실행', emoji: '\u2705' },
    { value: 'edit', label: '수정 - 매개변수 편집', emoji: '\u270F\uFE0F' },
    { value: 'restart', label: '다시 - 처음부터 시작', emoji: '\uD83D\uDD04' },
  ];

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message,
    options,
    isComplete: false,
  };
}

// ============================================
// 편집용 매개변수 목록 빌더
// ============================================

function buildEditParamList(session: MenuWizardSession): MenuWizardStepResult {
  const toolInfo = session.toolInfo!;

  // 매개변수 수집을 처음부터 다시 시작
  session.currentStep = 'collect_params';
  session.currentParamIndex = 0;

  const requiredParams = toolInfo.params.filter((p) => p.required);
  const optionalParams = toolInfo.params.filter((p) => !p.required);
  session.pendingParams = [...requiredParams, ...optionalParams];

  // 기존에 수집된 값은 유지 (기본값으로 표시)
  let message = '## 매개변수 재입력\n\n';
  message += '현재 설정된 매개변수:\n\n';

  for (const param of session.pendingParams) {
    const currentValue = session.collectedParams[param.name];
    if (currentValue !== undefined) {
      message += `- **${param.name}**: \`${currentValue}\`\n`;
    } else {
      message += `- **${param.name}**: (미설정)\n`;
    }
  }

  message += '\n모든 매개변수를 처음부터 다시 입력합니다.\n';

  // 기존 값을 초기화
  session.collectedParams = {};

  return buildParamPrompt(session);
}

// ============================================
// 도구 실행
// ============================================

async function executeSelectedTool(
  session: MenuWizardSession
): Promise<MenuWizardStepResult> {
  const toolName = session.selectedFunction!;
  const toolInfo = session.toolInfo!;
  const executor = toolExecutors[toolName];

  if (!executor) {
    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: `실행기를 찾을 수 없습니다: \`${toolName}\``,
      isComplete: true,
    };
  }

  session.currentStep = 'executing';

  try {
    const resultText = await executor(session.collectedParams);

    session.currentStep = 'complete';

    // 세션 정리
    sessions.delete(session.id);

    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: `## ${toolInfo.emoji} ${toolInfo.label} - 실행 완료\n\n`,
      isComplete: true,
      result: resultText,
    };
  } catch (error) {
    session.currentStep = 'complete';
    sessions.delete(session.id);

    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: `## ${toolInfo.emoji} ${toolInfo.label} - 실행 실패\n\n오류: ${errorMessage}`,
      isComplete: true,
    };
  }
}

// ============================================
// 결과 포매터
// ============================================

export function formatMenuWizardResult(stepResult: MenuWizardStepResult): string {
  let output = '';

  // 세션 ID 표시
  output += `> 세션 ID: \`${stepResult.sessionId}\`\n`;
  output += `> 단계: \`${stepResult.currentStep}\`\n\n`;

  // 메인 메시지
  output += stepResult.message + '\n';

  // 옵션 표시
  if (stepResult.options && stepResult.options.length > 0 && !stepResult.isComplete) {
    output += '\n### 선택 가능한 옵션\n\n';
    for (const option of stepResult.options) {
      const emoji = option.emoji ? `${option.emoji} ` : '';
      const desc = option.description ? ` - ${option.description}` : '';
      output += `- ${emoji}**\`${option.value}\`** ${option.label}${desc}\n`;
    }
  }

  // 실행 결과 표시
  if (stepResult.result) {
    output += '\n---\n';
    output += '### 실행 결과\n\n';
    output += stepResult.result;
    output += '\n';
  }

  // 완료 여부
  if (stepResult.isComplete) {
    output += '\n---\n';
    output += '마법사가 종료되었습니다. 새로운 기능을 사용하려면 `start_interactive`를 호출해주세요.\n';
  }

  return output;
}
