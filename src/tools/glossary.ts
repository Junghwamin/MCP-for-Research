import * as fs from 'fs';
import {
  loadGlossary,
  searchGlossary,
  addTerm,
  updateTerm,
  saveGlossary,
  getGlossaryStats,
  getTermsByCategory,
} from '../glossary/aimlGlossary.js';
import type { ManageGlossaryInput, GlossaryEntry, GlossaryCategory } from '../types/translation.js';

// ============================================
// 용어집 관리 도구
// ============================================

interface GlossaryResult {
  success: boolean;
  action: string;
  data?: any;
  message?: string;
  error?: string;
}

/**
 * 용어집 관리
 */
export async function manageGlossary(input: ManageGlossaryInput): Promise<GlossaryResult> {
  try {
    const glossary = loadGlossary(input.glossaryPath);

    switch (input.action) {
      case 'list':
        return listTerms(glossary, input.category as GlossaryCategory | undefined);

      case 'search':
        if (!input.term) {
          throw new Error('검색어를 입력해주세요.');
        }
        return searchTerms(input.term);

      case 'add':
        if (!input.term || !input.translation) {
          throw new Error('용어(term)와 번역(translation)을 입력해주세요.');
        }
        return addNewTerm(input);

      case 'update':
        if (!input.term) {
          throw new Error('수정할 용어를 입력해주세요.');
        }
        return updateExistingTerm(input);

      case 'import':
        if (!input.glossaryPath) {
          throw new Error('가져올 용어집 파일 경로를 입력해주세요.');
        }
        return importGlossary(input.glossaryPath);

      default:
        throw new Error(`Unknown action: ${input.action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      action: input.action,
      error: errorMessage,
    };
  }
}

/**
 * 용어 목록 조회
 */
function listTerms(glossary: any, category?: GlossaryCategory): GlossaryResult {
  const stats = getGlossaryStats(glossary);

  let terms: GlossaryEntry[];
  if (category) {
    terms = getTermsByCategory(category, glossary);
  } else {
    terms = glossary.entries;
  }

  return {
    success: true,
    action: 'list',
    data: {
      stats,
      category: category || 'all',
      termCount: terms.length,
      terms: terms.slice(0, 50), // 최대 50개만 반환
    },
    message: category
      ? `카테고리 '${category}'의 용어 ${terms.length}개`
      : `전체 용어 ${stats.totalTerms}개`,
  };
}

/**
 * 용어 검색
 */
function searchTerms(query: string): GlossaryResult {
  const results = searchGlossary(query);

  return {
    success: true,
    action: 'search',
    data: {
      query,
      resultCount: results.length,
      results,
    },
    message: `'${query}' 검색 결과: ${results.length}개`,
  };
}

/**
 * 새 용어 추가
 */
function addNewTerm(input: ManageGlossaryInput): GlossaryResult {
  const newEntry: GlossaryEntry = {
    term: input.term!,
    translation: input.translation!,
    category: (input.category as GlossaryCategory) || 'general',
    definition: input.definition,
    preserveOriginal: true,
    frequency: 'medium',
  };

  const glossary = addTerm(newEntry);

  // 변경된 용어집 저장 (선택적)
  if (input.glossaryPath) {
    saveGlossary(input.glossaryPath, glossary);
  }

  return {
    success: true,
    action: 'add',
    data: newEntry,
    message: `용어 '${input.term}'이(가) 추가되었습니다.`,
  };
}

/**
 * 기존 용어 수정
 */
function updateExistingTerm(input: ManageGlossaryInput): GlossaryResult {
  const updates: Partial<GlossaryEntry> = {};

  if (input.translation) updates.translation = input.translation;
  if (input.definition) updates.definition = input.definition;
  if (input.category) updates.category = input.category as GlossaryCategory;

  const glossary = updateTerm(input.term!, updates);

  // 변경된 용어집 저장 (선택적)
  if (input.glossaryPath) {
    saveGlossary(input.glossaryPath, glossary);
  }

  const updatedEntry = glossary.entries.find(
    (e) => e.term.toLowerCase() === input.term!.toLowerCase()
  );

  return {
    success: true,
    action: 'update',
    data: updatedEntry,
    message: `용어 '${input.term}'이(가) 수정되었습니다.`,
  };
}

/**
 * 외부 용어집 가져오기
 */
function importGlossary(glossaryPath: string): GlossaryResult {
  if (!fs.existsSync(glossaryPath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${glossaryPath}`);
  }

  const content = fs.readFileSync(glossaryPath, 'utf-8');
  const imported = JSON.parse(content);

  // 병합된 용어집 로드 (자동 병합)
  const glossary = loadGlossary(glossaryPath);
  const stats = getGlossaryStats(glossary);

  return {
    success: true,
    action: 'import',
    data: {
      importedFrom: glossaryPath,
      stats,
    },
    message: `용어집을 가져왔습니다. 총 ${stats.totalTerms}개 용어.`,
  };
}

/**
 * 결과 포맷팅
 */
export function formatGlossaryResult(result: GlossaryResult): string {
  if (!result.success) {
    return `❌ 용어집 작업 실패: ${result.error}`;
  }

  const lines: string[] = [`✅ ${result.message}`];

  switch (result.action) {
    case 'list':
      lines.push('');
      lines.push(`### 용어집 통계`);
      lines.push(`- 총 용어: ${result.data.stats.totalTerms}개`);
      lines.push('');
      lines.push('### 카테고리별');
      for (const [cat, count] of Object.entries(result.data.stats.byCategory)) {
        lines.push(`- ${cat}: ${count}개`);
      }

      if (result.data.terms && result.data.terms.length > 0) {
        lines.push('');
        lines.push('### 용어 목록 (일부)');
        lines.push('| 영어 | 한국어 | 카테고리 |');
        lines.push('|------|--------|----------|');
        for (const term of result.data.terms.slice(0, 20)) {
          lines.push(`| ${term.term} | ${term.translation} | ${term.category} |`);
        }
        if (result.data.terms.length > 20) {
          lines.push(`... 외 ${result.data.terms.length - 20}개`);
        }
      }
      break;

    case 'search':
      if (result.data.results && result.data.results.length > 0) {
        lines.push('');
        lines.push('| 영어 | 한국어 | 카테고리 | 원어유지 |');
        lines.push('|------|--------|----------|----------|');
        for (const term of result.data.results) {
          const preserve = term.preserveOriginal ? '✓' : '';
          lines.push(`| ${term.term} | ${term.translation} | ${term.category} | ${preserve} |`);
        }
      } else {
        lines.push('검색 결과가 없습니다.');
      }
      break;

    case 'add':
    case 'update':
      if (result.data) {
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(result.data, null, 2));
        lines.push('```');
      }
      break;

    case 'import':
      lines.push('');
      lines.push(`- 파일: ${result.data.importedFrom}`);
      lines.push(`- 총 용어: ${result.data.stats.totalTerms}개`);
      break;
  }

  return lines.join('\n');
}
