import type { Formula, Variable, FormulaRole, FormulaType } from '../types/formula.js';

// ============================================
// LaTeX 수식 파싱 및 분석
// ============================================

interface RawFormula {
  latex: string;
  type: FormulaType;
  context: string;
  number?: string;
  position: number;
}

/**
 * 텍스트에서 LaTeX 수식 추출
 */
export function extractFormulasFromText(text: string): RawFormula[] {
  const formulas: RawFormula[] = [];

  // 1. 번호가 있는 수식 (equation 환경)
  const numberedPatterns = [
    // \begin{equation}...\end{equation}
    /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g,
    // \begin{align}...\end{align}
    /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g,
    // (1), (2.3) 등 번호가 붙은 수식
    /\((\d+(?:\.\d+)?)\)\s*([^\n]+)/g,
  ];

  // 2. 디스플레이 수식 ($$...$$)
  const displayPattern = /\$\$([\s\S]*?)\$\$/g;

  // 3. 인라인 수식 ($...$)
  const inlinePattern = /\$([^$\n]+?)\$/g;

  // 번호가 있는 수식 추출
  for (const pattern of numberedPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const latex = match[1] || match[2];
      const context = getContext(text, match.index);

      formulas.push({
        latex: latex.trim(),
        type: 'equation',
        context,
        number: match[1]?.match(/^\d/) ? `(${match[1]})` : undefined,
        position: match.index,
      });
    }
  }

  // 디스플레이 수식 추출
  let match;
  while ((match = displayPattern.exec(text)) !== null) {
    const context = getContext(text, match.index);
    formulas.push({
      latex: match[1].trim(),
      type: 'display',
      context,
      position: match.index,
    });
  }

  // 인라인 수식 추출
  while ((match = inlinePattern.exec(text)) !== null) {
    const latex = match[1].trim();
    if (latex.length > 2 && isValidLatex(latex)) {
      const context = getContext(text, match.index);
      formulas.push({
        latex,
        type: 'inline',
        context,
        position: match.index,
      });
    }
  }

  // 위치 순으로 정렬하고 중복 제거
  return deduplicateFormulas(formulas.sort((a, b) => a.position - b.position));
}

/**
 * 수식 주변 컨텍스트 추출
 */
