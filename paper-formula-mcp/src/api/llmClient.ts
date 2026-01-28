import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import type {
  Formula,
  FormulaExplanation,
  ComponentExplanation,
} from '../types/formula.js';
import type { Concept, ConceptRelation, PaperRelation } from '../types/diagram.js';
import type { TextbookLevel, TextbookLanguage, TextbookStyle } from '../types/textbook.js';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================
// OpenAI 클라이언트 설정
// ============================================

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL_NAME = 'gpt-4o';

const openai = new OpenAI({
  apiKey: API_KEY || 'DUMMY_KEY',
});

// ============================================
// 수식 설명 생성
// ============================================

export async function explainFormulaWithLLM(
  formula: Formula,
  language: 'ko' | 'en' = 'ko',
  detailLevel: 'brief' | 'detailed' | 'educational' = 'detailed'
): Promise<FormulaExplanation> {
  if (!API_KEY) {
    return createFallbackExplanation(formula, language);
  }

  const langName = language === 'ko' ? 'Korean' : 'English';

  const systemPrompt = `You are an expert mathematician and academic paper analyst.
You explain mathematical formulas clearly and accurately in ${langName}.

IMPORTANT GUIDELINES:
1. Keep mathematical symbols in LaTeX format
2. Explain both the mathematical meaning and intuitive understanding
3. Identify the formula's role in the paper (definition, objective, theorem, etc.)
4. Be precise but accessible`;

  const detailInstructions = {
    brief: 'Provide a concise explanation in 2-3 sentences.',
    detailed: 'Provide a comprehensive explanation covering all aspects.',
    educational: 'Explain as if teaching to a graduate student, with examples.',
  };

  const userPrompt = `Analyze the following mathematical formula and explain it in ${langName}.

Formula (LaTeX): ${formula.latex}
Context: ${formula.context}
Section: ${formula.section}
Variables found: ${formula.variables.map(v => v.symbol).join(', ')}

${detailInstructions[detailLevel]}

Return a JSON object with this exact structure:
{
  "summary": "One-line summary of what this formula does",
  "components": [
    {"symbol": "x", "latex": "x", "explanation": "Input variable", "type": "variable"}
  ],
  "meaning": "Full explanation of the formula's meaning",
  "intuition": "Intuitive understanding / analogy",
  "role": "Role in the paper (e.g., defines the loss function)",
  "relatedFormulas": ["eq1", "eq2"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    return {
      summary: parsed.summary || '',
      components: (parsed.components || []).map((c: any) => ({
        symbol: c.symbol,
        latex: c.latex,
        explanation: c.explanation,
        type: c.type || 'variable',
      })),
      meaning: parsed.meaning || '',
      intuition: parsed.intuition || '',
      role: parsed.role || '',
      relatedFormulas: parsed.relatedFormulas || [],
    };
  } catch (error) {
    console.error('LLM explanation error:', error);
    return createFallbackExplanation(formula, language);
  }
}

function createFallbackExplanation(formula: Formula, language: 'ko' | 'en'): FormulaExplanation {
  const isKorean = language === 'ko';

  return {
    summary: isKorean
      ? `수식 ${formula.id}: ${formula.role} 유형의 수식`
      : `Formula ${formula.id}: A ${formula.role} type formula`,
    components: formula.variables.map(v => ({
      symbol: v.symbol,
      latex: v.latex,
      explanation: v.meaning || (isKorean ? '변수' : 'Variable'),
      type: 'variable' as const,
    })),
    meaning: isKorean
      ? 'API 키가 설정되지 않아 상세 설명을 생성할 수 없습니다.'
      : 'API key not set, unable to generate detailed explanation.',
    intuition: '',
    role: formula.role,
    relatedFormulas: [],
  };
}

// ============================================
// 개념 추출
// ============================================

export async function extractConceptsWithLLM(
  text: string,
  maxConcepts: number = 20
): Promise<Concept[]> {
  if (!API_KEY) {
    return [];
  }

  const systemPrompt = `You are an expert at analyzing academic papers.
Extract key concepts from the text, identifying:
- Novel concepts proposed by the paper
- Existing foundational concepts used
- Methods, metrics, and datasets mentioned`;

  const userPrompt = `Extract up to ${maxConcepts} key concepts from this text:

${text.substring(0, 8000)}

Return a JSON array with this structure:
[
  {
    "id": "concept_1",
    "name": "Attention Mechanism",
    "koreanName": "어텐션 메커니즘",
    "definition": "Brief definition",
    "type": "existing",
    "importance": "high"
  }
]

Types: "proposed" | "existing" | "method" | "metric" | "dataset"
Importance: "high" | "medium" | "low"`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    return (parsed.concepts || parsed || []).slice(0, maxConcepts);
  } catch (error) {
    console.error('Concept extraction error:', error);
    return [];
  }
}

// ============================================
// 개념 관계 분석
// ============================================

export async function analyzeConceptRelationsWithLLM(
  concepts: Concept[],
  context: string
): Promise<ConceptRelation[]> {
  if (!API_KEY || concepts.length < 2) {
    return [];
  }

  const conceptList = concepts.map(c => `- ${c.name} (${c.type}): ${c.definition || ''}`).join('\n');

  const userPrompt = `Given these concepts from a paper:
${conceptList}

Context:
${context.substring(0, 4000)}

Identify relationships between concepts:
- is_a: A is a type of B
- part_of: A is a component of B
- uses: A uses/applies B
- extends: A extends/improves B
- compared_to: A is compared with B
- derives_from: A is derived from B

Return a JSON array:
[
  {"source": "concept_1", "target": "concept_2", "type": "extends", "label": "improves upon"}
]`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: 'You are an expert at identifying conceptual relationships in academic papers.' },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    return parsed.relations || parsed || [];
  } catch (error) {
    console.error('Relation analysis error:', error);
    return [];
  }
}

// ============================================
// 논문 관계 분석
// ============================================

export interface PaperInfo {
  id: string;
  title: string;
  abstract?: string;
  year?: number;
}

export async function analyzePaperRelationsWithLLM(
  mainPaper: PaperInfo,
  relatedPapers: PaperInfo[]
): Promise<{ relations: PaperRelation[]; methodEvolution: string }> {
  if (!API_KEY || relatedPapers.length === 0) {
    return { relations: [], methodEvolution: '' };
  }

  const relatedList = relatedPapers
    .map(p => `- ${p.title} (${p.year || 'unknown'}): ${(p.abstract || '').substring(0, 200)}...`)
    .join('\n');

  const userPrompt = `Analyze the relationship between papers.

Main paper:
- Title: ${mainPaper.title}
- Year: ${mainPaper.year || 'unknown'}
- Abstract: ${(mainPaper.abstract || '').substring(0, 500)}

Related papers:
${relatedList}

For each related paper, determine:
- Relation type: "extends" | "improves" | "compares" | "applies" | "cites" | "baseline"
- Brief description of the relationship

Also explain how methodology evolved across these papers.

Return JSON:
{
  "relations": [
    {"source": "main", "target": "paper_id", "type": "extends", "description": "..."}
  ],
  "methodEvolution": "Description of how methods evolved..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: 'You are an expert at analyzing academic paper relationships and research evolution.' },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    return {
      relations: parsed.relations || [],
      methodEvolution: parsed.methodEvolution || '',
    };
  } catch (error) {
    console.error('Paper relation analysis error:', error);
    return { relations: [], methodEvolution: '' };
  }
}

