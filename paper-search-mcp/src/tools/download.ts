import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { getPaperDetails } from './details.js';
import { DownloadResult } from '../types/paper.js';

// PDF 다운로드
export async function downloadPaper(
  paperId: string,
  outputPath: string
): Promise<DownloadResult> {
  try {
    // 논문 정보 가져오기
    const paper = await getPaperDetails(paperId);

    if (!paper) {
      return {
        success: false,
        error: `Paper not found: ${paperId}`,
      };
    }

    // PDF URL 확인
    const pdfUrl = paper.pdfUrl;

    if (!pdfUrl) {
      return {
        success: false,
        error: `No PDF available for paper: ${paperId}`,
      };
    }

    // 출력 경로 처리
    let finalPath = outputPath;

    // 디렉토리인 경우 파일명 생성
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      const safeTitle = paper.title
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 100);
      finalPath = path.join(outputPath, `${safeTitle}.pdf`);
    }

    // 확장자 추가
    if (!finalPath.toLowerCase().endsWith('.pdf')) {
      finalPath += '.pdf';
    }

    // 디렉토리 생성
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // PDF 다운로드
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PaperSearchMCP/1.0)',
      },
      timeout: 60000, // 60초 타임아웃
    });

    // 파일 저장
    fs.writeFileSync(finalPath, response.data);

    return {
      success: true,
      filePath: finalPath,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        return {
          success: false,
          error: `PDF not found at the source`,
        };
      }
      return {
        success: false,
        error: `Download failed: ${error.message}`,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: `Download failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: 'Unknown error occurred during download',
    };
  }
}

// 다운로드 결과 포맷팅
export function formatDownloadResult(result: DownloadResult, paperId: string): string {
  if (result.success) {
    return `Successfully downloaded paper ${paperId}\nSaved to: ${result.filePath}`;
  } else {
    return `Failed to download paper ${paperId}\nError: ${result.error}`;
  }
}
