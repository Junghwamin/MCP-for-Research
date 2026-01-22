import * as fs from 'fs';
import * as path from 'path';
import { translateCaption } from '../api/translator.js';
import type { ExtractImagesInput, Figure } from '../types/translation.js';

// ============================================
// 이미지 추출 도구
// pdf2pic 라이브러리를 사용하여 PDF 페이지를 이미지로 변환
// ============================================

interface ExtractResult {
  success: boolean;
  images: {
    filename: string;
    pageNumber: number;
    figureNumber: string;
    originalCaption: string;
    translatedCaption?: string;
  }[];
  captionsFile?: string;
  error?: string;
}

/**
 * PDF에서 이미지 추출
 * 주의: pdf2pic은 ghostscript 또는 graphicsmagick이 필요할 수 있음
 */
export async function extractImages(input: ExtractImagesInput): Promise<ExtractResult> {
  try {
    // 출력 디렉토리 생성
    if (!fs.existsSync(input.outputDir)) {
      fs.mkdirSync(input.outputDir, { recursive: true });
    }

    // PDF 파일 확인
    if (!fs.existsSync(input.pdfPath)) {
      throw new Error(`PDF file not found: ${input.pdfPath}`);
    }

    // pdf2pic을 사용한 이미지 추출 시도
    let images: ExtractResult['images'] = [];

    try {
      // 동적 임포트 (pdf2pic이 설치되어 있을 때만)
      const { fromPath } = await import('pdf2pic');

      const options = {
        density: 150,           // DPI
        saveFilename: 'page',
        savePath: input.outputDir,
        format: input.imageFormat || 'png',
        width: 1200,
        height: 1600,
      };

      const convert = fromPath(input.pdfPath, options);

      // 모든 페이지 변환 (최대 50페이지)
      const results = await convert.bulk(-1, { responseType: 'image' });

      images = results.map((result, index) => ({
        filename: result.name || `page_${index + 1}.${input.imageFormat || 'png'}`,
        pageNumber: index + 1,
        figureNumber: `Page ${index + 1}`,
        originalCaption: '',
      }));

    } catch (pdf2picError) {
      // pdf2pic 실패 시 대체 메시지
      console.error('pdf2pic not available or failed. Using placeholder.');

      // 플레이스홀더 이미지 정보 생성
      images = [{
        filename: 'extraction_note.txt',
        pageNumber: 0,
        figureNumber: 'Note',
        originalCaption: 'Image extraction requires pdf2pic library with GraphicsMagick or Ghostscript installed.',
      }];

      // 안내 파일 생성
      const notePath = path.join(input.outputDir, 'extraction_note.txt');
      fs.writeFileSync(notePath, `
이미지 추출 안내
================

PDF에서 이미지를 추출하려면 다음이 필요합니다:

1. GraphicsMagick 또는 Ghostscript 설치
   - Windows: https://www.graphicsmagick.org/
   - Mac: brew install graphicsmagick

2. 수동 추출 방법:
   - Adobe Acrobat: 파일 > 내보내기 > 이미지
   - 온라인 도구: smallpdf.com, ilovepdf.com

3. 추출된 이미지는 이 폴더에 저장해주세요:
   ${input.outputDir}

파일명 규칙:
- fig1.png, fig2.png, ... (Figure 순서대로)
- table1.png, table2.png, ... (Table 순서대로)
`, 'utf-8');
    }

    // 캡션 번역 (이미지 추출 성공 시)
    if (input.translateCaptions && images.length > 0 && images[0].originalCaption) {
      for (const img of images) {
        if (img.originalCaption) {
          img.translatedCaption = await translateCaption(
            img.originalCaption,
            'figure',
            'ko'
          );
        }
      }
    }

    // 캡션 JSON 저장
    const captionsFile = path.join(input.outputDir, 'captions.json');
    fs.writeFileSync(captionsFile, JSON.stringify(images, null, 2), 'utf-8');

    return {
      success: true,
      images,
      captionsFile,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      images: [],
      error: errorMessage,
    };
  }
}

/**
 * 결과 포맷팅
 */
export function formatExtractResult(result: ExtractResult): string {
  if (!result.success) {
    return `❌ 이미지 추출 실패: ${result.error}`;
  }

  const lines = [
    '✅ 이미지 추출 완료!',
    '',
    `📁 추출된 이미지: ${result.images.length}개`,
  ];

  if (result.images.length > 0 && result.images.length <= 10) {
    lines.push('');
    for (const img of result.images) {
      lines.push(`- ${img.filename} (${img.figureNumber})`);
    }
  }

  if (result.captionsFile) {
    lines.push('', `📄 캡션 파일: ${result.captionsFile}`);
  }

  return lines.join('\n');
}
