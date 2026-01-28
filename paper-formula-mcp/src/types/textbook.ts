/**
 * Textbook generation type definitions
 */

import type { Formula } from './formula.js';

// 교과서 대상 수준
export type TextbookLevel =
  | 'elementary'    // 초등학교
  | 'middle'        // 중학교
  | 'high'          // 고등학교
  | 'undergraduate' // 대학교
  | 'graduate'      // 대학원
  | 'auto';         // 자동 (기초부터 논문 수준까지)

// 교과서 언어
export type TextbookLanguage = 'ko' | 'en';

// 교과서 장(Chapter) 정보
export interface TextbookChapter {
  number: number;
  title: string;
  targetLevel: TextbookLevel;
  sections: TextbookSection[];
  prerequisites: string[];     // 이전 장에서 배운 필수 개념들
  learningGoals: string[];     // 학습 목표
}

// 교과서 섹션
export interface TextbookSection {
  title: string;
  content: string;             // 마크다운 본문
  formulas?: string[];         // 관련 LaTeX 수식
  examples?: TextbookExample[];
  exercises?: TextbookExercise[];
  diagrams?: string[];         // Mermaid 다이어그램
}

// 예시
export interface TextbookExample {
  title: string;
  description: string;
  calculation?: string;        // 계산 과정
  visualization?: string;      // ASCII art 또는 다이어그램
}

// 연습문제
export interface TextbookExercise {
  question: string;
  hint?: string;
  answer?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// 교과서 전체 구조
export interface Textbook {
  title: string;
  paperTitle: string;
  description: string;
  targetLevel: TextbookLevel;
  language: TextbookLanguage;
  chapters: TextbookChapter[];
  glossary: GlossaryEntry[];
  formulaMap: FormulaMapEntry[];  // 논문 수식 → 교과서 장 매핑
}

// 용어 사전 항목
export interface GlossaryEntry {
  term: string;
  definition: string;
  relatedTerms?: string[];
  firstAppearance: number;     // 처음 등장하는 장 번호
}

// 수식 매핑
export interface FormulaMapEntry {
  formulaId: string;
  latex: string;
  chapterNumber: number;
  prerequisiteConcepts: string[];
}

// 교과서 생성 결과
export interface GenerateTextbookResult {
  success: boolean;
  textbook?: Textbook;
  markdown: string;            // 완성된 마크다운 교과서
  stats: {
    totalChapters: number;
    totalSections: number;
    totalExercises: number;
    coveredFormulas: number;
    totalFormulas: number;
  };
  error?: string;
}

// 교과서 생성 입력
export interface GenerateTextbookInput {
  pdfPath: string;
  targetLevel?: TextbookLevel;
  language?: TextbookLanguage;
  maxChapters?: number;
  includeExercises?: boolean;
  includeExamples?: boolean;
  focusFormulas?: string[];    // 특정 수식에 집중
  outputPath?: string;         // 파일 저장 경로
}

// ============================================
// 인터랙티브 마법사 타입
// ============================================

export type WizardStep =
  | 'welcome'
  | 'select_level'
  | 'select_language'
  | 'select_focus'
  | 'select_depth'
  | 'select_style'
  | 'confirm'
  | 'generating'
  | 'complete';

export interface WizardSession {
  id: string;
  pdfPath: string;
  paperTitle: string;
  formulas: Formula[];
  currentStep: WizardStep;
  config: WizardConfig;
  createdAt: number;
}

export interface WizardConfig {
  targetLevel: TextbookLevel;
  language: TextbookLanguage;
  focusAreas: string[];        // 집중할 분야
  maxChapters: number;
  includeExercises: boolean;
  includeExamples: boolean;
  includeVisualizations: boolean;
  style: TextbookStyle;
}

export type TextbookStyle =
  | 'formal'        // 정통 교과서 스타일
  | 'friendly'      // 친근한 대화체
  | 'visual'        // 시각적 중심
  | 'step-by-step'; // 단계별 풀이 중심

export interface WizardStepResult {
  sessionId: string;
  currentStep: WizardStep;
  message: string;             // 사용자에게 보여줄 메시지
  options?: WizardOption[];    // 선택지
  isComplete: boolean;
  textbook?: string;           // 완료 시 교과서 마크다운
}

export interface WizardOption {
  value: string;
  label: string;
  description?: string;
  emoji?: string;
}
