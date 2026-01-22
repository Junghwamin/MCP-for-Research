import Anthropic from '@anthropic-ai/sdk';
import type { GlossaryEntry } from '../types/translation.js';

// ============================================
// Claude API 번역 클라이언트
// ============================================

const client = new Anthropic();

// 번역 요청 인터페이스
interface TranslationRequest {
  text: string;
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh';
  context?: string;               // 이전 섹션 컨텍스트
  sectionType?: string;           // 섹션 유형 (abstract, introduction 등)
  glossaryHints?: GlossaryEntry[];
  preserveTerms?: boolean;
}

// 요약 요청 인터페이스
interface SummaryRequest {
  text: string;
  title?: string;
  language: 'ko' | 'en';
  detailLevel: 'brief' | 'detailed';
}

/**
 * 텍스트 번역
 */
export async function translateText(request: TranslationRequest): Promise<string> {
  const systemPrompt = buildTranslationSystemPrompt(request);
  const userPrompt = buildTranslationUserPrompt(request);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    if (response.content[0].type === 'text') {
      return response.content[0].text;
    }

    throw new Error('Unexpected response format');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 논문 요약 생성
 */
export async function generateSummary(request: SummaryRequest): Promise<{
  threeLines: string[];
  keywords: string[];
  contributions: string[];
  targetAudience: string[];
}> {
  const systemPrompt = buildSummarySystemPrompt(request);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `다음 논문의 내용을 분석하고 요약해주세요:\n\n제목: ${request.title || '(제목 없음)'}\n\n내용:\n${request.text.slice(0, 15000)}`, // 토큰 제한
        },
      ],
    });

    if (response.content[0].type === 'text') {
      return parseSummaryResponse(response.content[0].text);
    }

    throw new Error('Unexpected response format');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Summary generation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 캡션 번역 (Figure/Table)
 */
export async function translateCaption(
  caption: string,
  type: 'figure' | 'table',
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh' = 'ko'
): Promise<string> {
  const langName = getLanguageName(targetLanguage);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `당신은 학술 논문 번역 전문가입니다. ${type === 'figure' ? 'Figure' : 'Table'} 캡션을 ${langName}로 번역합니다.
번역 규칙:
- 간결하고 명확하게 번역
- 전문 용어는 원어를 괄호 안에 병기 (예: 어텐션(Attention))
- 번역문만 출력 (설명 없이)`,
      messages: [
        {
          role: 'user',
          content: `다음 캡션을 번역해주세요:\n${caption}`,
        },
      ],
    });

    if (response.content[0].type === 'text') {
      return response.content[0].text.trim();
    }

    return caption; // 실패 시 원문 반환
  } catch {
    return caption;
  }
}

/**
 * 번역 시스템 프롬프트 생성
 */
function buildTranslationSystemPrompt(request: TranslationRequest): string {
  const langName = getLanguageName(request.targetLanguage);

  let prompt = `당신은 AI/ML 분야 학술 논문 번역 전문가입니다. 논문을 ${langName}로 정확하고 자연스럽게 번역합니다.

## 번역 규칙

### 기본 규칙
1. 학술적 문체를 유지하면서 자연스러운 ${langName}로 번역
2. 원문의 의미를 정확하게 전달
3. 단락 구조와 문장 흐름 유지

### 수식 및 기호 처리
1. LaTeX 수식 ($...$, \\[...\\]) 은 그대로 유지
2. 변수명, 수학 기호는 원문 그대로 사용
3. 그리스 문자 (α, β, γ 등)는 그대로 유지

### 참조 처리
1. Figure/Table 참조는 원문 형식 유지 (예: Figure 1, Table 2)
2. 논문 인용 [1], [2] 등은 그대로 유지
3. 수식 번호 (1), (2) 등은 그대로 유지`;

  // 전문 용어 처리
  if (request.preserveTerms !== false) {
    prompt += `

### 전문 용어 처리
- 핵심 AI/ML 용어는 영어를 유지하고 필요시 한글 병기
- 예시: Transformer, Attention, Embedding, Fine-tuning
- 일반적인 용어는 번역: neural network → 신경망, training → 학습`;
  }

  // 용어집 힌트
  if (request.glossaryHints && request.glossaryHints.length > 0) {
    prompt += `

### 용어집 (이 용어들은 다음과 같이 번역해주세요)`;
    for (const entry of request.glossaryHints) {
      if (entry.preserveOriginal) {
        prompt += `\n- ${entry.term}: ${entry.term} (원어 유지)`;
      } else {
        prompt += `\n- ${entry.term}: ${entry.translation}`;
      }
    }
  }

  // 섹션별 지침
  if (request.sectionType) {
    const sectionGuidelines = getSectionGuidelines(request.sectionType);
    if (sectionGuidelines) {
      prompt += `\n\n### 현재 섹션 (${request.sectionType}) 번역 지침\n${sectionGuidelines}`;
    }
  }

  prompt += `

## 출력 형식
- 번역문만 출력 (설명이나 주석 없이)
- 원문의 단락 구분 유지
- 마크다운 형식 지원 (필요시 **강조**, *이탤릭* 사용)`;

  return prompt;
}

