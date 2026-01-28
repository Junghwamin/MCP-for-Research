import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), quiet: true } as any);

import type { GlossaryEntry } from '../types/translation.js';

// ============================================
// OpenAI GPT 기반 번역 클라이언트
// ============================================

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  // console.warn('WARNING: OPENAI_API_KEY is not set in environment variables.');
}

const openai = new OpenAI({
  apiKey: API_KEY || 'DUMMY_KEY',
});

// Use gpt-4o for high quality translation, or gpt-4o-mini for speed/cost
const MODEL_NAME = 'gpt-4o';

export type SamplingFunction = any; // Deprecated stub

// 번역 요청 인터페이스
interface TranslationRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  context?: string;
  sectionType?: string;
  glossary?: GlossaryEntry[];
  glossaryHints?: GlossaryEntry[]; // Backwards compatibility
  preserveTerms?: boolean;
}

// 요약 요청 인터페이스
interface SummaryRequest {
  abstract: string;
  introduction: string;
  conclusion: string;
  detailLevel: 'brief' | 'detailed';
  language: 'ko' | 'en';
  // Backwards compat fields
  text?: string;
  title?: string;
}

// ============================================
// 프롬프트 생성 함수들
// ============================================

function buildTranslationSystemPrompt(request: TranslationRequest): string {
  const targetLang = request.targetLanguage || 'ko';
  const languageName = targetLang === 'ko' ? 'Korean' : targetLang === 'en' ? 'English' : targetLang;

  let prompt = `You are a professional academic translator specializing in Quantum Computing, AI, and Physics.
Your task is to translate the provided text into natural, high-quality ${languageName} while preserving the original document's structure and academic tone.

**CRITICAL GUIDELINES:**

1.  **Format & Structure:**
    *   Output **clean, valid Markdown**.
    *   Preserve all headers (e.g., "I. INTRODUCTION") but translate their content (e.g., "I. 서론"). Use \`##\` for section headers.
    *   Maintain paragraph breaks exactly as in the original.
    *   Use bullet points (\`-\`) or numbered lists (\`1.\`) where appropriate.

2.  **Mathematics & Symbols:**
    *   **NEVER** translate mathematical variables (e.g., $x$, $\rho$, $\theta$). Keep them EXACTLY as is.
    *   Format all math expressions using LaTeX syntax enclosed in single dollar signs for inline (e.g., $\rho(x)$) or double dollar signs for blocks (e.g., $$H = \dots$$).
    *   Ensure equations are distinct and readable.

3.  **Terminology:**
    *   Use standard Korean academic terminology.
    *   **Keep specific key technical terms in English** where standard in the field (e.g., "Entanglement", "Superposition", "Qubit", "Fidelity", "Ansatz", "Kernel").
    *   Do NOT translate terms like "Transformer", "Attention", "Fine-tuning".

4.  **Tone:**
    *   Use a formal, polite, and objective academic tone (e.g., ending sentences with "~한다", "~이다", "~와 같다").
    *   Avoid colloquialisms.

5.  **Figures & Tables:**
    *   If you encounter figure captions (e.g., "FIG. 1"), translate the description clearly.
    *   Do not hallucinate or repeat captions at the end of the file.

Translate the following text segment, ensuring flow and coherence with the context provided.
`;

  if (request.preserveTerms !== false) {
    prompt += `
\n6. **Terminology Preservation (Strict):**
   - Keep the following terms (and similar ones) in English: [Quantum, Hamiltonian, Hilbert space, Hermitian, Unitary, POVM, Trace distance, Fidelity, Gradient descent, Bias-Variance, Overfitting, Generalization].
`;
  }

  const glossary = request.glossary || request.glossaryHints;
  if (glossary && glossary.length > 0) {
    prompt += '\n\n**Glossary (Use these translations):**\n';
    glossary.forEach(item => {
      prompt += `- ${item.term}: ${item.translation} (${item.definition || ''})\n`;
    });
  }

  if (request.context) {
    prompt += `\n\n**Previous Context:**\n...${request.context.slice(-1000)}...`;
  }

  return prompt;
}

function buildSummaryUserPrompt(request: SummaryRequest): string {
  const lang = request.language === 'ko' ? 'Korean' : 'English';

  if (request.text) {
    return `Analyze and summarize the following paper text in ${lang}:
${request.text.substring(0, 10000)}

Format requirements:
1. **threeLines**: 3 concise bullet points.
2. **keywords**: 5-7 key technical terms.
3. **contributions**: Main contributions.
4. **targetAudience**: Who should read this.

Return JSON ONLY:
{
  "threeLines": ["..."],
  "keywords": ["..."],
  "contributions": ["..."],
  "targetAudience": ["..."]
}`;
  }

  return `Please analyze the following paper sections and provide a structured summary in ${lang}.

Abstract:
${request.abstract}

Introduction (First 1000 chars):
${request.introduction.substring(0, 1000)}...

Conclusion (Last 1000 chars):
${request.conclusion.substring(0, 1000)}...

Format requirements:
Return ONLY a valid JSON object.
JSON Structure:
{
  "threeLines": ["Summary point 1", "Summary point 2", "Summary point 3"],
  "keywords": ["..."],
  "contributions": ["..."],
  "targetAudience": ["..."]
}
`;
}

// ============================================
// 메인 번역 함수
// ============================================

/**
 * 텍스트 번역 (OpenAI 사용)
 */
export async function translateText(
  request: TranslationRequest,
  _unused?: any
): Promise<string> {
  const systemPrompt = buildTranslationSystemPrompt(request);
  const userPrompt = request.text;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error('Translation error:', error);
    if (!API_KEY) return "Error: OPENAI_API_KEY not set.";
    throw error;
  }
}

/**
 * 논문 요약 생성 (OpenAI 사용)
 */
export async function generateSummary(
  request: SummaryRequest,
  _unused?: any
): Promise<{
  threeLines: string[];
  keywords: string[];
  contributions: string[];
  targetAudience: string[];
}> {
  const userPrompt = buildSummaryUserPrompt(request);

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: "You are a helpful research assistant. Return only JSON." },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content || "{}";

    try {
      const parsed = JSON.parse(responseText);
      return {
        threeLines: parsed.threeLines || parsed.summary || [],
        keywords: parsed.keywords || [],
        contributions: parsed.contributions || [parsed.keyContributions] || [],
        targetAudience: parsed.targetAudience || []
      };
    } catch (e) {
      console.error('JSON parsing failed:', responseText);
      return {
        threeLines: ['Failed to parse summary.'],
        keywords: [],
        contributions: [],
        targetAudience: []
      };
    }

  } catch (error) {
    if (!API_KEY) return {
      threeLines: ['Error: OPENAI_API_KEY not set.'],
      keywords: [],
      contributions: [],
      targetAudience: []
    };
    throw error;
  }
}

/**
 * 캡션 번역 (OpenAI 사용)
 */
export async function translateCaption(
  caption: string,
  type: 'figure' | 'table',
  _unused?: any,
  targetLang: string = 'ko'
): Promise<string> {
  if (!API_KEY) return caption;

  const prompt = `Translate the following ${type} caption to ${targetLang === 'ko' ? 'Korean' : 'English'}.
Keep it concise and professional. Do not translate technical variable names or symbols.
Return ONLY the translation.

Caption: "${caption}"`;

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: "You are a technical translator." },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });
    return (completion.choices[0].message.content || "").trim();
  } catch (error) {
    return caption;
  }
}

export { getLanguageName };

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    zh: '중국어',
  };
  return langMap[langCode] || '한국어';
}
