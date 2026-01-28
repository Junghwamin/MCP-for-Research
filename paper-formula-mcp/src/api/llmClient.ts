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
