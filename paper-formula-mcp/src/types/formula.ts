/**
 * Formula-related type definitions
 */

// 수식 역할 분류
export type FormulaRole =
  | 'definition'      // 새로운 개념/변수 정의
  | 'objective'       // 최적화할 목적 함수
  | 'constraint'      // 제약 조건
  | 'theorem'         // 주요 정리/결과
  | 'derivation'      // 다른 수식에서 유도
  | 'approximation'   // 근사/추정
  | 'example'         // 설명을 위한 예시
  | 'baseline'        // 비교 기준 (기존 방법)
  | 'unknown';        // 분류 불가

// 수식 유형
export type FormulaType =
  | 'equation'        // 번호가 있는 수식
  | 'inline'          // 인라인 수식
  | 'display'         // 디스플레이 수식 (번호 없음)
  | 'definition';     // 정의 수식

// 변수 정보
export interface Variable {
  symbol: string;           // 변수 기호 (예: "x", "θ")
  latex: string;            // LaTeX 표현 (예: "\\theta")
  meaning?: string;         // 변수 의미 (예: "learning rate")
  type?: 'scalar' | 'vector' | 'matrix' | 'tensor' | 'function' | 'set' | 'unknown';
  definedIn?: string;       // 정의된 수식 ID
}

// 수식 정보
export interface Formula {
  id: string;               // 수식 ID (예: "eq1", "inline_3")
  latex: string;            // LaTeX 표현
  type: FormulaType;        // 수식 유형
  role: FormulaRole;        // 수식 역할
  number?: string;          // 수식 번호 (예: "(1)", "(2.3)")
  context: string;          // 수식 주변 텍스트
  section: string;          // 소속 섹션
  pageNumber: number;       // 페이지 번호
  variables: Variable[];    // 포함된 변수들
  confidence: number;       // 역할 분류 신뢰도 (0-1)
}

// 수식 추출 결과
export interface ExtractFormulasResult {
  success: boolean;
  paperTitle: string;
  formulas: Formula[];
  stats: {
    totalFormulas: number;
    numberedEquations: number;
    inlineFormulas: number;
    byRole: Record<FormulaRole, number>;
  };
  error?: string;
}

// 수식 설명 구성요소
export interface ComponentExplanation {
  symbol: string;
  latex: string;
  explanation: string;
  type: 'variable' | 'operator' | 'function' | 'constant';
}

// 수식 설명 결과
export interface FormulaExplanation {
  summary: string;              // 한 줄 요약
  components: ComponentExplanation[];
  meaning: string;              // 전체 의미 설명
  intuition: string;            // 직관적 이해
  role: string;                 // 논문에서의 역할
  relatedFormulas: string[];    // 관련 수식 ID
}

// 수식 설명 도구 결과
export interface ExplainFormulaResult {
  success: boolean;
  formula: {
    id?: string;
    latex: string;
    role?: FormulaRole;
  };
  explanation: FormulaExplanation;
  language: 'ko' | 'en';
  error?: string;
}

// 수식 의존성
export interface FormulaDependency {
  from: string;               // 수식 ID
  to: string;                 // 의존하는 수식 ID
  type: 'uses_variable' | 'derives_from' | 'substitutes' | 'combines';
  sharedVariables?: string[];
  description?: string;
}

// 변수 사용 정보
export interface VariableUsage {
  symbol: string;
  latex: string;
  meaning: string;
  definedIn: string[];        // 정의된 수식 ID들
  usedIn: string[];           // 사용된 수식 ID들
  firstAppearance: string;    // 처음 등장 섹션
}

// 변수 분석 결과
export interface VariableAnalysisResult {
  success: boolean;
  variables: VariableUsage[];
  mermaid?: string;
  markdown?: string;
  table?: string;
  stats: {
    totalVariables: number;
    definedVariables: number;
    undefinedVariables: number;
    mostUsedVariables: string[];
  };
  error?: string;
}

// 역할 분석 결과
export interface RoleAnalysisResult {
  success: boolean;
  roleGroups: Record<FormulaRole, Formula[]>;
  flowDiagram: string;        // Mermaid 코드
  markdown: string;
  analysis: {
    dominantRoles: FormulaRole[];
    logicalFlow: string;      // LLM이 생성한 논리 흐름 설명
  };
  error?: string;
}
