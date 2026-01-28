#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// .env 파일 로드 (간단한 구현)
function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (key && value) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    }

    // dist 폴더에서 실행될 경우 상위 폴더의 .env도 확인
    const parentEnvPath = path.join(process.cwd(), '..', '.env');
    if (!process.env.OPENAI_API_KEY && fs.existsSync(parentEnvPath)) {
      const envContent = fs.readFileSync(parentEnvPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (key && value) {
            process.env[key.trim()] = value.trim();
          }
        }
      }
    }
  } catch (error) {
    // .env 파일이 없어도 괜찮음
  }
}

loadEnv();

// 생성기 임포트
import {
  generateLearningNotebook,
  generateConceptCell,
  generateFormulaImplementation,
  generateExperimentCells,
  saveNotebook,
  appendCellsToNotebook,
} from './generators/notebook-generator.js';

import {
  Domain,
  Difficulty,
  GenerateNotebookOptions,
  GenerateConceptOptions,
  ImplementFormulaOptions,
  CreateExperimentOptions,
  JupyterNotebook,
} from './types/notebook.js';

// 세션 상태 저장 (마법사용)
interface WizardSession {
  id: string;
  step: number;
  domain?: Domain;
  difficulty?: Difficulty;
  includeExperiments?: boolean;
  includeVisualization?: boolean;
  includeExercises?: boolean;
  paperContent?: string;
  outputPath?: string;
  createdAt: Date;
}

const wizardSessions = new Map<string, WizardSession>();

// 세션 정리 (30분 후 만료)
function cleanupSessions() {
  const now = new Date();
  for (const [id, session] of wizardSessions.entries()) {
    if (now.getTime() - session.createdAt.getTime() > 30 * 60 * 1000) {
      wizardSessions.delete(id);
    }
  }
}

// Tool 정의
const TOOLS: Tool[] = [
  {
    name: 'start_notebook_wizard',
    description: '논문 학습 노트북 생성 마법사를 시작합니다. 사용자에게 단계별로 질문하여 맞춤형 노트북을 생성합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        paperContent: {
          type: 'string',
          description: '논문 번역본 내용 (마크다운 형식)',
        },
        paperPath: {
          type: 'string',
          description: '논문 파일 경로 (paperContent 대신 사용 가능)',
        },
      },
    },
  },
  {
    name: 'wizard_answer',
    description: '마법사 질문에 대한 사용자 답변을 처리합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: '마법사 세션 ID',
        },
        answer: {
          type: 'string',
          description: '사용자의 답변',
        },
      },
      required: ['sessionId', 'answer'],
    },
  },
  {
    name: 'generate_learning_notebook',
    description: 'Generate an interactive Jupyter notebook from a paper translation. Creates a complete learning notebook with explanations, code examples, and visualizations.',
    inputSchema: {
      type: 'object',
      properties: {
        paperContent: {
          type: 'string',
          description: 'The translated paper content (markdown format)',
        },
        domain: {
          type: 'string',
          enum: ['ml', 'quantum'],
          description: 'Domain of the paper: "ml" for Machine Learning, "quantum" for Quantum Computing',
        },
        difficulty: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'advanced'],
          description: 'Target difficulty level for the notebook',
          default: 'intermediate',
        },
        includeExperiments: {
          type: 'boolean',
          description: 'Whether to include experiment reproduction sections',
          default: true,
        },
        outputPath: {
          type: 'string',
          description: 'Path where to save the generated notebook (.ipynb)',
        },
      },
      required: ['paperContent', 'domain', 'outputPath'],
    },
  },
  {
    name: 'generate_concept_cells',
    description: 'Generate notebook cells explaining a specific concept from a paper with executable code examples.',
    inputSchema: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          description: 'The concept to explain (e.g., "self-attention", "quantum entanglement")',
        },
        paperContext: {
          type: 'string',
          description: 'Relevant context from the paper about this concept',
        },
        domain: {
          type: 'string',
          enum: ['ml', 'quantum'],
          description: 'Domain: "ml" or "quantum"',
        },
        withVisualization: {
          type: 'boolean',
          description: 'Include visualization code',
          default: true,
        },
        withExampleData: {
          type: 'boolean',
          description: 'Include example data generation',
          default: true,
        },
        outputPath: {
          type: 'string',
          description: 'Optional: Path to append cells to existing notebook',
        },
      },
      required: ['concept', 'paperContext', 'domain'],
    },
  },
  {
    name: 'implement_formula',
    description: 'Convert a LaTeX formula from a paper into executable Python code with explanations.',
    inputSchema: {
      type: 'object',
      properties: {
        latex: {
          type: 'string',
          description: 'The LaTeX formula to implement',
        },
        description: {
          type: 'string',
          description: 'Description of what the formula represents',
        },
        domain: {
          type: 'string',
          enum: ['ml', 'quantum'],
          description: 'Domain for appropriate library usage',
        },
        generateTestCase: {
          type: 'boolean',
          description: 'Generate test code with example values',
          default: true,
        },
        outputPath: {
          type: 'string',
          description: 'Optional: Path to append cells to existing notebook',
        },
      },
      required: ['latex', 'description', 'domain'],
    },
  },
  {
    name: 'create_experiment',
    description: 'Generate code to reproduce an experiment or figure from a paper (optionally scaled down).',
    inputSchema: {
      type: 'object',
      properties: {
        experimentDescription: {
          type: 'string',
          description: 'Description of the experiment to reproduce',
        },
        figureReference: {
          type: 'string',
          description: 'Reference to specific figure or table (e.g., "Figure 3", "Table 2")',
        },
        scaleDown: {
          type: 'boolean',
          description: 'Scale down the experiment for quick demonstration',
          default: true,
        },
        domain: {
          type: 'string',
          enum: ['ml', 'quantum'],
          description: 'Domain of the experiment',
        },
        outputPath: {
          type: 'string',
          description: 'Optional: Path to append cells to existing notebook',
        },
      },
      required: ['experimentDescription', 'domain'],
    },
  },
  {
    name: 'create_empty_notebook',
    description: 'Create an empty Jupyter notebook with proper setup for ML or Quantum Computing.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the notebook',
        },
        domain: {
          type: 'string',
          enum: ['ml', 'quantum'],
          description: 'Domain for environment setup',
        },
        outputPath: {
          type: 'string',
          description: 'Path where to save the notebook',
        },
      },
      required: ['title', 'domain', 'outputPath'],
    },
  },
];

