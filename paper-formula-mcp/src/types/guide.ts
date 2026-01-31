/**
 * HOW-WHY-WHAT 가이드 생성 타입 정의
 */

// 가이드 스타일
export type GuideStyle = 'comprehensive' | 'concise' | 'practical';

// 가이드 언어
export type GuideLanguage = 'ko' | 'en';

// 가이드 생성 입력
export interface GenerateGuideInput {
  paperPath: string;          // .md 파일 경로
  guideStyle?: GuideStyle;
  language?: GuideLanguage;
  includeCode?: boolean;       // 실전 코드 포함 여부
  includeCompetition?: boolean; // 공모전/논문 활용 섹션 포함
  outputPath?: string;         // 저장 경로
}

// 가이드 생성 결과
export interface GenerateGuideResult {
  success: boolean;
  markdown: string;
  outputPath?: string;
  stats: {
    totalSections: number;
    totalWords: number;
    whatSections: number;
    whySections: number;
    howSections: number;
  };
  error?: string;
}

// ============================================
// 인터랙티브 마법사 타입
// ============================================

export type GuideWizardStep =
  | 'select_style'
  | 'select_language'
  | 'select_code'
  | 'select_competition'
  | 'confirm'
  | 'generating'
  | 'complete';

export interface GuideWizardSession {
  id: string;
  paperPath: string;
  paperTitle: string;
  paperContent: string;
  currentStep: GuideWizardStep;
  config: GuideWizardConfig;
  createdAt: number;
}

export interface GuideWizardConfig {
  style: GuideStyle;
  language: GuideLanguage;
  includeCode: boolean;
  includeCompetition: boolean;
  outputPath?: string;
}

export interface GuideWizardStepResult {
  sessionId: string;
  currentStep: GuideWizardStep;
  message: string;
  options?: GuideWizardOption[];
  isComplete: boolean;
  guide?: string;
}

export interface GuideWizardOption {
  value: string;
  label: string;
  description?: string;
  emoji?: string;
}
