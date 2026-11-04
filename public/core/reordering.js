import { $, $$ } from './dom.js';
export function createCoreReordering(context) {
    const S = context.state;
    const refreshAnswerUI = (...args) => context.refreshAnswerUI(...args);
    const syncRoundOrder = (...args) => context.syncRoundOrder(...args);
    const markDirty = (...args) => context.markDirty(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    function reorderAllowed(kind) {
        if (kind === 'questions')
            return !!S.draft && location.hash.startsWith('#edit/');
        if (kind === 'editor-order')
            return !!S.draft && location.hash.startsWith('#edit/') && S.draft.questions[S.questionIndex]?.type === 'order';
        return kind === 'player-order' && S.room?.role === 'player' && S.connected && S.roomState?.phase === 'question' && S.roomState.question?.type === 'order' && !S.answerPending && !S.answerSent && !$('.live-question[aria-busy="true"]');
    }
    function moveReordered(kind, id, to) {
        if (!reorderAllowed(kind))
            return;
        const list = kind === 'questions' ? S.draft.questions : kind === 'editor-order' ? S.draft.questions[S.questionIndex].options : S.order;
        const from = list.findIndex(item => kind === 'player-order' ? item === id : item.id === id);
        if (from < 0 || to < 0 || to >= list.length || from === to)
            return;
        const selected = kind === 'questions' ? S.draft.questions[S.questionIndex]?.id : null;
        list.splice(to, 0, list.splice(from, 1)[0]);
        if (kind === 'player-order') {
            const root = $('.order-list');
            for (const [index, id] of S.order.entries()) {
                const row = $$('[data-reorder-item]', root).find(el => el.dataset.reorderItem === id);
                if (row) {
                    root.append(row);
                    $('.question-number', row).textContent = index + 1;
                    $$('[data-action="player-order"]', row).forEach(el => { el.dataset.index = index; });
                }
            }
            refreshAnswerUI();
        }
        else {
            if (kind === 'questions') {
                S.questionIndex = S.draft.questions.findIndex(item => item.id === selected);
                syncRoundOrder();
            }
            else
                S.draft.questions[S.questionIndex].correct = list.map(item => item.id);
            markDirty();
            renderEditor();
        }
        const row = $$(`[data-reorder-list="${kind}"] > [data-reorder-item]`).find(item => item.dataset.reorderItem === id);
        $('[data-reorder-handle]', row || document)?.focus({ preventScroll: true });
        $('#reorder-status').textContent = `${kind === 'questions' ? 'Question' : 'Answer'} moved to position ${to + 1} of ${list.length}.`;
    }
    return { reorderAllowed, moveReordered };
}
