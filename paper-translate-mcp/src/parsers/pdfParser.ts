import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import type { PaperStructure, Section, Figure, Table, PaperMetadata } from '../types/translation.js';

// ============================================
// PDF 파싱 및 구조 분석
// ============================================

/**
 * PDF 파일에서 텍스트 추출
 */
export async function parsePDF(pdfPath: string): Promise<{
  text: string;
  metadata: PaperMetadata;
  numPages: number;
}> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);

  return {
    text: data.text,
    numPages: data.numpages,
    metadata: {
      fileName: path.basename(pdfPath),
      filePath: pdfPath,
      numPages: data.numpages,
      creationDate: data.info?.CreationDate,
      author: data.info?.Author,
      pdfTitle: data.info?.Title,
    },
  };
}

/**
 * 추출된 텍스트에서 논문 구조 분석
 */
export function analyzePaperStructure(text: string, metadata: PaperMetadata): PaperStructure {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // 제목 추출 (첫 번째 줄 또는 PDF 메타데이터)
  const title = extractTitle(lines, metadata);

  // 저자 추출
  const authors = extractAuthors(lines);

  // Abstract 추출
  const abstract = extractAbstract(text);

  // 섹션 분리
  const sections = extractSections(text);

  // Figure 정보 추출
  const figures = extractFigureInfo(text);

  // Table 정보 추출
  const tables = extractTableInfo(text);

  // References 추출
  const references = extractReferences(text);

  return {
    title,
    authors,
    abstract,
    sections,
    figures,
    tables,
    references,
    metadata,
  };
}

/**
 * 제목 추출
 */
function extractTitle(lines: string[], metadata: PaperMetadata): string {
  // PDF 메타데이터에서 제목이 있으면 사용
  if (metadata.pdfTitle && metadata.pdfTitle.length > 5) {
    return metadata.pdfTitle;
  }

  // 첫 몇 줄에서 제목 찾기 (보통 가장 긴 줄이 제목)
  const firstLines = lines.slice(0, 10);
  let title = '';
  let maxLength = 0;

  for (const line of firstLines) {
    // Abstract 전까지만 검색
    if (line.toLowerCase().includes('abstract')) break;
    if (line.length > maxLength && line.length < 200) {
      maxLength = line.length;
      title = line;
    }
  }

  return title || 'Untitled Paper';
}

/**
 * 저자 추출
 */
function extractAuthors(lines: string[]): string[] {
  const authors: string[] = [];
  let foundTitle = false;

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i];

    // 제목 다음 줄부터 저자 검색
    if (!foundTitle && line.length > 20) {
      foundTitle = true;
      continue;
    }

    // Abstract 나오면 중단
    if (line.toLowerCase().includes('abstract')) break;

    // 이메일 패턴이 있으면 저자 라인으로 판단
    if (foundTitle && (line.includes('@') || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(line))) {
      // 쉼표나 and로 구분된 이름들 추출
      const names = line.split(/,|and|\d/).map(n => n.trim()).filter(n => {
        return n.length > 2 && n.length < 50 && !n.includes('@');
      });
      authors.push(...names);
    }
  }

  return authors.slice(0, 10); // 최대 10명
}

/**
 * Abstract 추출
 */
function extractAbstract(text: string): string {
  const abstractPatterns = [
    /abstract[:\s]*\n?([\s\S]*?)(?=\n\s*(?:1\.?\s*)?introduction|keywords|index terms)/i,
    /abstract[:\s]*\n?([\s\S]*?)(?=\n\n\n)/i,
  ];

  for (const pattern of abstractPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const abstract = match[1].trim().replace(/\s+/g, ' ');
      if (abstract.length > 50) {
        return abstract;
      }
    }
  }

  return '';
}

/**
 * 섹션 추출
 */
