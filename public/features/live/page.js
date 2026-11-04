import { brand, icon } from '../../core/icons.js';
import { esc, safeImage } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
export function createFeaturesLivePage(context) {
    const S = context.state;
    const connectionLabel = (...args) => context.connectionLabel(...args);
    const resultsView = (...args) => context.resultsView(...args);
    const updateTimer = (...args) => context.updateTimer(...args);
    const updateConnection = (...args) => context.updateConnection(...args);
    const hydrateRoomImages = (...args) => context.hydrateRoomImages(...args);
    const fitChoiceQuestion = (...args) => context.fitChoiceQuestion(...args);
    const leaderboard = (...args) => context.leaderboard(...args);
    const roomImage = (...args) => context.roomImage(...args);
    const answerOption = (...args) => context.answerOption(...args);
    const orderView = (...args) => context.orderView(...args);
    const sliderView = (...args) => context.sliderView(...args);
    const pinView = (...args) => context.pinView(...args);
    const textAnswerView = (...args) => context.textAnswerView(...args);
    const answerStatus = (...args) => context.answerStatus(...args);
    function renderRoom() {
        S.reorder?.cancel();
        const focused = document.activeElement?.id, selectionStart = document.activeElement?.selectionStart, selectionEnd = document.activeElement?.selectionEnd;
        const room = S.room, st = S.roomState, isHost = room?.role === 'host';
        if (!room)
            return;
        context.app.innerHTML = `<div class="room-wrap room-header"><header class="room-nav">${brand()}<div class="row"><span class="room-code-small"><span class="code-label">Code </span><b>${esc(room.code)}</b></span><div class="connection ${S.connected ? '' : 'offline'}" role="status" aria-live="polite" aria-atomic="true">${connectionLabel()}</div>${st?.me && st.phase !== 'lobby' ? `<span class="player-score"><strong>${(st.me.score || 0).toLocaleString()}</strong> pts</span>` : ''}<button class="icon-btn" data-action="leave-room" title="Leave quiz" aria-label="Leave quiz">${icon('logout', 16)}</button></div></header></div>${context.siteNews.slot()}<div class="room-wrap"><div id="room-announcement"></div><div id="room-tools" class="room-tools" hidden></div>${S.fatalRoomError ? `<div class="waiting-state"><h1>${S.roomUnavailable ? 'Room not available' : 'Unable to join'}</h1><p>${esc(S.fatalRoomError)}</p><a class="btn primary" href="#join" style="margin-top:25px">Try another code</a></div>` : !st ? `<div class="loading-section" role="status"><span class="spinner" aria-hidden="true"></span>Connecting…</div>` : st.phase === 'lobby' ? lobbyView(st, isHost) : st.phase === 'countdown' ? countdownView(st, isHost) : st.phase === 'round_results' ? roundResultsView(st, isHost) : st.phase === 'finished' ? resultsView(st, isHost) : questionView(st, isHost)}</div>`;
        context.siteNews.render();
        updateTimer();
        updateConnection();
        hydrateRoomImages();
        if (focused) {
            const el = document.getElementById(focused);
            if (el) {
                el.focus({ preventScroll: true });
                try {
                    el.setSelectionRange(selectionStart, selectionEnd);
                }
                catch { }
            }
        }
        fitChoiceQuestion();
    }
    function lobbyView(st, isHost) {
        const count = st.participantCount ?? st.players?.length ?? 0;
        if (!isHost)
            return `<main class="waiting-state player-lobby"><div class="lobby-heading"><p class="lobby-quiz-title">${esc(st.title)}</p><h1>You’re in<span>.</span></h1><p class="lobby-waiting"><span aria-hidden="true"></span>Waiting for host</p></div><div class="waiting-cards"><div class="waiting-card player-badge"><span>Playing as</span><strong>${esc(S.room.name)}</strong></div><div class="waiting-card waiting-count"><span>In the room</span><strong>${count} <small>player${count === 1 ? '' : 's'}</small></strong></div></div></main>`;
        return `<main class="lobby-layout"><section class="lobby-main"><h1>${esc(st.title)}</h1><div class="big-code">${esc(st.code)}</div><button class="quiet-button copy-code" data-action="copy-link">${icon('copy', 13)} Copy link</button><div><button class="btn primary large" data-action="room-start" data-needs-connection ${!st.players?.length ? 'disabled' : ''}>${icon('play', 18)} Start quiz</button></div><p class="small muted lobby-meta">${st.totalQuestions} questions${st.round?.total > 1 ? ' · ' + st.round.total + ' rounds' : ''}</p></section><section class="card participant-card"><div class="row between"><h2>Players <span class="muted">${count}</span></h2><button class="quiet-button" data-action="room-lock">${icon('lock', 13)} ${st.locked ? 'Locked' : 'Open'}</button></div>${st.players?.length ? `<div class="participant-list">${st.players.map(p => `<span class="participant-chip ${p.connected === false ? 'disconnected' : ''}">${esc(p.name)}<button class="icon-btn" data-action="kick-player" data-id="${p.id}" data-name="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button></span>`).join('')}</div>` : '<p class="answer-note">Waiting for players</p>'}</section></main>`;
    }
    function roundLabel(st) {
        return st.settings?.roundsEnabled && st.round ? `<span class="round-tag">${esc(st.round.title)}<span>${st.round.index + 1} / ${st.round.total}</span></span>` : '';
    }
    function countdownView(st, isHost) {
        const hint = st.questionHint, type = hint && TYPES[hint.type];
        const label = type ? (hint.hasImage && hint.type !== 'pin' ? `Image · ${type.toLowerCase()}` : type) : '';
        const number = st.round && st.settings?.roundsEnabled ? st.round.questionIndex + 1 : st.questionIndex + 1;
        const total = st.round && st.settings?.roundsEnabled ? st.round.questionCount : st.totalQuestions;
        return `<main class="countdown-state">${roundLabel(st)}<p class="countdown-progress">Question ${number} of ${total}</p><h1>Get ready<span>.</span></h1>${label ? `<p class="countdown-hint">${esc(label)}</p>` : ''}<div id="countdown-number" role="timer" aria-live="polite">—</div><p id="countdown-media" class="small muted" role="status" hidden></p>${isHost ? '<button class="quiet-button" data-action="room-media-skip" id="media-skip" hidden>Start anyway</button>' : ''}${isHost ? '<button class="quiet-button countdown-end" data-action="room-finish">End quiz</button>' : ''}</main>`;
    }
    function roundResultsView(st, isHost) {
        const r = (st.roundResults || []).find(r => r.id === st.round?.id) || (st.roundResults || []).at(-1), hasNext = st.round && st.round.index + 1 < st.round.total;
        if (!r)
            return '<main class="waiting-state"><p>Loading results…</p></main>';
        return `<main class="round-results"><div class="results-head"><p class="round-overline">${esc(r.title)}</p><h1>${r.tied ? 'Tied for first' : r.winners?.length ? 'Round winner' : 'Round complete'}</h1>${r.winners?.length ? `<div class="round-winners">${r.winners.map(p => `<div class="round-winner-name">${esc(p.name)}</div>`).join('')}</div>` : '<p>No scoring answers</p>'}${r.reward ? `<div class="round-reward">${icon('trophy', 17)} ${esc(r.reward)}</div>` : ''}</div>${isHost || st.settings?.showLeaderboard ? leaderboard(r.leaderboard || []) : ''}${isHost ? `<div class="round-controls">${r.tied && !r.tieResolvedAt ? '<button class="btn" data-action="draw-round">' + icon('shuffle', 15) + ' Break tie</button>' : ''}<button class="btn primary" data-action="${hasNext ? 'room-next-round' : 'room-finish-final'}" data-needs-connection>${hasNext ? 'Next round' : 'Finish quiz'} ${icon('arrow', 16)}</button></div>` : '<p class="answer-note">Waiting for host</p>'}</main>`;
    }
    function questionView(st, isHost) {
        const q = st.question;
        if (!q)
            return `<div class="loading-section">Waiting…</div>`;
        const reveal = st.phase === 'reveal', answerable = !isHost && !reveal && !S.answerSent && !S.answerPending, hasOptions = ['single', 'multi', 'true_false', 'poll'].includes(q.type), round = st.round, roundEnd = st.settings?.roundsEnabled && round && round.questionIndex + 1 >= round.questionCount;
        const progress = st.settings?.roundsEnabled && round ? `${round.questionIndex + 1} / ${round.questionCount}` : `${st.questionIndex + 1} / ${st.totalQuestions}`;
        return `<main class="${reveal ? 'reveal-screen' : 'live-question-screen' + (hasOptions && q.options.some(o => safeImage(o.image)) ? ' live-choice-screen' : '')}" style="--answer-rows:${hasOptions ? Math.ceil(q.options.length / 2) : 1}"><div class="question-top"><div class="question-progress">${roundLabel(st)}<span>Question <b>${progress}</b></span></div><div class="row">${isHost ? `<span class="small muted"><span data-answer-count>${st.answerCount || 0}</span> / ${st.participantCount ?? st.players?.length ?? 0}</span>` : ''}<div class="timer ${reveal ? 'sr-only' : ''}" id="live-timer">${icon('clock', 14)}<span>—</span></div></div></div>${!reveal ? '<div class="timer-track"><div id="timer-fill"></div></div><p class="question-media-status" role="status" hidden></p>' : ''}<section class="live-question"><h1 id="live-question-title" tabindex="-1">${esc(q.prompt)}</h1>${reveal ? revealView(st, isHost) : `${q.type !== 'pin' && safeImage(q.image) ? roomImage(q.image, 'live-question-image', 'Question image') : ''}${hasOptions ? `${!isHost && st.settings?.showAnswerOptions === false ? '<p class="answer-note">Use the host’s screen to read the choices.</p>' : ''}<div class="answer-grid ${q.options.some(o => safeImage(o.image)) ? 'image-choice-grid' : ''}">${q.options.map((o, i) => answerOption(o, i, st, isHost, answerable)).join('')}</div>${q.type === 'multi' && answerable ? `<button class="btn primary" data-action="submit-multi" ${Array.isArray(S.selection) && S.selection.length ? '' : 'disabled'}>Submit ${icon('check', 16)}</button>` : ''}` : q.type === 'order' ? orderView(q, st, isHost, answerable) : q.type === 'slider' ? sliderView(q, st, isHost, answerable) : q.type === 'pin' ? pinView(q, st, isHost, answerable) : q.type === 'slide' ? '' : textAnswerView(q, st, isHost, answerable)}${answerStatus(q, isHost)}`}</section>${isHost ? `<div class="host-controls"><button class="quiet-button" data-action="room-finish">End quiz</button>${reveal ? `<button class="btn primary" data-action="room-next" data-needs-connection>${roundEnd ? 'Round results' : st.questionIndex + 1 >= st.totalQuestions ? 'Results' : 'Next question'} ${icon('arrow', 16)}</button>` : `<button class="btn primary" data-action="room-reveal" data-needs-connection>${q.type === 'slide' ? 'Continue' : 'Reveal answer'} ${icon('arrow', 16)}</button>`}</div>` : ''}</main>`;
    }
    function revealView(st, isHost) {
        const q = st.question, unscored = ['poll', 'word_cloud', 'open_ended', 'slide'].includes(q.type), me = st.me, dist = st.reveal?.distribution;
        const status = unscored ? (me?.answered ? 'Response saved' : 'No response') : !me?.answered ? 'No answer' : me.correct ? 'Correct' : 'Incorrect';
        const choices = ['single', 'multi', 'true_false'].includes(q.type), correctOptions = choices ? q.options.filter(o => st.reveal?.correct?.includes(o.id)) : [];
        const selected = Array.isArray(S.selection) ? S.selection : [S.selection], wrongOptions = choices && !me?.correct && !isHost ? q.options.filter(o => selected.includes(o.id) && !st.reveal?.correct?.includes(o.id)) : [];
        return `${!isHost && me && q.type !== 'slide' ? `<div class="answer-result reveal-result ${unscored ? 'neutral' : me.correct ? '' : 'wrong'}" role="status"><span class="result-symbol">${unscored ? '✓' : me.correct ? '✓' : !me.answered ? '—' : '×'}</span><div><strong>${status}</strong>${!unscored ? `<span class="result-points">+${Number(me.points || 0).toLocaleString()} pts</span>` : ''}</div></div>` : ''}<div class="reveal-answer">${correctOptions.length ? `<p class="reveal-label">Correct answer${correctOptions.length === 1 ? '' : 's'}</p><div class="correct-answer-list">${correctOptions.map(o => `<div class="correct-answer-tile">${icon('check', 19)}<div>${o.text ? `<strong>${esc(o.text)}</strong>` : ''}${safeImage(o.image) ? `${roomImage(o.image, '', o.text || 'Correct answer')}` : ''}</div>${isHost && dist ? `<span class="small muted">${dist[o.id] || 0}</span>` : ''}</div>`).join('')}</div>` : ''}${wrongOptions.length ? `<div class="your-answer"><span>Your answer</span>${wrongOptions.map(o => `<div>${esc(o.text)}${safeImage(o.image) ? `${roomImage(o.image, '', o.text || 'Your answer')}` : ''}</div>`).join('')}</div>` : ''}${q.type === 'short_answer' && !isHost && me?.answered && !me.correct ? `<div class="your-answer"><span>Your answer</span>${esc(S.selection || '')}</div>` : ''}${q.type === 'short_answer' ? `<p class="reveal-label">Accepted answer${st.reveal?.acceptedAnswers?.length === 1 ? '' : 's'}</p><div class="correct-answer-list">${(st.reveal?.acceptedAnswers || []).map(a => `<div class="correct-answer-tile">${icon('check', 19)}<strong>${esc(a)}</strong></div>`).join('')}</div>` : ''}${q.type === 'order' ? '<p class="reveal-label">Correct order</p>' + orderView(q, st, isHost, false) : ''}${q.type === 'slider' ? '<p class="reveal-label">Correct number</p>' + sliderView(q, st, isHost, false) : ''}${q.type === 'pin' ? '<p class="reveal-label">Correct location</p>' + pinView(q, st, isHost, false) : ''}${q.type === 'poll' ? `<p class="reveal-label">Responses</p><div class="answer-grid ${q.options.some(o => safeImage(o.image)) ? 'image-choice-grid' : ''}">${q.options.map((o, i) => answerOption(o, i, st, isHost, false)).join('')}</div>` : ''}${q.type === 'slide' && safeImage(q.image) ? roomImage(q.image, 'live-question-image', 'Slide image') : ''}${q.type === 'word_cloud' && dist ? `<div class="cloud-words">${Object.entries(dist).map(([word, count]) => `<span style="font-size:${Math.min(34, 14 + Number(count) * 3)}px">${esc(word)}</span>`).join('')}</div>` : ''}${q.type === 'open_ended' && st.reveal?.responses?.length ? `<div class="leaderboard">${st.reveal.responses.slice(0, 100).map(word => `<div class="leader-row"><span class="leader-name">${esc(word)}</span></div>`).join('')}</div>` : ''}${st.reveal?.explanation ? `<p class="explanation">${esc(st.reveal.explanation)}</p>` : ''}</div>${st.settings?.showLeaderboard && st.leaderboard?.length && q.type !== 'slide' ? `<div class="reveal-leaders"><p class="reveal-label">Leaderboard</p>${leaderboard(st.leaderboard.slice(0, 5))}</div>` : ''}`;
    }
    return { renderRoom, lobbyView, roundLabel, countdownView, roundResultsView, questionView, revealView };
}
