import type { Figure, Table } from '../types/translation.js';

// ============================================
// 마크다운 생성 유틸리티
// ============================================

interface MarkdownInput {
  title: string;
  translatedTitle: string;
  authors: string[];
  abstract: string;
  sections: { name: string; content: string }[];
  figures: Figure[];
  tables: Table[];
  references: string[];
}

/**
 * 번역된 논문을 마크다운으로 생성
 */
export function generateMarkdown(input: MarkdownInput): string {
  const lines: string[] = [];

  // 제목
  lines.push(`# ${input.translatedTitle}`);
  lines.push(`*원제: ${input.title}*`);
  lines.push('');

  // 저자
  if (input.authors.length > 0) {
    lines.push(`**저자**: ${input.authors.join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // 초록
  if (input.abstract) {
    lines.push('## 초록 (Abstract)');
    lines.push('');
    lines.push(input.abstract);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 섹션들
  for (const section of input.sections) {
    lines.push(`## ${section.name}`);
    lines.push('');
    lines.push(section.content);
    lines.push('');
  }

  // Figure 섹션
  if (input.figures.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Figures');
    lines.push('');

    for (const fig of input.figures) {
      lines.push(`### ${fig.number}`);
      if (fig.imagePath) {
        lines.push(`![${fig.number}](${fig.imagePath})`);
      }
      lines.push(`*원문*: ${fig.caption}`);
      if (fig.translatedCaption) {
        lines.push(`*번역*: ${fig.translatedCaption}`);
      }
      lines.push('');
    }
  }

  // Table 섹션
  if (input.tables.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Tables');
    lines.push('');

    for (const table of input.tables) {
      lines.push(`### ${table.number}`);
      lines.push(`*원문*: ${table.caption}`);
      if (table.translatedCaption) {
        lines.push(`*번역*: ${table.translatedCaption}`);
      }

      // 테이블 내용이 있으면 마크다운 테이블로 출력
      if (table.headers.length > 0) {
        lines.push('');
        lines.push('| ' + table.headers.join(' | ') + ' |');
        lines.push('| ' + table.headers.map(() => '---').join(' | ') + ' |');

        for (const row of table.rows) {
          lines.push('| ' + row.join(' | ') + ' |');
        }
      }
      lines.push('');
    }
  }

  // 참고문헌
  if (input.references.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 참고문헌 (References)');
    lines.push('');

    input.references.forEach((ref, i) => {
      lines.push(`[${i + 1}] ${ref}`);
    });
    lines.push('');
  }

  // 푸터
  lines.push('---');
  lines.push('');
  lines.push(`*번역 생성일: ${new Date().toISOString().split('T')[0]}*`);
  lines.push('*도구: paper-translate-mcp v1.0.0*');

  return lines.join('\n');
}

/**
 * 마크다운 테이블 생성
 */
export function createMarkdownTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  const lines: string[] = [];

  // 헤더
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  // 행
  for (const row of rows) {
    // 셀 개수 맞추기
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    lines.push('| ' + paddedRow.slice(0, headers.length).join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * 마크다운 이스케이프
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

/**
 * 마크다운 파싱 (간단한 구조 추출)
 */
export function parseMarkdown(content: string): {
  title: string;
  sections: { level: number; title: string; content: string }[];
  images: { alt: string; path: string }[];
} {
  const lines = content.split('\n');
  const sections: { level: number; title: string; content: string }[] = [];
  const images: { alt: string; path: string }[] = [];
  let title = '';
  let currentSection: { level: number; title: string; content: string } | null = null;

  for (const line of lines) {
    // 제목 (# 로 시작)
    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch && !title) {
      title = titleMatch[1];
      continue;
    }

    // 섹션 헤더 (## 또는 ### 로 시작)
    const sectionMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (sectionMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        level: sectionMatch[1].length,
        title: sectionMatch[2],
        content: '',
      };
      continue;
    }

    // 이미지
    const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imageMatch) {
      images.push({
        alt: imageMatch[1],
        path: imageMatch[2],
      });
    }

    // 섹션 내용
    if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // 마지막 섹션
  if (currentSection) {
    sections.push(currentSection);
  }

  return { title, sections, images };
}
