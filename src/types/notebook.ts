// Jupyter Notebook 타입 정의

export type CellType = 'code' | 'markdown';

export interface NotebookCell {
  cell_type: CellType;
  source: string[];
  metadata: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: CellOutput[];
}

export interface CellOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error';
  text?: string[];
  data?: Record<string, unknown>;
  name?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

export interface NotebookMetadata {
  kernelspec: {
    display_name: string;
    language: string;
    name: string;
  };
  language_info: {
    name: string;
    version: string;
    codemirror_mode?: { name: string; version: number };
    file_extension: string;
    mimetype: string;
    nbconvert_exporter: string;
    pygments_lexer: string;
  };
}

export interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

export type Domain = 'ml' | 'quantum';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface ConceptSection {
  title: string;
  explanation: string;
  formulas?: string[];
  codeSteps: CodeStep[];
  visualization?: string;
  exercises?: string[];
}

export interface CodeStep {
  description: string;
  code: string;
  explanation?: string;
}

export interface PaperAnalysis {
  title: string;
  domain: Domain;
  keyConcepts: string[];
  sections: ConceptSection[];
  prerequisites: string[];
  estimatedTime: string;
}

export interface GenerateNotebookOptions {
  paperContent: string;
  domain: Domain;
  difficulty: Difficulty;
  includeExperiments: boolean;
  outputPath: string;
}

export interface GenerateConceptOptions {
  concept: string;
  paperContext: string;
  domain: Domain;
  withVisualization: boolean;
  withExampleData: boolean;
}

export interface ImplementFormulaOptions {
  latex: string;
  description: string;
  domain: Domain;
  generateTestCase: boolean;
}

export interface CreateExperimentOptions {
  experimentDescription: string;
  figureReference?: string;
  scaleDown: boolean;
  domain: Domain;
}
