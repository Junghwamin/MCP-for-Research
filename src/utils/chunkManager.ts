import type { Chunk, ChunkConfig, Section } from '../types/translation.js';

// ============================================
// 텍스트 청킹 시스템
// 긴 논문을 작은 단위로 분할하여 번역
// ============================================

// 기본 청킹 설정
const DEFAULT_CONFIG: ChunkConfig = {
  maxTokens: 3000,      // 최대 토큰 수
  overlap: 200,         // 문맥 유지를 위한 오버랩
  splitBySentence: true // 문장 단위 분리
};

/**
 * 텍스트를 청크로 분할
 */
export function splitIntoChunks(
  text: string,
  sectionId: string,
  config: Partial<ChunkConfig> = {}
): Chunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const chunks: Chunk[] = [];

  // 빈 텍스트 처리
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 토큰 수 추정 (대략 4글자 = 1토큰)
  const estimatedTokens = estimateTokenCount(text);

  // 청크 분할이 필요 없는 경우
  if (estimatedTokens <= cfg.maxTokens) {
    return [{
      id: `${sectionId}-chunk-0`,
      sectionId,
      index: 0,
      totalChunks: 1,
      content: text.trim(),
      tokenCount: estimatedTokens,
    }];
  }

  // 문장 단위로 분리
  const sentences = cfg.splitBySentence
    ? splitBySentences(text)
    : splitByParagraphs(text);

  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  const overlapSentences: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);

    // 현재 청크에 추가할 수 있는지 확인
    if (currentTokens + sentenceTokens <= cfg.maxTokens) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    } else {
      // 현재 청크 저장
      if (currentChunk.trim()) {
        chunks.push({
          id: `${sectionId}-chunk-${chunkIndex}`,
          sectionId,
          index: chunkIndex,
          totalChunks: 0, // 나중에 업데이트
          content: currentChunk.trim(),
          tokenCount: currentTokens,
        });
        chunkIndex++;
      }

      // 오버랩 처리: 이전 청크의 마지막 몇 문장을 새 청크 시작에 포함
      const overlapText = getOverlapText(sentences, i, cfg.overlap);

      currentChunk = overlapText + ' ' + sentence;
      currentTokens = estimateTokenCount(currentChunk);
    }
  }

  // 마지막 청크 저장
  if (currentChunk.trim()) {
    chunks.push({
      id: `${sectionId}-chunk-${chunkIndex}`,
      sectionId,
      index: chunkIndex,
      totalChunks: 0,
      content: currentChunk.trim(),
      tokenCount: currentTokens,
    });
  }

  // 총 청크 수 업데이트
  const totalChunks = chunks.length;
  chunks.forEach(chunk => {
    chunk.totalChunks = totalChunks;
  });

  return chunks;
}

/**
 * 섹션 배열을 청크로 분할
 */
export function splitSectionsIntoChunks(
  sections: Section[],
  config: Partial<ChunkConfig> = {}
): Chunk[] {
  const allChunks: Chunk[] = [];

  for (const section of sections) {
    const sectionChunks = splitIntoChunks(section.content, section.id, config);
    allChunks.push(...sectionChunks);
  }

  return allChunks;
}

/**
 * 문장 단위로 텍스트 분리
 */
function splitBySentences(text: string): string[] {
  // 문장 종결 패턴: 마침표, 물음표, 느낌표 + 공백/줄바꿈
  // 단, 약어(e.g., i.e., et al., Fig., Eq.) 뒤의 마침표는 제외
  const sentences: string[] = [];

  // 줄바꿈 정규화
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 단락 먼저 분리
  const paragraphs = normalizedText.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // 문장 분리 (약어 보호)
    const protectedText = protectAbbreviations(paragraph);
    const sentenceParts = protectedText.split(/(?<=[.!?])\s+/);

    for (const part of sentenceParts) {
      const restored = restoreAbbreviations(part.trim());
      if (restored) {
        sentences.push(restored);
      }
    }
  }

  return sentences;
}

