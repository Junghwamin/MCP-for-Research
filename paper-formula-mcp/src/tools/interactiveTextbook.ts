/**
 * 인터랙티브 교과서 마법사
 * 단계별 질문을 통해 사용자 맞춤형 교과서를 생성
 */

import path from 'path';
import { extractFormulas } from './extractFormulas.js';
import { generateTextbookWithLLM } from '../api/llmClient.js';
import { writeFile } from 'fs/promises';
import type {
  WizardSession,
  WizardStep,
  WizardStepResult,
  WizardConfig,
  WizardOption,
  TextbookLevel,
  TextbookLanguage,
  TextbookStyle,
} from '../types/textbook.js';

// ============================================
// 세션 관리 (인메모리)
// ============================================

const sessions = new Map<string, WizardSession>();

function generateSessionId(): string {
  return `tb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// 30분 후 만료
function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}

// ============================================
// 마법사 시작
// ============================================

export interface StartWizardInput {
  pdfPath: string;
}

export async function startTextbookWizard(input: StartWizardInput): Promise<WizardStepResult> {
  cleanExpiredSessions();

  try {
    // PDF에서 수식 추출
    const extractResult = await extractFormulas({
      pdfPath: input.pdfPath,
      includeInline: false,
      includeNumbered: false,
    });

    if (!extractResult.success) {
      return {
        sessionId: '',
        currentStep: 'welcome',
        message: `❌ PDF 분석 실패: ${extractResult.error}`,
        isComplete: false,
      };
    }

    // 세션 생성
    const sessionId = generateSessionId();
    const session: WizardSession = {
      id: sessionId,
      pdfPath: input.pdfPath,
      paperTitle: extractResult.paperTitle,
      formulas: extractResult.formulas,
      currentStep: 'select_level',
      config: {
        targetLevel: 'auto',
        language: 'ko',
        focusAreas: [],
        maxChapters: 8,
        includeExercises: true,
        includeExamples: true,
        includeVisualizations: true,
        style: 'friendly',
      },
      createdAt: Date.now(),
    };

    sessions.set(sessionId, session);

    // 수식 요약
    const formulaCount = extractResult.formulas.filter(f => f.type !== 'inline').length;
    const roles = Object.entries(extractResult.stats.byRole)
      .filter(([_, count]) => count > 0)
      .map(([role, count]) => `${role}: ${count}개`)
      .join(', ');

    const welcomeMessage = [
      `# 📖 교과서 생성 마법사`,
      ``,
      `**논문**: ${extractResult.paperTitle}`,
      `**추출된 수식**: ${formulaCount}개 (${roles})`,
      ``,
      `---`,
      ``,
      `## 1단계: 대상 수준 선택`,
      ``,
      `이 교과서를 읽을 사람의 수학/과학 수준을 선택해주세요.`,
      `"auto"를 선택하면 초등학생 수준부터 논문 수준까지 단계적으로 설명합니다.`,
    ].join('\n');

    return {
      sessionId,
      currentStep: 'select_level',
      message: welcomeMessage,
      options: [
        { value: 'auto', label: '자동 (기초→심화)', description: '초등학생부터 대학원생까지 단계별로', emoji: '🎯' },
        { value: 'elementary', label: '초등학교', description: '기본 산수와 직관적 설명', emoji: '🌱' },
        { value: 'middle', label: '중학교', description: '기초 대수, 함수, 확률', emoji: '📗' },
        { value: 'high', label: '고등학교', description: '미적분, 행렬, 삼각함수', emoji: '📘' },
        { value: 'undergraduate', label: '대학교', description: '선형대수, 확률론, 최적화', emoji: '📙' },
        { value: 'graduate', label: '대학원', description: '논문 수준의 심화 설명', emoji: '📕' },
      ],
      isComplete: false,
    };
  } catch (error) {
    return {
      sessionId: '',
      currentStep: 'welcome',
      message: `❌ 마법사 시작 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isComplete: false,
    };
  }
}

// ============================================
// 마법사 답변 처리
// ============================================

export interface WizardAnswerInput {
  sessionId: string;
  answer: string;
}

export async function textbookWizardAnswer(input: WizardAnswerInput): Promise<WizardStepResult> {
  cleanExpiredSessions();

  const session = sessions.get(input.sessionId);
  if (!session) {
    return {
      sessionId: input.sessionId,
      currentStep: 'welcome',
      message: '❌ 세션을 찾을 수 없습니다. 새로운 마법사를 시작해주세요.',
      isComplete: false,
    };
  }

  const answer = input.answer.trim().toLowerCase();

  switch (session.currentStep) {
    case 'select_level':
      return handleSelectLevel(session, answer);

    case 'select_language':
      return handleSelectLanguage(session, answer);

    case 'select_focus':
      return handleSelectFocus(session, answer);

    case 'select_depth':
      return handleSelectDepth(session, answer);

    case 'select_style':
      return handleSelectStyle(session, answer);

    case 'confirm':
      return handleConfirm(session, answer);

    default:
      return {
        sessionId: session.id,
        currentStep: session.currentStep,
        message: '❌ 알 수 없는 단계입니다.',
        isComplete: false,
      };
  }
}

// ============================================
// 각 단계 핸들러
// ============================================

function handleSelectLevel(session: WizardSession, answer: string): WizardStepResult {
  const validLevels: TextbookLevel[] = ['auto', 'elementary', 'middle', 'high', 'undergraduate', 'graduate'];
  const level = validLevels.includes(answer as TextbookLevel) ? answer as TextbookLevel : 'auto';

  session.config.targetLevel = level;
  session.currentStep = 'select_language';

  const levelLabels: Record<TextbookLevel, string> = {
    auto: '자동 (기초→심화)',
    elementary: '초등학교',
    middle: '중학교',
    high: '고등학교',
    undergraduate: '대학교',
    graduate: '대학원',
  };

  return {
    sessionId: session.id,
    currentStep: 'select_language',
    message: [
      `✅ 대상 수준: **${levelLabels[level]}**`,
      ``,
      `---`,
      ``,
      `## 2단계: 언어 선택`,
      ``,
      `교과서를 어떤 언어로 작성할까요?`,
    ].join('\n'),
    options: [
      { value: 'ko', label: '한국어', description: '한국어로 작성 (수식 용어는 영어 병기)', emoji: '🇰🇷' },
      { value: 'en', label: 'English', description: 'Written in English', emoji: '🇺🇸' },
    ],
    isComplete: false,
  };
}