/**
 * 번역 사용자 프롬프트 생성
 */
function buildTranslationUserPrompt(request: TranslationRequest): string {
  let prompt = '';

  if (request.context) {
    prompt += `[이전 문맥]\n${request.context.slice(-500)}\n\n`;
  }

  prompt += `다음 텍스트를 번역해주세요:\n\n${request.text}`;

  return prompt;
}

/**
 * 요약 시스템 프롬프트 생성
 */
function buildSummarySystemPrompt(request: SummaryRequest): string {
  const langName = getLanguageName(request.language);

  return `당신은 AI/ML 논문 분석 전문가입니다. 논문을 분석하고 ${langName}로 요약합니다.

## 출력 형식 (JSON)
다음 형식으로 정확히 출력해주세요:

{
  "threeLines": [
    "핵심 내용 1",
    "핵심 내용 2",
    "핵심 내용 3"
  ],
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "contributions": [
    "주요 기여점 1",
    "주요 기여점 2",
    "주요 기여점 3"
  ],
  "targetAudience": [
    "이 논문을 읽어야 할 사람 1",
    "이 논문을 읽어야 할 사람 2"
  ]
}

## 규칙
- threeLines: 논문의 핵심을 3문장으로 요약 (각 문장은 1-2줄)
- keywords: 핵심 기술/개념 키워드 5개
- contributions: 논문의 주요 기여점/새로운 점
- targetAudience: 이 논문이 유용할 대상

JSON만 출력하세요.`;
}

/**
 * 요약 응답 파싱
 */
function parseSummaryResponse(response: string): {
  threeLines: string[];
  keywords: string[];
  contributions: string[];
  targetAudience: string[];
} {
  try {
    // JSON 부분만 추출
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        threeLines: parsed.threeLines || [],
        keywords: parsed.keywords || [],
        contributions: parsed.contributions || [],
        targetAudience: parsed.targetAudience || [],
      };
    }
  } catch {
    // JSON 파싱 실패 시 기본값
  }

  return {
    threeLines: ['요약을 생성할 수 없습니다.'],
    keywords: [],
    contributions: [],
    targetAudience: [],
  };
}

/**
 * 섹션별 번역 지침
 */
function getSectionGuidelines(sectionType: string): string | null {
  const guidelines: Record<string, string> = {
    abstract: '- 간결하고 명확하게 번역\n- 핵심 기여점과 결과가 잘 드러나도록',
    introduction: '- 연구 동기와 배경이 자연스럽게 전달되도록\n- 논문의 흐름을 설명하는 부분 명확하게',
    'related work': '- 기존 연구 인용 형식 유지\n- 비교/대조 표현 자연스럽게',
    method: '- 기술적 설명의 정확성 유지\n- 알고리즘/수식 설명 명확하게',
    methods: '- 기술적 설명의 정확성 유지\n- 알고리즘/수식 설명 명확하게',
    experiment: '- 실험 설정과 조건 정확하게\n- 비교 실험 결과 명확하게',
    experiments: '- 실험 설정과 조건 정확하게\n- 비교 실험 결과 명확하게',
    results: '- 수치와 결과 정확하게 전달\n- 비교 분석 내용 명확하게',
    discussion: '- 분석과 해석 자연스럽게\n- 한계점과 향후 연구 방향 명확하게',
    conclusion: '- 핵심 기여점 강조\n- 간결하게 마무리',
  };

  const lower = sectionType.toLowerCase();
  return guidelines[lower] || null;
}

/**
 * 언어 코드를 언어 이름으로 변환
 */
function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    zh: '중국어',
  };
  return langMap[langCode] || '한국어';
}

export { getLanguageName };
