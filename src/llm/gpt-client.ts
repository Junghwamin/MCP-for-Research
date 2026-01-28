import OpenAI from 'openai';
import { Domain, Difficulty, ConceptSection, PaperAnalysis, CodeStep } from '../types/notebook.js';

// 환경 변수에서 API 키 로드
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// PennyLane 전용 사용 지시 (양자 컴퓨팅 논문용)
const PENNYLANE_INSTRUCTION = `
CRITICAL REQUIREMENT FOR QUANTUM CODE:
- You MUST use ONLY PennyLane library for ALL quantum computing code
- NEVER use Qiskit, Cirq, or any other quantum library
- All quantum circuits must be implemented using: import pennylane as qml
- Use PennyLane's device: qml.device('default.qubit', wires=n)
- Use @qml.qnode decorator for quantum circuits
- Use PennyLane optimizers: from pennylane.optimize import AdamOptimizer, GradientDescentOptimizer
- Use PennyLane templates: from pennylane.templates import AngleEmbedding, StronglyEntanglingLayers
`;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const MODEL = 'gpt-4o';

/**
 * 논문 내용을 분석하여 학습 구조 생성
 */
export async function analyzePaper(
  paperContent: string,
  domain: Domain,
  difficulty: Difficulty
): Promise<PaperAnalysis> {
  const systemPrompt = `You are an expert educator who creates interactive learning materials from academic papers.
Your task is to analyze the paper and extract key concepts that can be implemented as code.

Domain: ${domain === 'ml' ? 'Machine Learning / Deep Learning' : 'Quantum Computing'}
Difficulty: ${difficulty}
${domain === 'quantum' ? PENNYLANE_INSTRUCTION : ''}

Output JSON format:
{
  "title": "Paper title",
  "domain": "${domain}",
  "keyConcepts": ["concept1", "concept2", ...],
  "prerequisites": ["prerequisite1", ...],
  "estimatedTime": "2-3 hours",
  "sections": [
    {
      "title": "Section title",
      "explanation": "Detailed explanation in Korean",
      "formulas": ["LaTeX formula 1", ...],
      "codeSteps": [
        {
          "description": "Step description",
          "code": "Python code",
          "explanation": "Why this code"
        }
      ],
      "visualization": "Description of visualization to create",
      "exercises": ["Exercise 1", ...]
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please analyze this paper and create a learning structure:\n\n${paperContent}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get response from GPT');
  }

  return JSON.parse(content) as PaperAnalysis;
}

/**
 * 특정 개념에 대한 코드 셀 생성
 */
export async function generateConceptCode(
  concept: string,
  paperContext: string,
  domain: Domain,
  withVisualization: boolean,
  withExampleData: boolean
): Promise<ConceptSection> {
  const domainLibraries = domain === 'ml'
    ? 'PyTorch, NumPy, Matplotlib, scikit-learn'
    : 'PennyLane, NumPy, Matplotlib';

  const quantumNote = domain === 'quantum' ? PENNYLANE_INSTRUCTION : '';

  const systemPrompt = `You are an expert ${domain === 'ml' ? 'ML/DL' : 'Quantum Computing'} educator.
Create executable Python code that explains the concept step by step.

Libraries to use: ${domainLibraries}
Include example data: ${withExampleData}
Include visualization: ${withVisualization}
${quantumNote}

Output JSON format:
{
  "title": "Concept title",
  "explanation": "Korean explanation of the concept",
  "formulas": ["LaTeX formulas used"],
  "codeSteps": [
    {
      "description": "Step description in Korean",
      "code": "Executable Python code",
      "explanation": "Code explanation in Korean"
    }
  ],
  "visualization": "Python code for visualization (if requested)",
  "exercises": ["Exercise questions in Korean"]
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Concept: ${concept}\n\nPaper Context:\n${paperContext}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get response from GPT');
  }

  return JSON.parse(content) as ConceptSection;
}

/**
 * LaTeX 수식을 Python 코드로 변환
 */
export async function implementFormula(
  latex: string,
  description: string,
  domain: Domain,
  generateTestCase: boolean
): Promise<{ code: string; testCode?: string; explanation: string }> {
  const systemPrompt = `You are an expert at implementing mathematical formulas in Python.
Convert the given LaTeX formula into clean, executable Python code.

Domain: ${domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}
Generate test case: ${generateTestCase}

Use appropriate libraries:
- ML: NumPy, PyTorch
- Quantum: NumPy, PennyLane
${domain === 'quantum' ? PENNYLANE_INSTRUCTION : ''}

Output JSON format:
{
  "code": "Python implementation of the formula",
  "testCode": "Test code with example values (if requested)",
  "explanation": "Korean explanation of implementation details"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Formula (LaTeX): ${latex}\n\nDescription: ${description}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get response from GPT');
  }

  return JSON.parse(content);
}

/**
 * 논문의 실험을 재현 가능한 코드로 생성
 */
export async function generateExperiment(
  experimentDescription: string,
  figureReference: string | undefined,
  scaleDown: boolean,
  domain: Domain
): Promise<{ setupCode: string; experimentCode: string; visualizationCode: string; explanation: string }> {
  const systemPrompt = `You are an expert at reproducing paper experiments in Python.
Create executable code that reproduces the experiment ${scaleDown ? '(scaled down for demonstration)' : ''}.

Domain: ${domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}
${domain === 'quantum' ? PENNYLANE_INSTRUCTION : ''}

Output JSON format:
{
  "setupCode": "Import statements and setup code",
  "experimentCode": "Main experiment code",
  "visualizationCode": "Code to visualize results",
  "explanation": "Korean explanation of the experiment"
}`;

  const userMessage = figureReference
    ? `Experiment: ${experimentDescription}\n\nFigure/Table reference: ${figureReference}`
    : `Experiment: ${experimentDescription}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get response from GPT');
  }

  return JSON.parse(content);
}

/**
 * 예시 데이터 생성 코드 생성
 */
export async function generateExampleData(
  context: string,
  domain: Domain,
  dataType: 'classification' | 'regression' | 'sequence' | 'quantum_state' | 'general'
): Promise<{ code: string; description: string }> {
  const systemPrompt = `You are an expert at creating example datasets for educational purposes.
Create Python code that generates appropriate example data for the given context.

Domain: ${domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}
Data type: ${dataType}
${domain === 'quantum' ? PENNYLANE_INSTRUCTION : ''}

Requirements:
- Data should be small enough to run quickly
- Include visualization of the data
- Add comments explaining the data structure

Output JSON format:
{
  "code": "Python code to generate and visualize example data",
  "description": "Korean description of the data"
}`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Context: ${context}` }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Failed to get response from GPT');
  }

  return JSON.parse(content);
}
