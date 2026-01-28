import { parsePDF } from '../parsers/pdfParser.js';
import { translateText, translateCaption, SamplingFunction } from '../api/translator.js';
import type { TranslateTableInput, Table } from '../types/translation.js';

// ============================================
// 테이블 번역 도구
// ============================================

interface TableTranslateResult {
  success: boolean;
  tableNumber: number;
  originalCaption: string;
  translatedCaption: string;
  content: string;
  format: 'markdown' | 'csv' | 'json';
  error?: string;
}

/**
 * 특정 테이블 번역
 */
export async function translateTable(
  input: TranslateTableInput,
  sampler: SamplingFunction
): Promise<TableTranslateResult> {
  try {
    // PDF 파싱
    const { text } = await parsePDF(input.pdfPath);

    // 테이블 추출
    const tables = extractTablesFromText(text);

    if (input.tableNumber > tables.length || input.tableNumber < 1) {
      throw new Error(`Table ${input.tableNumber} not found. Total tables: ${tables.length}`);
    }

    const table = tables[input.tableNumber - 1];

    // 캡션 번역
    const translatedCaption = await translateCaption(
      table.caption,
      'table',
      sampler,
      input.targetLanguage || 'ko'
    );

    // 테이블 내용 번역 (헤더 + 셀)
    const translatedHeaders: string[] = [];
    for (const header of table.headers) {
      const translated = await translateText({
        text: header,
        targetLanguage: input.targetLanguage || 'ko',
        preserveTerms: true,
      }, sampler);
      translatedHeaders.push(translated.trim());
    }

    const translatedRows: string[][] = [];
    for (const row of table.rows) {
      const translatedRow: string[] = [];
      for (const cell of row) {
        // 숫자만 있는 셀은 번역하지 않음
        if (/^[\d.,\-%+±]+$/.test(cell.trim())) {
          translatedRow.push(cell);
        } else {
          const translated = await translateText({
            text: cell,
            targetLanguage: input.targetLanguage || 'ko',
            preserveTerms: true,
          }, sampler);
          translatedRow.push(translated.trim());
        }
      }
      translatedRows.push(translatedRow);
    }

    // 출력 형식에 따라 포맷팅
    const content = formatTableContent(
      translatedHeaders,
      translatedRows,
      input.outputFormat || 'markdown'
    );

    return {
      success: true,
      tableNumber: input.tableNumber,
      originalCaption: table.caption,
      translatedCaption,
      content,
      format: input.outputFormat || 'markdown',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      tableNumber: input.tableNumber,
      originalCaption: '',
      translatedCaption: '',
      content: '',
      format: input.outputFormat || 'markdown',
      error: errorMessage,
    };
  }
}

/**
 * 텍스트에서 테이블 추출
 */
function extractTablesFromText(text: string): Table[] {
  const tables: Table[] = [];

  // "Table N:" 패턴으로 테이블 시작 찾기
  const tablePattern = /table\s*(\d+)[\s:.]+([^\n]+)/gi;

  let match;
  while ((match = tablePattern.exec(text)) !== null) {
    const tableNum = match[1];
    const caption = match[2].trim();

    // 테이블 내용 추출 시도 (간단한 휴리스틱)
    const tableContent = extractTableContent(text, match.index + match[0].length);

    tables.push({
      id: `table${tableNum}`,
      number: `Table ${tableNum}`,
      caption: caption,
      headers: tableContent.headers,
      rows: tableContent.rows,
      pageNumber: 0,
    });
  }

  return tables;
}

/**
 * 테이블 내용 추출 (간단한 구현)
 */
function extractTableContent(
  text: string,
  startIndex: number
): { headers: string[]; rows: string[][] } {
  // 테이블 영역 추출 (다음 빈 줄까지)
  const endIndex = text.indexOf('\n\n', startIndex);
  const tableText = text.slice(startIndex, endIndex > 0 ? endIndex : startIndex + 1000);

  const lines = tableText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 첫 번째 줄을 헤더로 가정
  const headers: string[] = [];
  const rows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 공백이나 탭으로 구분된 셀 추출
    const cells = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter((c) => c.length > 0);

    if (cells.length < 2) continue; // 테이블 행이 아님

    if (headers.length === 0) {
      headers.push(...cells);
    } else {
      rows.push(cells);
    }
  }

  return { headers, rows };
}

/**
 * 테이블 내용을 지정된 형식으로 포맷팅
 */
function formatTableContent(
  headers: string[],
  rows: string[][],
  format: 'markdown' | 'csv' | 'json'
): string {
  switch (format) {
    case 'markdown':
      return formatAsMarkdown(headers, rows);
    case 'csv':
      return formatAsCSV(headers, rows);
    case 'json':
      return formatAsJSON(headers, rows);
    default:
      return formatAsMarkdown(headers, rows);
  }
}

/**
 * 마크다운 형식
 */
function formatAsMarkdown(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '*테이블 내용을 추출할 수 없습니다.*';

  const lines: string[] = [];

  // 헤더
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  // 행
  for (const row of rows) {
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    lines.push('| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * CSV 형식
 */
function formatAsCSV(headers: string[], rows: string[][]): string {
  const lines: string[] = [];

  // 헤더
  lines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

  // 행
  for (const row of rows) {
    lines.push(row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
  }

  return lines.join('\n');
}

/**
 * JSON 형식
 */
function formatAsJSON(headers: string[], rows: string[][]): string {
  const data = rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });

  return JSON.stringify(data, null, 2);
}

/**
 * 결과 포맷팅
 */
export function formatTableResult(result: TableTranslateResult): string {
  if (!result.success) {
    return `❌ 테이블 번역 실패: ${result.error}`;
  }

  const lines = [
    `✅ Table ${result.tableNumber} 번역 완료!`,
    '',
    `**원문 캡션**: ${result.originalCaption}`,
    `**번역 캡션**: ${result.translatedCaption}`,
    '',
    '### 번역된 테이블',
    '',
    result.content,
  ];

  return lines.join('\n');
}
