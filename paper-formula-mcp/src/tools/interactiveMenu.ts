/**
 * 인터랙티브 기능 선택 마법사
 * 사용 가능한 모든 도구를 카테고리별로 보여주고,
 * 선택한 기능의 매개변수를 단계별로 수집하여 실행합니다.
 */

import { extractFormulas, formatExtractFormulasResult } from './extractFormulas.js';
import { explainFormula, formatExplainResult } from './explainFormula.js';
import { generateDependencyDiagram, formatDependencyResult } from './dependencyDiagram.js';
import { generateConceptMap, formatConceptMapResult } from './conceptDiagram.js';
import { generateEvolutionDiagram, formatEvolutionResult } from './evolutionDiagram.js';
import { analyzeVariables, formatVariableResult } from './analyzeVariables.js';
import { analyzeRoles, formatRoleResult } from './analyzeRoles.js';
import { generateTextbook, formatTextbookResult } from './generateTextbook.js';
import { startTextbookWizard, formatWizardResult } from './interactiveTextbook.js';

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
// 도구 카테고리 및 정의
// ============================================

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'formula_analysis',
    label: '수식 분석',
    emoji: '📐',
    tools: [
      {
        name: 'extract_formulas',
        label: '수식 추출',
        description: 'PDF 논문에서 모든 수학 수식을 LaTeX 표기법으로 추출합니다.',
        emoji: '🔍',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'includeInline',
            type: 'boolean',
            description: '인라인 수식 포함 여부',
            required: false,
            defaultValue: true,
          },
          {
            name: 'includeNumbered',
            type: 'boolean',
            description: '번호가 매겨진 수식만 포함 여부',
            required: false,
            defaultValue: false,
          },
        ],
      },
      {
        name: 'explain_formula',
        label: '수식 설명',
        description: 'LLM을 사용하여 수학 수식을 상세히 설명합니다.',
        emoji: '💡',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'formulaId',
            type: 'string',
            description: '수식 ID (예: "eq1", "eq2.3")',
            required: false,
          },
          {
            name: 'latex',
            type: 'string',
            description: '직접 입력할 LaTeX 수식 (formulaId 대안)',
            required: false,
          },
          {
            name: 'detailLevel',
            type: 'enum',
            description: '설명 상세도',
            required: false,
            defaultValue: 'detailed',
            enumValues: ['brief', 'detailed', 'educational'],
          },
          {
            name: 'language',
            type: 'enum',
            description: '출력 언어',
            required: false,
            defaultValue: 'ko',
            enumValues: ['ko', 'en'],
          },
        ],
      },
      {
        name: 'analyze_formula_variables',
        label: '변수 분석',
        description: '모든 수식의 변수 정의와 사용 현황을 분석합니다.',
        emoji: '🔤',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'outputFormat',
            type: 'enum',
            description: '출력 형식',
            required: false,
            defaultValue: 'mermaid',
            enumValues: ['mermaid', 'table', 'json'],
          },
          {
            name: 'filterSymbols',
            type: 'array',
            description: '특정 기호만 필터링 (쉼표로 구분)',
            required: false,
            arrayItemType: 'string',
          },
        ],
      },
      {
        name: 'analyze_formula_roles',
        label: '역할 분석',
        description: '논문 내 수식의 역할(정의, 목적, 정리 등)을 분석합니다.',
        emoji: '🏷️',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'groupByRole',
            type: 'boolean',
            description: '역할별로 그룹화',
            required: false,
            defaultValue: true,
          },
          {
            name: 'showFlow',
            type: 'boolean',
            description: '역할 간 논리적 흐름 표시',
            required: false,
            defaultValue: true,
          },
        ],
      },
    ],
  },
  {
    id: 'diagrams',
    label: '다이어그램',
    emoji: '📊',
    tools: [
      {
        name: 'generate_formula_dependency',
        label: '수식 의존성 다이어그램',
        description: '수식 간 의존성을 Mermaid 다이어그램으로 생성합니다.',
        emoji: '🔗',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'diagramType',
            type: 'enum',
            description: 'Mermaid 다이어그램 유형',
            required: false,
            defaultValue: 'flowchart',
            enumValues: ['flowchart', 'graph'],
          },
          {
            name: 'direction',
            type: 'enum',
            description: '그래프 방향',
            required: false,
            defaultValue: 'TB',
            enumValues: ['TB', 'BT', 'LR', 'RL'],
          },
          {
            name: 'includeVariables',
            type: 'boolean',
            description: '공유 변수를 엣지 레이블로 표시',
            required: false,
            defaultValue: true,
          },
          {
            name: 'filterSection',
            type: 'string',
            description: '특정 섹션으로 필터링',
            required: false,
          },
        ],
      },
      {
        name: 'generate_concept_map',
        label: '개념 관계도',
        description: '논문의 핵심 개념 간 관계를 Mermaid 다이어그램으로 생성합니다.',
        emoji: '🧠',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'maxConcepts',
            type: 'number',
            description: '포함할 최대 개념 수',
            required: false,
            defaultValue: 20,
          },
          {
            name: 'relationTypes',
            type: 'array',
            description: '표시할 관계 유형 (쉼표로 구분: is_a, part_of, uses, extends, compared_to)',
            required: false,
            arrayItemType: 'string',
          },
          {
            name: 'includeDefinitions',
            type: 'boolean',
            description: '노드에 개념 정의 포함',
            required: false,
            defaultValue: false,
          },
          {
            name: 'diagramStyle',
            type: 'enum',
            description: '다이어그램 스타일',
            required: false,
            defaultValue: 'flowchart',
            enumValues: ['mindmap', 'flowchart', 'graph'],
          },
        ],
      },
      {
        name: 'generate_evolution_diagram',
        label: '논문 발전 관계도',
        description: '논문 간 발전 관계와 인용을 Mermaid 다이어그램으로 생성합니다.',
        emoji: '🌳',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: '주요 PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'additionalPapers',
            type: 'array',
            description: '추가 관련 논문 경로 (쉼표로 구분)',
            required: false,
            arrayItemType: 'string',
          },
          {
            name: 'paperIds',
            type: 'array',
            description: 'arXiv 논문 ID (쉼표로 구분)',
            required: false,
            arrayItemType: 'string',
          },
          {
            name: 'depth',
            type: 'number',
            description: '참조 포함 깊이',
            required: false,
            defaultValue: 2,
          },
          {
            name: 'relationTypes',
            type: 'array',
            description: '관계 유형 (쉼표로 구분: extends, improves, compares, applies, cites)',
            required: false,
            arrayItemType: 'string',
          },
          {
            name: 'timelineView',
            type: 'boolean',
            description: '시간순 정렬 표시',
            required: false,
            defaultValue: true,
          },
        ],
      },
    ],
  },
  {
    id: 'textbook',
    label: '교과서',
    emoji: '📚',
    tools: [
      {
        name: 'generate_textbook',
        label: '교과서 생성',
        description: '논문의 수식을 기반으로 교육용 교과서를 생성합니다.',
        emoji: '📖',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
          {
            name: 'targetLevel',
            type: 'enum',
            description: '대상 수준',
            required: false,
            defaultValue: 'auto',
            enumValues: ['auto', 'elementary', 'middle', 'high', 'undergraduate', 'graduate'],
          },
          {
            name: 'language',
            type: 'enum',
            description: '교과서 언어',
            required: false,
            defaultValue: 'ko',
            enumValues: ['ko', 'en'],
          },
          {
            name: 'maxChapters',
            type: 'number',
            description: '최대 챕터 수',
            required: false,
            defaultValue: 8,
          },
          {
            name: 'includeExercises',
            type: 'boolean',
            description: '연습문제 포함 여부',
            required: false,
            defaultValue: true,
          },
          {
            name: 'includeExamples',
            type: 'boolean',
            description: '풀이 예시 포함 여부',
            required: false,
            defaultValue: true,
          },
          {
            name: 'focusFormulas',
            type: 'array',
            description: '집중할 수식 ID (쉼표로 구분)',
            required: false,
            arrayItemType: 'string',
          },
          {
            name: 'outputPath',
            type: 'string',
            description: '교과서 마크다운 저장 경로',
            required: false,
          },
        ],
      },
      {
        name: 'start_textbook_wizard',
        label: '교과서 마법사',
        description: '인터랙티브 교과서 생성 마법사를 시작합니다.',
        emoji: '🧙',
        params: [
          {
            name: 'pdfPath',
            type: 'string',
            description: 'PDF 파일의 절대 경로',
            required: true,
          },
        ],
      },
    ],
  },
];

