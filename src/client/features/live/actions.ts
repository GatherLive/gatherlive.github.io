import type {AppContext} from '../../app/context.js';
import { esc, $, download, slug } from '../../core/dom.js';
import {MAX_REVIEW_NOTE_LENGTH, REJECTION_QUICK_REPLIES, REVIEW_QUICK_REPLIES, reviewableAnswer} from '../../core/live-game.js';
import {openAvatarPicker, readAvatarProfile} from '../avatars/picker.js';
import {toggleGameStageLives} from './game-stage.js';
import {answerLabel} from './competition.js';
import {createAnswerReviewActions} from './answer-review.js';
import {resultHasPoints, startingLives} from '../results/lives.js';

export function createFeaturesLiveActions(context: AppContext) {
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
    const competitionCommand = (type: string, values = {}) => {
        const questionId = S.roomState?.question?.id;
        return S.room?.role === 'host' && S.connected && questionId && send({type, questionId, ...values});
    };
    function openReviewNote(button: HTMLElement, reject = false) {
        const state = S.roomState;
        const row = state?.competition?.review?.rows?.find(entry => entry.playerId === button.dataset.id);
        if (!row || !reviewableAnswer(row) || S.room?.role !== 'host' || state.competition.review.stage !== 'review') return;
        if (reject && row.reason !== 'rejected' && !competitionCommand('competition_review', {playerId: row.playerId, accepted: false})) return;
        const target = `data-id="${esc(row.playerId)}" data-question-id="${esc(state.question.id)}"`;
        const replies = reject ? REJECTION_QUICK_REPLIES : REVIEW_QUICK_REPLIES;
        const note = reject && row.reason !== 'rejected' ? '' : row.note;
        modal(reject ? 'Rejected answer' : 'Review answer', `<p class="competition-note-answer" dir="auto">${esc(answerLabel(state, row.answer))}</p>
            <div class="field"><span id="review-quick-replies-label">Quick replies</span>
                <div class="competition-quick-replies" role="group" aria-labelledby="review-quick-replies-label">
                    ${replies.map(reply => `<button class="quiet-button" type="button" data-action="competition-send-note" data-reply="${esc(reply)}" ${target} data-needs-connection>${esc(reply)}</button>`).join('')}
                </div></div>
            <div class="field"><label for="review-note">Custom note</label><input id="review-note" type="text" maxlength="${MAX_REVIEW_NOTE_LENGTH}" value="${esc(note || '')}"></div>`,
            `<button class="btn primary" type="button" data-action="competition-send-note" ${target} data-needs-connection>Post note</button>`);
        if (reject) {
            const done = $<HTMLButtonElement>('.modal-actions [data-action="close-modal"]');
            if (done) done.textContent = 'Done';
        }
    }
    function sendReviewNote(button: HTMLElement) {
        const input = $<HTMLInputElement>('#review-note');
        if (!input || S.roomState?.question?.id !== button.dataset.questionId) return closeModal();
        const note = button.dataset.reply ?? input.value.trim();
        if (!note) { input.focus(); return toast('Enter a note.', true); }
        if (competitionCommand('competition_review', {playerId: button.dataset.id, note}))
            closeModal();
    }
    async function hostDraft() {
        const draft = await saveQuiz(true);
        await hostQuiz(draft.id, draft.settings);
    }
    return { actions: {
            ...createAnswerReviewActions(context),
            'zoom-answer': zoomAnswer,
            'sample': sampleQuiz,
            'remove-question-image': () => { S.draft.questions[S.questionIndex].image = ''; markDirty(); renderEditor(); },
            'remove-answer-image': el => { const option = S.draft.questions[S.questionIndex].options.find(o => o.id === el.dataset.id); if (option) {
                option.image = '';
                markDirty();
                renderEditor();
            } },
            'host-draft': hostDraft,
            'host-quiz': el => hostQuiz(el.dataset.id),
            'copy-link': copyLink,
            'copy-room-code': () => context.copyRoomCode(),
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
            'toggle-game-lives': toggleGameStageLives,
            'room-avatar': () => {
                if (!S.connected || S.roomState?.phase !== 'lobby') return;
                const code = S.room?.code;
                const current = S.roomState.me?.avatar ?? S.roomState.hostAvatar ?? readAvatarProfile();
                openAvatarPicker(context, current, avatar => {
                    if (S.room?.code !== code || S.roomState?.phase !== 'lobby') throw new Error('Avatars can be changed in the lobby.');
                    if (!context.send({type: 'avatar_update', avatar}, {quiet: true})) throw new Error('Reconnect to save your avatar.');
                });
            },
            'competition-approve': el => competitionCommand('competition_review', {playerId: el.dataset.id, accepted: true}),
            'competition-reject': el => S.roomState?.settings?.game
                ? openReviewNote(el, true)
                : competitionCommand('competition_review', {playerId: el.dataset.id, accepted: false}),
            'competition-note': el => openReviewNote(el),
            'competition-send-note': sendReviewNote,
            'competition-reveal': el => competitionCommand('competition_reveal', {revealed: Number(el.dataset.revealed)}),
            'competition-auto-reveal': el => competitionCommand('competition_auto_reveal', {enabled: el.dataset.enabled === 'true'}),
            'competition-apply': () => competitionCommand('competition_apply'),
            'room-finish-final': () => send({ type: 'finish' }),
            'draw-round': () => send({ type: 'draw_round' }),
            'room-lock': () => send({ type: 'lock', locked: !S.roomState.locked }),
            'room-finish': () => modal(S.roomState?.study ? 'End practice?' : 'End quiz?',
                S.roomState?.study ? '<p>Review the answers you have submitted.</p>' : '<p>Ends the quiz for all players.</p>',
                '<button class="btn primary" data-action="confirm-finish">Show results</button>'),
            'confirm-finish': () => { send({ type: 'finish' }); closeModal(); },
            'kick-player': el => modal('Remove this player?', `<p>${esc(el.dataset.name)} will be removed from this quiz.</p>`, `<button class="btn danger" data-action="confirm-kick" data-id="${el.dataset.id}">Remove player</button>`),
            'confirm-kick': el => { send({ type: 'kick', playerId: el.dataset.id }); closeModal(); },
            'leave-room': () => {
                const practice = S.roomState?.study && S.roomState.phase !== 'finished';
                const message = practice ? 'Resume from Open rooms in My quizzes within 24 hours of opening this room.'
                    : S.room.role === 'host' ? (S.roomState?.phase === 'finished' ? 'Saved results stay in My quizzes.' : 'Participants stay in the room. Rejoin or close it from Open rooms.')
                    : 'You can rejoin from this browser while the room is still open.';
                modal(practice?'Leave practice?':'Leave quiz?', `<p>${message}</p>`,
                    `<button class="btn primary" data-action="confirm-leave">${practice?'Save and leave':'Leave quiz'}</button>`);
            },
            'confirm-leave': async () => {
                const host = S.room?.role === 'host', state = S.roomState;
                if(host && S.connected && state?.study && !['lobby','finished'].includes(state.phase) && state.autoplay?.status !== 'paused'){
                    await context.actions['autoplay-pause']();
                }
                closeModal(); disconnectRoom(); S.room = null; S.roomState = null; S.fatalRoomError = null;
                location.hash = host ? '#dashboard' : '#';
            },
            'choose-answer': el => { const q = S.roomState?.question; if (!S.connected || !q || S.answerSent || S.answerPending || S.roomState.autoplay?.clockPaused || (S.room.role === 'host' && !S.roomState.hostPlaying))
                return; if (q.type === 'multi') {
                if (!Array.isArray(S.selection))
                    S.selection = [];
                S.selection = S.selection.includes(el.dataset.id) ? S.selection.filter(id => id !== el.dataset.id) : [...S.selection, el.dataset.id];
                refreshAnswerUI();
            }
            else
                sendAnswer(el.dataset.id); },
            'submit-multi': () => { if ((S.selection as string[])?.length)
                sendAnswer(S.selection); },
            'submit-order': () => sendAnswer(S.order),
            'submit-slider': () => sendAnswer(Number($('#player-slider')?.value ?? S.selection)),
            'submit-pin': () => { if (S.pin)
                sendAnswer(S.pin); },
            'player-order': el => moveReordered('player-order', S.order[Number(el.dataset.index)], Number(el.dataset.index) + Number(el.dataset.direction)),
            'save-report': async () => { await backend(`/api/rooms/${S.room.code}/report`, { detailed: !!S.roomState?.study }); toast('Results saved.'); },
            'results-csv': () => download(`${slug(S.roomState.title)}-results.csv`, csvFor(S.roomState.leaderboard || [], S.roomState.roundResults || [], startingLives(S.roomState), S.roomState.competition?.winners ?? [], resultHasPoints(S.roomState), S.roomState.competition?.rankedByElimination === true), 'text/csv;charset=utf-8')
        } };
}