function handleSelectLanguage(session: WizardSession, answer: string): WizardStepResult {
  session.config.language = answer === 'en' ? 'en' : 'ko';
  session.currentStep = 'select_focus';

  // 수식 역할별 분류
  const roleGroups = new Map<string, number>();
  for (const f of session.formulas) {
    if (f.type === 'inline') continue;
    roleGroups.set(f.role, (roleGroups.get(f.role) || 0) + 1);
  }

  const sectionGroups = new Map<string, number>();
  for (const f of session.formulas) {
    if (f.type === 'inline') continue;
    sectionGroups.set(f.section, (sectionGroups.get(f.section) || 0) + 1);
  }

  const topSections = [...sectionGroups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([sec, cnt]) => `${sec} (${cnt}개 수식)`);

  return {
    sessionId: session.id,
    currentStep: 'select_focus',
    message: [
      `✅ 언어: **${session.config.language === 'ko' ? '한국어' : 'English'}**`,
      ``,
      `---`,
      ``,
      `## 3단계: 초점 영역 선택`,
      ``,
      `논문의 어떤 부분에 집중할까요?`,
      ``,
      `**논문의 주요 섹션:**`,
      ...topSections.map(s => `- ${s}`),
    ].join('\n'),
    options: [
      { value: 'all', label: '전체 논문', description: '모든 수식과 개념을 포괄적으로', emoji: '📚' },
      { value: 'core', label: '핵심 수식만', description: '정의와 정리 등 핵심 수식에 집중', emoji: '🎯' },
      { value: 'math', label: '수학적 기초', description: '수학적 배경과 유도 과정에 집중', emoji: '🔢' },
      { value: 'application', label: '응용/구현', description: '실제 적용과 알고리즘에 집중', emoji: '💻' },
    ],
    isComplete: false,
  };
}