// ============================================
// 세션 관리 (인메모리)
// ============================================

const menuSessions = new Map<string, MenuWizardSession>();

function generateMenuSessionId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function cleanExpiredMenuSessions(): void {
  const now = Date.now();
  for (const [id, session] of menuSessions) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      menuSessions.delete(id);
    }
  }
}

// ============================================
// 모든 도구를 플랫 리스트로
// ============================================

function getAllTools(): ToolInfo[] {
  const tools: ToolInfo[] = [];
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      tools.push(tool);
    }
  }
  return tools;
}

function findTool(name: string): ToolInfo | null {
  for (const category of TOOL_CATEGORIES) {
    for (const tool of category.tools) {
      if (tool.name === name) {
        return tool;
      }
    }
  }
  return null;
}

// ============================================
// 도구 실행기 맵
// ============================================

const toolExecutors: Record<string, (params: Record<string, any>) => Promise<string>> = {
  extract_formulas: async (params) => {
    const result = await extractFormulas({
      pdfPath: params.pdfPath as string,
      includeInline: (params.includeInline as boolean) ?? true,
      includeNumbered: (params.includeNumbered as boolean) ?? false,
    });
    return formatExtractFormulasResult(result);
  },

  explain_formula: async (params) => {
    const result = await explainFormula({
      pdfPath: params.pdfPath as string,
      formulaId: params.formulaId as string | undefined,
      latex: params.latex as string | undefined,
      detailLevel: (params.detailLevel as 'brief' | 'detailed' | 'educational') || 'detailed',
      language: (params.language as 'ko' | 'en') || 'ko',
    });
    return formatExplainResult(result);
  },

  analyze_formula_variables: async (params) => {
    const result = await analyzeVariables({
      pdfPath: params.pdfPath as string,
      outputFormat: (params.outputFormat as 'mermaid' | 'table' | 'json') || 'mermaid',
      filterSymbols: params.filterSymbols as string[] | undefined,
    });
    return formatVariableResult(result);
  },

  analyze_formula_roles: async (params) => {
    const result = await analyzeRoles({
      pdfPath: params.pdfPath as string,
      groupByRole: (params.groupByRole as boolean) ?? true,
      showFlow: (params.showFlow as boolean) ?? true,
    });
    return formatRoleResult(result);
  },

  generate_formula_dependency: async (params) => {
    const result = await generateDependencyDiagram({
      pdfPath: params.pdfPath as string,
      diagramType: (params.diagramType as 'flowchart' | 'graph') || 'flowchart',
      direction: (params.direction as 'TB' | 'BT' | 'LR' | 'RL') || 'TB',
      includeVariables: (params.includeVariables as boolean) ?? true,
      filterSection: params.filterSection as string | undefined,
    });
    return formatDependencyResult(result);
  },

  generate_concept_map: async (params) => {
    const result = await generateConceptMap({
      pdfPath: params.pdfPath as string,
      maxConcepts: (params.maxConcepts as number) || 20,
      relationTypes: params.relationTypes as string[] | undefined,
      includeDefinitions: (params.includeDefinitions as boolean) ?? false,
      diagramStyle: (params.diagramStyle as 'mindmap' | 'flowchart' | 'graph') || 'flowchart',
    });
    return formatConceptMapResult(result);
  },

  generate_evolution_diagram: async (params) => {
    const result = await generateEvolutionDiagram({
      pdfPath: params.pdfPath as string,
      additionalPapers: params.additionalPapers as string[] | undefined,
      paperIds: params.paperIds as string[] | undefined,
      depth: (params.depth as number) || 2,
      relationTypes: params.relationTypes as string[] | undefined,
      timelineView: (params.timelineView as boolean) ?? true,
    });
    return formatEvolutionResult(result);
  },

  generate_textbook: async (params) => {
    const result = await generateTextbook({
      pdfPath: params.pdfPath as string,
      targetLevel: (params.targetLevel as any) || 'auto',
      language: (params.language as 'ko' | 'en') || 'ko',
      maxChapters: (params.maxChapters as number) || 8,
      includeExercises: (params.includeExercises as boolean) ?? true,
      includeExamples: (params.includeExamples as boolean) ?? true,
      focusFormulas: params.focusFormulas as string[] | undefined,
      outputPath: params.outputPath as string | undefined,
    });
    return formatTextbookResult(result);
  },

  start_textbook_wizard: async (params) => {
    const result = await startTextbookWizard({
      pdfPath: params.pdfPath as string,
    });
    return formatWizardResult(result);
  },
};

