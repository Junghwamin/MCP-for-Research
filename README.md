# MCP for Research

Academic research MCP (Model Context Protocol) servers for paper discovery, analysis, and translation.

## MCP Servers

### 1. [paper-search-mcp](./paper-search-mcp/)
Search and analyze academic papers from arXiv, Semantic Scholar, and OpenReview.

**Tools:**
- `search_papers` - Search papers by keywords with filters
- `get_paper_details` - Get detailed paper information
- `search_by_author` - Find papers by author
- `get_citations` / `get_references` - Citation analysis
- `get_related_papers` - Find similar papers
- `download_paper` - Download PDF
- `export_papers` / `export_bibtex` - Export to JSON/CSV/BibTeX
- `search_openreview` / `get_openreview_info` - OpenReview integration
- `summarize_paper` - Generate paper summary

### 2. [paper-translate-mcp](./paper-translate-mcp/)
Translate academic papers with AI/ML terminology preservation.

**Tools:**
- `translate_paper` - Full PDF paper translation
- `summarize_paper` - Quick summary generation
- `extract_paper_images` - Extract figures/diagrams
- `translate_table` - Table translation
- `export_translation` - Export to DOCX
- `manage_glossary` - AI/ML terminology glossary

### 3. [paper-formula-mcp](./paper-formula-mcp/)
Analyze mathematical formulas in papers and generate Mermaid diagrams.

**Tools:**
- `extract_formulas` - Extract LaTeX formulas with role classification
- `explain_formula` - Explain formula meaning (Korean/English)
- `generate_formula_dependency` - Formula dependency graph
- `generate_concept_map` - Concept relationship diagram
- `generate_evolution_diagram` - Paper evolution timeline
- `analyze_formula_variables` - Variable usage analysis
- `analyze_formula_roles` - Formula role flow diagram

**Formula Roles:**
- Definition, Objective, Constraint, Theorem, Derivation, Approximation, Example, Baseline

## Installation

### paper-search-mcp
```bash
cd paper-search-mcp
npm install
npm run build
```

### paper-translate-mcp
```bash
cd paper-translate-mcp
npm install
npm run build
```

### paper-formula-mcp
```bash
cd paper-formula-mcp
npm install
npm run build
```

## Claude Code Configuration

Add to your Claude Code settings:

```json
{
  "mcpServers": {
    "paper-search": {
      "command": "node",
      "args": ["path/to/paper-search-mcp/dist/index.js"]
    },
    "paper-translate": {
      "command": "node",
      "args": ["path/to/paper-translate-mcp/dist/index.js"]
    },
    "paper-formula": {
      "command": "node",
      "args": ["path/to/paper-formula-mcp/dist/index.js"]
    }
  }
}
```

## Supported Languages (paper-translate-mcp)
- Korean (ko)
- English (en)
- Japanese (ja)
- Chinese (zh)

## License
MIT
