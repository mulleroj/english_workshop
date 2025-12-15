# 📚 How to Expand The English Workshop

This guide explains how to expand and maintain your vocabulary application.

## 🎯 Expanding Questions (20 → 40 → 80+)

### Current Status

- **40 lessons** with vocabulary
- **20 questions per difficulty** (Easy, Medium, Hard, Mixed)
- **3,200 total questions** (40 lessons × 4 difficulties × 20 questions)

### Why Expand?

- Better coverage of all vocabulary words
- More variety for students
- Reduced repetition in quizzes

---

## 🚀 Quick Expansion Guide

### Step 1: Update the Generator

Open `generate-questions.ts` and find line **199**:

```typescript
// Current (20 questions):
const questions = await generateQuestionsForLesson(lesson, difficulty, 20);

// Change to 40 questions:
const questions = await generateQuestionsForLesson(lesson, difficulty, 40);

// Or 80 questions:
const questions = await generateQuestionsForLesson(lesson, difficulty, 80);
```

### Step 2: Make Sure You Have Your API Key

Check that `.env.local` contains your Gemini API key:

```
API_KEY=your_gemini_api_key_here
```

### Step 3: Run the Generator

```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -Command "npm run generate-questions"
```

**Estimated Time:**

- 20 questions: ~3 minutes
- 40 questions: ~6 minutes  
- 80 questions: ~12 minutes

### Step 4: Verify Results

Check the file size of `data/pregenerated-questions.ts`:

- **20 questions**: ~1.2 MB
- **40 questions**: ~2.4 MB
- **80 questions**: ~4.8 MB

### Step 5: Deploy to Netlify

```bash
git add -A
git commit -m "Expand questions to 40 per difficulty"
git push
```

Netlify will automatically rebuild and deploy (2-3 minutes).

---

## 📖 Adding New Lessons

### Step 1: Add Vocabulary to `data/lessons.ts`

```typescript
{
  id: 'new_lesson',
  course: 'elementary', // or 'pre-intermediate'
  title: 'Your Lesson Title',
  description: 'Brief description',
  icon: 'BookOpen', // See IconMap in App.tsx
  emoji: '📘',
  type: 'vocabulary',
  content: [
    { term: "word", translation: "slovo", emoji: "📝" },
    // Add more words...
  ]
}
```

### Step 2: Regenerate Questions

Run the generator again to create questions for the new lesson:

```bash
npm run generate-questions
```

### Step 3: Push Changes

```bash
git add -A
git commit -m "Add new lesson: [Lesson Name]"
git push
```

---

## 🔧 Troubleshooting

### Generator Fails with API Error

**Problem:** `API_KEY not found!`

**Solution:**

1. Check `.env.local` file exists
2. Verify API key is valid
3. Try passing key directly: `npx tsx generate-questions.ts YOUR_API_KEY`

---

### Empty Questions Generated

**Problem:** Some lessons show empty question arrays `[]`

**Solution:**

1. Check the lesson has vocabulary in `data/lessons.ts`
2. Ensure lesson `id` matches in generator
3. Re-run generator for specific lesson

---

### App Shows "No questions found"

**Problem:** App can't find pregenerated questions

**Solution:**

1. Verify `data/pregenerated-questions.ts` exists
2. Check file is not empty (should be several MB)
3. Rebuild app: `npm run build`

---

### Build Size Too Large

**Problem:** Netlify build fails or app loads slowly

**Solution:**

- Consider reducing questions per difficulty
- Split lessons into separate files
- Use dynamic imports (advanced)

---

## 📊 Question Quality Guidelines

### Easy Questions

- ✅ Direct translations: "What is 'pes'?" → Dog
- ✅ Simple multiple choice with 4 options
- ❌ No context sentences
- ❌ No spelling tasks

### Medium Questions  

- ✅ Context-based: "I sit on a ___" → Chair
- ✅ Gap-fill exercises
- ✅ Definition-based questions
- ❌ No typing/spelling

### Hard Questions

- ✅ Requires typing the answer
- ✅ Translate specific words
- ✅ Complete sentences
- ❌ No multiple choice

### Mixed Questions

- ✅ Random mix of all types
- ✅ 50/50 split between MC and text input

---

## 🎨 Customization Tips

### Change Quiz Length (currently 10 questions)

In `App.tsx`, line **211**:

```typescript
// Current:
const selectedQuestions = shuffled.slice(0, Math.min(10, shuffled.length));

// Change to 15:
const selectedQuestions = shuffled.slice(0, Math.min(15, shuffled.length));
```

### Add More Difficulty Levels

1. Update `types.ts`:

   ```typescript
   export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'mixed' | 'expert';
   ```

2. Update generator prompt in `generate-questions.ts`

3. Regenerate questions

---

## 📱 PWA & Offline Functionality

### App is Already PWA-Enabled

- ✅ Manifest configured
- ✅ Service worker active
- ✅ Icons generated
- ✅ Offline cache enabled

### Testing PWA Locally

1. Build the app: `npm run build`
2. Preview: `npm run preview`
3. Open in browser (Chrome/Edge)
4. Check for install prompt in URL bar

### Update PWA Settings

Edit `public/manifest.json` to change:

- App name
- Theme color
- Icons
- Start URL

---

## 🌐 Deployment Checklist

Before each deployment:

- [ ] Test locally: `npm run dev`
- [ ] Build successfully: `npm run build`  
- [ ] Check file sizes (dist folder)
- [ ] Verify questions in browser dev tools
- [ ] Test on mobile device (if possible)
- [ ] Commit and push to GitHub
- [ ] Wait for Netlify deployment
- [ ] Test live site

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Run dev server | `npm run dev` |
| Generate questions | `npm run generate-questions` |
| Build for production | `npm run build` |
| Preview build | `npm run preview` |
| Git commit | `git add -A && git commit -m "message"` |
| Git push | `git push` |

---

## 🎯 Recommended Expansion Path

1. **Start**: 20 questions (current) ✅
2. **Test**: Get student feedback for 1-2 weeks
3. **Expand**: Increase to 40 questions
4. **Evaluate**: Check app performance and student engagement
5. **Scale**: Go to 60-80 if needed
6. **Optimize**: Consider splitting large lessons

---

## 💡 Pro Tips

- **Generate in batches**: Don't try to generate 100+ questions at once
- **Test incrementally**: Expand a few lessons first, then all
- **Monitor file size**: Keep total bundle under 5MB for fast loading
- **Backup regularly**: Keep old `pregenerated-questions.ts` files
- **Use version control**: Commit after each major change

---

## 📧 Need Help?

If you run into issues:

1. Check this guide first
2. Look at error messages in console
3. Review recent commits in Git history
4. Check Netlify deployment logs
5. Ask your AI assistant for help (mention this project)

---

**Last Updated**: 2025-12-16  
**Version**: 1.0  
**Contact**: Jana Mullerova (<mulleroj@gmail.com>)