// ============================================
// 마법사 시작
// ============================================

export async function startInteractive(): Promise<MenuWizardStepResult> {
  cleanExpiredMenuSessions();

  const sessionId = generateMenuSessionId();
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

  menuSessions.set(sessionId, session);

  // 카테고리별 도구 목록 메시지 생성
  const messageLines: string[] = [
    `# 🎛️ 인터랙티브 기능 선택 마법사`,
    ``,
    `사용 가능한 도구를 카테고리별로 안내합니다.`,
    `실행할 도구의 이름을 선택해주세요.`,
    ``,
    `---`,
    ``,
  ];

  const options: MenuWizardOption[] = [];

  for (const category of TOOL_CATEGORIES) {
    messageLines.push(`## ${category.emoji} ${category.label}`);
    messageLines.push(``);

    for (const tool of category.tools) {
      messageLines.push(`- ${tool.emoji} **${tool.name}**: ${tool.description}`);
      options.push({
        value: tool.name,
        label: `${tool.emoji} ${tool.label}`,
        description: tool.description,
        emoji: category.emoji,
      });
    }
    messageLines.push(``);
  }

  return {
    sessionId,
    currentStep: 'select_function',
    message: messageLines.join('\n'),
    options,
    isComplete: false,
  };
}

// ============================================
// 마법사 답변 처리
// ============================================

