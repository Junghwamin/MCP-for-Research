/**
 * 인터랙티브 HOW-WHY-WHAT 가이드 마법사
 * 단계별 질문을 통해 사용자 맞춤형 가이드를 생성
 */

import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { generateGuide } from './generateGuide.js';
import type {
  GuideWizardSession,
  GuideWizardStep,
  GuideWizardStepResult,
  GuideWizardConfig,
  GuideWizardOption,
  GuideStyle,
  GuideLanguage,
} from '../types/guide.js';

// ============================================
// 세션 관리 (인메모리)
// ============================================

const sessions = new Map<string, GuideWizardSession>();

function generateSessionId(): string {
  return `gd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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

export interface StartGuideWizardInput {
  paperPath: string;
}

export async function startGuideWizard(input: StartGuideWizardInput): Promise<GuideWizardStepResult> {
  cleanExpiredSessions();

  try {
    // 마크다운 파일 읽기
    let paperContent: string;
    try {
      paperContent = await readFile(input.paperPath, 'utf-8');
    } catch {
      return {
        sessionId: '',
        currentStep: 'select_style',
        message: `❌ 파일을 읽을 수 없습니다: ${input.paperPath}`,
        isComplete: false,
      };
    }

    if (paperContent.trim().length === 0) {
      return {
        sessionId: '',
        currentStep: 'select_style',
        message: '❌ 빈 파일입니다.',
        isComplete: false,
      };
    }

    // 논문 제목 추출
    const paperTitle = extractTitle(paperContent);

    // 세션 생성
    const sessionId = generateSessionId();
    const session: GuideWizardSession = {
      id: sessionId,
      paperPath: input.paperPath,
      paperTitle,
      paperContent,
      currentStep: 'select_style',
      config: {
        style: 'comprehensive',
        language: 'ko',
        includeCode: true,
        includeCompetition: true,
      },
      createdAt: Date.now(),
    };

    sessions.set(sessionId, session);

    // 파일 크기 정보
    const lineCount = paperContent.split('\n').length;
    const wordCount = paperContent.split(/\s+/).length;

    const welcomeMessage = [
      `# 📖 HOW-WHY-WHAT 가이드 생성 마법사`,
      ``,
      `**논문**: ${paperTitle}`,
      `**파일**: ${path.basename(input.paperPath)}`,
      `**분량**: ${lineCount}줄, ~${wordCount}단어`,
      ``,
      `---`,
      ``,
      `## 1단계: 가이드 스타일 선택`,
      ``,
      `어떤 스타일의 가이드를 생성할까요?`,
    ].join('\n');

    return {
      sessionId,
      currentStep: 'select_style',
      message: welcomeMessage,
      options: [
        { value: 'comprehensive', label: '종합 (Comprehensive)', description: '상세한 설명, 표, 다이어그램, 코드 포함 (1500줄+)', emoji: '📚' },
        { value: 'concise', label: '간결 (Concise)', description: '핵심만 빠르게 정리 (500줄)', emoji: '⚡' },
        { value: 'practical', label: '실전 (Practical)', description: '코드 중심, 구현 위주 설명', emoji: '💻' },
      ],
      isComplete: false,
    };
  } catch (error) {
    return {
      sessionId: '',
      currentStep: 'select_style',
      message: `❌ 마법사 시작 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isComplete: false,
    };
  }
}

// ============================================
// 마법사 답변 처리
// ============================================

export interface GuideWizardAnswerInput {
  sessionId: string;
  answer: string;
}

export async function guideWizardAnswer(input: GuideWizardAnswerInput): Promise<GuideWizardStepResult> {
  cleanExpiredSessions();

  const session = sessions.get(input.sessionId);
  if (!session) {
    return {
      sessionId: input.sessionId,
      currentStep: 'select_style',
      message: '❌ 세션을 찾을 수 없습니다. 새로운 마법사를 시작해주세요.',
      isComplete: false,
    };
  }

  const answer = input.answer.trim().toLowerCase();

  switch (session.currentStep) {
    case 'select_style':
      return handleSelectStyle(session, answer);

    case 'select_language':
      return handleSelectLanguage(session, answer);

    case 'select_code':
      return handleSelectCode(session, answer);

    case 'select_competition':
      return handleSelectCompetition(session, answer);

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

function handleSelectStyle(session: GuideWizardSession, answer: string): GuideWizardStepResult {
  const validStyles: GuideStyle[] = ['comprehensive', 'concise', 'practical'];
  session.config.style = validStyles.includes(answer as GuideStyle) ? answer as GuideStyle : 'comprehensive';
  session.currentStep = 'select_language';

  const styleLabels: Record<GuideStyle, string> = {
    comprehensive: '종합 (Comprehensive)',
    concise: '간결 (Concise)',
    practical: '실전 (Practical)',
  };

  return {
    sessionId: session.id,
    currentStep: 'select_language',
    message: [
      `✅ 스타일: **${styleLabels[session.config.style]}**`,
      ``,
      `---`,
      ``,
      `## 2단계: 언어 선택`,
      ``,
      `가이드를 어떤 언어로 작성할까요?`,
    ].join('\n'),
    options: [
      { value: 'ko', label: '한국어', description: '한국어로 작성 (전문 용어는 영어 병기)', emoji: '🇰🇷' },
      { value: 'en', label: 'English', description: 'Written in English', emoji: '🇺🇸' },
    ],
    isComplete: false,
  };
}

