import { uid, safeImage } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
import { CHAT_OPTIONS } from '../chat/room-chat.js';
export function createFeaturesEditorModel(context) {
    const S = context.state;
    const activeUser = (...args) => context.activeUser(...args);
    function defaultSettings() { return { shuffleQuestions: false, shuffleOptions: false, shuffleTrueFalse: false, scoring: 'accuracy', allowLateJoin: true, showLeaderboard: true, participantLimit: 0, questionDelay: 3, showQuestionType: false, showAnswerOptions: true, roundsEnabled: false, rounds: [], chatMode: 'off', chatReplies: true, chatReactions: true, chatMentions: false }; }
    function questionRound(id, d = S.draft) { return (d.settings.rounds || []).find(r => r.questionIds.includes(id)); }
    function ensureRounds(d = S.draft) {
        if (!Array.isArray(d.settings.rounds))
            d.settings.rounds = [];
        if (!d.settings.rounds.length)
            d.settings.rounds = [{ id: uid(), title: 'Round 1', reward: '', questionIds: d.questions.map(q => q.id) }];
        const assigned = new Set(), ids = new Set(d.questions.map(q => q.id));
        for (const round of d.settings.rounds)
            round.questionIds = (round.questionIds || []).filter(id => ids.has(id) && !assigned.has(id) && assigned.add(id));
        d.settings.rounds[0].questionIds.push(...d.questions.filter(q => !assigned.has(q.id)).map(q => q.id));
    }
    function assignQuestion(id, roundId) {
        for (const r of S.draft.settings.rounds)
            r.questionIds = r.questionIds.filter(qid => qid !== id);
        const round = S.draft.settings.rounds.find(r => r.id === roundId);
        if (round)
            round.questionIds.push(id);
        syncRoundOrder();
    }
    function syncRoundOrder() {
        const order = new Map(S.draft.questions.map((q, i) => [q.id, i]));
        for (const round of S.draft.settings.rounds || [])
            round.questionIds.sort((a, b) => order.get(a) - order.get(b));
    }
    function cloneQuizQuestions(d) {
        const remap = new Map();
        d.questions = d.questions.map(q => { const id = uid(); remap.set(q.id, id); return { ...q, id }; });
        if (Array.isArray(d.settings?.rounds))
            d.settings.rounds = d.settings.rounds.map(r => ({ ...r, id: uid(), questionIds: (r.questionIds || []).map(id => remap.get(id)).filter(Boolean) }));
        return d;
    }
    function newQuestion(type = 'single') {
        const options = (type === 'true_false' ? ['True', 'False'] : ['', '', '', '']).map(text => ({ id: uid(), text, image: '' }));
        return { id: uid(), type, prompt: '', image: '', options, correct: type === 'order' ? options.map(o => o.id) : [], acceptedAnswers: [], min: 0, max: 100, target: type === 'pin' ? { x: .5, y: .5 } : 50, tolerance: type === 'pin' ? .1 : 0, timeLimit: 20, points: ['poll', 'word_cloud', 'open_ended', 'slide'].includes(type) ? 0 : 1000, explanation: '' };
    }
    function blankQuiz() { return { id: uid(), owner_id: activeUser().id, title: 'Untitled quiz', description: '', collection: '', questions: [newQuestion()], settings: defaultSettings() }; }
    function validateDraft(d) {
        if (!d.title.trim())
            throw new Error('Give your quiz a title first.');
        if (!d.questions.length)
            throw new Error('Add at least one question.');
        if (d.questions.length > 500)
            throw new Error('A quiz can contain up to 500 questions.');
        for (let i = 0; i < d.questions.length; i++) {
            const q = d.questions[i], prefix = `Question ${i + 1}: `;
            if (!q.prompt.trim() || q.prompt.length > 1000)
                throw new Error(prefix + 'add question text up to 1,000 characters.');
            if (!TYPES[q.type])
                throw new Error(prefix + 'choose a supported question type.');
            if (q.timeLimit < 5 || q.timeLimit > 300 || !Number.isFinite(q.timeLimit))
                throw new Error(prefix + 'choose a time from 5 to 300 seconds.');
            if (q.image && !safeImage(q.image))
                throw new Error(prefix + 'use an HTTPS image URL.');
            if (['single', 'multi', 'true_false', 'poll', 'order'].includes(q.type)) {
                if (q.options.length < 2 || q.options.length > 8)
                    throw new Error(prefix + 'add between 2 and 8 answers.');
                if (q.options.some(o => !o.text.trim() && !safeImage(o.image)))
                    throw new Error(prefix + 'fill in every answer or add an image.');
                if (q.options.some(o => o.image && !safeImage(o.image)))
                    throw new Error(prefix + 'answer images need HTTPS URLs.');
                if (['single', 'true_false'].includes(q.type) && q.correct.length !== 1)
                    throw new Error(prefix + 'select exactly one correct answer.');
                if (q.type === 'multi' && !q.correct.length)
                    throw new Error(prefix + 'select the correct answers.');
                if (q.type === 'order')
                    q.correct = q.options.map(o => o.id);
            }
            if (q.type === 'short_answer' && !q.acceptedAnswers.filter(x => x.trim()).length)
                throw new Error(prefix + 'add at least one accepted answer.');
            if (q.type === 'slider' && (!Number.isFinite(q.min) || !Number.isFinite(q.max) || q.min >= q.max || q.target < q.min || q.target > q.max || q.tolerance < 0))
                throw new Error(prefix + 'check the slider range and correct number.');
            if (q.type === 'pin' && (!safeImage(q.image) || !Number.isFinite(q.target?.x) || !Number.isFinite(q.target?.y) || q.target.x < 0 || q.target.x > 1 || q.target.y < 0 || q.target.y > 1 || !Number.isFinite(q.tolerance) || q.tolerance < .001 || q.tolerance > 1.5))
                throw new Error(prefix + 'add an image and set a valid pin location.');
            if (['poll', 'word_cloud', 'open_ended', 'slide'].includes(q.type))
                q.points = 0;
        }
        if (!Number.isInteger(d.settings.questionDelay) || d.settings.questionDelay < 0 || d.settings.questionDelay > 30)
            throw new Error('Choose a countdown from 0 to 30 seconds.');
        if (!CHAT_OPTIONS.some(([mode]) => mode === d.settings.chatMode) || ['chatReplies', 'chatReactions'].some(key => typeof d.settings[key] !== 'boolean'))
            throw new Error('Choose valid room chat settings.');
        if (d.settings.roundsEnabled) {
            if (!Array.isArray(d.settings.rounds) || !d.settings.rounds.length)
                throw new Error('Add a round.');
            const assigned = [];
            for (let i = 0; i < d.settings.rounds.length; i++) {
                const r = d.settings.rounds[i];
                if (!r.title.trim())
                    throw new Error(`Round ${i + 1}: add a title.`);
                if (!r.questionIds.length)
                    throw new Error(`${r.title}: assign at least one question.`);
                assigned.push(...r.questionIds);
            }
            if (assigned.length !== d.questions.length || new Set(assigned).size !== assigned.length || assigned.some(id => !d.questions.some(q => q.id === id)))
                throw new Error('Assign every question to one round.');
        }
        if (JSON.stringify(d).length > 4 * 1024 * 1024)
            throw new Error('This quiz is too large. Keep its JSON under 4 MB.');
    }
    return { defaultSettings, questionRound, ensureRounds, assignQuestion, syncRoundOrder, cloneQuizQuestions, newQuestion, blankQuiz, validateDraft };
}
