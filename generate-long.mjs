// 긴 논문을 축약해서 노트북 생성
import * as fs from 'fs';
import * as path from 'path';

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

// 긴 논문 목록 (요약 필요)
const papers = [
  {
    path: '3_Symmetry/Group-Invariant Quantum Machine Learning.md',
    output: 'Group_Invariant_QML_학습노트북.ipynb'
  },
  {
    path: '3_Symmetry/Exploiting Symmetry in Variational Quantum Machine Learning.md',
    output: 'Exploiting_Symmetry_학습노트북.ipynb'
  }
];

// 논문 내용을 축약하는 함수 (앞부분만 사용)
function truncatePaper(content, maxChars = 25000) {
  if (content.length <= maxChars) return content;

  // 섹션 단위로 자르기
  const sections = content.split(/(?=^## )/m);
  let result = '';

  for (const section of sections) {
    if ((result + section).length > maxChars) {
      result += '\n\n[... 이하 생략 - 전체 논문은 원본 파일 참조 ...]';
      break;
    }
    result += section;
  }

  return result;
}

async function generateLong() {
  console.log('🚀 긴 논문들을 축약하여 노트북을 생성합니다...\n');

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    const fullPath = `${basePath}/${paper.path}`;
    const fullOutputPath = `${outputPath}/${paper.output}`;

    console.log(`\n[${i + 1}/${papers.length}] 📄 ${paper.path}`);

    try {
      let content = fs.readFileSync(fullPath, 'utf-8');
      console.log(`   📖 원본 길이: ${content.length} 글자`);

      content = truncatePaper(content, 25000);
      console.log(`   ✂️ 축약 후: ${content.length} 글자`);
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

    // API 레이트 리밋 방지를 위한 대기
    console.log('   ⏸️ 60초 대기 (레이트 리밋 방지)...');
    await new Promise(resolve => setTimeout(resolve, 60000));
  }

  console.log('\n\n🎉 완료!');
}

generateLong();