// Prompt 정의 (마법사 워크플로우)
const PROMPTS: Prompt[] = [
  {
    name: 'notebook_wizard',
    description: '논문 학습 노트북 생성 마법사 - 단계별로 질문하여 맞춤형 노트북을 생성합니다',
    arguments: [
      {
        name: 'paper_path',
        description: '논문 파일 경로',
        required: false,
      },
    ],
  },
];

// MCP 서버 생성
const server = new Server(
  {
    name: 'paper-notebook-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

// Tool 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Prompt 목록 핸들러
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

// Prompt 가져오기 핸들러
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'notebook_wizard') {
    const paperPath = args?.paper_path as string | undefined;

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `논문 학습 노트북을 생성하려고 합니다.${paperPath ? `\n\n논문 파일: ${paperPath}` : ''}

다음 질문들에 답해주세요:

1. **분야 선택**: 이 논문은 어떤 분야인가요?
   - ML (Machine Learning / Deep Learning)
   - Quantum (Quantum Computing)

2. **난이도 선택**: 어떤 수준의 노트북을 원하시나요?
   - beginner (초급 - 개념 위주, 간단한 예제)
   - intermediate (중급 - 상세한 설명 + 코드)
   - advanced (고급 - 논문 재현 수준)

3. **포함할 내용**: 어떤 내용을 포함할까요? (여러 개 선택 가능)
   - experiments (실험 재현 코드)
   - visualization (시각화 코드)
   - exercises (연습 문제)

4. **출력 경로**: 노트북을 저장할 경로를 알려주세요.
   예: ./my_paper_notebook.ipynb`,
          },
        },
      ],
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
});

