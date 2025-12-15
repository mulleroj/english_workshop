import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion, DifficultyLevel, Lesson, VocabItem } from "../types";

// Fallback emojis for Generative content (Family)
const FAMILY_EMOJIS: Record<string, string> = {
  "Mother": "👩",
  "Father": "👨",
  "Brother": "👦",
  "Sister": "👧",
  "Son": "👶",
  "Daughter": "🧒",
  "Husband": "🤵",
  "Wife": "👰",
  "Uncle": "🧔",
  "Aunt": "👩‍🦱",
  "Cousin": "🧑‍🤝‍🧑",
  "Nephew": "👦",
  "Niece": "👧",
  "Grandmother": "👵",
  "Grandfather": "👴",
  "Grandparent": "🧓",
  "Parent": "👪",
  "Step-brother": "👦",
  "Step-sister": "👧"
};

// Fisher-Yates Shuffle Algorithm
const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Helper to generate fallback options if the AI fails to provide them for multiple-choice
const getFallbackOptions = (correctAnswer: string, lessonContent: string | VocabItem[]): string[] => {
  let candidates: string[] = [];

  if (Array.isArray(lessonContent)) {
    // Pick random terms from the vocab list that are NOT the correct answer
    candidates = lessonContent
      .map(item => item.term)
      .filter(term => term.toLowerCase() !== correctAnswer.toLowerCase());
  } else {
    // Generative content fallback (mostly for Family)
    candidates = Object.keys(FAMILY_EMOJIS);
    candidates = candidates.filter(c => c.toLowerCase() !== correctAnswer.toLowerCase());
  }

  // Shuffle candidates and pick 3 distractors
  const shuffledCandidates = shuffleArray(candidates);
  const distractors = shuffledCandidates.slice(0, 3);
  
  // Combine with correct answer and shuffle the final set
  return shuffleArray([...distractors, correctAnswer]);
};

export const generateQuestions = async (lesson: Lesson, count: number = 10, difficulty: DifficultyLevel = 'mixed'): Promise<QuizQuestion[]> => {
  // Initialize AI client lazily to avoid top-level process.env access issues
  // We guard against 'process' being undefined in browser environments
  let apiKey = '';
  try {
    if (typeof process !== 'undefined') {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    console.error("Environment variable access failed:", e);
  }

  const ai = new GoogleGenAI({ apiKey });

  // Helper to format vocab list
  const vocabList = Array.isArray(lesson.content) 
    ? (lesson.content as VocabItem[]).map(v => `${v.term} (${v.translation})`).join(", ")
    : lesson.content;

  // Define strategy based on difficulty - STRICTLY SEPARATED
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
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
      
      // STRICT AUDIT & FIX POST-PROCESSING
      // This ensures that even if the AI hallucinates the wrong type for a difficulty,
      // we force the UI to render correctly by fixing the data.
      const processedData = data.map(q => {
        let enforcedType = q.type;
        let enforcedDifficulty = q.difficulty;
        let finalOptions = q.options || [];

        // 1. Enforce Type constraints based on requested Difficulty
        if (difficulty === 'easy') {
          enforcedType = 'multiple-choice';
          enforcedDifficulty = 'easy';
        } else if (difficulty === 'medium') {
          enforcedType = 'multiple-choice';
          enforcedDifficulty = 'medium';
        } else if (difficulty === 'hard') {
          enforcedType = 'text-input';
          enforcedDifficulty = 'hard';
        }

        // 2. Fix Options if Type was coerced
        if (enforcedType === 'multiple-choice' && (finalOptions.length < 2)) {
          // AI failed to give options, or we coerced a text-input to MC.
          // Generate fallback options from lesson content.
          finalOptions = getFallbackOptions(q.correctAnswer, lesson.content);
        } else if (enforcedType === 'text-input') {
          // Clear options for text-input to keep data clean
          finalOptions = [];
        }

        // 3. ATTACH EMOJI
        // Find the emoji for this word from the lesson content
        let emoji = '❓';
        if (Array.isArray(lesson.content)) {
            const vocabItem = (lesson.content as VocabItem[]).find(
                item => item.term.toLowerCase() === q.correctAnswer.toLowerCase()
            );
            if (vocabItem && vocabItem.emoji) {
                emoji = vocabItem.emoji;
            }
        } else {
            // Check family map
            const key = Object.keys(FAMILY_EMOJIS).find(k => k.toLowerCase() === q.correctAnswer.toLowerCase());
            if (key) {
                emoji = FAMILY_EMOJIS[key];
            }
        }

        // 4. SHUFFLE OPTIONS
        // Explicitly shuffle the answer buttons so the correct answer isn't always in the same spot
        if (finalOptions.length > 0) {
            finalOptions = shuffleArray(finalOptions);
        }

        return {
          ...q,
          type: enforcedType,
          difficulty: difficulty !== 'mixed' ? (difficulty as 'easy'|'medium'|'hard') : enforcedDifficulty,
          options: finalOptions,
          emoji: emoji
        };
      });

      // 5. SHUFFLE QUESTIONS
      // Ensure the order of questions is random every time
      return shuffleArray(processedData);
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Failed to generate questions:", error);
    // Fallback
    return [
      {
        id: "err-1",
        text: "Translate: Jablko",
        type: difficulty === 'hard' ? 'text-input' : 'multiple-choice',
        options: difficulty === 'hard' ? [] : ["Apple", "Pear", "Banana", "Orange"],
        correctAnswer: "apple",
        explanation: "Apple is a fruit.",
        difficulty: difficulty === 'mixed' ? 'easy' : (difficulty as 'easy'|'medium'|'hard'),
        emoji: "🍎"
      }
    ];
  }
};