function handleSelectFocus(session: WizardSession, answer: string): WizardStepResult {
  const focusMap: Record<string, string[]> = {
    all: ['definition', 'objective', 'theorem', 'derivation', 'constraint', 'approximation'],
    core: ['definition', 'objective', 'theorem'],
    math: ['definition', 'derivation', 'theorem', 'approximation'],
    application: ['objective', 'constraint', 'approximation', 'example'],
  };

  session.config.focusAreas = focusMap[answer] || focusMap['all'];
  session.currentStep = 'select_depth';

  return {
    sessionId: session.id,
    currentStep: 'select_depth',
    message: [
      `✅ 초점: **${answer === 'all' ? '전체 논문' : answer === 'core' ? '핵심 수식' : answer === 'math' ? '수학적 기초' : '응용/구현'}**`,
      ``,
      `---`,
      ``,
      `## 4단계: 교과서 분량`,
      ``,
      `교과서의 분량을 선택해주세요.`,
    ].join('\n'),
    options: [
      { value: 'compact', label: '간결 (3-4장)', description: '핵심만 빠르게 정리', emoji: '⚡' },
      { value: 'standard', label: '표준 (6-8장)', description: '기초부터 심화까지 균형 있게', emoji: '📖' },
      { value: 'comprehensive', label: '상세 (10-12장)', description: '모든 개념을 꼼꼼하게', emoji: '📚' },
    ],
    isComplete: false,
  };
}

function handleSelectDepth(session: WizardSession, answer: string): WizardStepResult {
  const depthMap: Record<string, { chapters: number; exercises: boolean; examples: boolean }> = {
    compact: { chapters: 4, exercises: false, examples: true },
    standard: { chapters: 8, exercises: true, examples: true },
    comprehensive: { chapters: 12, exercises: true, examples: true },
  };

  const config = depthMap[answer] || depthMap['standard'];
  session.config.maxChapters = config.chapters;
  session.config.includeExercises = config.exercises;
  session.config.includeExamples = config.examples;
  session.currentStep = 'select_style';

  return {
    sessionId: session.id,
    currentStep: 'select_style',
    message: [
      `✅ 분량: **${answer === 'compact' ? '간결 (3-4장)' : answer === 'comprehensive' ? '상세 (10-12장)' : '표준 (6-8장)'}**`,
      ``,
      `---`,
      ``,
      `## 5단계: 서술 스타일`,
      ``,
      `교과서의 서술 스타일을 선택해주세요.`,
    ].join('\n'),
    options: [
      { value: 'friendly', label: '친근한 대화체', description: '"~해요" 체, 비유와 이모지 활용', emoji: '😊' },
      { value: 'formal', label: '정통 교과서체', description: '격식체, 학술적 서술', emoji: '🎓' },
      { value: 'visual', label: '시각적 중심', description: 'ASCII 그림, 다이어그램 풍부', emoji: '🎨' },
      { value: 'step-by-step', label: '단계별 풀이', description: '모든 수식을 한 단계씩 풀어서', emoji: '🪜' },
    ],
    isComplete: false,
  };
}

function handleSelectStyle(session: WizardSession, answer: string): WizardStepResult {
  const validStyles: TextbookStyle[] = ['friendly', 'formal', 'visual', 'step-by-step'];
  session.config.style = validStyles.includes(answer as TextbookStyle) ? answer as TextbookStyle : 'friendly';
  session.currentStep = 'confirm';

  const styleLabels: Record<TextbookStyle, string> = {
    friendly: '친근한 대화체',
    formal: '정통 교과서체',
    visual: '시각적 중심',
    'step-by-step': '단계별 풀이',
  };

  const levelLabels: Record<TextbookLevel, string> = {
    auto: '자동 (기초→심화)',
    elementary: '초등학교',
    middle: '중학교',
    high: '고등학교',
    undergraduate: '대학교',
    graduate: '대학원',
  };

  const focusLabel = session.config.focusAreas.length >= 6 ? '전체 논문' :
    session.config.focusAreas.includes('objective') && !session.config.focusAreas.includes('derivation') ? '응용/구현' :
    session.config.focusAreas.includes('derivation') && !session.config.focusAreas.includes('objective') ? '수학적 기초' :
    '핵심 수식';

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message: [
      `✅ 스타일: **${styleLabels[session.config.style]}**`,
      ``,
      `---`,
      ``,
      `## 📋 설정 확인`,
      ``,
      `| 항목 | 설정값 |`,
      `|------|--------|`,
      `| 논문 | ${session.paperTitle} |`,
      `| 대상 수준 | ${levelLabels[session.config.targetLevel]} |`,
      `| 언어 | ${session.config.language === 'ko' ? '한국어' : 'English'} |`,
      `| 초점 영역 | ${focusLabel} |`,
      `| 분량 | ${session.config.maxChapters}장 |`,
      `| 연습문제 | ${session.config.includeExercises ? '포함' : '미포함'} |`,
      `| 예시 | ${session.config.includeExamples ? '포함' : '미포함'} |`,
      `| 스타일 | ${styleLabels[session.config.style]} |`,
      ``,
      `이 설정으로 교과서를 생성할까요?`,
    ].join('\n'),
    options: [
      { value: 'yes', label: '생성 시작', description: '교과서 생성을 시작합니다', emoji: '🚀' },
      { value: 'restart', label: '처음부터 다시', description: '설정을 처음부터 다시 합니다', emoji: '🔄' },
    ],
    isComplete: false,
  };
}

