import type {AppContext} from '../../app/context.js';
import { $, uid } from '../../core/dom.js';
export function createFeaturesEditorActions(context: AppContext) {
    const S = context.state;
    const blankQuiz = (...args) => context.blankQuiz(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    const copyAIPrompt = (...args) => context.copyAIPrompt(...args);
    const saveQuiz = (...args) => context.saveQuiz(...args);
    const exportQuiz = (...args) => context.exportQuiz(...args);
    const questionRound = (...args) => context.questionRound(...args);
    const newQuestion = (...args) => context.newQuestion(...args);
    const assignQuestion = (...args) => context.assignQuestion(...args);
    const markDirty = (...args) => context.markDirty(...args);
    const moveReordered = (...args) => context.moveReordered(...args);
    const ensureRounds = (...args) => context.ensureRounds(...args);
    const syncRoundOrder = (...args) => context.syncRoundOrder(...args);
    return { actions: {
            'new-quiz': () => { S.draft = blankQuiz(); S.questionIndex = 0; S.dirty = true; location.hash = `#edit/${S.draft.id}`; renderEditor(); setTimeout(() => { const details = $<HTMLDetailsElement>('.editor-quiz-details'); if (details)
                details.open = true; $('#quiz-title')?.focus(); $('#quiz-title')?.select(); }, 20); },
            'copy-ai-prompt': copyAIPrompt,
            'save-quiz': () => saveQuiz(),
            'export-quiz': exportQuiz,
            'select-question': el => { S.questionIndex = Number(el.dataset.index); S.currentRoundId = questionRound(S.draft.questions[S.questionIndex].id)?.id; renderEditor(); },
            'add-question': () => { if (S.draft.questions.length >= 500)
                throw new Error('A quiz can have up to 500 questions.'); const roundId = S.currentRoundId || questionRound(S.draft.questions[S.questionIndex]?.id)?.id || S.draft.settings.rounds?.[0]?.id, q = newQuestion(); S.draft.questions.push(q); if (roundId)
                assignQuestion(q.id, roundId); S.questionIndex = S.draft.questions.length - 1; markDirty(); renderEditor(); },
            'duplicate-question': () => { const q = structuredClone(S.draft.questions[S.questionIndex]), roundId = questionRound(q.id)?.id; q.id = uid(); S.draft.questions.splice(S.questionIndex + 1, 0, q); if (roundId)
                assignQuestion(q.id, roundId); S.questionIndex++; markDirty(); renderEditor(); },
            'delete-question': () => { const [q] = S.draft.questions.splice(S.questionIndex, 1); for (const r of S.draft.settings.rounds || [])
                r.questionIds = r.questionIds.filter(id => id !== q.id); S.questionIndex = Math.max(0, S.questionIndex - 1); markDirty(); renderEditor(); },
            'move-question': el => moveReordered('questions', S.draft.questions[S.questionIndex].id, S.questionIndex + Number(el.dataset.direction)),
            'add-round': () => { ensureRounds(); if (S.draft.settings.rounds.length >= 100)
                throw new Error('A quiz can have up to 100 rounds.'); const r = { id: uid(), title: `Round ${S.draft.settings.rounds.length + 1}`, reward: '', questionIds: [] }; S.draft.settings.rounds.push(r); S.currentRoundId = r.id; markDirty(); renderEditor(); $(`[data-round-id="${r.id}"][data-rfield="title"]`)?.focus(); },
            'delete-round': el => { const rounds = S.draft.settings.rounds, index = rounds.findIndex(r => r.id === el.dataset.id); if (rounds.length < 2 || index < 0)
                return; const [removed] = rounds.splice(index, 1), target = rounds[Math.max(0, index - 1)]; target.questionIds.push(...removed.questionIds); S.currentRoundId = target.id; syncRoundOrder(); markDirty(); renderEditor(); },
            'move-round': el => { const rounds = S.draft.settings.rounds, index = rounds.findIndex(r => r.id === el.dataset.id), next = index + Number(el.dataset.direction); if (next < 0 || next >= rounds.length)
                return; [rounds[index], rounds[next]] = [rounds[next], rounds[index]]; markDirty(); renderEditor(); },
            'add-option': () => { const q = S.draft.questions[S.questionIndex]; if (q.options.length >= 8)
                return; q.options.push({ id: uid(), text: '', image: '' }); if (q.type === 'order')
                q.correct = q.options.map(o => o.id); markDirty(); renderEditor(); },
            'remove-option': el => { const q = S.draft.questions[S.questionIndex]; if (q.options.length <= 2)
                throw new Error('Keep at least two answer choices.'); q.options = q.options.filter(o => o.id !== el.dataset.id); q.correct = q.correct.filter(id => id !== el.dataset.id); markDirty(); renderEditor(); },
            'move-option': el => moveReordered('editor-order', el.dataset.id, S.draft.questions[S.questionIndex].options.findIndex(o => o.id === el.dataset.id) + Number(el.dataset.direction))
        } };
}
