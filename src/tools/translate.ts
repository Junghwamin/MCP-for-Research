import * as fs from 'fs';
import * as path from 'path';
import { parsePDF, analyzePaperStructure, saveOriginalText } from '../parsers/pdfParser.js';
import { translateText, translateCaption } from '../api/translator.js';
import { splitIntoChunks, mergeTranslatedChunks, estimateTokenCount } from '../utils/chunkManager.js';
import { generateMarkdown } from '../utils/markdown.js';
import { generateDocx } from '../utils/docxGenerator.js';
import { loadGlossary, findMatchingTerms } from '../glossary/aimlGlossary.js';
import type {
  TranslatePaperInput,
  TranslationResult,
  TranslationProgress,
  Section,
  PaperStructure,
  Chunk,
} from '../types/translation.js';

// ============================================
// 전체 논문 번역 도구
// ============================================

/**
 * 전체 논문 번역
 */
export async function translatePaper(input: TranslatePaperInput): Promise<TranslationResult> {
  const startTime = Date.now();

  try {
    // 1. PDF 파싱
    console.error(`[1/6] PDF 파싱 중: ${input.pdfPath}`);
    const { text, metadata, numPages } = await parsePDF(input.pdfPath);

    // 2. 출력 디렉토리 설정
    const outputDir = input.outputDir || path.dirname(input.pdfPath);
    const paperName = path.basename(input.pdfPath, '.pdf');
    const paperOutputDir = path.join(outputDir, `${paperName}_translated`);

    if (!fs.existsSync(paperOutputDir)) {
      fs.mkdirSync(paperOutputDir, { recursive: true });
    }

    // 3. 원문 저장
    console.error('[2/6] 원문 저장 중...');
    const originalPath = saveOriginalText(text, paperOutputDir, paperName);

    // 4. 논문 구조 분석
    console.error('[3/6] 논문 구조 분석 중...');
    const structure = analyzePaperStructure(text, metadata);

    // 5. 진행 상황 파일 초기화
    const progressPath = path.join(paperOutputDir, 'progress.json');
    const progress = initProgress(input.pdfPath, paperOutputDir, structure);
    saveProgress(progressPath, progress);

    // 6. 용어집 로드
    const glossary = loadGlossary();
    const relevantTerms = findMatchingTerms(text, glossary);

    // 7. 섹션별 번역
    console.error('[4/6] 번역 중...');
    const translatedSections = await translateSections(
      structure,
      input.targetLanguage || 'ko',
      input.preserveTerms ?? true,
      relevantTerms,
      progress,
      progressPath
    );

    // 8. Figure/Table 캡션 번역
    console.error('[5/6] 캡션 번역 중...');
    const translatedFigures = await translateFigureCaptions(
      structure.figures,
      input.targetLanguage || 'ko'
    );
    const translatedTables = await translateTableCaptions(
      structure.tables,
      input.targetLanguage || 'ko'
    );

    // 9. 마크다운 생성
    console.error('[6/6] 문서 생성 중...');
    const mdContent = generateMarkdown({
      title: structure.title,
      translatedTitle: translatedSections.title,
      authors: structure.authors,
      abstract: translatedSections.abstract,
      sections: translatedSections.sections,
      figures: translatedFigures,
      tables: translatedTables,
      references: structure.references,
    });

    const mdPath = path.join(paperOutputDir, `${paperName}_translated.md`);
    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    // 10. DOCX 생성 (옵션)
    let docxPath: string | undefined;
    if (input.generateDocx !== false) {
      docxPath = path.join(paperOutputDir, `${paperName}_translated.docx`);
      await generateDocx(mdPath, docxPath, path.join(paperOutputDir, 'images'));
    }

    // 11. 진행 완료
    progress.status = 'completed';
    progress.completedAt = new Date().toISOString();
    saveProgress(progressPath, progress);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      paperId: paperName,
      title: {
        original: structure.title,
        translated: translatedSections.title,
      },
      outputFiles: {
        originalText: originalPath,
        translatedMarkdown: mdPath,
        translatedDocx: docxPath,
        imagesDir: path.join(paperOutputDir, 'images'),
        progressJson: progressPath,
      },
      stats: {
        totalSections: structure.sections.length,
        totalFigures: structure.figures.length,
        totalTables: structure.tables.length,
        totalChunks: translatedSections.totalChunks,
        translatedChars: mdContent.length,
        processingTimeMs: processingTime,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      paperId: path.basename(input.pdfPath, '.pdf'),
      title: { original: '', translated: '' },
      outputFiles: {
        originalText: '',
        translatedMarkdown: '',
      },
      stats: {
        totalSections: 0,
        totalFigures: 0,
        totalTables: 0,
        totalChunks: 0,
        translatedChars: 0,
        processingTimeMs: Date.now() - startTime,
      },
      error: errorMessage,
    };
  }
}

