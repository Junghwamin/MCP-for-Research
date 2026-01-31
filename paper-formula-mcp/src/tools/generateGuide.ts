/**
 * HOW-WHY-WHAT 가이드 생성 도구
 * 논문 마크다운 파일을 읽고 LLM을 사용하여 HOW-WHY-WHAT 프레임워크 가이드를 생성
 */

import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { generateGuideWithLLM } from '../api/llmClient.js';
import type {
  GenerateGuideInput,
  GenerateGuideResult,
  GuideStyle,
  GuideLanguage,
} from '../types/guide.js';

// ============================================
// 가이드 생성 도구
// ============================================

export async function generateGuide(input: GenerateGuideInput): Promise<GenerateGuideResult> {
  try {
    const {
      paperPath,
      guideStyle = 'comprehensive',
      language = 'ko',
      includeCode = true,
      includeCompetition = true,
      outputPath,
    } = input;

    // 1. 마크다운 파일 읽기
    let paperContent: string;
    try {
      paperContent = await readFile(paperPath, 'utf-8');
    } catch (err) {
      return {
        success: false,
        markdown: '',
        stats: { totalSections: 0, totalWords: 0, whatSections: 0, whySections: 0, howSections: 0 },
        error: `파일을 읽을 수 없습니다: ${paperPath}`,
      };
    }

    if (paperContent.trim().length === 0) {
      return {
        success: false,
        markdown: '',
        stats: { totalSections: 0, totalWords: 0, whatSections: 0, whySections: 0, howSections: 0 },
        error: '빈 파일입니다.',
      };
    }

    // 2. 논문 제목 추출
    const paperTitle = extractPaperTitle(paperContent);

    // 3. 각 섹션별 LLM 호출
    const sections: string[] = [];
    let previousSections = '';

    // 헤더 생성
    const header = generateHeader(paperTitle, language);
    sections.push(header);

    // WHAT 섹션
    const whatSection = await generateGuideWithLLM({
      paperContent,
      paperTitle,
      section: 'what',
      style: guideStyle,
      language,
    });
    sections.push(whatSection);
    previousSections += whatSection.substring(0, 500);

    // WHY 섹션
    const whySection = await generateGuideWithLLM({
      paperContent,
      paperTitle,
      section: 'why',
      style: guideStyle,
      language,
      previousSections,
    });
    sections.push(whySection);
    previousSections += whySection.substring(0, 500);

    // HOW 섹션
    const howSection = await generateGuideWithLLM({
      paperContent,
      paperTitle,
      section: 'how',
      style: guideStyle,
      language,
      previousSections,
    });
    sections.push(howSection);
    previousSections += howSection.substring(0, 500);

    // 핵심 발견 & 실전 지침
    const findingsSection = await generateGuideWithLLM({
      paperContent,
      paperTitle,
      section: 'findings',
      style: guideStyle,
      language,
      previousSections,
    });
    sections.push(findingsSection);

    // 실전 코드 (선택)
    if (includeCode) {
      const codeSection = await generateGuideWithLLM({
        paperContent,
        paperTitle,
        section: 'code',
        style: guideStyle,
        language,
        previousSections,
      });
      sections.push(codeSection);
    }

    // 공모전/논문 활용 (선택)
    if (includeCompetition) {
      const appSection = await generateGuideWithLLM({
        paperContent,
        paperTitle,
        section: 'application',
        style: guideStyle,
        language,
        previousSections,
      });
      sections.push(appSection);
    }

    // 부록
    const appendixSection = await generateGuideWithLLM({
      paperContent,
      paperTitle,
      section: 'appendix',
      style: guideStyle,
      language,
      previousSections,
    });
    sections.push(appendixSection);

    // 4. 전체 마크다운 조합
    const fullMarkdown = sections.join('\n\n---\n\n');

    // 5. 통계 계산
    const stats = calculateStats(fullMarkdown);

    // 6. 파일 저장
    const savePath = outputPath || generateOutputPath(paperPath, paperTitle);
    try {
      await writeFile(savePath, fullMarkdown, 'utf-8');
    } catch {
      // 저장 실패해도 마크다운은 반환
    }

    return {
      success: true,
      markdown: fullMarkdown,
      outputPath: savePath,
      stats,
    };
  } catch (error) {
    return {
      success: false,
      markdown: '',
      stats: { totalSections: 0, totalWords: 0, whatSections: 0, whySections: 0, howSections: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 마크다운에서 논문 제목 추출
 */
function extractPaperTitle(content: string): string {
  // # 으로 시작하는 첫 번째 줄
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.replace(/^#+\s*/, '').trim();
    }
  }
  // 제목을 찾지 못하면 첫 줄 사용
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed.substring(0, 100);
    }
  }
  return 'Unknown Paper';
}

/**
 * 가이드 헤더 생성
 */
function generateHeader(paperTitle: string, language: GuideLanguage): string {
  if (language === 'ko') {
    return [
      `# 🎯 ${paperTitle}`,
      `## HOW-WHY-WHAT 프레임워크 학습 가이드`,
      ``,
      `> **목표**: 논문의 핵심 개념, 동기, 방법론을 체계적으로 이해하기`,
      `> **구조**: WHAT(무엇인가?) → WHY(왜 필요한가?) → HOW(어떻게 작동하나?)`,
      ``,
      `---`,
      ``,
      `# 📑 목차`,
      ``,
      `1. [WHAT: 무엇인가?](#1-what-무엇인가)`,
      `2. [WHY: 왜 필요한가?](#2-why-왜-필요한가)`,
      `3. [HOW: 어떻게 작동하나?](#3-how-어떻게-작동하나)`,
      `4. [핵심 발견 & 실전 지침](#4-핵심-발견--실전-지침)`,
      `5. [실전 코드](#5-실전-코드)`,
      `6. [공모전 & 논문 활용 가이드](#6-공모전--논문-활용-가이드)`,
      `7. [부록](#부록)`,
    ].join('\n');
  } else {
    return [
      `# 🎯 ${paperTitle}`,
      `## HOW-WHY-WHAT Framework Study Guide`,
      ``,
      `> **Goal**: Systematically understand the paper's core concepts, motivation, and methodology`,
      `> **Structure**: WHAT → WHY → HOW`,
      ``,
      `---`,
      ``,
      `# 📑 Table of Contents`,
      ``,
      `1. [WHAT: What is it?](#1-what-what-is-it)`,
      `2. [WHY: Why is it needed?](#2-why-why-is-it-needed)`,
      `3. [HOW: How does it work?](#3-how-how-does-it-work)`,
      `4. [Key Findings & Guidelines](#4-key-findings--guidelines)`,
      `5. [Practical Code](#5-practical-code)`,
      `6. [Competition & Paper Guide](#6-competition--paper-guide)`,
      `7. [Appendix](#appendix)`,
    ].join('\n');
  }
}

/**
 * 통계 계산
 */
function calculateStats(markdown: string): GenerateGuideResult['stats'] {
  const whatSections = (markdown.match(/^## 1\./gm) || []).length + (markdown.match(/^### ①|^### ②|^### ③/gm) || []).length;
  const whySections = (markdown.match(/^## 2\./gm) || []).length;
  const howSections = (markdown.match(/^## 3\./gm) || []).length + (markdown.match(/^### Step/gm) || []).length;
  const totalSections = (markdown.match(/^## /gm) || []).length;
  const totalWords = markdown.split(/\s+/).length;

  return {
    totalSections,
    totalWords,
    whatSections,
    whySections,
    howSections,
  };
}

/**
 * 출력 경로 자동 생성
 */
function generateOutputPath(paperPath: string, paperTitle: string): string {
  const dir = path.dirname(paperPath);
  const safeName = paperTitle
    .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  return path.join(dir, `${safeName}_HOW_WHY_WHAT_GUIDE.md`);
}

// ============================================
// 결과 포맷팅
// ============================================

export function formatGuideResult(result: GenerateGuideResult): string {
  if (!result.success) {
    return `❌ 가이드 생성 실패: ${result.error}`;
  }

  const header = [
    `# 📖 HOW-WHY-WHAT 가이드 생성 완료`,
    ``,
    `## 📊 통계`,
    `- 총 섹션 수: ${result.stats.totalSections}`,
    `- 총 단어 수: ${result.stats.totalWords}`,
    `- WHAT 섹션: ${result.stats.whatSections}개`,
    `- WHY 섹션: ${result.stats.whySections}개`,
    `- HOW 섹션: ${result.stats.howSections}개`,
    result.outputPath ? `- 저장 위치: ${result.outputPath}` : '',
    ``,
    `---`,
    ``,
  ].filter(Boolean).join('\n');

  return header + result.markdown;
}