function handleSelectLanguage(session: GuideWizardSession, answer: string): GuideWizardStepResult {
  session.config.language = answer === 'en' ? 'en' : 'ko';
  session.currentStep = 'select_code';

  return {
    sessionId: session.id,
    currentStep: 'select_code',
    message: [
      `✅ 언어: **${session.config.language === 'ko' ? '한국어' : 'English'}**`,
      ``,
      `---`,
      ``,
      `## 3단계: 코드 포함 여부`,
      ``,
      `실전 코드 예시(PennyLane/PyTorch)를 포함할까요?`,
    ].join('\n'),
    options: [
      { value: 'yes', label: '코드 포함', description: '환경 설정, 구현, 실험, 시각화 코드 포함', emoji: '💻' },
      { value: 'no', label: '코드 미포함', description: '이론과 개념 설명만', emoji: '📝' },
    ],
    isComplete: false,
  };
}

function handleSelectCode(session: GuideWizardSession, answer: string): GuideWizardStepResult {
  session.config.includeCode = answer !== 'no';
  session.currentStep = 'select_competition';

  return {
    sessionId: session.id,
    currentStep: 'select_competition',
    message: [
      `✅ 코드: **${session.config.includeCode ? '포함' : '미포함'}**`,
      ``,
      `---`,
      ``,
      `## 4단계: 공모전/논문 활용 가이드`,
      ``,
      `공모전 활용법, 논문 작성 팁, 확장 아이디어 섹션을 포함할까요?`,
    ].join('\n'),
    options: [
      { value: 'yes', label: '포함', description: '공모전 활용, 논문 작성 팁, 확장 아이디어', emoji: '🏆' },
      { value: 'no', label: '미포함', description: '순수 학습 가이드만', emoji: '📖' },
    ],
    isComplete: false,
  };
}

function handleSelectCompetition(session: GuideWizardSession, answer: string): GuideWizardStepResult {
  session.config.includeCompetition = answer !== 'no';
  session.currentStep = 'confirm';

  const styleLabels: Record<GuideStyle, string> = {
    comprehensive: '종합 (Comprehensive)',
    concise: '간결 (Concise)',
    practical: '실전 (Practical)',
  };

  return {
    sessionId: session.id,
    currentStep: 'confirm',
    message: [
      `✅ 공모전/논문 활용: **${session.config.includeCompetition ? '포함' : '미포함'}**`,
      ``,
      `---`,
      ``,
      `## 📋 설정 확인`,
      ``,
      `| 항목 | 설정값 |`,
      `|------|--------|`,
      `| 논문 | ${session.paperTitle} |`,
      `| 스타일 | ${styleLabels[session.config.style]} |`,
      `| 언어 | ${session.config.language === 'ko' ? '한국어' : 'English'} |`,
      `| 코드 포함 | ${session.config.includeCode ? '예' : '아니오'} |`,
      `| 공모전/논문 활용 | ${session.config.includeCompetition ? '예' : '아니오'} |`,
      ``,
      `이 설정으로 가이드를 생성할까요?`,
    ].join('\n'),
    options: [
      { value: 'yes', label: '생성 시작', description: 'HOW-WHY-WHAT 가이드를 생성합니다', emoji: '🚀' },
      { value: 'restart', label: '처음부터 다시', description: '설정을 처음부터 다시 합니다', emoji: '🔄' },
    ],
    isComplete: false,
  };
}

