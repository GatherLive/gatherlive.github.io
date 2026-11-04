import { esc, $, download, slug } from '../../core/dom.js';
export function createFeaturesLiveActions(context) {
    const S = context.state;
    const zoomAnswer = (...args) => context.zoomAnswer(...args);
    const sampleQuiz = (...args) => context.sampleQuiz(...args);
    const markDirty = (...args) => context.markDirty(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    const saveQuiz = (...args) => context.saveQuiz(...args);
    const hostQuiz = (...args) => context.hostQuiz(...args);
    const copyLink = (...args) => context.copyLink(...args);
    const openSocket = (...args) => context.openSocket(...args);
    const modal = (...args) => context.modal(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const send = (...args) => context.send(...args);
    const disconnectRoom = (...args) => context.disconnectRoom(...args);
    const refreshAnswerUI = (...args) => context.refreshAnswerUI(...args);
    const sendAnswer = (...args) => context.sendAnswer(...args);
    const moveReordered = (...args) => context.moveReordered(...args);
    const backend = (...args) => context.backend(...args);
    const toast = (...args) => context.toast(...args);
    const csvFor = (...args) => context.csvFor(...args);
    return { actions: {
            'zoom-answer': zoomAnswer,
            'sample': sampleQuiz,
            'remove-question-image': () => { S.draft.questions[S.questionIndex].image = ''; markDirty(); renderEditor(); },
            'remove-answer-image': el => { const option = S.draft.questions[S.questionIndex].options.find(o => o.id === el.dataset.id); if (option) {
                option.image = '';
                markDirty();
                renderEditor();
            } },
            'host-draft': async () => { const d = await saveQuiz(true); await hostQuiz(d.id, d.settings); },
            'host-quiz': el => hostQuiz(el.dataset.id),
            'copy-link': copyLink,
            'reconnect': () => { if (S.room && !S.fatalRoomError) {
                S.retries = 1;
                return openSocket();
            } },
            'room-media-skip': () => modal('Start without waiting?', '<p>Some players are still downloading images. Starting now may reduce their answer time.</p>', '<button class="btn primary" data-action="room-media-continue">Start anyway</button>'),
            'room-media-continue': () => { closeModal(); send({ type: 'media_skip' }); },
            'room-start': () => send({ type: 'start' }),
            'room-reveal': () => send({ type: 'reveal' }),
            'room-next': () => send({ type: 'next' }),
            'room-next-round': () => send({ type: 'next_round' }),
            'room-finish-final': () => send({ type: 'finish' }),
            'draw-round': () => send({ type: 'draw_round' }),
            'room-lock': () => send({ type: 'lock', locked: !S.roomState.locked }),
            'room-finish': () => modal('End quiz?', `<p>Ends the quiz for all players.</p>`, '<button class="btn primary" data-action="confirm-finish">Show results</button>'),
            'confirm-finish': () => { send({ type: 'finish' }); closeModal(); },
            'kick-player': el => modal('Remove this player?', `<p>${esc(el.dataset.name)} will be removed from this quiz.</p>`, `<button class="btn danger" data-action="confirm-kick" data-id="${el.dataset.id}">Remove player</button>`),
            'confirm-kick': el => { send({ type: 'kick', playerId: el.dataset.id }); closeModal(); },
            'leave-room': () => modal('Leave quiz?', `<p>${S.room.role === 'host' ? (S.roomState?.phase === 'finished' ? 'Saved results stay in My quizzes → Results.' : 'Players stay in the room. Rejoin or close it from My quizzes → Open rooms.') : 'You can rejoin from this browser while the room is still open.'}</p>`, '<button class="btn primary" data-action="confirm-leave">Leave quiz</button>'),
            'confirm-leave': () => { const host = S.room?.role === 'host'; closeModal(); disconnectRoom(); S.room = null; S.roomState = null; S.fatalRoomError = null; location.hash = host ? '#dashboard' : '#'; },
            'choose-answer': el => { const q = S.roomState?.question; if (!S.connected || !q || S.answerSent || S.answerPending || S.room.role === 'host')
                return; if (q.type === 'multi') {
                if (!Array.isArray(S.selection))
                    S.selection = [];
                S.selection = S.selection.includes(el.dataset.id) ? S.selection.filter(id => id !== el.dataset.id) : [...S.selection, el.dataset.id];
                refreshAnswerUI();
            }
            else
                sendAnswer(el.dataset.id); },
            'submit-multi': () => { if (S.selection?.length)
                sendAnswer(S.selection); },
            'submit-order': () => sendAnswer(S.order),
            'submit-slider': () => sendAnswer(Number($('#player-slider')?.value ?? S.selection)),
            'submit-pin': () => { if (S.pin)
                sendAnswer(S.pin); },
            'player-order': el => moveReordered('player-order', S.order[Number(el.dataset.index)], Number(el.dataset.index) + Number(el.dataset.direction)),
            'save-report': async () => { await backend(`/api/rooms/${S.room.code}/report`, { detailed: false }); toast('Results saved.'); },
            'results-csv': () => download(`${slug(S.roomState.title)}-results.csv`, csvFor(S.roomState.leaderboard || [], S.roomState.roundResults || []), 'text/csv;charset=utf-8')
        } };
}
