import * as fs from 'fs';
import * as path from 'path';
import { Paper, ExportFormat } from '../types/paper.js';
import { getPaperDetails } from './details.js';
import {
  paperToBibTeXString,
  papersToBibTeXFile,
  papersToCSV,
  papersToJSON,
} from '../utils/bibtex.js';

// 논문 목록 내보내기
export async function exportPapers(
  papers: Paper[],
  format: ExportFormat,
  outputPath: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    let content: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = papersToJSON(papers);
        extension = '.json';
        break;
      case 'csv':
        content = papersToCSV(papers);
        extension = '.csv';
        break;
      case 'bibtex':
        content = papersToBibTeXFile(papers);
        extension = '.bib';
        break;
      default:
        return {
          success: false,
          error: `Unsupported format: ${format}`,
        };
    }

    // 경로 처리
    let finalPath = outputPath;

    // 확장자 추가
    if (!finalPath.toLowerCase().endsWith(extension)) {
      finalPath += extension;
    }

    // 디렉토리 생성
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 파일 저장
    fs.writeFileSync(finalPath, content, 'utf-8');

    return {
      success: true,
      filePath: finalPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 단일 논문 BibTeX 내보내기
export async function exportBibTeX(paperId: string): Promise<{
  success: boolean;
  bibtex?: string;
  error?: string;
}> {
  try {
    const paper = await getPaperDetails(paperId);

    if (!paper) {
      return {
        success: false,
        error: `Paper not found: ${paperId}`,
      };
    }

    const bibtex = paperToBibTeXString(paper);

    return {
      success: true,
      bibtex,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 내보내기 결과 포맷팅
export function formatExportResult(
  result: { success: boolean; filePath?: string; error?: string },
  format: ExportFormat
): string {
  if (result.success) {
    return `Successfully exported papers to ${format.toUpperCase()} format\nSaved to: ${result.filePath}`;
  } else {
    return `Failed to export papers\nError: ${result.error}`;
  }
}

// BibTeX 결과 포맷팅
export function formatBibTeXResult(
  result: { success: boolean; bibtex?: string; error?: string },
  paperId: string
): string {
  if (result.success && result.bibtex) {
    return `## BibTeX for ${paperId}\n\n\`\`\`bibtex\n${result.bibtex}\n\`\`\`\n\nYou can copy this BibTeX entry to your reference manager.`;
  } else {
    return `Failed to generate BibTeX for ${paperId}\nError: ${result.error}`;
  }
}
