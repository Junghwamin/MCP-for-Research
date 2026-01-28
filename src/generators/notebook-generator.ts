import * as fs from 'fs';
import * as path from 'path';
import {
  JupyterNotebook,
  NotebookCell,
  Domain,
  Difficulty,
  ConceptSection,
  PaperAnalysis,
  GenerateNotebookOptions,
  GenerateConceptOptions,
  ImplementFormulaOptions,
  CreateExperimentOptions,
} from '../types/notebook.js';
import {
  analyzePaper,
  generateConceptCode,
  implementFormula,
  generateExperiment,
  generateExampleData,
} from '../llm/gpt-client.js';
import { ML_SETUP_CODE, ML_DATA_TEMPLATES, ML_VISUALIZATION } from '../templates/ml-templates.js';
import { QUANTUM_SETUP_CODE, QUANTUM_DATA_TEMPLATES, QUANTUM_VISUALIZATION } from '../templates/quantum-templates.js';

/**
 * 마크다운 셀 생성
 */
function createMarkdownCell(content: string): NotebookCell {
  return {
    cell_type: 'markdown',
    source: content.split('\n').map((line, i, arr) =>
      i < arr.length - 1 ? line + '\n' : line
    ),
    metadata: {},
  };
}

/**
 * 코드 셀 생성
 */
function createCodeCell(code: string): NotebookCell {
  return {
    cell_type: 'code',
    source: code.split('\n').map((line, i, arr) =>
      i < arr.length - 1 ? line + '\n' : line
    ),
    metadata: {},
    execution_count: null,
    outputs: [],
  };
}

/**
 * 기본 노트북 구조 생성
 */
function createBaseNotebook(): JupyterNotebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.10.0',
        codemirror_mode: { name: 'ipython', version: 3 },
        file_extension: '.py',
        mimetype: 'text/x-python',
        nbconvert_exporter: 'python',
        pygments_lexer: 'ipython3',
      },
    },
    cells: [],
  };
}

/**
 * 메타 정보 셀 생성
 */
function createMetaCell(analysis: PaperAnalysis): NotebookCell {
  const content = `# 📓 ${analysis.title}

## Interactive Learning Notebook

**분야**: ${analysis.domain === 'ml' ? 'Machine Learning / Deep Learning' : 'Quantum Computing'}

**예상 학습 시간**: ${analysis.estimatedTime}

---

### 📚 사전 지식
${analysis.prerequisites.map(p => `- ${p}`).join('\n')}

---

### 🎯 학습 목표
${analysis.keyConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

> 💡 **Tip**: 각 코드 셀을 순서대로 실행하면서 결과를 확인해보세요!
`;

  return createMarkdownCell(content);
}

/**
 * 환경 설정 셀 생성
 */
function createSetupCell(domain: Domain): NotebookCell {
  const setupCode = domain === 'ml' ? ML_SETUP_CODE : QUANTUM_SETUP_CODE;
  return createCodeCell(setupCode);
}

/**
 * 개념 섹션을 노트북 셀들로 변환
 */
function conceptToCell(section: ConceptSection, index: number): NotebookCell[] {
  const cells: NotebookCell[] = [];

  // 섹션 헤더 (마크다운)
  let headerContent = `## 💡 ${index + 1}. ${section.title}\n\n${section.explanation}`;

  // 수식이 있으면 추가
  if (section.formulas && section.formulas.length > 0) {
    headerContent += '\n\n### 📐 수식\n\n';
    headerContent += section.formulas.map(f => `$$${f}$$`).join('\n\n');
  }

  cells.push(createMarkdownCell(headerContent));

  // 코드 단계들
  for (const step of section.codeSteps) {
    // 단계 설명 (마크다운)
    cells.push(createMarkdownCell(`### ${step.description}\n\n${step.explanation || ''}`));

    // 코드 (코드 셀)
    cells.push(createCodeCell(step.code));
  }

  // 시각화 코드가 있으면 추가
  if (section.visualization) {
    cells.push(createMarkdownCell('### 📊 시각화'));
    cells.push(createCodeCell(section.visualization));
  }

  // 연습 문제가 있으면 추가
  if (section.exercises && section.exercises.length > 0) {
    const exerciseContent = `### 🎯 직접 해보기\n\n${section.exercises.map((e, i) => `**${i + 1}.** ${e}`).join('\n\n')}`;
    cells.push(createMarkdownCell(exerciseContent));
    cells.push(createCodeCell('# 여기에 코드를 작성해보세요\n\n'));
  }

  return cells;
}

/**
 * 전체 학습 노트북 생성
 */
