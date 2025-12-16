import { GoogleGenAI, Type } from "@google/genai";
import { lessons } from './data/lessons.js';
import { DifficultyLevel, Lesson, VocabItem, QuizQuestion } from './types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load API key from environment or command line argument
// Usage: npm run generate-questions
// Or: tsx generate-questions.ts YOUR_API_KEY
const apiKey = process.env.API_KEY || process.argv[2] || '';

if (!apiKey) {
    console.error('❌ API_KEY not found!');
    console.log('\nPlease provide API key in one of these ways:');
    console.log('  1. Set API_KEY in your .env.local file');
    console.log('  2. Pass as argument: tsx generate-questions.ts YOUR_API_KEY');
    console.log('\n💡 Tip: Check your .env.local file format. It should contain:');
    console.log('     API_KEY=your_actual_key_here');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Helper to generate questions for a specific lesson and difficulty
async function generateQuestionsForLesson(
    lesson: Lesson,
    difficulty: DifficultyLevel,
    count: number = 20
): Promise<QuizQuestion[]> {
    console.log(`  📝 Generating ${count} questions for ${lesson.id} (${difficulty})...`);

    const vocabList = Array.isArray(lesson.content)
        ? (lesson.content as VocabItem[]).map(v => `${v.term} (${v.translation})`).join(", ")
        : lesson.content;

    let strategyInstructions = "";

    switch (difficulty) {
        case 'easy':
            strategyInstructions = `
        MODE: Multiple Choice Only.
        DIFFICULTY CONSTRAINT: STRICTLY EASY.
        - All ${count} questions MUST be simple direct translations (e.g., "What is 'pes'?" -> Options: Dog, Cat...).
        - DO NOT use gap-fills or definitions.
        - DO NOT use text input / spelling tasks.
        - Set "type" to "multiple-choice" for ALL items.
        - Set "difficulty" to "easy" for ALL items.
        - Provide 4 simple options.
      `;
            break;

        case 'medium':
            strategyInstructions = `
        MODE: Multiple Choice Only.
        DIFFICULTY CONSTRAINT: STRICTLY MEDIUM.
        - All ${count} questions MUST be context-based, gap-fills, or definitions (e.g., "I sit on a ___" -> Chair).
        - DO NOT use simple direct translations.
        - DO NOT use text input / spelling tasks.
        - Set "type" to "multiple-choice" for ALL items.
        - Set "difficulty" to "medium" for ALL items.
        - Provide 4 options.
      `;
            break;

        case 'hard':
            strategyInstructions = `
        MODE: Spelling / Text Input Only.
        DIFFICULTY CONSTRAINT: STRICTLY HARD.
        - All ${count} questions MUST require the user to type the word.
        - Ask the user to translate a specific word or finish a sentence.
        - The question MUST require typing a specific English word from the source material.
        - Example: "Translate into English: 'Jablko'" (Answer: "apple").
        - Set "type" to "text-input" for ALL items.
        - Set "difficulty" to "hard" for ALL items.
        - "options" can be empty or null.
      `;
            break;

        case 'mixed':
            strategyInstructions = `
        MODE: Mixed.
        - Randomly choose between Multiple Choice (Easy/Medium style) and Text Input (Hard style) for each question.
        - Aim for a 50/50 split.
        - If "type" is "multiple-choice", provide 4 options.
        - If "type" is "text-input", make sure the question prompts for a specific word to be typed.
        - Set "difficulty" field according to the specific question complexity.
      `;
            break;
    }

    const basePrompt = `
    SOURCE MATERIAL:
    The user is learning the following English words (with translations/context):
    ${vocabList}

    INSTRUCTIONS:
    Create a quiz with ${count} questions based strictly on the source material.
    
    ${strategyInstructions}

    CRITICAL RULES:
    1. The "correctAnswer" MUST be the exact English term from the source list.
    2. Ignore case in answers, but provide the standard spelling in "correctAnswer".
    3. STRICTLY adhere to the selected Difficulty Mode. Do not mix difficulties unless the mode is 'mixed'.
    4. Ensure ALL ${count} questions follow the same format if a specific difficulty (Easy/Medium/Hard) is chosen. Do not drift to other difficulties.
    5. Make sure to create EXACTLY ${count} unique questions.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: basePrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            text: { type: Type.STRING, description: "The question text" },
                            type: { type: Type.STRING, enum: ["multiple-choice", "text-input"] },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "List of 4 possible answers (required for multiple-choice)"
                            },
                            correctAnswer: { type: Type.STRING, description: "The exact English word answer" },
                            explanation: { type: Type.STRING, description: "Short explanation" },
                            difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] }
                        },
                        required: ["id", "text", "type", "correctAnswer", "explanation", "difficulty"],
                        propertyOrdering: ["id", "text", "type", "options", "correctAnswer", "explanation", "difficulty"]
                    }
                }
            }
        });

        if (response.text) {
            let data = JSON.parse(response.text) as QuizQuestion[];

            // Attach emojis from lesson content
            const processedData = data.map(q => {
                let emoji = '❓';
                if (Array.isArray(lesson.content)) {
                    const vocabItem = (lesson.content as VocabItem[]).find(
                        item => item.term.toLowerCase() === q.correctAnswer.toLowerCase()
                    );
                    if (vocabItem && vocabItem.emoji) {
                        emoji = vocabItem.emoji;
                    }
                }

                return {
                    ...q,
                    emoji: emoji
                };
            });

            console.log(`  ✅ Generated ${processedData.length} questions`);
            return processedData;
        }

        throw new Error("Empty response from AI");
    } catch (error) {
        console.error(`  ❌ Error generating questions for ${lesson.id} (${difficulty}):`, error);
        return [];
    }
}

// Main generator function
async function generateAllQuestions() {
    console.log('🚀 Starting question generation...\n');
    console.log(`📚 Total lessons: ${lessons.length}`);
    console.log(`🎯 Difficulties: easy, medium, hard, mixed`);
    console.log(`📝 Questions per difficulty: 80`);
    console.log(`🔢 Total questions to generate: ${lessons.length * 4 * 80} = ${lessons.length * 320}\n`);

    const allQuestions: Record<string, Record<DifficultyLevel, QuizQuestion[]>> = {};
    const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard', 'mixed'];

    let completedCount = 0;
    const totalTasks = lessons.length * difficulties.length;

    for (const lesson of lessons) {
        console.log(`\n📖 Processing: ${lesson.title} (${lesson.id})`);
        allQuestions[lesson.id] = {} as Record<DifficultyLevel, QuizQuestion[]>;

        for (const difficulty of difficulties) {
            const questions = await generateQuestionsForLesson(lesson, difficulty, 80);
            allQuestions[lesson.id][difficulty] = questions;

            completedCount++;
            console.log(`  ⏳ Progress: ${completedCount}/${totalTasks} (${Math.round(completedCount / totalTasks * 100)}%)`);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('\n✅ All questions generated!');
    console.log('\n💾 Saving to file...');

    // Save to TypeScript file
    const outputPath = path.join(__dirname, 'data', 'pregenerated-questions.ts');
    const fileContent = `// Auto-generated pregenerated questions
// Generated: ${new Date().toISOString()}
// Total questions: ${Object.keys(allQuestions).length * 4 * 80}

import { QuizQuestion, DifficultyLevel } from '../types';

export type PregeneratedQuestions = Record<string, Record<DifficultyLevel, QuizQuestion[]>>;

export const pregeneratedQuestions: PregeneratedQuestions = ${JSON.stringify(allQuestions, null, 2)};
`;

    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    console.log(`✅ Saved to: ${outputPath}`);

    // Also save as JSON for backup
    const jsonPath = path.join(__dirname, 'data', 'pregenerated-questions.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allQuestions, null, 2), 'utf-8');
    console.log(`✅ Backup saved to: ${jsonPath}`);

    console.log('\n🎉 Generation complete!');
}

// Run the generator
generateAllQuestions().catch(console.error);