export interface InteractiveAnswerInput {
  sessionId: string;
  answer: string;
}

export async function interactiveAnswer(input: InteractiveAnswerInput): Promise<MenuWizardStepResult> {
  cleanExpiredMenuSessions();

  const session = menuSessions.get(input.sessionId);
  if (!session) {
    return {
      sessionId: input.sessionId,
      currentStep: 'select_function',
      message: '세션을 찾을 수 없습니다. 새로운 마법사를 시작해주세요.',
      isComplete: false,
    };
  }

  const answer = input.answer.trim();

  switch (session.currentStep) {
    case 'select_function':
      return handleSelectFunction(session, answer);

    case 'collect_params':
      return handleCollectParams(session, answer);

    case 'confirm':
      return handleConfirm(session, answer);

    default:
      return {
        sessionId: session.id,
        currentStep: session.currentStep,
        message: '알 수 없는 단계입니다. 새로운 마법사를 시작해주세요.',
        isComplete: false,
      };
  }
}

// ============================================
// 단계별 핸들러
// ============================================

function handleSelectFunction(session: MenuWizardSession, answer: string): MenuWizardStepResult {
  const tool = findTool(answer);
  if (!tool) {
    // 유효하지 않은 도구명 - 다시 선택 요청
    const allTools = getAllTools();
    const validNames = allTools.map(t => t.name).join(', ');
    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: [
        `"${answer}"는 유효한 도구 이름이 아닙니다.`,
        ``,
        `사용 가능한 도구: ${validNames}`,
        ``,
        `다시 선택해주세요.`,
      ].join('\n'),
      options: getAllTools().map(t => ({
        value: t.name,
        label: `${t.emoji} ${t.label}`,
        description: t.description,
      })),
      isComplete: false,
    };
  }

  session.selectedFunction = tool.name;
  session.toolInfo = tool;
  session.collectedParams = {};
  session.currentParamIndex = 0;

  // 필수 매개변수를 먼저, 그다음 선택적 매개변수 정렬
  const requiredParams = tool.params.filter(p => p.required);
  const optionalParams = tool.params.filter(p => !p.required);
  session.pendingParams = [...requiredParams, ...optionalParams];

  // 매개변수가 없으면 바로 확인 단계로
  if (session.pendingParams.length === 0) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  // 첫 번째 매개변수 질문
  session.currentStep = 'collect_params';
  return buildParamQuestion(session);
}