async function handleConfirm(session: GuideWizardSession, answer: string): Promise<GuideWizardStepResult> {
  if (answer === 'restart') {
    session.currentStep = 'select_style';
    return {
      sessionId: session.id,
      currentStep: 'select_style',
      message: [
        `🔄 처음부터 다시 시작합니다.`,
        ``,
        `---`,
        ``,
        `## 1단계: 가이드 스타일 선택`,
        ``,
        `어떤 스타일의 가이드를 생성할까요?`,
      ].join('\n'),
      options: [
        { value: 'comprehensive', label: '종합 (Comprehensive)', description: '상세한 설명, 표, 다이어그램, 코드 포함 (1500줄+)', emoji: '📚' },
        { value: 'concise', label: '간결 (Concise)', description: '핵심만 빠르게 정리 (500줄)', emoji: '⚡' },
        { value: 'practical', label: '실전 (Practical)', description: '코드 중심, 구현 위주 설명', emoji: '💻' },
      ],
      isComplete: false,
    };
  }

  // 가이드 생성 시작
  session.currentStep = 'generating';

  try {
    const result = await generateGuide({
      paperPath: session.paperPath,
      guideStyle: session.config.style,
      language: session.config.language,
      includeCode: session.config.includeCode,
      includeCompetition: session.config.includeCompetition,
    });

    if (!result.success) {
      session.currentStep = 'confirm';
      return {
        sessionId: session.id,
        currentStep: 'confirm',
        message: `❌ 가이드 생성 중 오류 발생: ${result.error}\n\n다시 시도하시겠습니까?`,
        options: [
          { value: 'yes', label: '다시 시도', description: '가이드 생성을 다시 시도합니다', emoji: '🔄' },
          { value: 'restart', label: '처음부터', description: '설정을 변경합니다', emoji: '⏪' },
        ],
        isComplete: false,
      };
    }

    session.currentStep = 'complete';

    return {
      sessionId: session.id,
      currentStep: 'complete',
      message: `✅ HOW-WHY-WHAT 가이드 생성이 완료되었습니다!${result.outputPath ? `\n📁 저장 위치: ${result.outputPath}` : ''}`,
      isComplete: true,
      guide: result.markdown,
    };
  } catch (error) {
    session.currentStep = 'confirm';
    return {
      sessionId: session.id,
      currentStep: 'confirm',
      message: `❌ 가이드 생성 중 오류 발생: ${error instanceof Error ? error.message : 'Unknown error'}\n\n다시 시도하시겠습니까?`,
      options: [
        { value: 'yes', label: '다시 시도', description: '가이드 생성을 다시 시도합니다', emoji: '🔄' },
        { value: 'restart', label: '처음부터', description: '설정을 변경합니다', emoji: '⏪' },
      ],
      isComplete: false,
    };
  }
}

// ============================================
// 헬퍼
// ============================================

function extractTitle(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.replace(/^#+\s*/, '').trim();
    }
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed.substring(0, 100);
    }
  }
  return 'Unknown Paper';
}

// ============================================
// 결과 포맷팅
// ============================================

export function formatGuideWizardResult(result: GuideWizardStepResult): string {
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
    lines.push(`> 💡 \`guide_wizard_answer\`를 사용하여 선택지의 **value**를 전달해주세요.`);
    lines.push(`> 세션 ID: \`${result.sessionId}\``);
  }

  if (result.isComplete && result.guide) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(result.guide);
  }

  return lines.join('\n');
}
