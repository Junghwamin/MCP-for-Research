import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { Glossary, GlossaryEntry, GlossaryCategory } from '../types/translation.js';

// ============================================
// AI/ML 용어집 관리
// ============================================

// 기본 내장 용어집
const DEFAULT_GLOSSARY: Glossary = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString().split('T')[0],
  entries: [
    // Transformer & Attention
    { term: 'Transformer', translation: '트랜스포머', category: 'transformer', preserveOriginal: true, frequency: 'high' },
    { term: 'Attention', translation: '어텐션', category: 'transformer', preserveOriginal: true, frequency: 'high' },
    { term: 'Self-Attention', translation: '셀프 어텐션', category: 'transformer', preserveOriginal: true, frequency: 'high' },
    { term: 'Multi-Head Attention', translation: '멀티헤드 어텐션', category: 'transformer', preserveOriginal: true, frequency: 'high' },
    { term: 'Cross-Attention', translation: '크로스 어텐션', category: 'transformer', preserveOriginal: true, frequency: 'medium' },
    { term: 'Positional Encoding', translation: '위치 인코딩', category: 'transformer', preserveOriginal: true, frequency: 'high' },

    // Neural Network Basics
    { term: 'Neural Network', translation: '신경망', category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'Deep Learning', translation: '딥러닝', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'Machine Learning', translation: '머신러닝', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'Convolutional Neural Network', translation: '합성곱 신경망', aliases: ['CNN'], category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'Recurrent Neural Network', translation: '순환 신경망', aliases: ['RNN'], category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'LSTM', translation: 'LSTM', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'GRU', translation: 'GRU', category: 'neural_network', preserveOriginal: true, frequency: 'medium' },
    { term: 'Feedforward', translation: '순방향', category: 'neural_network', preserveOriginal: false, frequency: 'medium' },
    { term: 'Backpropagation', translation: '역전파', category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'Activation Function', translation: '활성화 함수', category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'ReLU', translation: 'ReLU', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'Sigmoid', translation: '시그모이드', category: 'neural_network', preserveOriginal: true, frequency: 'medium' },
    { term: 'Softmax', translation: '소프트맥스', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'Dropout', translation: '드롭아웃', category: 'neural_network', preserveOriginal: true, frequency: 'high' },
    { term: 'Batch Normalization', translation: '배치 정규화', category: 'neural_network', preserveOriginal: false, frequency: 'high' },
    { term: 'Layer Normalization', translation: '레이어 정규화', category: 'neural_network', preserveOriginal: false, frequency: 'high' },

    // Optimization
    { term: 'Gradient Descent', translation: '경사 하강법', category: 'optimization', preserveOriginal: false, frequency: 'high' },
    { term: 'Stochastic Gradient Descent', translation: '확률적 경사 하강법', aliases: ['SGD'], category: 'optimization', preserveOriginal: false, frequency: 'high' },
    { term: 'Adam', translation: 'Adam', category: 'optimization', preserveOriginal: true, frequency: 'high' },
    { term: 'AdamW', translation: 'AdamW', category: 'optimization', preserveOriginal: true, frequency: 'high' },
    { term: 'Learning Rate', translation: '학습률', category: 'optimization', preserveOriginal: false, frequency: 'high' },
    { term: 'Weight Decay', translation: '가중치 감쇠', category: 'optimization', preserveOriginal: false, frequency: 'medium' },
    { term: 'Momentum', translation: '모멘텀', category: 'optimization', preserveOriginal: true, frequency: 'medium' },
    { term: 'Warmup', translation: '워밍업', category: 'optimization', preserveOriginal: true, frequency: 'medium' },
    { term: 'Scheduler', translation: '스케줄러', category: 'optimization', preserveOriginal: true, frequency: 'medium' },

    // Loss Functions
    { term: 'Loss Function', translation: '손실 함수', category: 'loss_function', preserveOriginal: false, frequency: 'high' },
    { term: 'Cross-Entropy', translation: '교차 엔트로피', category: 'loss_function', preserveOriginal: false, frequency: 'high' },
    { term: 'Mean Squared Error', translation: '평균 제곱 오차', aliases: ['MSE'], category: 'loss_function', preserveOriginal: false, frequency: 'high' },
    { term: 'Binary Cross-Entropy', translation: '이진 교차 엔트로피', aliases: ['BCE'], category: 'loss_function', preserveOriginal: false, frequency: 'medium' },
    { term: 'KL Divergence', translation: 'KL 발산', category: 'loss_function', preserveOriginal: true, frequency: 'medium' },

    // NLP
    { term: 'Tokenization', translation: '토큰화', category: 'nlp', preserveOriginal: false, frequency: 'high' },
    { term: 'Embedding', translation: '임베딩', category: 'nlp', preserveOriginal: true, frequency: 'high' },
    { term: 'Word Embedding', translation: '단어 임베딩', category: 'nlp', preserveOriginal: false, frequency: 'high' },
    { term: 'Vocabulary', translation: '어휘', category: 'nlp', preserveOriginal: false, frequency: 'medium' },
    { term: 'Sequence-to-Sequence', translation: '시퀀스-투-시퀀스', aliases: ['Seq2Seq'], category: 'nlp', preserveOriginal: true, frequency: 'high' },
    { term: 'Language Model', translation: '언어 모델', category: 'nlp', preserveOriginal: false, frequency: 'high' },
    { term: 'Large Language Model', translation: '대규모 언어 모델', aliases: ['LLM'], category: 'nlp', preserveOriginal: false, frequency: 'high' },
    { term: 'Pre-training', translation: '사전 학습', category: 'nlp', preserveOriginal: false, frequency: 'high' },
    { term: 'Fine-tuning', translation: '미세 조정', category: 'nlp', preserveOriginal: true, frequency: 'high' },
    { term: 'Prompt', translation: '프롬프트', category: 'nlp', preserveOriginal: true, frequency: 'high' },
    { term: 'In-context Learning', translation: '인컨텍스트 학습', category: 'nlp', preserveOriginal: true, frequency: 'high' },

    // Computer Vision
    { term: 'Convolution', translation: '합성곱', category: 'cv', preserveOriginal: false, frequency: 'high' },
    { term: 'Pooling', translation: '풀링', category: 'cv', preserveOriginal: true, frequency: 'high' },
    { term: 'Feature Map', translation: '특징 맵', category: 'cv', preserveOriginal: false, frequency: 'medium' },
    { term: 'ResNet', translation: 'ResNet', category: 'cv', preserveOriginal: true, frequency: 'high' },
    { term: 'Vision Transformer', translation: '비전 트랜스포머', aliases: ['ViT'], category: 'cv', preserveOriginal: true, frequency: 'high' },

    // Generative Models
    { term: 'Generative Model', translation: '생성 모델', category: 'generative', preserveOriginal: false, frequency: 'high' },
    { term: 'GAN', translation: 'GAN', category: 'generative', preserveOriginal: true, frequency: 'high' },
    { term: 'Variational Autoencoder', translation: '변분 오토인코더', aliases: ['VAE'], category: 'generative', preserveOriginal: false, frequency: 'high' },
    { term: 'Diffusion Model', translation: '확산 모델', category: 'generative', preserveOriginal: false, frequency: 'high' },
    { term: 'Latent Space', translation: '잠재 공간', category: 'generative', preserveOriginal: false, frequency: 'medium' },

    // Evaluation Metrics
    { term: 'Accuracy', translation: '정확도', category: 'evaluation', preserveOriginal: false, frequency: 'high' },
    { term: 'Precision', translation: '정밀도', category: 'evaluation', preserveOriginal: false, frequency: 'high' },
    { term: 'Recall', translation: '재현율', category: 'evaluation', preserveOriginal: false, frequency: 'high' },
    { term: 'F1-Score', translation: 'F1 점수', category: 'evaluation', preserveOriginal: true, frequency: 'high' },
    { term: 'BLEU', translation: 'BLEU', category: 'evaluation', preserveOriginal: true, frequency: 'high' },
    { term: 'Perplexity', translation: '퍼플렉시티', category: 'evaluation', preserveOriginal: true, frequency: 'medium' },
    { term: 'AUC', translation: 'AUC', category: 'evaluation', preserveOriginal: true, frequency: 'medium' },

    // General
    { term: 'Dataset', translation: '데이터셋', category: 'general', preserveOriginal: true, frequency: 'high' },
    { term: 'Training', translation: '학습', category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Inference', translation: '추론', category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Batch Size', translation: '배치 크기', category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Epoch', translation: '에포크', category: 'general', preserveOriginal: true, frequency: 'high' },
    { term: 'Overfitting', translation: '과적합', category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Underfitting', translation: '과소적합', category: 'general', preserveOriginal: false, frequency: 'medium' },
    { term: 'Regularization', translation: '정규화', category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Hyperparameter', translation: '하이퍼파라미터', category: 'general', preserveOriginal: true, frequency: 'high' },
    { term: 'Baseline', translation: '베이스라인', category: 'general', preserveOriginal: true, frequency: 'high' },
    { term: 'State-of-the-art', translation: '최신 기술', aliases: ['SOTA'], category: 'general', preserveOriginal: false, frequency: 'high' },
    { term: 'Benchmark', translation: '벤치마크', category: 'general', preserveOriginal: true, frequency: 'high' },
  ],
};

// 용어집 캐시
let glossaryCache: Glossary | null = null;

/**
 * 용어집 로드
 */
export function loadGlossary(customPath?: string): Glossary {
  // 캐시된 용어집 반환
  if (glossaryCache && !customPath) {
    return glossaryCache;
  }

  // 커스텀 경로가 있으면 파일에서 로드
  if (customPath && fs.existsSync(customPath)) {
    try {
      const content = fs.readFileSync(customPath, 'utf-8');
      const customGlossary = JSON.parse(content) as Glossary;

      // 기본 용어집과 병합
      glossaryCache = mergeGlossaries(DEFAULT_GLOSSARY, customGlossary);
      return glossaryCache;
    } catch {
      console.error(`Failed to load custom glossary: ${customPath}`);
    }
  }

  glossaryCache = DEFAULT_GLOSSARY;
  return glossaryCache;
}

/**
 * 두 용어집 병합 (커스텀이 우선)
 */
function mergeGlossaries(base: Glossary, custom: Glossary): Glossary {
  const merged: Glossary = {
    version: custom.version || base.version,
    lastUpdated: custom.lastUpdated || base.lastUpdated,
    entries: [...base.entries],
  };

  // 커스텀 항목 추가/덮어쓰기
  for (const customEntry of custom.entries) {
    const existingIndex = merged.entries.findIndex(
      (e) => e.term.toLowerCase() === customEntry.term.toLowerCase()
    );

    if (existingIndex >= 0) {
      merged.entries[existingIndex] = customEntry;
    } else {
      merged.entries.push(customEntry);
    }
  }

  return merged;
}

/**
 * 텍스트에서 매칭되는 용어 찾기
 */
export function findMatchingTerms(text: string, glossary: Glossary): GlossaryEntry[] {
  const matches: GlossaryEntry[] = [];
  const textLower = text.toLowerCase();

  for (const entry of glossary.entries) {
    // 메인 용어 체크
    if (textLower.includes(entry.term.toLowerCase())) {
      matches.push(entry);
      continue;
    }

    // 별칭 체크
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        if (textLower.includes(alias.toLowerCase())) {
          matches.push(entry);
          break;
        }
      }
    }
  }

  // 빈도순으로 정렬
  return matches.sort((a, b) => {
    const freqOrder = { high: 0, medium: 1, low: 2 };
    return freqOrder[a.frequency] - freqOrder[b.frequency];
  });
}

