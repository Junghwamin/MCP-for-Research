// ============================================
// 논문 번역 MCP 서버 타입 정의
// ============================================

// ---------- 논문 구조 ----------
export interface PaperStructure {
  title: string;
  authors: string[];
  abstract: string;
  sections: Section[];
  figures: Figure[];
  tables: Table[];
  references: string[];
  metadata: PaperMetadata;
}

export interface Section {
  id: string;
  level: number;              // 1: H1, 2: H2, 3: H3
  name: string;               // "Introduction", "Methods" 등
  originalName: string;       // 원문 섹션명
  content: string;
  pageRange: [number, number];
  subsections?: Section[];
}

export interface Figure {
  id: string;                 // "fig1", "fig2a"
  number: string;             // "Figure 1", "Figure 2a"
  caption: string;
  translatedCaption?: string;
  pageNumber: number;
  imagePath?: string;         // 추출된 이미지 경로
  boundingBox?: BoundingBox;
}

export interface Table {
  id: string;
  number: string;             // "Table 1"
  caption: string;
  translatedCaption?: string;
  headers: string[];
  rows: string[][];
  pageNumber: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaperMetadata {
  fileName: string;
  filePath: string;
  numPages: number;
  creationDate?: string;
  author?: string;
  pdfTitle?: string;
}

// ---------- 번역 관련 ----------
export interface TranslationConfig {
  targetLanguage: 'ko' | 'en' | 'ja' | 'zh';
  preserveTerms: boolean;     // AI/ML 용어 영어 유지
  outputFormat: 'markdown' | 'parallel' | 'html';
  extractImages: boolean;
  translateTables: boolean;
}

export interface TranslationResult {
  success: boolean;
  paperId: string;
  title: {
    original: string;
    translated: string;
  };
  outputFiles: OutputFiles;
  stats: TranslationStats;
  error?: string;
}

export interface OutputFiles {
  originalText: string;       // original.txt 경로
  translatedMarkdown: string; // translated.md 경로
  translatedDocx?: string;    // 논문명_번역.docx 경로
  imagesDir?: string;         // images/ 폴더 경로
  captionsJson?: string;      // captions.json 경로
  progressJson?: string;      // progress.json 경로
}

export interface TranslationStats {
  totalSections: number;
  totalFigures: number;
  totalTables: number;
  totalChunks: number;
  translatedChars: number;
  processingTimeMs: number;
}

// ---------- 청킹 시스템 ----------
export interface ChunkConfig {
  maxTokens: number;          // 기본 3000
  overlap: number;            // 기본 200
  splitBySentence: boolean;
}

export interface Chunk {
  id: string;
  sectionId: string;
  index: number;
  totalChunks: number;
  content: string;
  tokenCount: number;
}

// ---------- 진행 상황 ----------
export interface TranslationProgress {
  paperId: string;
  pdfPath: string;
  outputDir: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalSections: number;
  completedSections: string[];
  currentSection?: string;
  currentChunk?: number;
  totalChunks?: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

// ---------- 요약 기능 ----------
export interface SummaryResult {
  success: boolean;
  title: string;
  summary: {
    threeLines: string[];     // 핵심 3줄
    keywords: string[];       // 키워드 태그
    contributions: string[];  // 주요 기여점
    targetAudience: string[]; // 읽어야 할 사람
  };
  language: 'ko' | 'en';
  error?: string;
}

export interface SummaryConfig {
  detailLevel: 'brief' | 'detailed';
  language: 'ko' | 'en';
}

// ---------- 용어집 ----------
export interface GlossaryEntry {
  term: string;               // 영어 원어
  translation: string;        // 한국어 번역
  aliases?: string[];         // 동의어/약어
  category: GlossaryCategory;
  definition?: string;
  preserveOriginal: boolean;  // 원어 유지 여부
  frequency: 'high' | 'medium' | 'low';
}

export type GlossaryCategory =
  | 'neural_network'
  | 'transformer'
  | 'optimization'
  | 'loss_function'
  | 'nlp'
  | 'cv'
  | 'rl'
  | 'generative'
  | 'evaluation'
  | 'general';

export interface Glossary {
  version: string;
  lastUpdated: string;
  entries: GlossaryEntry[];
}

// ---------- DOCX 생성 ----------
export interface DocxConfig {
  fontSize: number;           // 기본 11pt
  fontFamily: string;         // 기본 '맑은 고딕'
  lineSpacing: number;        // 기본 1.5
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  imageWidthPercent: number;  // 기본 80%
}

export interface DocxStyles {
  title: { fontSize: number; bold: boolean };
  h1: { fontSize: number; bold: boolean };
  h2: { fontSize: number; bold: boolean };
  h3: { fontSize: number; bold: boolean };
  body: { fontSize: number; bold: boolean };
  caption: { fontSize: number; italic: boolean };
}

// ---------- MCP 도구 입력 ----------
export interface TranslatePaperInput {
  pdfPath: string;
  outputDir?: string;
  targetLanguage?: 'ko' | 'en' | 'ja' | 'zh';
  outputFormat?: 'markdown' | 'parallel' | 'html';
  preserveTerms?: boolean;
  extractImages?: boolean;
  generateDocx?: boolean;
}

export interface TranslateSectionInput {
  pdfPath: string;
  sectionName: string;
  targetLanguage?: 'ko' | 'en' | 'ja' | 'zh';
  includeSubsections?: boolean;
}

export interface SummarizePaperInput {
  pdfPath: string;
  detailLevel?: 'brief' | 'detailed';
  language?: 'ko' | 'en';
}

export interface ExtractImagesInput {
  pdfPath: string;
  outputDir: string;
  imageFormat?: 'png' | 'jpg' | 'webp';
  translateCaptions?: boolean;
}

export interface TranslateTableInput {
  pdfPath: string;
  tableNumber: number;
  targetLanguage?: 'ko' | 'en' | 'ja' | 'zh';
  outputFormat?: 'markdown' | 'csv' | 'json';
}

export interface ExportTranslationInput {
  translatedMdPath: string;
  outputPath: string;
  format: 'docx' | 'html' | 'pdf';
  imagesDir?: string;
  includeOriginal?: boolean;
}

export interface ManageGlossaryInput {
  action: 'list' | 'search' | 'add' | 'update' | 'import';
  term?: string;
  translation?: string;
  definition?: string;
  category?: GlossaryCategory;
  glossaryPath?: string;
}
