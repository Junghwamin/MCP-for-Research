import { Paper, BibTeXEntry } from '../types/paper.js';

// 특수 문자 이스케이프
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// 제목에서 citation key 생성
function generateCitationKey(paper: Paper): string {
  const firstAuthor = paper.authors[0]?.name.split(' ').pop() || 'unknown';
  const year = paper.year || 'nodate';
  const titleWord = paper.title.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'paper';

  return `${firstAuthor.toLowerCase()}${year}${titleWord}`;
}

// 저자 목록을 BibTeX 형식으로 변환
function formatAuthors(paper: Paper): string {
  return paper.authors
    .map(a => a.name)
    .join(' and ');
}

// Paper를 BibTeX 엔트리로 변환
export function paperToBibTeX(paper: Paper): BibTeXEntry {
  const citationKey = generateCitationKey(paper);

  // 엔트리 타입 결정
  let type: 'article' | 'inproceedings' | 'misc' = 'misc';
  if (paper.venue) {
    // 학회인지 저널인지 추정
    const venueUpper = paper.venue.toUpperCase();
    const isConference = [
      'NEURIPS', 'NIPS', 'ICML', 'ICLR', 'CVPR', 'ICCV', 'ECCV',
      'ACL', 'EMNLP', 'NAACL', 'AAAI', 'IJCAI', 'KDD', 'WWW',
      'SIGIR', 'CIKM', 'WSDM', 'ICSE', 'FSE', 'ASE',
    ].some(conf => venueUpper.includes(conf));

    type = isConference ? 'inproceedings' : 'article';
  } else if (paper.arxivId) {
    type = 'misc'; // arXiv preprint
  }

  const fields: BibTeXEntry['fields'] = {
    title: `{${paper.title}}`,
    author: formatAuthors(paper),
    year: paper.year?.toString() || '',
  };

  // 학회/저널 정보
  if (type === 'inproceedings' && paper.venue) {
    fields.booktitle = paper.venue;
  } else if (type === 'article' && paper.venue) {
    fields.journal = paper.venue;
  }

  // arXiv 정보
  if (paper.arxivId) {
    fields.eprint = paper.arxivId;
    fields.archivePrefix = 'arXiv';
    if (paper.categories && paper.categories.length > 0) {
      fields.primaryClass = paper.categories[0];
    }
  }

  // DOI
  if (paper.doi) {
    fields.doi = paper.doi;
  }

  // URL
  if (paper.url) {
    fields.url = paper.url;
  }

  return {
    type,
    citationKey,
    fields,
  };
}

// BibTeX 엔트리를 문자열로 변환
export function bibtexEntryToString(entry: BibTeXEntry): string {
  const lines: string[] = [];
  lines.push(`@${entry.type}{${entry.citationKey},`);

  const fieldOrder = [
    'title', 'author', 'booktitle', 'journal', 'year',
    'volume', 'pages', 'doi', 'url', 'eprint', 'archivePrefix', 'primaryClass',
  ];

  for (const field of fieldOrder) {
    const value = entry.fields[field as keyof typeof entry.fields];
    if (value) {
      lines.push(`  ${field} = {${value}},`);
    }
  }

  // 마지막 콤마 제거
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  }

  lines.push('}');

  return lines.join('\n');
}

// Paper를 BibTeX 문자열로 직접 변환
export function paperToBibTeXString(paper: Paper): string {
  const entry = paperToBibTeX(paper);
  return bibtexEntryToString(entry);
}

// 여러 논문을 BibTeX 파일 내용으로 변환
export function papersToBibTeXFile(papers: Paper[]): string {
  const entries = papers.map(p => paperToBibTeXString(p));
  return entries.join('\n\n');
}

// 논문 목록을 CSV로 변환
export function papersToCSV(papers: Paper[]): string {
  const headers = [
    'id',
    'title',
    'authors',
    'year',
    'venue',
    'citationCount',
    'abstract',
    'arxivId',
    'doi',
    'url',
    'pdfUrl',
  ];

  const rows: string[] = [];
  rows.push(headers.join(','));

  for (const paper of papers) {
    const row = [
      escapeCSV(paper.id),
      escapeCSV(paper.title),
      escapeCSV(paper.authors.map(a => a.name).join('; ')),
      paper.year?.toString() || '',
      escapeCSV(paper.venue || ''),
      paper.citationCount?.toString() || '',
      escapeCSV(paper.abstract),
      escapeCSV(paper.arxivId || ''),
      escapeCSV(paper.doi || ''),
      escapeCSV(paper.url || ''),
      escapeCSV(paper.pdfUrl || ''),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

// CSV 필드 이스케이프
function escapeCSV(value: string): string {
  if (!value) return '';

  // 쌍따옴표, 쉼표, 줄바꿈이 포함된 경우 따옴표로 감싸기
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// 논문 목록을 JSON으로 변환
export function papersToJSON(papers: Paper[]): string {
  return JSON.stringify(papers, null, 2);
}