/**
 * 섹션별 번역
 */
async function translateSections(
  structure: PaperStructure,
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh',
  preserveTerms: boolean,
  glossaryTerms: any[],
  progress: TranslationProgress,
  progressPath: string
): Promise<{
  title: string;
  abstract: string;
  sections: { name: string; content: string }[];
  totalChunks: number;
}> {
  const translatedSections: { name: string; content: string }[] = [];
  let totalChunks = 0;

  // 제목 번역
  const translatedTitle = await translateText({
    text: structure.title,
    targetLanguage,
    preserveTerms,
    glossaryHints: glossaryTerms,
  });

  // Abstract 번역
  const translatedAbstract = structure.abstract
    ? await translateText({
        text: structure.abstract,
        targetLanguage,
        sectionType: 'abstract',
        preserveTerms,
        glossaryHints: glossaryTerms,
      })
    : '';

  // 각 섹션 번역
  for (const section of structure.sections) {
    // 이미 완료된 섹션 스킵
    if (progress.completedSections.includes(section.id)) {
      continue;
    }

    progress.currentSection = section.id;
    progress.status = 'in_progress';
    saveProgress(progressPath, progress);

    // 청킹
    const chunks = splitIntoChunks(section.content, section.id);
    totalChunks += chunks.length;

    // 청크별 번역
    const translatedChunks: { chunk: Chunk; translated: string }[] = [];
    let context = '';

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      progress.currentChunk = i + 1;
      progress.totalChunks = chunks.length;
      saveProgress(progressPath, progress);

      console.error(`  섹션 "${section.name}" 번역 중: ${i + 1}/${chunks.length}`);

      const translated = await translateText({
        text: chunk.content,
        targetLanguage,
        context: context,
        sectionType: section.name.toLowerCase(),
        preserveTerms,
        glossaryHints: glossaryTerms,
      });

      translatedChunks.push({ chunk, translated });
      context = translated.slice(-500); // 다음 청크를 위한 문맥
    }

    // 청크 병합
    const mergedTranslation = mergeTranslatedChunks(translatedChunks);

    translatedSections.push({
      name: section.name,
      content: mergedTranslation,
    });

    // 완료 표시
    progress.completedSections.push(section.id);
    progress.updatedAt = new Date().toISOString();
    saveProgress(progressPath, progress);
  }

  return {
    title: translatedTitle,
    abstract: translatedAbstract,
    sections: translatedSections,
    totalChunks,
  };
}

/**
 * Figure 캡션 번역
 */
async function translateFigureCaptions(
  figures: PaperStructure['figures'],
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh'
): Promise<PaperStructure['figures']> {
  const translated = [];

  for (const fig of figures) {
    const translatedCaption = await translateCaption(fig.caption, 'figure', targetLanguage);
    translated.push({
      ...fig,
      translatedCaption,
    });
  }

  return translated;
}

/**
 * Table 캡션 번역
 */
async function translateTableCaptions(
  tables: PaperStructure['tables'],
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh'
): Promise<PaperStructure['tables']> {
  const translated = [];

  for (const table of tables) {
    const translatedCaption = await translateCaption(table.caption, 'table', targetLanguage);
    translated.push({
      ...table,
      translatedCaption,
    });
  }

  return translated;
}

/**
 * 진행 상황 초기화
 */
function initProgress(pdfPath: string, outputDir: string, structure: PaperStructure): TranslationProgress {
  return {
    paperId: path.basename(pdfPath, '.pdf'),
    pdfPath,
    outputDir,
    status: 'pending',
    totalSections: structure.sections.length,
    completedSections: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 진행 상황 저장
 */
function saveProgress(progressPath: string, progress: TranslationProgress): void {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf-8');
}

/**
 * 결과 포맷팅
 */
export function formatTranslateResult(result: TranslationResult): string {
  if (!result.success) {
    return `❌ 번역 실패: ${result.error}`;
  }

  const lines = [
    '✅ 논문 번역 완료!',
    '',
    `📄 **원제**: ${result.title.original}`,
    `📄 **번역 제목**: ${result.title.translated}`,
    '',
    '## 생성된 파일',
    `- 원문: ${result.outputFiles.originalText}`,
    `- 번역문 (MD): ${result.outputFiles.translatedMarkdown}`,
  ];

  if (result.outputFiles.translatedDocx) {
    lines.push(`- 번역문 (DOCX): ${result.outputFiles.translatedDocx}`);
  }

  lines.push(
    '',
    '## 통계',
    `- 섹션 수: ${result.stats.totalSections}`,
    `- Figure 수: ${result.stats.totalFigures}`,
    `- Table 수: ${result.stats.totalTables}`,
    `- 처리 시간: ${(result.stats.processingTimeMs / 1000).toFixed(1)}초`
  );

  return lines.join('\n');
}
