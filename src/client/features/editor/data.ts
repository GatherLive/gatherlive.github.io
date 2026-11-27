import type {AppContext} from '../../app/context.js';
import { quizTags } from '../../core/tags.js';
import { $, uid } from '../../core/dom.js';
import {optimizeQuizImage} from '../media/optimize.js';
import {QuizHistory} from './history.js';
export function createFeaturesEditorData(context: AppContext) {
    const S = context.state;
    const history = new QuizHistory();
    const renderEditor = (...args) => context.renderEditor(...args);
    const loading = (...args) => context.loading(...args);
    const db = (...args) => context.db(...args);
    const toast = (...args) => context.toast(...args);
    const defaultSettings = (...args) => context.defaultSettings(...args);
    const validateDraft = (...args) => context.validateDraft(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const getToken = (...args) => context.getToken(...args);
    const request = (...args) => context.request(...args);
    async function openEditor(id) {
        S.studyQuestionsShownFor = null;
        if (S.draft?.id === id) {
            renderEditor();
            return;
        }
        let quiz = S.quizzes.find(q => q.id === id);
        if (!quiz) {
            loading('Opening your quiz…');
            try {
                quiz = (await db(`giveaway_quizzes?id=eq.${encodeURIComponent(id)}&select=*`))[0];
            }
            catch (e) {
                toast(e.message, true);
            }
        }
        if (!quiz) {
            location.hash = '#dashboard';
            return;
        }
        const owner=activeUser()?.id,version=context.routeVersion;
        if(!S.accountUsage||S.usageOwner!==owner){try{const usage=await context.backend('/api/account/usage',null,'GET');if(owner===activeUser()?.id){S.accountUsage=usage;S.usageOwner=owner;}}catch{}}
        if(owner!==activeUser()?.id||version!==context.routeVersion)return;
        S.draft = structuredClone(quiz);
        S.draft.settings = { ...defaultSettings(), ...S.draft.settings };
        S.draft.tags = quizTags(quiz);
        S.questionIndex = 0;
        S.dirty = false;
        renderEditor();
    }
    const editorPosition = () => ({questionId: S.draft?.questions[S.questionIndex]?.id, roundId: S.currentRoundId});
    function bindEditorHistory() { history.bind(S.draft, editorPosition(), S.dirty); }
    function updateEditorHistory() {
        const state = $('#save-state');
        if (state) state.textContent = S.saving ? 'Saving…' : S.dirty ? 'Unsaved' : 'Saved';
        const undo = $<HTMLButtonElement>('[data-action="undo-quiz"]'), redo = $<HTMLButtonElement>('[data-action="redo-quiz"]');
        if (undo) undo.disabled = S.saving || !history.canUndo;
        if (redo) redo.disabled = S.saving || !history.canRedo;
    }
    function markDirty(source?: HTMLElement) {
        history.record(S.draft, editorPosition(), source);
        S.dirty = history.dirty;
        updateEditorHistory();
    }
    function moveHistory(undo: boolean) {
        if (S.saving || !S.draft || !$('.editor-page')) return;
        const position = history.move(S.draft, undo);
        if (!position) return;
        S.questionIndex = Math.max(0, S.draft.questions.findIndex(question => question.id === position.questionId));
        S.currentRoundId = position.roundId;
        S.dirty = history.dirty;
        renderEditor();
        $<HTMLButtonElement>(`[data-action="${undo ? 'undo-quiz' : 'redo-quiz'}"]:not(:disabled)`)?.focus({preventScroll: true});
    }
    async function saveQuiz(silent = false) {
        if (S.saving)
            throw new Error('Your quiz is still saving. Try again in a moment.');
        context.commitQuizTag?.();
        validateDraft(S.draft);
        history.record(S.draft, editorPosition());
        const submitted = history.content;
        const id = S.draft.id, owner = activeUser().id;
        S.saving = true;
        updateEditorHistory();
        try {
            const {title, description, questions, settings} = submitted;
            const tags = quizTags(submitted);
            const payload = {id, owner_id: owner, title: title.trim(), description, collection: '', tags, questions, settings: {...settings, tags}, updated_at: new Date().toISOString()};
            const result = await db('giveaway_quizzes?on_conflict=id', { method: 'POST', body: payload, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
            const saved = result[0];
            if (activeUser()?.id !== owner) return saved;
            if (S.draft?.id === id) {
                const same = submitted === history.content;
                const savedDraft = {...structuredClone(saved), tags: quizTags(saved)};
                S.draft = same ? savedDraft : {...savedDraft, ...structuredClone(history.content)};
                history.markSaved(savedDraft, submitted);
                S.dirty = history.dirty;
            }
            const idx = S.quizzes.findIndex(q => q.id === saved.id);
            if (idx >= 0)
                S.quizzes[idx] = saved;
            else
                S.quizzes.unshift(saved);
            if (!silent)
                toast('Quiz saved.');
            return saved;
        }
        finally {
            S.saving = false;
            updateEditorHistory();
        }
    }
    async function uploadImage(file, target) {
        if (!file)
            return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            throw new Error('Choose a JPG, PNG or WebP image.');
        if (file.size > 3 * 1024 * 1024)
            throw new Error('Keep your image under 3 MB.');
        const questionId = S.draft.questions[S.questionIndex].id, draftId = S.draft.id;
        const upload = await optimizeQuizImage(file);
        const result=await request(context.apiURL('/api/account/images'),{method:'POST',headers:{Authorization:'Bearer '+await getToken(),'Content-Type':upload.type},body:upload});
        const url=result.url; S.accountUsage=null;
        const q = S.draft?.id === draftId && S.draft.questions.find(question => question.id === questionId);
        if (!q) return;
        if (target === 'question')
            q.image = url;
        else {
            const o = q.options.find(o => o.id === target);
            if (o)
                o.image = url;
        }
        markDirty();
        renderEditor();
        toast('Image uploaded.');
    }
    return {openEditor, bindEditorHistory, updateEditorHistory, markDirty, saveQuiz, uploadImage,
        actions: {'undo-quiz': () => moveHistory(true), 'redo-quiz': () => moveHistory(false)},
        keys: [(event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || !$('.editor-page') ||
                event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable], .modal')) return false;
            const key = event.key.toLowerCase();
            if (key !== 'z' && key !== 'y') return false;
            event.preventDefault();
            moveHistory(key === 'z' && !event.shiftKey);
            return true;
        }]
    };
}
