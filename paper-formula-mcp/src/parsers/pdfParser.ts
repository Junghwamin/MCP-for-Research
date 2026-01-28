import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';

// ============================================
// PDF 파싱 및 텍스트 추출
// ============================================

export interface PDFContent {
  text: string;
  numPages: number;
  metadata: {
    fileName: string;
    filePath: string;
    title?: string;
    author?: string;
  };
}

export interface TextSection {
  name: string;
  content: string;
  pageNumber: number;
}

/**
 * PDF 파일에서 텍스트 추출
 */
export async function parsePDF(pdfPath: string): Promise<PDFContent> {
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
      title: data.info?.Title,
      author: data.info?.Author,
    },
  };
}

/**
 * 텍스트를 섹션별로 분리
 */
export function extractSections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  const lines = text.split('\n');

  const sectionPatterns = [
    /^(\d+)\.?\s+([A-Z][A-Za-z\s]+)$/,
    /^(I{1,3}|IV|V|VI{0,3})\.?\s+([A-Z][A-Za-z\s]+)$/i,
  ];

  const knownSections = [
    'abstract', 'introduction', 'related work', 'background',
    'method', 'methods', 'methodology', 'approach', 'model',
    'experiment', 'experiments', 'results', 'discussion',
    'conclusion', 'conclusions', 'references'
  ];

  let currentSection: TextSection | null = null;
  let estimatedPage = 1;
  let charCount = 0;
  const charsPerPage = 3000;

  for (const line of lines) {
    const trimmedLine = line.trim();
    charCount += line.length;

    if (charCount > charsPerPage * estimatedPage) {
      estimatedPage++;
    }

    let isSectionHeader = false;
    let sectionName = '';

    for (const pattern of sectionPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        sectionName = match[2] || match[1];
        isSectionHeader = true;
        break;
      }
    }

    if (!isSectionHeader) {
      const lineLower = trimmedLine.toLowerCase();
      for (const known of knownSections) {
        if (lineLower === known || lineLower.startsWith(known + ':')) {
          sectionName = trimmedLine;
          isSectionHeader = true;
          break;
        }
      }
    }

    if (isSectionHeader && trimmedLine.length < 80) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        name: sectionName,
        content: '',
        pageNumber: estimatedPage,
      };
    } else if (currentSection) {
      currentSection.content += trimmedLine + '\n';
    } else if (trimmedLine) {
      if (!currentSection) {
        currentSection = {
          name: 'Header',
          content: trimmedLine + '\n',
          pageNumber: estimatedPage,
        };
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections.filter(s => s.content.trim().length > 0);
}

/**
 * 논문 제목 추출
 */
export function extractTitle(text: string, metadata?: { title?: string }): string {
  if (metadata?.title && metadata.title.length > 5) {
    return metadata.title;
  }

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 15);

  let title = '';
  let maxScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('abstract')) break;

    let score = 0;
    score += line.length > 20 && line.length < 150 ? 10 : 0;
    score += /^[A-Z]/.test(line) ? 5 : 0;
    score += i < 5 ? (5 - i) : 0;
    score -= line.includes('@') ? 10 : 0;
    score -= /^\d/.test(line) ? 5 : 0;

    if (score > maxScore) {
      maxScore = score;
      title = line;
    }
  }

  return title || 'Untitled Paper';
}

/**
 * Abstract 추출
 */
export function extractAbstract(text: string): string {
  const patterns = [
    /abstract[:\s]*\n?([\s\S]*?)(?=\n\s*(?:1\.?\s*)?introduction|keywords|index terms)/i,
    /abstract[:\s]*\n?([\s\S]{100,1500}?)(?=\n\n)/i,
  ];

  for (const pattern of patterns) {
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
 * 참고문헌 추출
 */
export function extractReferences(text: string): string[] {
  const references: string[] = [];
  const refMatch = text.match(/references\s*\n([\s\S]*?)(?=\n\s*appendix|$)/i);

  if (refMatch) {
    const refText = refMatch[1];
    const refPattern = /(?:\[(\d+)\]|^(\d+)\.)\s*([^\n\[]+(?:\n(?!\[|\d+\.).*)*)/gm;

    let match;
    while ((match = refPattern.exec(refText)) !== null) {
      const content = match[3].trim().replace(/\s+/g, ' ');
      if (content.length > 20) {
        references.push(content);
      }
    }
  }

  return references.slice(0, 100);
}