/**
 * 용어 검색
 */
export function searchGlossary(query: string, glossary?: Glossary): GlossaryEntry[] {
  const g = glossary || loadGlossary();
  const queryLower = query.toLowerCase();

  return g.entries.filter((entry) => {
    if (entry.term.toLowerCase().includes(queryLower)) return true;
    if (entry.translation.includes(query)) return true;
    if (entry.aliases?.some((a) => a.toLowerCase().includes(queryLower))) return true;
    return false;
  });
}

/**
 * 용어 추가
 */
export function addTerm(entry: GlossaryEntry, glossary?: Glossary): Glossary {
  const g = glossary || loadGlossary();

  // 중복 체크
  const existing = g.entries.find(
    (e) => e.term.toLowerCase() === entry.term.toLowerCase()
  );

  if (existing) {
    throw new Error(`Term already exists: ${entry.term}`);
  }

  g.entries.push(entry);
  g.lastUpdated = new Date().toISOString().split('T')[0];

  glossaryCache = g;
  return g;
}

/**
 * 용어 업데이트
 */
export function updateTerm(
  term: string,
  updates: Partial<GlossaryEntry>,
  glossary?: Glossary
): Glossary {
  const g = glossary || loadGlossary();

  const index = g.entries.findIndex(
    (e) => e.term.toLowerCase() === term.toLowerCase()
  );

  if (index < 0) {
    throw new Error(`Term not found: ${term}`);
  }

  g.entries[index] = { ...g.entries[index], ...updates };
  g.lastUpdated = new Date().toISOString().split('T')[0];

  glossaryCache = g;
  return g;
}

/**
 * 용어집 저장
 */
export function saveGlossary(outputPath: string, glossary?: Glossary): void {
  const g = glossary || loadGlossary();
  fs.writeFileSync(outputPath, JSON.stringify(g, null, 2), 'utf-8');
}

/**
 * 카테고리별 용어 목록
 */
export function getTermsByCategory(
  category: GlossaryCategory,
  glossary?: Glossary
): GlossaryEntry[] {
  const g = glossary || loadGlossary();
  return g.entries.filter((e) => e.category === category);
}

/**
 * 용어집 통계
 */
export function getGlossaryStats(glossary?: Glossary): {
  totalTerms: number;
  byCategory: Record<GlossaryCategory, number>;
  byFrequency: Record<string, number>;
} {
  const g = glossary || loadGlossary();

  const byCategory: Record<string, number> = {};
  const byFrequency: Record<string, number> = { high: 0, medium: 0, low: 0 };

  for (const entry of g.entries) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    byFrequency[entry.frequency]++;
  }

  return {
    totalTerms: g.entries.length,
    byCategory: byCategory as Record<GlossaryCategory, number>,
    byFrequency,
  };
}

export { DEFAULT_GLOSSARY };