function handleCollectParams(session: MenuWizardSession, answer: string): MenuWizardStepResult {
  const currentParam = session.pendingParams[session.currentParamIndex];
  if (!currentParam) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  const lowerAnswer = answer.toLowerCase();

  // 선택적 매개변수에서 "skip" 입력 시 기본값 사용
  if (!currentParam.required && (lowerAnswer === 'skip' || lowerAnswer === '건너뛰기')) {
    if (currentParam.defaultValue !== undefined) {
      session.collectedParams[currentParam.name] = currentParam.defaultValue;
    }
    // 다음 매개변수로 이동
    session.currentParamIndex++;
    if (session.currentParamIndex >= session.pendingParams.length) {
      session.currentStep = 'confirm';
      return buildConfirmStep(session);
    }
    return buildParamQuestion(session);
  }

  // 타입별 값 파싱
  let parsedValue: any;

  switch (currentParam.type) {
    case 'string': {
      parsedValue = answer;
      break;
    }

    case 'number': {
      const num = Number(answer);
      if (isNaN(num)) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: [
            `"${answer}"는 유효한 숫자가 아닙니다.`,
            ``,
            `**${currentParam.name}**: ${currentParam.description}`,
            `숫자를 입력해주세요.`,
          ].join('\n'),
          isComplete: false,
        };
      }
      parsedValue = num;
      break;
    }

    case 'boolean': {
      const trueValues = ['true', 'yes', '예', 'y', '1'];
      const falseValues = ['false', 'no', '아니오', 'n', '0'];
      if (trueValues.includes(lowerAnswer)) {
        parsedValue = true;
      } else if (falseValues.includes(lowerAnswer)) {
        parsedValue = false;
      } else {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: [
            `"${answer}"는 유효한 불리언 값이 아닙니다.`,
            ``,
            `**${currentParam.name}**: ${currentParam.description}`,
          ].join('\n'),
          options: [
            { value: '예', label: '예 (true)', emoji: '✅' },
            { value: '아니오', label: '아니오 (false)', emoji: '❌' },
          ],
          isComplete: false,
        };
      }
      break;
    }

    case 'enum': {
      const enumValues = currentParam.enumValues || [];
      if (!enumValues.includes(answer)) {
        return {
          sessionId: session.id,
          currentStep: 'collect_params',
          message: [
            `"${answer}"는 유효한 값이 아닙니다.`,
            ``,
            `**${currentParam.name}**: ${currentParam.description}`,
            `다음 중 하나를 선택해주세요.`,
          ].join('\n'),
          options: enumValues.map(v => ({
            value: v,
            label: v,
          })),
          isComplete: false,
        };
      }
      parsedValue = answer;
      break;
    }

    case 'array': {
      parsedValue = answer.split(',').map(s => s.trim()).filter(s => s.length > 0);
      break;
    }

    default:
      parsedValue = answer;
  }

  session.collectedParams[currentParam.name] = parsedValue;

  // 다음 매개변수로 이동
  session.currentParamIndex++;
  if (session.currentParamIndex >= session.pendingParams.length) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  return buildParamQuestion(session);
}

