
import fs from 'fs';
import path from 'path';
import { translatePaper } from './src/tools/translate.js';

const TARGET_DIR = 'C:/Users/정화민/Desktop/공모전 추천논문';

async function main() {
    console.log(`Scanning PDFs in ${TARGET_DIR}...`);
    if (!fs.existsSync(TARGET_DIR)) {
        console.error('Target directory does not exist.');
        return;
    }

    const files = fs.readdirSync(TARGET_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));

    console.log(`Found ${files.length} PDFs to translate.`);

    for (const [index, file] of files.entries()) {
        const pdfPath = path.join(TARGET_DIR, file);
        console.log(`\n[${index + 1}/${files.length}] Processing: ${file}`);

        try {
            const result = await translatePaper({
                pdfPath: pdfPath,
                targetLanguage: 'ko',
                outputDir: TARGET_DIR, // Save output in the same directory (it will create subfolders)
                generateDocx: true,    // Generate DOCX automatically
                preserveTerms: true
            });

            if (result.success) {
                console.log(`✅ Success: ${file}`);
                console.log(`   Output: ${result.outputFiles.translatedDocx}`);
            } else {
                console.error(`❌ Failed: ${file}`);
                console.error(`   Error: ${result.error}`);
            }
        } catch (e: any) {
            console.error(`❌ Exception processing ${file}: ${e.message}`);
        }
    }
}

main().catch(console.error);