// ============================================
// 수식 의존성 분석 (LLM 보조)
// ============================================

export async function analyzeFormulaDependenciesWithLLM(
  formulas: Formula[]
): Promise<{ from: string; to: string; type: string; description: string }[]> {
  if (!API_KEY || formulas.length < 2) {
    return [];
  }

  const formulaList = formulas
    .slice(0, 20) // 최대 20개
    .map(f => `- ${f.id}: ${f.latex.substring(0, 100)}... (${f.role})`)
    .join('\n');

  const userPrompt = `Analyze dependencies between these formulas:

${formulaList}

Identify which formulas depend on others (uses variables defined in, derived from, substitutes into, etc.)

Return JSON:
{
  "dependencies": [
    {"from": "eq1", "to": "eq2", "type": "uses_variable", "description": "eq2 uses variable x defined in eq1"}
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: 'You are an expert at analyzing mathematical formula dependencies.' },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || '{}';
    const parsed = JSON.parse(responseText);

    return parsed.dependencies || [];
  } catch (error) {
    console.error('Formula dependency analysis error:', error);
    return [];
  }
}

// ============================================
// 역할 흐름 분석
// ============================================

export async function analyzeRoleFlowWithLLM(
  formulas: Formula[]
): Promise<string> {
  if (!API_KEY || formulas.length < 2) {
    return '';
  }

  const formulaList = formulas
    .slice(0, 30)
    .map(f => `- ${f.id} [${f.role}]: ${f.latex.substring(0, 80)}...`)
    .join('\n');

  const userPrompt = `Analyze the logical flow of these formulas in the paper:

${formulaList}

Describe how the formulas build upon each other:
1. What definitions are established first?
2. What is the main objective/theorem?
3. How do derivations connect them?

Return a concise paragraph (3-5 sentences) in Korean describing the logical flow.`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: 'You are an expert at understanding the logical structure of mathematical papers.' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Role flow analysis error:', error);
    return '';
  }
}

// ============================================
// 교과서 생성
// ============================================

export interface GenerateTextbookLLMInput {
  paperTitle: string;
  formulas: Formula[];
  targetLevel: TextbookLevel;
  language: TextbookLanguage;
  maxChapters: number;
  includeExercises: boolean;
  includeExamples: boolean;
  style?: TextbookStyle;
}

export async function generateTextbookWithLLM(input: GenerateTextbookLLMInput): Promise<string> {
  if (!API_KEY) {
    return createFallbackTextbook(input);
  }

  const {
    paperTitle,
    formulas,
    targetLevel,
    language,
    maxChapters,
    includeExercises,
    includeExamples,
    style = 'friendly',
  } = input;

  const langName = language === 'ko' ? 'Korean' : 'English';

  // 수식 요약 준비
  const formulaSummary = formulas
    .slice(0, 30)
    .map(f => {
      const vars = f.variables.map(v => v.symbol).join(', ');
      return `- [${f.id}] (${f.role}) LaTeX: ${f.latex.substring(0, 120)}${f.latex.length > 120 ? '...' : ''}\n  Context: ${f.context.substring(0, 150)}${f.context.length > 150 ? '...' : ''}\n  Variables: ${vars}`;
    })
    .join('\n');

  // 수준별 가이드
  const levelGuide: Record<TextbookLevel, string> = {
    auto: `Build the textbook progressively from elementary school to graduate level.
Start with basic arithmetic concepts, then vectors, matrices, probability, and build up to the paper's formulas.
Each chapter should target a higher education level:
- Chapters 1-2: Elementary school (ages 10-12) - Use analogies, simple numbers, real-world examples
- Chapters 3-4: Middle school (ages 13-15) - Basic algebra, functions, vectors
- Chapters 5-6: High school (ages 16-18) - Calculus basics, matrices, probability, complex numbers
- Chapters 7+: University/Graduate - Full mathematical formalism connecting to the paper`,
    elementary: 'Write for 10-12 year olds. Use only basic arithmetic. Explain with real-world analogies and pictures.',
    middle: 'Write for 13-15 year olds. Use basic algebra and geometry. Introduce functions and simple probability.',
    high: 'Write for 16-18 year olds. Use calculus, matrices, trigonometry. Build mathematical intuition.',
    undergraduate: 'Write for university students. Use linear algebra, probability theory, optimization concepts.',
    graduate: 'Write for graduate students. Use advanced math directly. Focus on the paper\'s contributions.',
  };

  // 스타일 가이드
  const styleGuide: Record<TextbookStyle, string> = {
    friendly: `Use a warm, conversational tone ("~해요" style in Korean, "Let's explore..." in English).
Include analogies and metaphors. Make complex ideas feel approachable.
Use occasional ASCII art or simple diagrams to illustrate points.`,
    formal: `Use formal academic language. Follow traditional textbook structure with theorems, proofs, and corollaries.
Be precise and rigorous in mathematical statements.`,
    visual: `Emphasize visual explanations. Include ASCII art diagrams, tables, and step-by-step visual breakdowns.
Every concept should have a visual representation. Use box-drawing characters for diagrams.`,
    'step-by-step': `Break every formula and derivation into numbered micro-steps.
Show every intermediate calculation. Never skip a step.
Format: Step 1 → Step 2 → ... → Final Result.`,
  };

  const exerciseGuide = includeExercises
    ? `CRITICAL REQUIREMENT FOR EXERCISES:
Each chapter MUST end with 2-4 exercises.
EVERY exercise MUST include ALL of the following:
1. The question (clearly stated)
2. "풀이과정:" (or "Solution Process:" in English) - Show the COMPLETE step-by-step solution process
3. "답:" (or "Answer:" in English) - State the final answer clearly

Example exercise format:
---
**연습문제 1.** 벡터 (3, 4)의 길이를 구하세요.

**풀이과정:**
1. 벡터의 길이 공식: $||v|| = \\sqrt{x^2 + y^2}$
2. 대입: $||v|| = \\sqrt{3^2 + 4^2}$
3. 계산: $= \\sqrt{9 + 16} = \\sqrt{25}$
4. 결과: $= 5$

**답:** 5
---
NEVER provide an exercise without its full solution process and answer.`
    : 'Do NOT include exercises.';

  const exampleGuide = includeExamples
    ? `Include 1-2 worked examples per section with concrete numbers.
Show the full calculation process step by step.`
    : '';

  const systemPrompt = `You are a world-class textbook author who makes complex academic papers accessible to anyone.
You are writing a textbook in ${langName} based on a research paper.

${styleGuide[style]}

IMPORTANT RULES:
1. Write in Markdown format
2. Use LaTeX notation for ALL mathematical formulas ($$...$$ for display, $...$ for inline)
3. Each chapter must have clear learning goals at the beginning
4. Connect each chapter to the paper's formulas naturally
5. Use ASCII art or simple diagrams where helpful
6. ${exerciseGuide}
7. ${exampleGuide}
8. Include a glossary at the end
9. At the end of each chapter, explicitly state which formula from the paper was covered
10. Never make mathematical errors - verify all calculations`;

  const userPrompt = `Create a textbook based on this research paper.

**Paper Title**: ${paperTitle}

**Key Formulas**:
${formulaSummary}

**Configuration**:
- Target level: ${targetLevel}
- ${levelGuide[targetLevel]}
- Maximum chapters: ${maxChapters}
- Language: ${langName}

Write a complete textbook with ${maxChapters} chapters that builds up from foundational concepts to understanding all the key formulas in this paper.

Each chapter should:
1. Start with learning goals
2. Introduce concepts with clear explanations
3. Build up to one or more formulas from the paper
4. ${includeExamples ? 'Include worked examples with full calculations' : ''}
5. ${includeExercises ? 'End with exercises that have COMPLETE solution processes and final answers' : ''}

The textbook should feel like a journey from "I know nothing" to "I understand this paper's math."`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16000,
    });

    const content = completion.choices[0].message.content || '';

    if (content.length < 200) {
      return createFallbackTextbook(input);
    }

    return content;
  } catch (error) {
    console.error('Textbook generation error:', error);
    return createFallbackTextbook(input);
  }
}

/**
 * API 키 없을 때 기본 교과서 생성
 */
function createFallbackTextbook(input: GenerateTextbookLLMInput): string {
  const isKorean = input.language === 'ko';
  const formulas = input.formulas;

  const lines: string[] = [];

  if (isKorean) {
    lines.push(`# 📖 ${input.paperTitle} - 학습 교과서`);
    lines.push('');
    lines.push('> ⚠️ API 키가 설정되지 않아 기본 구조만 생성되었습니다.');
    lines.push('> OPENAI_API_KEY를 .env 파일에 설정하면 상세한 교과서가 생성됩니다.');
    lines.push('');
    lines.push('---');
    lines.push('');

    // 기본 장 구조
    lines.push('## 1장: 기초 개념');
    lines.push('');
    lines.push('이 장에서는 논문을 이해하기 위한 기본 개념을 소개합니다.');
    lines.push('');

    // 수식별 장 생성
    const roleOrder = ['definition', 'objective', 'theorem', 'derivation', 'constraint', 'approximation'];
    let chapterNum = 2;

    for (const role of roleOrder) {
      const roleFormulas = formulas.filter(f => f.role === role);
      if (roleFormulas.length === 0) continue;

      const roleName: Record<string, string> = {
        definition: '정의',
        objective: '목적 함수',
        theorem: '정리',
        derivation: '유도',
        constraint: '제약 조건',
        approximation: '근사',
      };

      lines.push(`## ${chapterNum}장: ${roleName[role] || role}`);
      lines.push('');

      for (const f of roleFormulas.slice(0, 5)) {
        lines.push(`### 수식 ${f.id}`);
        lines.push('');
        lines.push(`$$${f.latex}$$`);
        lines.push('');
        lines.push(`> ${f.context.substring(0, 200)}`);
        lines.push('');

        if (f.variables.length > 0) {
          lines.push('**변수:**');
          for (const v of f.variables) {
            lines.push(`- $${v.latex}$ (${v.symbol}): ${v.meaning || '설명 필요'}`);
          }
          lines.push('');
        }
      }

      chapterNum++;
    }

    lines.push('## 용어 사전');
    lines.push('');
    const allVars = new Set<string>();
    for (const f of formulas) {
      for (const v of f.variables) {
        allVars.add(`| $${v.latex}$ | ${v.meaning || v.symbol} |`);
      }
    }
    lines.push('| 기호 | 의미 |');
    lines.push('|------|------|');
    for (const v of [...allVars].slice(0, 30)) {
      lines.push(v);
    }
  } else {
    lines.push(`# 📖 ${input.paperTitle} - Learning Textbook`);
    lines.push('');
    lines.push('> ⚠️ No API key configured. Only basic structure generated.');
    lines.push('> Set OPENAI_API_KEY in .env for detailed content.');
  }

  return lines.join('\n');
}