async function handleConfirm(session: MenuWizardSession, answer: string): Promise<MenuWizardStepResult> {
  const lowerAnswer = answer.toLowerCase();

  if (lowerAnswer === 'restart' || lowerAnswer === '처음부터') {
    // 처음부터 다시 시작
    session.currentStep = 'select_function';
    session.selectedFunction = null;
    session.toolInfo = null;
    session.collectedParams = {};
    session.currentParamIndex = 0;
    session.pendingParams = [];

    const messageLines: string[] = [
      `🔄 처음부터 다시 시작합니다.`,
      ``,
      `---`,
      ``,
      `# 🎛️ 기능 선택`,
      ``,
    ];

    const options: MenuWizardOption[] = [];
    for (const category of TOOL_CATEGORIES) {
      messageLines.push(`## ${category.emoji} ${category.label}`);
      messageLines.push(``);
      for (const tool of category.tools) {
        messageLines.push(`- ${tool.emoji} **${tool.name}**: ${tool.description}`);
        options.push({
          value: tool.name,
          label: `${tool.emoji} ${tool.label}`,
          description: tool.description,
          emoji: category.emoji,
        });
      }
      messageLines.push(``);
    }

    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: messageLines.join('\n'),
      options,
      isComplete: false,
    };
  }

  if (lowerAnswer === 'edit' || lowerAnswer === '수정') {
    // 매개변수 수정: 매개변수 목록을 보여주고 다시 수집 시작
    session.currentParamIndex = 0;
    session.currentStep = 'collect_params';

    const paramSummary = session.pendingParams.map((p, i) => {
      const currentVal = session.collectedParams[p.name];
      const valStr = currentVal !== undefined ? JSON.stringify(currentVal) : '(미설정)';
      return `${i + 1}. **${p.name}**: ${valStr}`;
    }).join('\n');

    return {
      sessionId: session.id,
      currentStep: 'collect_params',
      message: [
        `📝 매개변수를 처음부터 다시 입력합니다.`,
        ``,
        `현재 설정:`,
        paramSummary,
        ``,
        `---`,
        ``,
      ].join('\n') + '\n' + buildParamQuestion(session).message,
      options: buildParamQuestion(session).options,
      isComplete: false,
    };
  }

  // "yes" 또는 기타 → 실행
  if (lowerAnswer === 'yes' || lowerAnswer === '예' || lowerAnswer === 'y' || lowerAnswer === '실행') {
    return executeSelectedTool(session);
  }

  // 알 수 없는 입력
  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message: [
      `입력을 인식할 수 없습니다.`,
      ``,
      `다음 중 하나를 선택해주세요.`,
    ].join('\n'),
    options: [
      { value: 'yes', label: '실행', description: '이 설정으로 도구를 실행합니다', emoji: '🚀' },
      { value: 'edit', label: '수정', description: '매개변수를 다시 입력합니다', emoji: '✏️' },
      { value: 'restart', label: '처음부터', description: '도구 선택부터 다시 시작합니다', emoji: '🔄' },
    ],
    isComplete: false,
  };
}

// ============================================
// 헬퍼 함수: 매개변수 질문 생성
// ============================================

function buildParamQuestion(session: MenuWizardSession): MenuWizardStepResult {
  const currentParam = session.pendingParams[session.currentParamIndex];
  if (!currentParam) {
    session.currentStep = 'confirm';
    return buildConfirmStep(session);
  }

  const toolLabel = session.toolInfo?.label || session.selectedFunction || '';
  const totalParams = session.pendingParams.length;
  const currentIndex = session.currentParamIndex + 1;
  const requiredTag = currentParam.required ? '(필수)' : '(선택)';
  const defaultTag = currentParam.defaultValue !== undefined
    ? ` [기본값: ${JSON.stringify(currentParam.defaultValue)}]`
    : '';

  const messageLines: string[] = [
    `## 📝 ${toolLabel} - 매개변수 입력 (${currentIndex}/${totalParams})`,
    ``,
    `**${currentParam.name}** ${requiredTag}${defaultTag}`,
    `${currentParam.description}`,
    ``,
  ];

  let options: MenuWizardOption[] | undefined;

  switch (currentParam.type) {
    case 'boolean': {
      messageLines.push(`예/아니오 중 선택해주세요.`);
      options = [
        { value: '예', label: '예 (true)', emoji: '✅' },
        { value: '아니오', label: '아니오 (false)', emoji: '❌' },
      ];
      break;
    }

    case 'enum': {
      messageLines.push(`다음 중 하나를 선택해주세요.`);
      options = (currentParam.enumValues || []).map(v => ({
        value: v,
        label: v,
      }));
      break;
    }

    case 'number': {
      messageLines.push(`숫자를 입력해주세요.`);
      break;
    }

    case 'array': {
      messageLines.push(`값을 쉼표(,)로 구분하여 입력해주세요.`);
      break;
    }

    case 'string':
    default: {
      messageLines.push(`값을 입력해주세요.`);
      break;
    }
  }

  // 선택적 매개변수에는 skip 옵션 추가
  if (!currentParam.required) {
    messageLines.push(``);
    messageLines.push(`> 💡 "skip"을 입력하면 기본값을 사용합니다.`);
    if (!options) {
      options = [];
    }
    options.push({
      value: 'skip',
      label: '건너뛰기',
      description: currentParam.defaultValue !== undefined
        ? `기본값 ${JSON.stringify(currentParam.defaultValue)} 사용`
        : '이 매개변수를 건너뜁니다',
      emoji: '⏭️',
    });
  }

  return {
    sessionId: session.id,
    currentStep: 'collect_params',
    message: messageLines.join('\n'),
    options,
    isComplete: false,
  };
}

