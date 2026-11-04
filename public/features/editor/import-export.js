import { download, slug, esc, $, uid } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
export function createFeaturesEditorImportExport(context) {
    const S = context.state;
    const toast = (...args) => context.toast(...args);
    const modal = (...args) => context.modal(...args);
    const blankQuiz = (...args) => context.blankQuiz(...args);
    const newQuestion = (...args) => context.newQuestion(...args);
    const cloneQuizQuestions = (...args) => context.cloneQuizQuestions(...args);
    const validateDraft = (...args) => context.validateDraft(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    function exportQuiz() { const { title, description, collection, questions, settings } = S.draft; download(`${slug(title)}.json`, JSON.stringify({ format: 'gather.quiz', version: 1, title, description, collection, questions, settings }, null, 2)); }
    async function copyAIPrompt() {
        const { AI_QUIZ_PROMPT } = await import('./ai-prompt.js');
        try {
            await navigator.clipboard.writeText(AI_QUIZ_PROMPT);
            toast('AI prompt copied.');
        }
        catch {
            modal('AI quiz prompt', `<textarea class="input ai-prompt" id="ai-prompt" readonly aria-label="AI quiz prompt">${esc(AI_QUIZ_PROMPT)}</textarea>`, '', () => { $('#ai-prompt').focus(); $('#ai-prompt').select(); });
        }
    }
    async function importQuiz(file) {
        if (!file)
            return;
        if (file.size > 4 * 1024 * 1024)
            throw new Error('Choose a quiz JSON file under 4 MB.');
        let data;
        try {
            data = JSON.parse(await file.text());
        }
        catch {
            throw new Error('That file is not valid JSON.');
        }
        if (typeof data.title !== 'string' || !Array.isArray(data.questions))
            throw new Error('Choose a Gather quiz export containing a title and questions.');
        const settings = data.settings || {};
        const draft = { ...blankQuiz(), title: data.title.slice(0, 120), description: String(data.description || '').slice(0, 2000), collection: String(data.collection || '').slice(0, 80), settings: { questionDelay: settings.questionDelay === undefined ? 3 : Number(settings.questionDelay), showQuestionType: settings.showQuestionType === true, showAnswerOptions: settings.showAnswerOptions !== false, roundsEnabled: !!settings.roundsEnabled, rounds: Array.isArray(settings.rounds) ? structuredClone(settings.rounds) : [], shuffleQuestions: !!settings.shuffleQuestions, shuffleOptions: !!settings.shuffleOptions, shuffleTrueFalse: !!settings.shuffleTrueFalse, scoring: settings.scoring === 'speed' ? 'speed' : 'accuracy', allowLateJoin: settings.allowLateJoin !== false, showLeaderboard: settings.showLeaderboard !== false, participantLimit: Math.max(0, Math.floor(Number(settings.participantLimit) || 0)), chatMode: settings.chatMode ?? 'off', chatReplies: settings.chatReplies ?? true, chatReactions: settings.chatReactions ?? true }, questions: data.questions.map(raw => {
                if (!raw || typeof raw !== 'object' || !TYPES[raw.type])
                    throw new Error('Every question needs a supported question type.');
                const q = { ...newQuestion(raw.type), ...raw, id: String(raw.id || uid()), prompt: String(raw.prompt || ''), image: String(raw.image || ''), explanation: String(raw.explanation || ''), options: [], correct: [], acceptedAnswers: Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers.map(String) : [] };
                const remap = new Map();
                q.options = (Array.isArray(raw.options) ? raw.options : []).map(o => { const id = uid(); remap.set(o.id, id); return { id, text: String(o.text || ''), image: String(o.image || '') }; });
                q.correct = (Array.isArray(raw.correct) ? raw.correct : []).map(id => remap.get(id)).filter(Boolean);
                if (q.type === 'order' && q.correct.length === q.options.length)
                    q.options = q.correct.map(id => q.options.find(o => o.id === id));
                return q;
            }) };
        cloneQuizQuestions(draft);
        validateDraft(draft);
        S.draft = draft;
        S.questionIndex = 0;
        S.dirty = true;
        location.hash = `#edit/${draft.id}`;
        renderEditor();
        toast('Quiz imported.');
    }
    async function sampleQuiz() {
        const { geographyQuestions } = await import('./sample.js');
        const d = blankQuiz();
        d.title = 'Around the world';
        d.collection = 'General knowledge';
        d.description = '10 questions about our planet, from flags to oceans.';
        d.questions = geographyQuestions(uid);
        d.settings.showQuestionType = true;
        S.draft = d;
        S.questionIndex = 0;
        S.dirty = true;
        location.hash = `#edit/${d.id}`;
        renderEditor();
    }
    return { exportQuiz, copyAIPrompt, importQuiz, sampleQuiz };
}