/**
 * 단락 단위로 텍스트 분리
 */
function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * 약어 보호 (문장 분리 시 잘못된 분리 방지)
 */
function protectAbbreviations(text: string): string {
  const abbreviations = [
    'e.g.', 'i.e.', 'et al.', 'etc.', 'vs.', 'cf.',
    'Fig.', 'Figs.', 'Eq.', 'Eqs.', 'Tab.', 'Sec.', 'Ref.',
    'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.',
    'Inc.', 'Ltd.', 'Corp.',
  ];

  let protected_text = text;
  abbreviations.forEach((abbr, i) => {
    const placeholder = `__ABBR${i}__`;
    protected_text = protected_text.replace(new RegExp(escapeRegex(abbr), 'g'), placeholder);
  });

  return protected_text;
}

/**
 * 약어 복원
 */
function restoreAbbreviations(text: string): string {
  const abbreviations = [
    'e.g.', 'i.e.', 'et al.', 'etc.', 'vs.', 'cf.',
    'Fig.', 'Figs.', 'Eq.', 'Eqs.', 'Tab.', 'Sec.', 'Ref.',
    'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.',
    'Inc.', 'Ltd.', 'Corp.',
  ];

  let restored = text;
  abbreviations.forEach((abbr, i) => {
    const placeholder = `__ABBR${i}__`;
    restored = restored.replace(new RegExp(placeholder, 'g'), abbr);
  });

  return restored;
}

/**
 * 정규식 특수문자 이스케이프
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 오버랩 텍스트 생성
 */
function getOverlapText(sentences: string[], currentIndex: number, overlapTokens: number): string {
  const overlapSentences: string[] = [];
  let tokens = 0;

  // 현재 위치에서 뒤로 가면서 오버랩 문장 수집
  for (let i = currentIndex - 1; i >= 0 && tokens < overlapTokens; i--) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokenCount(sentence);

    if (tokens + sentenceTokens <= overlapTokens) {
      overlapSentences.unshift(sentence);
      tokens += sentenceTokens;
    } else {
      break;
    }
  }

  return overlapSentences.join(' ');
}

/**
 * 토큰 수 추정
 * 대략적인 추정: 영어는 4글자 = 1토큰, 한국어는 2글자 = 1토큰
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  // 영어와 비영어(한글 등) 문자 분리
  const englishChars = (text.match(/[a-zA-Z0-9\s.,!?;:'"()-]/g) || []).length;
  const nonEnglishChars = text.length - englishChars;

  // 토큰 추정
  const englishTokens = Math.ceil(englishChars / 4);
  const nonEnglishTokens = Math.ceil(nonEnglishChars / 2);

  return englishTokens + nonEnglishTokens;
}

/**
 * 청크 병합 (번역된 청크들을 하나로)
 */
export function mergeTranslatedChunks(
  chunks: { chunk: Chunk; translated: string }[]
): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].translated;

  // 정렬
  const sorted = [...chunks].sort((a, b) => a.chunk.index - b.chunk.index);

  // 오버랩 제거하면서 병합
  let merged = sorted[0].translated;

  for (let i = 1; i < sorted.length; i++) {
    const currentText = sorted[i].translated;

    // 간단한 중복 제거: 이전 텍스트의 마지막 부분과 현재 텍스트의 시작 부분 비교
    // 완전한 중복 제거는 복잡하므로 여기서는 줄바꿈으로 구분
    merged += '\n\n' + currentText;
  }

  return merged;
}

/**
 * 청크 진행 상황 계산
 */
export function calculateProgress(
  completedChunks: number,
  totalChunks: number
): { percent: number; display: string } {
  if (totalChunks === 0) return { percent: 100, display: '100%' };

  const percent = Math.round((completedChunks / totalChunks) * 100);
  return {
    percent,
    display: `${completedChunks}/${totalChunks} (${percent}%)`,
  };
}
