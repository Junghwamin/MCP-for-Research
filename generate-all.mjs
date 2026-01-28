// 모든 논문에 대해 노트북 생성
import * as fs from 'fs';
import * as path from 'path';

// .env 로드
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

import { generateLearningNotebook } from './dist/generators/notebook-generator.js';

const basePath = 'C:/Users/정화민/Desktop/MCP_hwamin/공모전노문';
const outputPath = `${basePath}/notebooks`;

// 생성할 논문 목록
const papers = [
  {
    path: '1_QCNN/qunatumconvoultionalneuralnetwork.md',
    output: 'Quantum_Convolutional_Neural_Networks.ipynb'
  },
  {
    path: '1_QCNN/realizing qunatum convoultion neural networks on a superconducting quantum processor.md',
    output: 'QCNN_초전도_양자프로세서.ipynb'
  },
  {
    path: '2_Training_Issues/Barren plateaus in quantum neural network training landscapes.md',
    output: 'Barren_Plateaus_학습노트북.ipynb'
  },
  {
    path: '2_Training_Issues/Expressibility and entangling capability of parameterized quantum circuits.md',
    output: 'Expressibility_Entangling_학습노트북.ipynb'
  },
  {
    path: '3_Symmetry/Group-Invariant Quantum Machine Learning.md',
    output: 'Group_Invariant_QML_학습노트북.ipynb'
  },
  {
    path: '3_Symmetry/Exploiting Symmetry in Variational Quantum Machine Learning.md',
    output: 'Exploiting_Symmetry_학습노트북.ipynb'
  },
  {
    path: '4_Generalization/Generalization in quantum machine learning from few training data.md',
    output: 'Generalization_Few_Data_학습노트북.ipynb'
  },
  {
    path: '4_Generalization/Circuit-centric quantum classifiers.md',
    output: 'Circuit_Centric_Classifiers_학습노트북.ipynb'
  }
];

async function generateAll() {
  console.log('🚀 모든 논문에 대해 노트북 생성을 시작합니다...\n');

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const fullPath = `${basePath}/${paper.path}`;
    const fullOutputPath = `${outputPath}/${paper.output}`;

    console.log(`\n[${i + 1}/${papers.length}] 📄 ${paper.path}`);

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      console.log(`   📖 논문 로드 완료 (${content.length} 글자)`);
      console.log(`   ⏳ GPT API 호출 중...`);

      await generateLearningNotebook({
        paperContent: content,
        domain: 'quantum',
        difficulty: 'intermediate',
        includeExperiments: true,
        outputPath: fullOutputPath
      });

      console.log(`   ✅ 완료: ${paper.output}`);
    } catch (error) {
      console.error(`   ❌ 오류: ${error.message}`);
    }
  }

  console.log('\n\n🎉 모든 노트북 생성 완료!');
  console.log(`📁 저장 위치: ${outputPath}`);
}

generateAll();
