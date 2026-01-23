import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertInchesToTwip,
} from 'docx';
import { parseMarkdown } from './markdown.js';

// ============================================
// DOCX 문서 생성기
// ============================================

// DOCX 스타일 설정
const STYLES = {
  fontSize: {
    title: 32,      // 16pt * 2
    h1: 28,         // 14pt * 2
    h2: 26,         // 13pt * 2
    h3: 24,         // 12pt * 2
    body: 22,       // 11pt * 2
    caption: 20,    // 10pt * 2
  },
  font: '맑은 고딕',
  lineSpacing: 360, // 1.5 줄간격 (240 * 1.5)
  margins: {
    top: convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left: convertInchesToTwip(1),
    right: convertInchesToTwip(1),
  },
};

/**
 * 마크다운 파일을 DOCX로 변환
 */
export async function generateDocx(
  mdPath: string,
  outputPath: string,
  imagesDir?: string
): Promise<void> {
  // 마크다운 읽기
  const mdContent = fs.readFileSync(mdPath, 'utf-8');
  const parsed = parseMarkdown(mdContent);

  // 문서 요소 생성
  const children: Paragraph[] = [];

  // 제목
  if (parsed.title) {
    children.push(createTitle(parsed.title));
    children.push(createEmptyParagraph());
  }

  // 마크다운 라인별 처리
  const lines = mdContent.split('\n');
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 빈 줄
    if (!line.trim()) {
      if (inTable && tableHeaders.length > 0) {
        // 테이블 종료
        children.push(createTable(tableHeaders, tableRows));
        tableHeaders = [];
        tableRows = [];
        inTable = false;
      }
      children.push(createEmptyParagraph());
      continue;
    }

    // 제목 (#)
    if (line.startsWith('# ') && children.length === 0) {
      continue; // 이미 처리됨
    }

    // H2 (##)
    if (line.startsWith('## ')) {
      const text = line.replace(/^##\s+/, '');
      children.push(createHeading(text, HeadingLevel.HEADING_1));
      continue;
    }

    // H3 (###)
    if (line.startsWith('### ')) {
      const text = line.replace(/^###\s+/, '');
      children.push(createHeading(text, HeadingLevel.HEADING_2));
      continue;
    }

    // 구분선 (---)
    if (line.match(/^-{3,}$/)) {
      children.push(createHorizontalLine());
      continue;
    }

    // 이탤릭 텍스트 (*text*)
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      const text = line.slice(1, -1);
      children.push(createItalicParagraph(text));
      continue;
    }

    // 볼드 텍스트 (**text**)
    if (line.startsWith('**') && line.endsWith('**')) {
      const text = line.slice(2, -2);
      children.push(createBoldParagraph(text));
      continue;
    }

    // 이미지 (![alt](path))
    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      const imagePath = imageMatch[2];
      const fullImagePath = imagesDir
        ? path.join(imagesDir, path.basename(imagePath))
        : imagePath;

      if (fs.existsSync(fullImagePath)) {
        try {
          const imageBuffer = fs.readFileSync(fullImagePath);
          children.push(createImage(imageBuffer, imageMatch[1]));
        } catch {
          children.push(createParagraph(`[이미지: ${imageMatch[1]}]`));
        }
      } else {
        children.push(createParagraph(`[이미지: ${imageMatch[1]}]`));
      }
      continue;
    }

    // 테이블 헤더 (| col1 | col2 |)
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());

      // 구분선 체크 (| --- | --- |)
      if (cells.every(c => c.match(/^-+$/))) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        // 헤더 행
        tableHeaders = cells;
      } else {
        // 데이터 행
        tableRows.push(cells);
      }
      continue;
    }

    // 리스트 아이템 (- item 또는 1. item)
    if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
      const text = line.replace(/^[-*\d.]+\s+/, '');
      children.push(createListItem(text));
      continue;
    }

    // 일반 텍스트
    children.push(createParagraph(line));
  }

  // 남은 테이블 처리
  if (tableHeaders.length > 0) {
    children.push(createTable(tableHeaders, tableRows));
  }

  // 문서 생성
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: STYLES.margins,
          },
        },
        children: children,
      },
    ],
  });

  // 파일 저장
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
}

