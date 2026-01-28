# Paper Translate MCP

영어 학술 논문을 한국어로 번역하는 MCP (Model Context Protocol) 서버입니다.

## 기능

| 도구 | 설명 |
|------|------|
| `translate_paper` | 전체 논문 번역 (PDF → 마크다운) |
| `translate_section` | 특정 섹션만 번역 |
| `summarize_paper` | 번역 전 핵심 요약 (3줄 + 키워드) |
| `extract_paper_images` | 이미지 추출 + 캡션 번역 |
| `translate_table` | 테이블 추출 및 번역 |
| `manage_glossary` | AI/ML 용어집 관리 |
| `export_translation` | DOCX 문서 생성 (11pt, 맑은 고딕) |

## 특징

- **긴 논문 처리**: 섹션별 분리 + 청킹 시스템으로 원문 손실 방지
- **AI/ML 용어집**: 60개 이상의 전문 용어 일관된 번역
- **다양한 출력**: 마크다운, DOCX 문서 지원
- **이미지/테이블 처리**: 캡션 번역 및 테이블 내용 번역

## 설치

```bash
npm install
npm run build
```

## Claude Desktop / Antigravity 설정

`claude_desktop_config.json` 또는 Antigravity의 `mcp_config.json`에 추가:

```json
{
  "mcpServers": {
    "paper-translate": {
      "command": "node",
      "args": ["path/to/paper-translate-mcp/dist/index.js"]
    }
  }
}
```

**주의:** 이 서버는 **MCP Sampling**을 사용하여 호스트(Antigravity 또는 Claude Desktop)의 LLM 기능을 활용합니다. 별도의 API 키 설정이 필요 없습니다.

## 사용 예시

### 논문 요약
```
summarize_paper로 논문의 핵심 내용을 3줄로 요약
```

### 전체 번역
```
translate_paper로 PDF 논문을 한국어 마크다운으로 번역
```

### DOCX 출력
```
export_translation으로 11pt 맑은 고딕 폰트의 Word 문서 생성
```

## 기술 스택

- TypeScript
- @modelcontextprotocol/sdk
- pdf-parse (PDF 파싱)
- docx (DOCX 생성)
- sharp (이미지 처리)

## 라이선스

MIT
