// 테스트 스크립트: 노트북 생성기 직접 호출
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

// 생성기 임포트
import { generateLearningNotebook } from './dist/generators/notebook-generator.js';

// 논문 읽기
const paperPath = 'C:/Users/정화민/Desktop/MCP_hwamin/공모전노문/1_QCNN/qunatumconvoultionalneuralnetwork.md';
const paperContent = fs.readFileSync(paperPath, 'utf-8');

console.log('📄 논문 로드 완료:', paperContent.length, '글자');
console.log('🚀 노트북 생성 시작...');

// 노트북 생성
const options = {
  paperContent: paperContent,
  domain: 'quantum',
  difficulty: 'intermediate',
  includeExperiments: true,
  outputPath: 'C:/Users/정화민/Desktop/MCP_hwamin/공모전노문/notebooks/QCNN_학습노트북.ipynb'
};

try {
  const result = await generateLearningNotebook(options);
  console.log('✅ 노트북 생성 완료:', result);
} catch (error) {
  console.error('❌ 오류:', error.message);
  console.error(error.stack);
}