// ============================================
// 헬퍼 함수: 확인 단계 생성
// ============================================

function buildConfirmStep(session: MenuWizardSession): MenuWizardStepResult {
  const tool = session.toolInfo;
  if (!tool) {
    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: '도구 정보가 없습니다. 다시 선택해주세요.',
      isComplete: false,
    };
  }

  // 매개변수 요약 테이블 생성
  const paramLines: string[] = [];
  for (const param of session.pendingParams) {
    const value = session.collectedParams[param.name];
    const displayValue = value !== undefined ? JSON.stringify(value) : '(미설정)';
    paramLines.push(`| ${param.name} | ${displayValue} | ${param.required ? '필수' : '선택'} |`);
  }

  const message = [
    `## 📋 실행 확인`,
    ``,
    `**도구**: ${tool.emoji} ${tool.label} (\`${tool.name}\`)`,
    ``,
    paramLines.length > 0 ? [
      `| 매개변수 | 값 | 구분 |`,
      `|----------|------|------|`,
      ...paramLines,
    ].join('\n') : '(매개변수 없음)',
    ``,
    `이 설정으로 실행할까요?`,
  ].join('\n');

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message,
    options: [
      { value: 'yes', label: '실행', description: '이 설정으로 도구를 실행합니다', emoji: '🚀' },
      { value: 'edit', label: '수정', description: '매개변수를 다시 입력합니다', emoji: '✏️' },
      { value: 'restart', label: '처음부터', description: '도구 선택부터 다시 시작합니다', emoji: '🔄' },
    ],
    isComplete: false,
  };
}

// ============================================
// 도구 실행
// ============================================

async function executeSelectedTool(session: MenuWizardSession): Promise<MenuWizardStepResult> {
  const toolName = session.selectedFunction;
  if (!toolName) {
    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: '선택된 도구가 없습니다. 다시 선택해주세요.',
      isComplete: false,
    };
  }

  session.currentStep = 'executing';

  const executor = toolExecutors[toolName];
  if (!executor) {
    return {
      sessionId: session.id,
      currentStep: 'select_function',
      message: `"${toolName}" 도구의 실행기를 찾을 수 없습니다.`,
      isComplete: false,
    };
  }

  try {
    const resultText = await executor(session.collectedParams);

    session.currentStep = 'complete';

    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: [
        `## ✅ 실행 완료`,
        ``,
        `**도구**: ${session.toolInfo?.emoji || ''} ${session.toolInfo?.label || toolName}`,
        ``,
        `---`,
        ``,
      ].join('\n'),
      isComplete: true,
      result: resultText,
    };
  } catch (error) {
    // 실행 실패 시 확인 단계로 돌아가서 재시도 가능
    session.currentStep = 'confirm';
    return {
      sessionId: session.id,
      currentStep: 'confirm',
      message: [
        `❌ 실행 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ``,
        `다시 시도하시겠습니까?`,
      ].join('\n'),
      options: [
        { value: 'yes', label: '다시 시도', description: '같은 설정으로 다시 실행합니다', emoji: '🔄' },
        { value: 'edit', label: '수정', description: '매개변수를 변경합니다', emoji: '✏️' },
        { value: 'restart', label: '처음부터', description: '도구 선택부터 다시 시작합니다', emoji: '⏪' },
      ],
      isComplete: false,
    };
  }
}

// ============================================
// 결과 포맷팅
// ============================================

export function formatMenuWizardResult(result: MenuWizardStepResult): string {
  const lines: string[] = [result.message];

  if (result.options && result.options.length > 0) {
    lines.push('');
    lines.push('**선택지:**');
    for (const opt of result.options) {
      const emoji = opt.emoji ? `${opt.emoji} ` : '';
      const desc = opt.description ? ` - ${opt.description}` : '';
      lines.push(`- ${emoji}**${opt.value}**: ${opt.label}${desc}`);
    }
    lines.push('');
    lines.push(`> 💡 \`interactive_answer\`를 사용하여 선택지의 **value**를 전달해주세요.`);
    lines.push(`> 세션 ID: \`${result.sessionId}\``);
  }

  if (result.isComplete && result.result) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(result.result);
  }

  return lines.join('\n');
}