/**
 * 제목 생성
 */
function createTitle(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: STYLES.fontSize.title,
        font: STYLES.font,
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

/**
 * 헤딩 생성
 */
function createHeading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.HEADING_2): Paragraph {
  const fontSize = level === HeadingLevel.HEADING_1
    ? STYLES.fontSize.h1
    : STYLES.fontSize.h2;

  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: fontSize,
        font: STYLES.font,
      }),
    ],
    heading: level,
    spacing: { before: 400, after: 200 },
  });
}

/**
 * 일반 단락 생성
 */
function createParagraph(text: string): Paragraph {
  // 인라인 마크다운 처리
  const runs = parseInlineMarkdown(text);

  return new Paragraph({
    children: runs,
    spacing: { line: STYLES.lineSpacing, after: 120 },
  });
}

/**
 * 볼드 단락 생성
 */
function createBoldParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: STYLES.fontSize.body,
        font: STYLES.font,
      }),
    ],
    spacing: { line: STYLES.lineSpacing, after: 120 },
  });
}

/**
 * 이탤릭 단락 생성
 */
function createItalicParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        italics: true,
        size: STYLES.fontSize.caption,
        font: STYLES.font,
      }),
    ],
    spacing: { line: STYLES.lineSpacing, after: 120 },
  });
}

/**
 * 리스트 아이템 생성
 */
function createListItem(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: '• ' + text,
        size: STYLES.fontSize.body,
        font: STYLES.font,
      }),
    ],
    spacing: { line: STYLES.lineSpacing, after: 80 },
    indent: { left: 720 }, // 0.5인치 들여쓰기
  });
}

/**
 * 빈 단락 생성
 */
function createEmptyParagraph(): Paragraph {
  return new Paragraph({
    children: [],
    spacing: { after: 120 },
  });
}

/**
 * 수평선 생성
 */
function createHorizontalLine(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: '─'.repeat(50),
        size: STYLES.fontSize.body,
        font: STYLES.font,
        color: 'CCCCCC',
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

/**
 * 이미지 생성
 */
function createImage(imageBuffer: Buffer, altText: string): Paragraph {
  try {
    return new Paragraph({
      children: [
        new ImageRun({
          data: imageBuffer,
          transformation: {
            width: 400,
            height: 300,
          },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  } catch {
    return createParagraph(`[이미지: ${altText}]`);
  }
}

/**
 * 테이블 생성
 */
function createTable(headers: string[], rows: string[][]): Table {
  const tableRows: TableRow[] = [];

  // 헤더 행
  tableRows.push(
    new TableRow({
      children: headers.map(
        (header) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: header,
                    bold: true,
                    size: STYLES.fontSize.body,
                    font: STYLES.font,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: 'E0E0E0' },
          })
      ),
    })
  );

  // 데이터 행
  for (const row of rows) {
    tableRows.push(
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      size: STYLES.fontSize.body,
                      font: STYLES.font,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
    );
  }

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * 인라인 마크다운 파싱
 */
function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remaining = text;

  // 간단한 패턴 매칭 (볼드, 이탤릭, 코드)
  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, style: { bold: true } },
    { regex: /\*([^*]+)\*/g, style: { italics: true } },
    { regex: /`([^`]+)`/g, style: { font: 'Consolas' } },
  ];

  // 패턴 없으면 그냥 텍스트
  let hasPattern = false;
  for (const { regex } of patterns) {
    if (regex.test(text)) {
      hasPattern = true;
      break;
    }
  }

  if (!hasPattern) {
    return [
      new TextRun({
        text: text,
        size: STYLES.fontSize.body,
        font: STYLES.font,
      }),
    ];
  }

  // 패턴 처리 (간소화: 전체 텍스트로 처리)
  runs.push(
    new TextRun({
      text: text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1'),
      size: STYLES.fontSize.body,
      font: STYLES.font,
    })
  );

  return runs;
}

export { STYLES };
