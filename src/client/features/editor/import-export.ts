import type {AppContext} from '../../app/context.js';
import { download, slug, esc, $, uid } from '../../core/dom.js';
import { quizTags } from '../../core/tags.js';
import { TYPES } from '../../core/quiz-types.js';
import {DEFAULT_REVEAL_DELAY, validRevealDelay} from '../../core/live-game.js';
import { SELF_STUDY_FORMAT, packSelfStudyQuiz, unpackSelfStudyQuiz } from './self-study-file.js';
import {isTextResponse} from './competition.js';
const MAX_QUIZ_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ENCODED_STUDY_BYTES = Math.ceil(MAX_QUIZ_FILE_BYTES * 4 / 3) + 1024;
export function createFeaturesEditorImportExport(context: AppContext) {
    const S = context.state;
    const toast = (...args) => context.toast(...args);
    const modal = (...args) => context.modal(...args);
    const blankQuiz = (...args) => context.blankQuiz(...args);
    const newQuestion = (...args) => context.newQuestion(...args);
    const cloneQuizQuestions = (...args) => context.cloneQuizQuestions(...args);
    const validateDraft = (...args) => context.validateDraft(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    function exportQuiz() {
        context.commitQuizTag?.();
        const {title, description, questions, settings} = S.draft;
        const quiz = {format: 'gather.quiz', version: 1, title, description, tags: quizTags(S.draft), questions, settings};
        const file = settings?.selfStudy ? packSelfStudyQuiz(quiz) : quiz;
        download(`${slug(title)}.json`, JSON.stringify(file, null, 2));
    }
    async function copyAIPrompt(study = false) {
        const {AI_QUIZ_PROMPT, AI_SELF_STUDY_PROMPT} = await import('./ai-prompt.js');
        const prompt = study ? AI_SELF_STUDY_PROMPT : AI_QUIZ_PROMPT;
        const title = study ? 'Solo play prompt' : 'Host quiz prompt';
        try {
            await navigator.clipboard.writeText(prompt);
            toast(title + ' copied.');
        }
        catch {
            modal(title, `<textarea class="input ai-prompt" id="ai-prompt" readonly aria-label="${title}">${esc(prompt)}</textarea>`, '', () => { $('#ai-prompt').focus(); $('#ai-prompt').select(); });
        }
    }
    async function importQuiz(file) {
        if (!file)
            return;
        if (file.size > MAX_ENCODED_STUDY_BYTES)
            throw new Error('This quiz file is too large. Use a smaller quiz.');
        let data;
        try {
            data = JSON.parse(await file.text());
        }
        catch {
            throw new Error('That file is not valid JSON.');
        }
        const wrappedStudy = data?.format === SELF_STUDY_FORMAT;
        if (file.size > MAX_QUIZ_FILE_BYTES && (!wrappedStudy || data.encoding !== 'base64url'))
            throw new Error('Choose a quiz JSON file under 4 MB.');
        if (wrappedStudy) data = unpackSelfStudyQuiz(data);
        if (typeof data?.title !== 'string' || !Array.isArray(data.questions))
            throw new Error('Choose a Gather quiz export containing a title and questions.');
        const settings = data.settings || {}, selfStudy = wrappedStudy || settings.selfStudy === true;
        const game = settings.game;
        if (game != null && (typeof game !== 'object' || Array.isArray(game) || !['all', 'turns', 'auto'].includes(game.reveal))) throw new Error('Choose a valid answer reveal.');
        if (game && !validRevealDelay(game.revealDelay ?? DEFAULT_REVEAL_DELAY)) throw new Error('Choose a reveal interval from 1 to 30 seconds.');
        const draft = { ...blankQuiz(), title: data.title.slice(0, 120), description: String(data.description || '').slice(0, 2000), collection: '', tags: quizTags(data), settings: { ...(selfStudy ? {selfStudy: true} : {}), ...(game ? {game: {reveal: game.reveal, ...(game.revealDelay == null ? {} : {revealDelay: game.revealDelay})}} : {}), ...(settings.competition != null ? {competition: structuredClone(settings.competition)} : {}), questionDelay: settings.questionDelay === undefined ? 3 : Number(settings.questionDelay), showQuestionType: settings.showQuestionType === true, showAnswerOptions: settings.showAnswerOptions !== false, roundsEnabled: !!settings.roundsEnabled, rounds: Array.isArray(settings.rounds) ? structuredClone(settings.rounds) : [], shuffleQuestions: !!settings.shuffleQuestions, shuffleOptions: !!settings.shuffleOptions, shuffleTrueFalse: !!settings.shuffleTrueFalse, scoring: settings.scoring === 'speed' ? 'speed' : 'accuracy', allowLateJoin: settings.allowLateJoin !== false, showLeaderboard: settings.showLeaderboard !== false, participantLimit: Math.max(0, Math.floor(Number(settings.participantLimit) || 0)), chatMode: settings.chatMode ?? 'off', chatReplies: settings.chatReplies ?? true, chatReactions: settings.chatReactions ?? true, chatMentions: settings.chatMentions ?? false }, questions: data.questions.map(raw => {
                if (!raw || typeof raw !== 'object' || !Object.hasOwn(TYPES, raw.type))
                    throw new Error('Every question needs a supported question type.');
                const q = { ...newQuestion(raw.type), ...raw, id: String(raw.id || uid()), prompt: String(raw.prompt || ''), image: String(raw.image || ''), explanation: String(raw.explanation || ''), options: [], correct: [], acceptedAnswers: Array.isArray(raw.acceptedAnswers) ? raw.acceptedAnswers.map(String) : [] };
                if(q.type==='pin'&&raw.answerRegion==null)delete q.answerRegion;
                const remap = new Map();
                q.options = (Array.isArray(raw.options) ? raw.options : []).map(o => { const id = uid(); remap.set(o.id, id); return { id, text: String(o.text || ''), image: String(o.image || '') }; });
                q.correct = (Array.isArray(raw.correct) ? raw.correct : []).map(id => remap.get(id)).filter(Boolean);
                if (q.competition?.mode === 'avoid-host' && !isTextResponse(q.type)) {
                    q.competition.secretAnswer = remap.get(q.competition.secretAnswer);
                }
                if (q.type === 'order' && q.correct.length === q.options.length)
                    q.options = q.correct.map(id => q.options.find(o => o.id === id));
                return q;
            }) };
        cloneQuizQuestions(draft);
        validateDraft(draft);
        S.draft = draft;
        S.studyQuestionsShownFor = null;
        S.questionIndex = 0;
        S.dirty = true;
        location.hash = `#edit/${draft.id}`;
        renderEditor();
        toast(wrappedStudy ? 'Solo play quiz imported.' : 'Quiz imported.');
    }
    async function sampleQuiz() {
        const { geographySample } = await import('./sample.js');
        const d = blankQuiz();
        const {questions, rounds} = geographySample(uid);
        d.title = 'Around the world';
        d.tags = ['General knowledge'];
        d.description = 'Explore flags, oceans and maps with every question type and three live challenges.';
        d.questions = questions;
        Object.assign(d.settings, {
            showQuestionType: true, roundsEnabled: true, rounds,
            game: {reveal: 'all'}, competition: {lives: 3, livesReset: 'round'}
        });
        S.draft = d;
        S.questionIndex = 0;
        S.dirty = true;
        location.hash = `#edit/${d.id}`;
        renderEditor();
    }
    return { exportQuiz, copyAIPrompt, importQuiz, sampleQuiz };
}
