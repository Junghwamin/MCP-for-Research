# Paper Search MCP Server

CS/AI/ML 분야 학술 논문을 검색하고, 인용 정보를 확인하고, PDF를 다운로드할 수 있는 MCP 서버입니다.

## 기능

- **논문 검색**: arXiv + Semantic Scholar 통합 검색
- **고급 필터**: 연도 범위, 학회/저널 필터
- **인용 분석**: 피인용 논문, 참고문헌, 관련 논문 조회
- **PDF 다운로드**: 오픈 액세스 논문 자동 다운로드
- **내보내기**: JSON, CSV, BibTeX 형식 지원
- **OpenReview 연동**: ML 학회 리뷰 점수 확인
- **논문 요약**: 초록 기반 구조화된 요약

## 설치

```bash
cd paper-search-mcp
npm install
npm run build
```

## Claude Desktop 설정

`claude_desktop_config.json` 파일에 추가:

```json
{
  "mcpServers": {
    "paper-search": {
      "command": "node",
      "args": ["C:/Users/정화민/Desktop/MCP_hwamin/paper-search-mcp/dist/index.js"]
    }
  }
}
```

## 사용 가능한 Tools (13개)

### 검색
| Tool | 설명 |
|------|------|
| `search_papers` | 키워드로 논문 검색 (고급 필터 지원) |
| `search_by_author` | 특정 저자의 논문 검색 |
| `get_paper_details` | 논문 상세 정보 조회 |

### 인용 분석
| Tool | 설명 |
|------|------|
| `get_citations` | 이 논문을 인용한 논문들 |
| `get_references` | 이 논문이 참조하는 논문들 |
| `get_related_papers` | 관련/유사 논문 추천 |

### 다운로드/내보내기
| Tool | 설명 |
|------|------|
| `download_paper` | PDF 다운로드 |
| `export_papers` | 논문 목록 내보내기 (JSON/CSV/BibTeX) |
| `export_bibtex` | 단일 논문 BibTeX 생성 |

### OpenReview
| Tool | 설명 |
|------|------|
| `search_openreview` | OpenReview에서 학회별 논문 검색 |
| `get_openreview_info` | 논문 리뷰 정보 조회 |

### 유틸리티
| Tool | 설명 |
|------|------|
| `summarize_paper` | 논문 요약 생성 |
| `clear_cache` | 검색 캐시 초기화 |

## 사용 예시

### 논문 검색
```
"transformer attention 관련 논문 찾아줘"
→ search_papers(query="transformer attention", maxResults=10)
```

### 연도 필터 검색
```
"2023년 이후 LLM 논문 검색해줘"
→ search_papers(query="large language model", yearFrom=2023)
```

### 특정 학회 검색
```
"NeurIPS 2024 논문 중 reinforcement learning 관련 찾아줘"
→ search_openreview(venue="neurips", query="reinforcement learning", year=2024)
```

### 논문 다운로드
```
"이 논문 PDF 다운로드해줘"
→ download_paper(paperId="2301.00001", outputPath="C:/Downloads")
```

### BibTeX 내보내기
```
"이 논문 BibTeX로 내보내줘"
→ export_bibtex(paperId="2301.00001")
```

## API 소스

- **arXiv API**: 논문 검색, PDF 다운로드
- **Semantic Scholar API**: 인용 정보, 관련 논문
- **OpenReview API**: ML 학회 리뷰 점수

## 지원하는 OpenReview 학회

- NeurIPS
- ICLR
- ICML
- AAAI
- ACL
- EMNLP
- CVPR
- ICCV

## 라이선스

MIT