async function handleConfirm(session: WizardSession, answer: string): Promise<WizardStepResult> {
  if (answer === 'restart') {
    session.currentStep = 'select_level';
    return {
      sessionId: session.id,
      currentStep: 'select_level',
      message: [
        `🔄 처음부터 다시 시작합니다.`,
        ``,
        `---`,
        ``,
        `## 1단계: 대상 수준 선택`,
        ``,
        `이 교과서를 읽을 사람의 수학/과학 수준을 선택해주세요.`,
      ].join('\n'),
      options: [
        { value: 'auto', label: '자동 (기초→심화)', description: '초등학생부터 대학원생까지 단계별로', emoji: '🎯' },
        { value: 'elementary', label: '초등학교', description: '기본 산수와 직관적 설명', emoji: '🌱' },
        { value: 'middle', label: '중학교', description: '기초 대수, 함수, 확률', emoji: '📗' },
        { value: 'high', label: '고등학교', description: '미적분, 행렬, 삼각함수', emoji: '📘' },
        { value: 'undergraduate', label: '대학교', description: '선형대수, 확률론, 최적화', emoji: '📙' },
        { value: 'graduate', label: '대학원', description: '논문 수준의 심화 설명', emoji: '📕' },
      ],
      isComplete: false,
    };
  }

  // 교과서 생성 시작
  session.currentStep = 'generating';

  try {
    // 초점 영역에 맞는 수식 필터링
    let targetFormulas = session.formulas.filter(f => {
      if (f.type === 'inline') return false;
      if (session.config.focusAreas.length === 0) return true;
      return session.config.focusAreas.includes(f.role);
    }).slice(0, 30);

    if (targetFormulas.length === 0) {
      // 필터 완화: 모든 비-인라인 수식 포함
      targetFormulas = session.formulas.filter(f => f.type !== 'inline').slice(0, 30);
    }

    const textbookMarkdown = await generateTextbookWithLLM({
      paperTitle: session.paperTitle,
      formulas: targetFormulas,
      targetLevel: session.config.targetLevel,
      language: session.config.language,
      maxChapters: session.config.maxChapters,
      includeExercises: session.config.includeExercises,
      includeExamples: session.config.includeExamples,
      style: session.config.style,
    });

    session.currentStep = 'complete';

    // 파일 저장
    const outputPath = path.join(path.dirname(session.pdfPath), 'generated_textbook.md');
    try {
      await writeFile(outputPath, textbookMarkdown, 'utf-8');
    } catch {
      // 파일 저장 실패해도 계속 진행
    }

    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: `✅ 교과서 생성이 완료되었습니다!`,
      isComplete: true,
      textbook: textbookMarkdown,
    };
  } catch (error) {
    session.currentStep = 'confirm'; // 재시도 가능하도록
    return {
      sessionId: session.id,
      currentStep: 'confirm',
      message: `❌ 교과서 생성 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}\n\n다시 시도하시겠습니까?`,
      options: [
        { value: 'yes', label: '다시 시도', description: '교과서 생성을 다시 시도합니다', emoji: '🔄' },
        { value: 'restart', label: '처음부터', description: '설정을 변경합니다', emoji: '⏪' },
      ],
      isComplete: false,
    };
  }
}

// ============================================
// 결과 포맷팅
// ============================================

export function formatWizardResult(result: WizardStepResult): string {
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
    lines.push(`> 💡 \`textbook_wizard_answer\`를 사용하여 선택지의 **value**를 전달해주세요.`);
    lines.push(`> 세션 ID: \`${result.sessionId}\``);
  }

  if (result.isComplete && result.textbook) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(result.textbook);
  }

  return lines.join('\n');
}