function extractSections(text: string): Section[] {
  const sections: Section[] = [];

  // 일반적인 논문 섹션 패턴
  const sectionPatterns = [
    // "1. Introduction" 또는 "1 Introduction" 형식
    /^(\d+)\.?\s+([A-Z][A-Za-z\s]+)$/gm,
    // "Introduction" 단독 (대문자 시작)
    /^([A-Z][A-Z\s]+)$/gm,
  ];

  const sectionNames = [
    'introduction', 'related work', 'background', 'method', 'methods',
    'methodology', 'approach', 'model', 'architecture', 'experiment',
    'experiments', 'results', 'discussion', 'conclusion', 'conclusions',
    'future work', 'acknowledgments', 'references'
  ];

  // 텍스트를 줄 단위로 분석
  const lines = text.split('\n');
  let currentSection: Section | null = null;
  let sectionId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();

    // 섹션 헤더 감지
    const numberMatch = line.match(/^(\d+)\.?\s+(.+)$/);
    const isKnownSection = sectionNames.some(name => lineLower.includes(name));

    if (numberMatch || (isKnownSection && line.length < 50)) {
      // 이전 섹션 저장
      if (currentSection) {
        sections.push(currentSection);
      }

      // 새 섹션 시작
      sectionId++;
      const sectionName = numberMatch ? numberMatch[2] : line;
      currentSection = {
        id: `section-${sectionId}`,
        level: numberMatch ? 1 : 2,
        name: translateSectionName(sectionName),
        originalName: sectionName,
        content: '',
        pageRange: [0, 0], // PDF 페이지 정보 없으면 0
      };
    } else if (currentSection) {
      // 현재 섹션에 내용 추가
      currentSection.content += line + '\n';
    }
  }

  // 마지막 섹션 저장
  if (currentSection) {
    sections.push(currentSection);
  }

  // 내용 정리
  sections.forEach(section => {
    section.content = section.content.trim();
  });

  return sections.filter(s => s.content.length > 50);
}

/**
 * 섹션 이름 한글 매핑
 */
function translateSectionName(name: string): string {
  const mapping: Record<string, string> = {
    'abstract': '초록 (Abstract)',
    'introduction': '서론 (Introduction)',
    'related work': '관련 연구 (Related Work)',
    'background': '배경 (Background)',
    'method': '방법론 (Method)',
    'methods': '방법론 (Methods)',
    'methodology': '방법론 (Methodology)',
    'approach': '접근법 (Approach)',
    'model': '모델 (Model)',
    'architecture': '아키텍처 (Architecture)',
    'experiment': '실험 (Experiment)',
    'experiments': '실험 (Experiments)',
    'results': '결과 (Results)',
    'discussion': '토의 (Discussion)',
    'conclusion': '결론 (Conclusion)',
    'conclusions': '결론 (Conclusions)',
    'future work': '향후 연구 (Future Work)',
    'acknowledgments': '감사의 글 (Acknowledgments)',
    'references': '참고문헌 (References)',
  };

  const lower = name.toLowerCase().trim();
  return mapping[lower] || name;
}

/**
 * Figure 정보 추출
 */
function extractFigureInfo(text: string): Figure[] {
  const figures: Figure[] = [];

  // "Figure 1:" 또는 "Fig. 1." 패턴
  const figurePattern = /(?:figure|fig\.?)\s*(\d+[a-z]?)[\s:.]+([^\n]+(?:\n(?![A-Z]|\d\.)[^\n]+)*)/gi;

  let match;
  while ((match = figurePattern.exec(text)) !== null) {
    const figNum = match[1];
    const caption = match[2].trim().replace(/\s+/g, ' ');

    figures.push({
      id: `fig${figNum}`,
      number: `Figure ${figNum}`,
      caption: caption,
      pageNumber: 0, // PDF 페이지 정보 없음
    });
  }

  return figures;
}

/**
 * Table 정보 추출
 */
function extractTableInfo(text: string): Table[] {
  const tables: Table[] = [];

  // "Table 1:" 패턴
  const tablePattern = /table\s*(\d+)[\s:.]+([^\n]+)/gi;

  let match;
  while ((match = tablePattern.exec(text)) !== null) {
    const tableNum = match[1];
    const caption = match[2].trim();

    tables.push({
      id: `table${tableNum}`,
      number: `Table ${tableNum}`,
      caption: caption,
      headers: [],
      rows: [],
      pageNumber: 0,
    });
  }

  return tables;
}

/**
 * References 추출
 */
function extractReferences(text: string): string[] {
  const references: string[] = [];

  // References 섹션 찾기
  const refMatch = text.match(/references\s*\n([\s\S]*?)(?=\n\s*(?:appendix|supplementary)|$)/i);

  if (refMatch) {
    const refText = refMatch[1];
    // [1] 또는 1. 형식의 참고문헌
    const refPattern = /(?:\[(\d+)\]|^(\d+)\.)\s*([^\n\[]+(?:\n(?!\[|\d+\.).*)*)/gm;

    let refMatch2;
    while ((refMatch2 = refPattern.exec(refText)) !== null) {
      const refContent = refMatch2[3].trim().replace(/\s+/g, ' ');
      if (refContent.length > 10) {
        references.push(refContent);
      }
    }
  }

  return references.slice(0, 100); // 최대 100개
}

/**
 * 원문 텍스트를 파일로 저장
 */
export function saveOriginalText(text: string, outputDir: string, fileName: string): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${fileName}_original.txt`);
  fs.writeFileSync(outputPath, text, 'utf-8');

  return outputPath;
}