export async function generateLearningNotebook(options: GenerateNotebookOptions): Promise<string> {
  const { paperContent, domain, difficulty, includeExperiments, outputPath } = options;

  // 논문 분석
  const analysis = await analyzePaper(paperContent, domain, difficulty);

  // 노트북 구조 생성
  const notebook = createBaseNotebook();

  // 1. 메타 정보
  notebook.cells.push(createMetaCell(analysis));

  // 2. 환경 설정
  notebook.cells.push(createMarkdownCell('---\n\n## 🔧 환경 설정\n\n먼저 필요한 라이브러리를 임포트합니다.'));
  notebook.cells.push(createSetupCell(domain));

  // 3. 예시 데이터 생성
  notebook.cells.push(createMarkdownCell('---\n\n## 📊 예시 데이터\n\n논문의 내용을 이해하기 위한 예시 데이터를 생성합니다.'));

  const dataTemplate = domain === 'ml'
    ? ML_DATA_TEMPLATES.classification
    : QUANTUM_DATA_TEMPLATES.quantum_state;
  notebook.cells.push(createCodeCell(dataTemplate));

  // 4. 각 개념 섹션
  for (let i = 0; i < analysis.sections.length; i++) {
    notebook.cells.push(createMarkdownCell('---'));
    const sectionCells = conceptToCell(analysis.sections[i], i);
    notebook.cells.push(...sectionCells);
  }

  // 5. 실험 섹션 (옵션)
  if (includeExperiments) {
    notebook.cells.push(createMarkdownCell('---\n\n## 🧪 미니 실험\n\n논문의 핵심 아이디어를 작은 규모로 재현해봅니다.'));

    const experimentResult = await generateExperiment(
      `Reproduce the main experiment from the paper: ${analysis.title}`,
      undefined,
      true,
      domain
    );

    notebook.cells.push(createMarkdownCell(`### 실험 설명\n\n${experimentResult.explanation}`));
    notebook.cells.push(createCodeCell(experimentResult.setupCode));
    notebook.cells.push(createCodeCell(experimentResult.experimentCode));
    notebook.cells.push(createMarkdownCell('### 결과 시각화'));
    notebook.cells.push(createCodeCell(experimentResult.visualizationCode));
  }

  // 6. 정리 및 다음 단계
  notebook.cells.push(createMarkdownCell(`---

## 📝 정리

이 노트북에서 배운 내용:
${analysis.keyConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### 🚀 다음 단계

- 논문 원문을 다시 읽어보세요
- 하이퍼파라미터를 변경하며 실험해보세요
- 관련 논문들을 찾아보세요

---

> 이 노트북은 자동 생성되었습니다.
> 코드에 오류가 있거나 개선점이 있다면 수정해보세요!
`));

  // 파일 저장
  const notebookJson = JSON.stringify(notebook, null, 2);
  fs.writeFileSync(outputPath, notebookJson, 'utf-8');

  return outputPath;
}

/**
 * 특정 개념에 대한 코드 셀 생성
 */
export async function generateConceptCell(options: GenerateConceptOptions): Promise<NotebookCell[]> {
  const { concept, paperContext, domain, withVisualization, withExampleData } = options;

  const section = await generateConceptCode(
    concept,
    paperContext,
    domain,
    withVisualization,
    withExampleData
  );

  return conceptToCell(section, 0);
}

/**
 * 수식 구현 코드 생성
 */
export async function generateFormulaImplementation(options: ImplementFormulaOptions): Promise<NotebookCell[]> {
  const { latex, description, domain, generateTestCase } = options;

  const result = await implementFormula(latex, description, domain, generateTestCase);

  const cells: NotebookCell[] = [];

  // 수식 설명 마크다운
  cells.push(createMarkdownCell(`## 수식 구현\n\n$$${latex}$$\n\n${description}\n\n### 설명\n\n${result.explanation}`));

  // 구현 코드
  cells.push(createMarkdownCell('### Python 구현'));
  cells.push(createCodeCell(result.code));

  // 테스트 코드 (옵션)
  if (result.testCode) {
    cells.push(createMarkdownCell('### 테스트'));
    cells.push(createCodeCell(result.testCode));
  }

  return cells;
}

/**
 * 실험 재현 코드 생성
 */
export async function generateExperimentCells(options: CreateExperimentOptions): Promise<NotebookCell[]> {
  const { experimentDescription, figureReference, scaleDown, domain } = options;

  const result = await generateExperiment(experimentDescription, figureReference, scaleDown, domain);

  const cells: NotebookCell[] = [];

  // 실험 설명
  cells.push(createMarkdownCell(`## 🧪 실험 재현${figureReference ? ` (${figureReference})` : ''}\n\n${result.explanation}`));

  // 설정 코드
  cells.push(createMarkdownCell('### 설정'));
  cells.push(createCodeCell(result.setupCode));

  // 실험 코드
  cells.push(createMarkdownCell('### 실험 실행'));
  cells.push(createCodeCell(result.experimentCode));

  // 시각화
  cells.push(createMarkdownCell('### 결과 시각화'));
  cells.push(createCodeCell(result.visualizationCode));

  return cells;
}

/**
 * 노트북을 파일로 저장
 */
export function saveNotebook(notebook: JupyterNotebook, outputPath: string): void {
  const notebookJson = JSON.stringify(notebook, null, 2);
  fs.writeFileSync(outputPath, notebookJson, 'utf-8');
}

/**
 * 셀들을 기존 노트북에 추가
 */
export function appendCellsToNotebook(notebookPath: string, cells: NotebookCell[]): void {
  const content = fs.readFileSync(notebookPath, 'utf-8');
  const notebook: JupyterNotebook = JSON.parse(content);
  notebook.cells.push(...cells);
  saveNotebook(notebook, notebookPath);
}