// Tool 호출 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    cleanupSessions(); // 오래된 세션 정리

    switch (name) {
      case 'start_notebook_wizard': {
        // 새 세션 생성
        const sessionId = `wizard_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // 논문 내용 가져오기
        let paperContent = args?.paperContent as string | undefined;
        const paperPath = args?.paperPath as string | undefined;

        if (!paperContent && paperPath) {
          try {
            paperContent = fs.readFileSync(paperPath, 'utf-8');
          } catch (e) {
            return {
              content: [{
                type: 'text',
                text: `❌ 논문 파일을 읽을 수 없습니다: ${paperPath}\n\n파일 경로를 확인해주세요.`
              }],
              isError: true,
            };
          }
        }

        const session: WizardSession = {
          id: sessionId,
          step: 1,
          paperContent,
          createdAt: new Date(),
        };
        wizardSessions.set(sessionId, session);

        return {
          content: [{
            type: 'text',
            text: `🧙 **논문 학습 노트북 생성 마법사**를 시작합니다!

세션 ID: \`${sessionId}\`

---

## 📚 Step 1/5: 분야 선택

이 논문은 어떤 분야인가요?

**선택지:**
1. **ML** - Machine Learning / Deep Learning
2. **Quantum** - Quantum Computing

---

💬 답변 방법: "1" 또는 "ML" / "2" 또는 "Quantum"을 입력해주세요.

예시: \`wizard_answer\` 도구를 사용하여 \`sessionId: "${sessionId}", answer: "quantum"\` 으로 답변`
          }],
        };
      }

      case 'wizard_answer': {
        const sessionId = args?.sessionId as string;
        const answer = (args?.answer as string)?.toLowerCase().trim();

        const session = wizardSessions.get(sessionId);
        if (!session) {
          return {
            content: [{
              type: 'text',
              text: `❌ 세션을 찾을 수 없습니다: ${sessionId}\n\n새로운 마법사를 시작하려면 \`start_notebook_wizard\`를 사용하세요.`
            }],
            isError: true,
          };
        }

        // 단계별 처리
        switch (session.step) {
          case 1: { // 분야 선택
            if (answer === '1' || answer === 'ml' || answer.includes('machine') || answer.includes('deep')) {
              session.domain = 'ml';
            } else if (answer === '2' || answer === 'quantum' || answer.includes('quantum')) {
              session.domain = 'quantum';
            } else {
              return {
                content: [{
                  type: 'text',
                  text: `❓ 이해하지 못했습니다. "ML" 또는 "Quantum" 중에서 선택해주세요.`
                }],
              };
            }
            session.step = 2;
            wizardSessions.set(sessionId, session);

            return {
              content: [{
                type: 'text',
                text: `✅ **${session.domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}** 분야를 선택하셨습니다!

---

## 📊 Step 2/5: 난이도 선택

어떤 수준의 노트북을 원하시나요?

**선택지:**
1. **beginner** (초급)
   - 핵심 개념 위주 설명
   - 간단한 예제 코드
   - 기초적인 시각화

2. **intermediate** (중급) ⭐ 추천
   - 상세한 개념 설명
   - 단계별 구현 코드
   - 다양한 시각화
   - 연습 문제 포함

3. **advanced** (고급)
   - 논문 수준의 상세 설명
   - 실제 재현 가능한 코드
   - 하이퍼파라미터 실험
   - 전체 파이프라인 구현

---

💬 1, 2, 3 또는 beginner/intermediate/advanced로 답변해주세요.`
              }],
            };
          }

          case 2: { // 난이도 선택
            if (answer === '1' || answer === 'beginner' || answer.includes('초급')) {
              session.difficulty = 'beginner';
            } else if (answer === '2' || answer === 'intermediate' || answer.includes('중급')) {
              session.difficulty = 'intermediate';
            } else if (answer === '3' || answer === 'advanced' || answer.includes('고급')) {
              session.difficulty = 'advanced';
            } else {
              return {
                content: [{
                  type: 'text',
                  text: `❓ 이해하지 못했습니다. "beginner", "intermediate", "advanced" 중에서 선택해주세요.`
                }],
              };
            }
            session.step = 3;
            wizardSessions.set(sessionId, session);

            return {
              content: [{
                type: 'text',
                text: `✅ **${session.difficulty}** 난이도를 선택하셨습니다!

---

## 🧪 Step 3/5: 실험 재현 포함 여부

논문의 실험을 재현하는 코드를 포함할까요?
(축소된 버전으로 빠르게 실행 가능)

**선택지:**
1. **yes** - 실험 재현 코드 포함
2. **no** - 개념 설명만

---

💬 "yes" 또는 "no"로 답변해주세요.`
              }],
            };
          }

          case 3: { // 실험 포함 여부
            session.includeExperiments = answer === 'yes' || answer === '1' || answer.includes('예') || answer.includes('응');
            session.step = 4;
            wizardSessions.set(sessionId, session);

            return {
              content: [{
                type: 'text',
                text: `✅ 실험 재현: **${session.includeExperiments ? '포함' : '미포함'}**

---

## 📊 Step 4/5: 시각화 & 연습문제

추가로 포함할 내용을 선택해주세요.

**선택지:** (쉼표로 구분하여 여러 개 선택 가능)
1. **visualization** - 시각화 코드 (그래프, 히트맵 등)
2. **exercises** - 연습 문제 (직접 해보기)
3. **both** - 둘 다 포함 ⭐ 추천
4. **none** - 추가 없음

---

💬 예시: "both" 또는 "1,2" 또는 "visualization, exercises"`
              }],
            };
          }

          case 4: { // 시각화 & 연습문제
            session.includeVisualization = answer.includes('1') || answer.includes('visual') || answer.includes('both') || answer === '3';
            session.includeExercises = answer.includes('2') || answer.includes('exercise') || answer.includes('both') || answer === '3';
            session.step = 5;
            wizardSessions.set(sessionId, session);

            return {
              content: [{
                type: 'text',
                text: `✅ 시각화: **${session.includeVisualization ? '포함' : '미포함'}** | 연습문제: **${session.includeExercises ? '포함' : '미포함'}**

---

## 📁 Step 5/5: 저장 경로

노트북을 저장할 경로를 입력해주세요.

**예시:**
- \`./quantum_cnn_notebook.ipynb\`
- \`C:/Users/사용자/Desktop/paper_study.ipynb\`

---

💬 파일 경로를 입력해주세요. (.ipynb 확장자 권장)`
              }],
            };
          }

          case 5: { // 저장 경로
            let outputPath = answer.trim();
            if (!outputPath.endsWith('.ipynb')) {
              outputPath += '.ipynb';
            }
            session.outputPath = outputPath;
            session.step = 6;
            wizardSessions.set(sessionId, session);

            // 최종 확인
            return {
              content: [{
                type: 'text',
                text: `✅ 저장 경로: **${outputPath}**

---

## 📋 최종 확인

**선택하신 옵션:**
| 항목 | 선택 |
|------|------|
| 분야 | ${session.domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'} |
| 난이도 | ${session.difficulty} |
| 실험 재현 | ${session.includeExperiments ? '✅' : '❌'} |
| 시각화 | ${session.includeVisualization ? '✅' : '❌'} |
| 연습문제 | ${session.includeExercises ? '✅' : '❌'} |
| 저장 경로 | ${outputPath} |

---

**노트북을 생성할까요?**
1. **yes** - 생성 시작! 🚀
2. **no** - 취소

💬 "yes" 또는 "no"로 답변해주세요.`
              }],
            };
          }

          case 6: { // 최종 확인
            if (answer === 'no' || answer === '2' || answer.includes('취소')) {
              wizardSessions.delete(sessionId);
              return {
                content: [{
                  type: 'text',
                  text: `❌ 마법사가 취소되었습니다.\n\n다시 시작하려면 \`start_notebook_wizard\`를 사용하세요.`
                }],
              };
            }

            if (answer !== 'yes' && answer !== '1' && !answer.includes('예') && !answer.includes('응')) {
              return {
                content: [{
                  type: 'text',
                  text: `❓ "yes" 또는 "no"로 답변해주세요.`
                }],
              };
            }

            // 논문 내용 확인
            if (!session.paperContent) {
              session.step = 7;
              wizardSessions.set(sessionId, session);
              return {
                content: [{
                  type: 'text',
                  text: `📄 논문 내용이 필요합니다!

논문 번역본의 내용을 붙여넣어 주세요.
(마크다운 형식 권장)

---

💬 논문 내용을 입력해주세요.`
                }],
              };
            }

            // 노트북 생성 시작
            const options: GenerateNotebookOptions = {
              paperContent: session.paperContent,
              domain: session.domain!,
              difficulty: session.difficulty!,
              includeExperiments: session.includeExperiments!,
              outputPath: session.outputPath!,
            };

            try {
              const outputPath = await generateLearningNotebook(options);
              wizardSessions.delete(sessionId);

              return {
                content: [{
                  type: 'text',
                  text: `🎉 **노트북 생성 완료!**

📓 저장 위치: \`${outputPath}\`

---

**노트북 구성:**
- 📋 논문 메타 정보 및 학습 목표
- 🔧 환경 설정 (${session.domain === 'ml' ? 'PyTorch, NumPy' : 'Qiskit, PennyLane'})
- 📊 예시 데이터 생성
- 💡 핵심 개념별 설명 및 코드
${session.includeExperiments ? '- 🧪 미니 실험 재현\n' : ''}${session.includeVisualization ? '- 📈 시각화 코드\n' : ''}${session.includeExercises ? '- ✏️ 연습 문제\n' : ''}- 📝 정리 및 다음 단계

---

🚀 Jupyter Notebook을 열어서 순서대로 실행해보세요!`
                }],
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              return {
                content: [{
                  type: 'text',
                  text: `❌ 노트북 생성 중 오류가 발생했습니다:\n\n${errorMessage}\n\nAPI 키와 네트워크 연결을 확인해주세요.`
                }],
                isError: true,
              };
            }
          }

          case 7: { // 논문 내용 입력
            session.paperContent = args?.answer as string;

            // 노트북 생성
            const options: GenerateNotebookOptions = {
              paperContent: session.paperContent,
              domain: session.domain!,
              difficulty: session.difficulty!,
              includeExperiments: session.includeExperiments!,
              outputPath: session.outputPath!,
            };

            try {
              const outputPath = await generateLearningNotebook(options);
              wizardSessions.delete(sessionId);

              return {
                content: [{
                  type: 'text',
                  text: `🎉 **노트북 생성 완료!**

📓 저장 위치: \`${outputPath}\`

---

**노트북 구성:**
- 📋 논문 메타 정보 및 학습 목표
- 🔧 환경 설정
- 📊 예시 데이터 생성
- 💡 핵심 개념별 설명 및 코드
${session.includeExperiments ? '- 🧪 미니 실험 재현\n' : ''}${session.includeVisualization ? '- 📈 시각화 코드\n' : ''}${session.includeExercises ? '- ✏️ 연습 문제\n' : ''}- 📝 정리 및 다음 단계

---

🚀 Jupyter Notebook을 열어서 순서대로 실행해보세요!`
                }],
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              return {
                content: [{
                  type: 'text',
                  text: `❌ 노트북 생성 중 오류가 발생했습니다:\n\n${errorMessage}`
                }],
                isError: true,
              };
            }
          }

          default:
            return {
              content: [{
                type: 'text',
                text: `❌ 알 수 없는 단계입니다. 새로운 마법사를 시작해주세요.`
              }],
              isError: true,
            };
        }
      }

      case 'generate_learning_notebook': {
        const options: GenerateNotebookOptions = {
          paperContent: args?.paperContent as string,
          domain: args?.domain as Domain,
          difficulty: (args?.difficulty as Difficulty) || 'intermediate',
          includeExperiments: args?.includeExperiments !== false,
          outputPath: args?.outputPath as string,
        };

        const outputPath = await generateLearningNotebook(options);

        return {
          content: [{
            type: 'text',
            text: `✅ 학습 노트북이 성공적으로 생성되었습니다!

📓 저장 위치: ${outputPath}

노트북 구성:
- 📋 논문 메타 정보 및 학습 목표
- 🔧 환경 설정 (필요한 라이브러리)
- 📊 예시 데이터 생성
- 💡 핵심 개념별 설명 및 코드
${options.includeExperiments ? '- 🧪 미니 실험 재현\n' : ''}- 📝 정리 및 다음 단계

Jupyter Notebook을 열어서 순서대로 실행해보세요!`
          }],
        };
      }

      case 'generate_concept_cells': {
        const options: GenerateConceptOptions = {
          concept: args?.concept as string,
          paperContext: args?.paperContext as string,
          domain: args?.domain as Domain,
          withVisualization: args?.withVisualization !== false,
          withExampleData: args?.withExampleData !== false,
        };

        const cells = await generateConceptCell(options);

        // 기존 노트북에 추가할 경우
        if (args?.outputPath) {
          appendCellsToNotebook(args.outputPath as string, cells);
          return {
            content: [{
              type: 'text',
              text: `✅ "${options.concept}" 개념 셀이 노트북에 추가되었습니다!

📓 노트북: ${args.outputPath}
📝 추가된 셀 수: ${cells.length}

포함된 내용:
- 개념 설명 (한국어)
- 단계별 코드 구현
${options.withVisualization ? '- 시각화 코드\n' : ''}${options.withExampleData ? '- 예시 데이터\n' : ''}- 연습 문제`
            }],
          };
        }

        // 셀 내용을 텍스트로 반환
        const cellsPreview = cells.map((cell, i) => {
          const type = cell.cell_type === 'markdown' ? '📝 Markdown' : '💻 Code';
          const preview = cell.source.slice(0, 3).join('').substring(0, 100);
          return `[${i + 1}] ${type}: ${preview}...`;
        }).join('\n');

        return {
          content: [{
            type: 'text',
            text: `✅ "${options.concept}" 개념 셀이 생성되었습니다!

📝 생성된 셀 (${cells.length}개):
${cellsPreview}

💡 outputPath를 지정하면 노트북에 직접 추가할 수 있습니다.`
          }],
        };
      }

      case 'implement_formula': {
        const options: ImplementFormulaOptions = {
          latex: args?.latex as string,
          description: args?.description as string,
          domain: args?.domain as Domain,
          generateTestCase: args?.generateTestCase !== false,
        };

        const cells = await generateFormulaImplementation(options);

        // 기존 노트북에 추가할 경우
        if (args?.outputPath) {
          appendCellsToNotebook(args.outputPath as string, cells);
          return {
            content: [{
              type: 'text',
              text: `✅ 수식 구현이 노트북에 추가되었습니다!

📓 노트북: ${args.outputPath}

수식: ${options.latex}
📝 추가된 셀 수: ${cells.length}
${options.generateTestCase ? '✓ 테스트 코드 포함' : ''}`
            }],
          };
        }

        // 코드 미리보기
        const codeCell = cells.find(c => c.cell_type === 'code');
        const codePreview = codeCell?.source.join('').substring(0, 500);

        return {
          content: [{
            type: 'text',
            text: `✅ 수식 구현이 생성되었습니다!

수식: ${options.latex}

📝 Python 구현:
\`\`\`python
${codePreview}...
\`\`\`

💡 outputPath를 지정하면 노트북에 직접 추가할 수 있습니다.`
          }],
        };
      }

      case 'create_experiment': {
        const options: CreateExperimentOptions = {
          experimentDescription: args?.experimentDescription as string,
          figureReference: args?.figureReference as string | undefined,
          scaleDown: args?.scaleDown !== false,
          domain: args?.domain as Domain,
        };

        const cells = await generateExperimentCells(options);

        // 기존 노트북에 추가할 경우
        if (args?.outputPath) {
          appendCellsToNotebook(args.outputPath as string, cells);
          return {
            content: [{
              type: 'text',
              text: `✅ 실험 재현 코드가 노트북에 추가되었습니다!

📓 노트북: ${args.outputPath}
🧪 실험: ${options.experimentDescription}
${options.figureReference ? `📊 참조: ${options.figureReference}\n` : ''}${options.scaleDown ? '⚡ 축소된 버전 (빠른 실행)\n' : ''}
📝 추가된 셀 수: ${cells.length}`
            }],
          };
        }

        return {
          content: [{
            type: 'text',
            text: `✅ 실험 재현 코드가 생성되었습니다!

🧪 실험: ${options.experimentDescription}
${options.figureReference ? `📊 참조: ${options.figureReference}\n` : ''}
📝 생성된 셀: ${cells.length}개

포함된 내용:
- 실험 설명
- 설정 코드
- 실험 실행 코드
- 결과 시각화

💡 outputPath를 지정하면 노트북에 직접 추가할 수 있습니다.`
          }],
        };
      }

      case 'create_empty_notebook': {
        const { ML_SETUP_CODE } = await import('./templates/ml-templates.js');
        const { QUANTUM_SETUP_CODE } = await import('./templates/quantum-templates.js');

        const title = args?.title as string;
        const domain = args?.domain as Domain;
        const outputPath = args?.outputPath as string;

        const notebook: JupyterNotebook = {
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
          cells: [
            {
              cell_type: 'markdown',
              source: [`# ${title}\n`, '\n', `**분야**: ${domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}\n`],
              metadata: {},
            },
            {
              cell_type: 'markdown',
              source: ['## 환경 설정\n'],
              metadata: {},
            },
            {
              cell_type: 'code',
              source: (domain === 'ml' ? ML_SETUP_CODE : QUANTUM_SETUP_CODE).split('\n').map((l, i, a) => i < a.length - 1 ? l + '\n' : l),
              metadata: {},
              execution_count: null,
              outputs: [],
            },
          ],
        };

        saveNotebook(notebook, outputPath);

        return {
          content: [{
            type: 'text',
            text: `✅ 빈 노트북이 생성되었습니다!

📓 저장 위치: ${outputPath}
📚 분야: ${domain === 'ml' ? 'Machine Learning' : 'Quantum Computing'}

포함된 내용:
- 제목 헤더
- 환경 설정 코드

이제 generate_concept_cells, implement_formula, create_experiment 등을 사용하여
내용을 추가할 수 있습니다!`
          }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Tool error:', error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Paper Notebook MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