function getContext(text: string, position: number, windowSize: number = 200): string {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * 유효한 LaTeX인지 확인
 */
function isValidLatex(latex: string): boolean {
  // 너무 짧거나 단순한 것 필터링
  if (latex.length < 2) return false;
  if (/^[a-zA-Z0-9]$/.test(latex)) return false;
  if (/^\d+$/.test(latex)) return false;

  // 수학 기호가 있는지 확인
  const mathIndicators = [
    '\\', '_', '^', '=', '+', '-', '\\frac', '\\sum', '\\int',
    '\\partial', '\\nabla', '\\times', '\\cdot', 'alpha', 'beta',
    'theta', 'lambda', 'sigma', 'omega', '\\log', '\\exp', '\\max', '\\min'
  ];

  return mathIndicators.some(ind => latex.includes(ind)) ||
         /[a-z].*[=+\-*/]/.test(latex);
}

/**
 * 중복 수식 제거
 */
function deduplicateFormulas(formulas: RawFormula[]): RawFormula[] {
  const seen = new Set<string>();
  return formulas.filter(f => {
    const normalized = normalizeLatex(f.latex);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * LaTeX 정규화
 */
export function normalizeLatex(latex: string): string {
  return latex
    .replace(/\s+/g, ' ')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\big/g, '')
    .replace(/\\Big/g, '')
    .trim();
}

/**
 * 수식에서 변수 추출
 */
export function extractVariables(latex: string): Variable[] {
  const variables: Variable[] = [];
  const seen = new Set<string>();

  // 그리스 문자
  const greekPattern = /\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega)/g;

  // 일반 변수 (단일 문자)
  const singleVarPattern = /(?<!\\)([a-zA-Z])(?![a-zA-Z])/g;

  // 서브스크립트가 있는 변수
  const subscriptPattern = /([a-zA-Z])_\{?([a-zA-Z0-9]+)\}?/g;

  // 볼드/특수 변수
  const boldPattern = /\\(?:mathbf|mathbb|mathcal|boldsymbol)\{([A-Za-z])\}/g;

  let match;

  // 그리스 문자 추출
  while ((match = greekPattern.exec(latex)) !== null) {
    const symbol = match[1];
    if (!seen.has(symbol)) {
      seen.add(symbol);
      variables.push({
        symbol: getGreekSymbol(symbol),
        latex: `\\${symbol}`,
        type: inferVariableType(latex, symbol),
      });
    }
  }

  // 서브스크립트 변수 추출
  while ((match = subscriptPattern.exec(latex)) !== null) {
    const symbol = `${match[1]}_${match[2]}`;
    if (!seen.has(symbol)) {
      seen.add(symbol);
      variables.push({
        symbol,
        latex: match[0],
        type: inferVariableType(latex, symbol),
      });
    }
  }

  // 볼드 변수 추출
  while ((match = boldPattern.exec(latex)) !== null) {
    const symbol = match[1];
    if (!seen.has(symbol)) {
      seen.add(symbol);
      variables.push({
        symbol,
        latex: match[0],
        type: 'vector',
      });
    }
  }

  // 단일 문자 변수 추출 (마지막에, 다른 패턴에 안 잡힌 것만)
  const reservedWords = ['sin', 'cos', 'tan', 'log', 'exp', 'min', 'max', 'lim', 'sum', 'int', 'if', 'in', 'of', 'd'];
  while ((match = singleVarPattern.exec(latex)) !== null) {
    const symbol = match[1];
    if (!seen.has(symbol) && !reservedWords.includes(symbol.toLowerCase())) {
      seen.add(symbol);
      variables.push({
        symbol,
        latex: symbol,
        type: inferVariableType(latex, symbol),
      });
    }
  }

  return variables;
}

/**
 * 그리스 문자 심볼 반환
 */
function getGreekSymbol(name: string): string {
  const greekSymbols: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
    rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
    chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
    Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  };
  return greekSymbols[name] || name;
}

/**
 * 변수 타입 추론
 */
function inferVariableType(latex: string, symbol: string): Variable['type'] {
  // 볼드면 벡터/행렬
  if (latex.includes(`\\mathbf{${symbol}}`) || latex.includes(`\\boldsymbol{${symbol}}`)) {
    return 'vector';
  }
  // 대문자면 행렬일 가능성
  if (/^[A-Z]$/.test(symbol)) {
    return 'matrix';
  }
  // 소문자면 스칼라
  if (/^[a-z]$/.test(symbol)) {
    return 'scalar';
  }
  return 'unknown';
}

/**
 * 수식 역할 분류 (컨텍스트 기반)
 */
export function classifyFormulaRole(latex: string, context: string): { role: FormulaRole; confidence: number } {
  const contextLower = context.toLowerCase();

  // 키워드 기반 분류
  const rolePatterns: { role: FormulaRole; keywords: string[]; score: number }[] = [
    {
      role: 'definition',
      keywords: ['define', 'denote', 'let', 'given', 'where', 'is defined as', '정의'],
      score: 0,
    },
    {
      role: 'objective',
      keywords: ['minimize', 'maximize', 'loss', 'cost', 'objective', 'optimize', 'argmin', 'argmax', '목적', '손실'],
      score: 0,
    },
    {
      role: 'constraint',
      keywords: ['subject to', 'constraint', 's.t.', 'such that', 'satisfies', '제약', '조건'],
      score: 0,
    },
    {
      role: 'theorem',
      keywords: ['theorem', 'proposition', 'lemma', 'corollary', 'proof', 'prove', '정리', '명제'],
      score: 0,
    },
    {
      role: 'derivation',
      keywords: ['from', 'derive', 'follows', 'therefore', 'thus', 'hence', 'substituting', '유도', '따라서'],
      score: 0,
    },
    {
      role: 'approximation',
      keywords: ['approximately', 'approx', '≈', 'estimate', 'asymptotic', '근사'],
      score: 0,
    },
    {
      role: 'example',
      keywords: ['example', 'instance', 'for example', 'e.g.', 'such as', '예시', '예를 들어'],
      score: 0,
    },
    {
      role: 'baseline',
      keywords: ['baseline', 'previous', 'prior work', 'existing', 'traditional', '기준', '기존'],
      score: 0,
    },
  ];

  // 각 역할에 대한 점수 계산
  for (const pattern of rolePatterns) {
    for (const keyword of pattern.keywords) {
      if (contextLower.includes(keyword)) {
        pattern.score += 1;
      }
    }
  }

  // LaTeX 패턴 분석
  if (latex.includes('\\min') || latex.includes('\\max') || latex.includes('argmin') || latex.includes('argmax')) {
    rolePatterns.find(p => p.role === 'objective')!.score += 2;
  }
  if (latex.includes(':=') || latex.includes('\\triangleq')) {
    rolePatterns.find(p => p.role === 'definition')!.score += 2;
  }
  if (latex.includes('\\approx') || latex.includes('\\sim')) {
    rolePatterns.find(p => p.role === 'approximation')!.score += 2;
  }

  // 최고 점수 역할 선택
  rolePatterns.sort((a, b) => b.score - a.score);
  const best = rolePatterns[0];

  if (best.score === 0) {
    return { role: 'unknown', confidence: 0.3 };
  }

  const confidence = Math.min(0.9, 0.5 + best.score * 0.1);
  return { role: best.role, confidence };
}

/**
 * RawFormula를 Formula로 변환
 */
export function convertToFormula(
  raw: RawFormula,
  id: string,
  sectionName: string,
  pageNumber: number
): Formula {
  const variables = extractVariables(raw.latex);
  const { role, confidence } = classifyFormulaRole(raw.latex, raw.context);

  return {
    id,
    latex: raw.latex,
    type: raw.type,
    role,
    number: raw.number,
    context: raw.context,
    section: sectionName,
    pageNumber,
    variables,
    confidence,
  };
}
