import * as fs from 'fs';
import * as path from 'path';
import { generateDocx } from '../utils/docxGenerator.js';
import { parseMarkdown } from '../utils/markdown.js';
import type { ExportTranslationInput } from '../types/translation.js';

// ============================================
// 번역 결과 내보내기 도구
// ============================================

interface ExportResult {
  success: boolean;
  outputPath: string;
  format: string;
  fileSize?: number;
  error?: string;
}

/**
 * 번역 결과를 다양한 형식으로 내보내기
 */
export async function exportTranslation(input: ExportTranslationInput): Promise<ExportResult> {
  try {
    // 마크다운 파일 확인
    if (!fs.existsSync(input.translatedMdPath)) {
      throw new Error(`Markdown file not found: ${input.translatedMdPath}`);
    }

    const format = input.format || 'docx';

    switch (format) {
      case 'docx':
        return await exportToDocx(input);
      case 'html':
        return await exportToHtml(input);
      case 'pdf':
        return await exportToPdf(input);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      outputPath: input.outputPath,
      format: input.format || 'docx',
      error: errorMessage,
    };
  }
}

/**
 * DOCX로 내보내기
 */
async function exportToDocx(input: ExportTranslationInput): Promise<ExportResult> {
  // DOCX 생성
  await generateDocx(
    input.translatedMdPath,
    input.outputPath,
    input.imagesDir
  );

  // 파일 크기 확인
  const stats = fs.statSync(input.outputPath);

  return {
    success: true,
    outputPath: input.outputPath,
    format: 'docx',
    fileSize: stats.size,
  };
}

/**
 * HTML로 내보내기
 */
async function exportToHtml(input: ExportTranslationInput): Promise<ExportResult> {
  const mdContent = fs.readFileSync(input.translatedMdPath, 'utf-8');
  const parsed = parseMarkdown(mdContent);

  // HTML 생성
  const html = generateHtmlDocument(mdContent, parsed.title, input.imagesDir);

  // 파일 저장
  fs.writeFileSync(input.outputPath, html, 'utf-8');

  const stats = fs.statSync(input.outputPath);

  return {
    success: true,
    outputPath: input.outputPath,
    format: 'html',
    fileSize: stats.size,
  };
}

/**
 * PDF로 내보내기 (미지원 - 안내 메시지)
 */
async function exportToPdf(input: ExportTranslationInput): Promise<ExportResult> {
  // PDF 직접 생성은 복잡하므로 DOCX를 먼저 생성하고 안내
  const docxPath = input.outputPath.replace(/\.pdf$/i, '.docx');

  await generateDocx(
    input.translatedMdPath,
    docxPath,
    input.imagesDir
  );

  // 안내 파일 생성
  const noteContent = `PDF 변환 안내
=============

DOCX 파일이 생성되었습니다: ${path.basename(docxPath)}

PDF로 변환하려면:
1. Microsoft Word에서 DOCX 파일 열기
2. 파일 > 다른 이름으로 저장 > PDF 선택

또는 온라인 변환:
- https://smallpdf.com/word-to-pdf
- https://www.ilovepdf.com/word_to_pdf
`;

  const notePath = input.outputPath.replace(/\.pdf$/i, '_pdf_guide.txt');
  fs.writeFileSync(notePath, noteContent, 'utf-8');

  return {
    success: true,
    outputPath: docxPath,
    format: 'pdf (as docx)',
    fileSize: fs.statSync(docxPath).size,
  };
}

/**
 * HTML 문서 생성
 */
function generateHtmlDocument(
  mdContent: string,
  title: string,
  imagesDir?: string
): string {
  // 간단한 마크다운 → HTML 변환
  let html = mdContent
    // 제목
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // 볼드/이탤릭
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 코드
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // 이미지
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const imgSrc = imagesDir ? `file://${path.join(imagesDir, path.basename(src))}` : src;
      return `<figure><img src="${imgSrc}" alt="${alt}" style="max-width:100%;"><figcaption>${alt}</figcaption></figure>`;
    })
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 수평선
    .replace(/^-{3,}$/gm, '<hr>')
    // 리스트
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // 줄바꿈 → 단락
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // 테이블 처리 (간단한 변환)
  html = html.replace(
    /\|(.+)\|\n\|[-|\s]+\|\n((?:\|.+\|\n?)+)/g,
    (_, header, body) => {
      const headers = header.split('|').filter((h: string) => h.trim());
      const rows = body.trim().split('\n').map((row: string) =>
        row.split('|').filter((c: string) => c.trim())
      );

      let table = '<table border="1" cellpadding="8" cellspacing="0">';
      table += '<thead><tr>' + headers.map((h: string) => `<th>${h.trim()}</th>`).join('') + '</tr></thead>';
      table += '<tbody>';
      for (const row of rows) {
        table += '<tr>' + row.map((c: string) => `<td>${c.trim()}</td>`).join('') + '</tr>';
      }
      table += '</tbody></table>';
      return table;
    }
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || '번역된 논문'}</title>
  <style>
    body {
      font-family: '맑은 고딕', 'Malgun Gothic', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { font-size: 24pt; color: #1a1a1a; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 16pt; color: #2a2a2a; margin-top: 30px; }
    h3 { font-size: 13pt; color: #3a3a3a; }
    p { margin: 1em 0; text-align: justify; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: Consolas, monospace; }
    pre { background: #f5f5f5; padding: 15px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f0f0f0; font-weight: bold; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    figure { text-align: center; margin: 30px 0; }
    figcaption { font-style: italic; color: #666; margin-top: 10px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    em { color: #666; }
  </style>
</head>
<body>
  <p>${html}</p>
  <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 10pt;">
    번역 생성일: ${new Date().toISOString().split('T')[0]}<br>
    도구: paper-translate-mcp v1.0.0
  </footer>
</body>
</html>`;
}

/**
 * 결과 포맷팅
 */
export function formatExportResult(result: ExportResult): string {
  if (!result.success) {
    return `❌ 내보내기 실패: ${result.error}`;
  }

  const lines = [
    `✅ 내보내기 완료!`,
    '',
    `📄 **형식**: ${result.format.toUpperCase()}`,
    `📁 **파일**: ${result.outputPath}`,
  ];

  if (result.fileSize) {
    const sizeKB = (result.fileSize / 1024).toFixed(1);
    lines.push(`📊 **크기**: ${sizeKB} KB`);
  }

  return lines.join('\n');
}
