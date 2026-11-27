import type {AppContext} from '../../app/context.js';
import { brand, icon } from '../../core/icons.js';
import { esc, safeImage } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
import {competitionMode, competitionQuestionHint, competitionRevealView, competitionReviewPending, competitionTeamName, competitionTeams, roomLifeStatus} from './competition.js';
import {avatarMarkup, hydrateAvatars} from '../avatars/render.js';
import {lifeStandings, resultHasPoints, resultMetrics, startingLives} from '../results/lives.js';
import {gameStageMarkup, preserveGameStageScroll} from './game-stage.js';

export function createFeaturesLivePage(context: AppContext) {
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
        context.updateContentProtection();
        S.reorder?.cancel();
        const focused = document.activeElement?.id, selectionStart = (document.activeElement as HTMLInputElement)?.selectionStart, selectionEnd = (document.activeElement as HTMLInputElement)?.selectionEnd;
        const room = S.room, st = S.roomState, isHost = room?.role === 'host';
        if (!room)
            return;
        const study = st?.study || room.study;
        const lobby = st?.phase === 'lobby' && !study;
        const roomLabel = study ? '<span class="room-code-small">Solo play</span>' :
            `<button class="room-code-small room-copy-code" type="button" data-action="copy-room-code" aria-label="Copy room code ${esc(room.code)}" title="Copy room code"><b>${esc(room.code)}</b></button>`;
        const roomStatus = `<div class="room-identity">${roomLabel}<div class="connection ${S.connected ? '' : 'offline'}" role="status" aria-live="polite" aria-atomic="true">${connectionLabel()}</div></div>`;
        const playing = st?.me && st.phase !== 'lobby' && !S.fatalRoomError;
        const lives = playing ? roomLifeStatus(st) : '';
        const metric = playing ? lives || `<span class="player-score"><strong>${(st.me.score || 0).toLocaleString()}</strong> pts</span>` : '';
        const team = !st?.settings?.game && !S.fatalRoomError && st?.phase !== 'finished' && st?.me?.team;
        const avatar = !S.fatalRoomError && st?.phase === 'lobby'
            ? `<button class="icon-btn room-avatar-button" id="room-avatar-button" data-action="room-avatar" data-needs-connection title="Edit avatar" aria-label="Edit avatar">${avatarMarkup(st.me?.avatar ?? st.hostAvatar, st.me?.name ?? 'Host', 'room')}</button>`
            : '';
        const content = S.fatalRoomError
            ? `<main class="waiting-state"><h1>${S.roomUnavailable ? 'Room not available' : 'Unable to join'}</h1><p>${esc(S.fatalRoomError)}</p><a class="btn primary" href="#join" style="margin-top:25px">Try another code</a></main>`
            : !st ? '<div class="loading-section" role="status"><span class="spinner" aria-hidden="true"></span>Connecting…</div>'
            : st.phase === 'lobby' ? lobbyView(st, isHost)
            : st.phase === 'countdown' ? countdownView(st, isHost)
            : st.phase === 'round_results' ? roundResultsView(st, isHost)
            : st.phase === 'finished' ? resultsView(st, isHost)
            : questionView(st, isHost);
        const layout = `
            <div class="room-wrap room-header"><header class="room-nav">${brand()}<div class="row">${roomStatus}${metric}${avatar}<button class="icon-btn" data-action="leave-room" title="Leave quiz" aria-label="Leave quiz">${icon('logout', 16)}</button></div></header></div>
            ${context.siteNews.slot()}
            <div class="room-wrap${lobby ? '' : ' room-content'}">
                <div id="room-announcement"></div><div id="room-tools" class="room-tools" hidden></div>
                ${pausedRoom(st, isHost)}
                ${team ? `<p class="competition-hud">${esc(competitionTeamName(team))}</p>` : ''}
                ${!S.fatalRoomError && ['lobby','round_results'].includes(st?.phase) ? competitionTeams(st, isHost) : ''}
                ${isHost && st?.phase === 'lobby' && st.competition?.ready === false ? '<p class="answer-note">At least one participant per team to start.</p>' : ''}
                ${content}${roomFooter(st, isHost)}
            </div>`;
        const restoreStage = preserveGameStageScroll(context.app);
        const openReview = context.app.querySelector<HTMLDetailsElement>('.game-answer-review')?.open;
        context.app.innerHTML = lobby ? layout : `<div class="live-room-layout">${layout}</div>`;
        restoreStage();
        const reviewPanel = context.app.querySelector<HTMLDetailsElement>('.game-answer-review');
        if (reviewPanel && openReview) reviewPanel.open = true;
        hydrateAvatars(context.app);
        context.siteNews.render();
        context.updateRoomSettings();
        updateTimer();
        updateConnection();
        hydrateRoomImages();
        if (focused) {
            const el = document.getElementById(focused) as HTMLInputElement;
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
    function pausedRoom(st, isHost) {
        const auto = st?.autoplay;
        if (S.fatalRoomError || auto?.status !== 'paused' || !(st.study || auto.pauseReason)) return '';
        const title = st.study && st.phase !== 'lobby' ? 'Practice paused' : 'Autoplay paused';
        return `<div class="room-paused"><div role="status"><strong>${title}</strong>
            ${auto.pauseReason === 'idle' ? '<small>No answers for 5 minutes.</small>' : ''}</div>
            ${isHost ? `<button class="btn small" data-action="autoplay-resume" data-needs-connection>${icon('play', 14)} ${st.study && st.phase !== 'lobby' ? 'Resume practice' : 'Resume Autoplay'}</button>` : ''}
        </div>`;
    }
    function roomFooter(st, isHost) {
        if (S.fatalRoomError || !isHost || !st || ['lobby', 'finished'].includes(st.phase)) return '';
        const canSkip = st.study && st.phase === 'question' && st.question?.type !== 'slide' && st.autoplay?.status === 'off';
        return `<footer class="live-room-footer">
            <button class="quiet-button" data-action="room-finish">${st.study ? 'End practice' : 'End quiz'}</button>
            ${canSkip ? `<button class="quiet-button" data-action="room-reveal" data-needs-connection>${st.me?.answered ? 'Reveal answer' : 'Skip question'}</button>` : ''}
        </footer>`;
    }
    function lobbyView(st, isHost) {
        const count = st.participantCount ?? st.players?.length ?? 0;
        const stage = gameStageMarkup(st);
        if (st.study) {
            const scheduled = st.autoplay?.status === 'running';
            const count = st.totalQuestions + (st.totalQuestions === 1 ? ' question' : ' questions');
            return `<main class="solo-lobby"><div class="solo-start">
                <h1>${esc(st.title)}</h1><p>${count}${st.round?.total > 1 ? ' · ' + st.round.total + ' rounds' : ''}</p>
                <button class="btn primary" data-action="room-start" data-needs-connection>${icon('play', 17)} ${scheduled ? 'Start now' : 'Start quiz'}</button>
            </div>${stage}</main>`;
        }
        if (!isHost)
            return `<main class="waiting-state player-lobby"><div class="lobby-heading"><p class="lobby-quiz-title">${esc(st.title)}</p><h1>You’re in<span>.</span></h1><p class="lobby-waiting"><span aria-hidden="true"></span>${st.autoplay?.startsAt ? 'Waiting to start' : 'Waiting for host'}</p></div><div class="waiting-cards"><div class="waiting-card player-badge"><span>Playing as</span><strong>${esc(S.room.name)}</strong></div><div class="waiting-card waiting-count"><span>In the room</span><strong>${count} <small>player${count === 1 ? '' : 's'}</small></strong></div></div>${stage ? '<p class="small muted game-lobby-note">Your answers are shown with your name during the reveal.</p>' : ''}${stage}</main>`;
        const lock = `<button class="quiet-button" data-action="room-lock">${icon('lock', 13)} ${st.locked ? 'Locked' : 'Open'}</button>`;
        return `<main class="lobby-layout"><section class="lobby-main"><h1>${esc(st.title)}</h1><div class="big-code">${esc(st.code)}</div><button class="quiet-button copy-code" data-action="copy-link">${icon('copy', 13)} Copy link</button>${context.joinVerificationMarkup()}<div><button class="btn primary large" data-action="room-start" data-needs-connection ${!st.players?.length ? 'disabled' : ''}>${icon('play', 18)} ${st.autoplay?.startsAt ? 'Start now' : 'Start quiz'}</button></div><p class="small muted lobby-meta">${st.totalQuestions} questions${st.round?.total > 1 ? ' · ' + st.round.total + ' rounds' : ''}</p>${stage ? lock : ''}</section>${stage || `<section class="card participant-card"><div class="row between"><h2>Players <span class="muted">${count}</span></h2>${lock}</div>${st.players?.length ? `<div class="participant-list">${st.players.map(p => `<span class="participant-chip ${p.connected === false ? 'disconnected' : ''}">${p.avatar ? avatarMarkup(p.avatar, p.name, 'chat') : ''}${esc(p.name)}${p.id===st.me?.id?' (you)':`<button class="icon-btn" data-action="kick-player" data-id="${p.id}" data-name="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button>`}</span>`).join('')}</div>` : '<p class="answer-note">Waiting for players</p>'}</section>`}</main>`;
    }
    function roundLabel(st) {
        return st.settings?.roundsEnabled && st.round ? `<span class="round-tag"><span class="round-tag-title">${esc(st.round.title)}</span><span class="round-tag-count">${st.round.index + 1} / ${st.round.total}</span></span>` : '';
    }
    function countdownView(st, isHost) {
        const hint = st.questionHint, type = hint && TYPES[hint.type];
        const label = type ? (hint.hasImage && hint.type !== 'pin' ? `Image · ${type.toLowerCase()}` : type) : '';
        const number = st.round && st.settings?.roundsEnabled ? st.round.questionIndex + 1 : st.questionIndex + 1;
        const total = st.round && st.settings?.roundsEnabled ? st.round.questionCount : st.totalQuestions;
        return `<main class="countdown-state">${roundLabel(st)}<p class="countdown-progress">Question ${number} of ${total}</p><h1>Get ready<span>.</span></h1>${label ? `<p class="countdown-hint">${esc(label)}</p>` : ''}<div id="countdown-number" role="timer" aria-live="polite">—</div><p id="countdown-media" class="small muted" role="status" hidden></p>${isHost ? '<button class="quiet-button" data-action="room-media-skip" id="media-skip" hidden>Start anyway</button>' : ''}</main>`;
    }
    function roundResultsView(st, isHost) {
        const r = (st.roundResults || []).find(r => r.id === st.round?.id) || (st.roundResults || []).at(-1), hasNext = st.round && st.round.index + 1 < st.round.total && !st.competition?.gameDecided;
        if (!r)
            return '<main class="waiting-state"><p>Loading results…</p></main>';
        const automatic = st.autoplay?.status === 'running', lives = startingLives(st);
        const winningNames = r.winningTeams ? r.winningTeams.map(competitionTeamName) : (r.winners ?? []).map(player => player.name);
        const nextAction = `<button class="btn primary" data-action="${hasNext ? 'room-next-round' : 'room-finish-final'}" data-needs-connection>${hasNext ? 'Next round' : 'Results'} ${icon('arrow',16)}</button>`;
        if (st.study) {
            return `<main class="round-results"><div class="results-head"><p class="round-overline">${esc(r.title)}</p>
                <h1>Round complete</h1><p>${lives ? resultMetrics(r.leaderboard?.[0], lives, resultHasPoints(r)) : Number(r.leaderboard?.[0]?.score || 0).toLocaleString() + ' pts'}</p>
            </div>${st.autoplay?.status === 'paused' || automatic ? '' : `<div class="round-controls">${nextAction}</div>`}</main>`;
        }
        return `<main class="round-results"><div class="results-head"><p class="round-overline">${esc(r.title)}</p><h1>${r.tied ? 'Tied for first' : winningNames.length ? 'Round winner' : 'Round complete'}</h1>${winningNames.length ? `<div class="round-winners">${winningNames.map(name => `<div class="round-winner-name">${esc(name)}</div>`).join('')}</div>` : lives ? '<p>No winner</p>' : '<p>No scoring answers</p>'}${r.reward ? `<div class="round-reward">${icon('trophy', 17)} ${esc(r.reward)}</div>` : ''}</div>${isHost || st.settings?.showLeaderboard ? lives ? lifeStandings(r.leaderboard || [], lives, {ownId: st.me?.id, points: resultHasPoints(r)}) : leaderboard(r.leaderboard || []) : ''}${isHost && !automatic ? `<div class="round-controls">${r.tied && !r.tieResolvedAt ? '<button class="btn" data-action="draw-round">' + icon('shuffle', 15) + ' Break tie</button>' : ''}<button class="btn primary" data-action="${hasNext ? 'room-next-round' : 'room-finish-final'}" data-needs-connection>${hasNext ? 'Next round' : 'Finish quiz'} ${icon('arrow', 16)}</button></div>` : automatic ? '' : '<p class="answer-note">Waiting for host</p>'}</main>`;
    }
    function questionControls(st, isHost, roundEnd) {
        const automatic=st.autoplay?.status==='running', reveal=st.phase==='reveal';
        const nextLabel=roundEnd?'Round results':st.competition?.gameDecided||st.questionIndex+1>=st.totalQuestions?'Results':'Next question';
        const next=`<button class="btn primary" data-action="room-next" data-needs-connection>${nextLabel} ${icon('arrow',16)}</button>`;
        if(!isHost||automatic||st.autoplay?.clockPaused||competitionReviewPending(st))return '';
        if(st.study)return st.autoplay?.status==='paused'||(!reveal&&st.question.type!=='slide')?'':`<div class="solo-next">${next}</div>`;
        const step=reveal?next:`<button class="btn primary" data-action="room-reveal" data-needs-connection>${st.question.type==='slide'?'Continue':'Reveal answer'} ${icon('arrow',16)}</button>`;
        return `<div class="host-controls">${step}</div>`;
    }
    function questionView(st, controlsRoom) {
        const q = st.question;
        if (!q)
            return `<div class="loading-section">Waiting…</div>`;
        const isHost = controlsRoom && !st.hostPlaying;
        const reveal = st.phase === 'reveal', answerable = !isHost && !reveal && !st.me?.eliminated && !st.me?.spectating && !S.answerSent && !S.answerPending && !st.autoplay?.clockPaused, hasOptions = ['single', 'multi', 'true_false', 'poll'].includes(q.type), round = st.round, roundEnd = st.settings?.roundsEnabled && round && round.questionIndex + 1 >= round.questionCount;
        const progress = st.settings?.roundsEnabled && round ? `${round.questionIndex + 1} / ${round.questionCount}` : `${st.questionIndex + 1} / ${st.totalQuestions}`;
        return `<main class="${reveal ? 'reveal-screen' : 'live-question-screen' + (hasOptions && q.options.some(o => safeImage(o.image)) ? ' live-choice-screen' : '')}" style="--answer-rows:${hasOptions ? Math.ceil(q.options.length / 2) : 1}"><div class="question-top"><div class="question-progress">${roundLabel(st)}<span class="question-index">Question <b>${progress}</b></span></div><div class="row question-metrics">${isHost ? `<span class="small muted question-answer-count"><span class="sr-only">Answers </span><span data-answer-count>${st.answerCount || 0}</span> / ${st.competition?.answering ?? st.participantCount ?? st.players?.length ?? 0}</span>` : ''}${reveal ? '' : `<div class="timer" id="live-timer">${icon('clock', 14)}<span>—</span></div>`}</div></div>${!reveal ? '<div class="timer-track"><div id="timer-fill"></div></div><p class="question-media-status" role="status" hidden></p>' : ''}<section class="live-question"><h1 id="live-question-title" tabindex="-1">${esc(q.prompt)}</h1>${reveal ? revealView(st, controlsRoom, isHost) + (!st.settings?.game && !competitionReviewPending(st) ? competitionTeams(st, controlsRoom) : '') : `${competitionQuestionHint(st)}` + `${q.type !== 'pin' && safeImage(q.image) ? roomImage(q.image, 'live-question-image', 'Question image') : ''}${hasOptions ? `${!isHost && st.settings?.showAnswerOptions === false ? '<p class="answer-note">Use the host’s screen to read the choices.</p>' : ''}<div class="answer-grid ${q.options.some(o => safeImage(o.image)) ? 'image-choice-grid' : ''}">${q.options.map((o, i) => answerOption(o, i, st, isHost, answerable)).join('')}</div>${q.type === 'multi' && answerable ? `<button class="btn primary" data-action="submit-multi" ${Array.isArray(S.selection) && S.selection.length ? '' : 'disabled'}>Submit ${icon('check', 16)}</button>` : ''}` : q.type === 'order' ? orderView(q, st, isHost, answerable) : q.type === 'slider' ? sliderView(q, st, isHost, answerable) : q.type === 'pin' ? pinView(q, st, isHost, answerable) : q.type === 'slide' ? '' : textAnswerView(q, st, isHost, answerable)}${answerStatus(q, isHost)}`}</section>${questionControls(st, controlsRoom, roundEnd)}</main>`;
    }
    function revealView(st, controlsRoom, isHost = controlsRoom) {
        const stage = gameStageMarkup(st);
        const competition = competitionRevealView(st, controlsRoom);
        if (competitionMode(st) !== 'classic' || stage && competitionReviewPending(st)) return stage + competition;
        const q = st.question, unscored = ['poll', 'word_cloud', 'open_ended', 'slide'].includes(q.type), me = st.me, dist = st.reveal?.distribution;
        const status = unscored ? (me?.answered ? 'Response saved' : 'No response') : !me?.answered ? 'No answer' : me.correct ? 'Correct' : 'Incorrect';
        const choices = ['single', 'multi', 'true_false'].includes(q.type), correctOptions = choices ? q.options.filter(o => st.reveal?.correct?.includes(o.id)) : [];
        const selected = Array.isArray(S.selection) ? S.selection : [S.selection], wrongOptions = choices && !me?.correct && !isHost ? q.options.filter(o => selected.includes(o.id) && !st.reveal?.correct?.includes(o.id)) : [];
        return `${stage}${!isHost && me && q.type !== 'slide' ? `<div class="answer-result reveal-result ${unscored ? 'neutral' : me.correct ? '' : 'wrong'}" role="status"><span class="result-symbol">${unscored ? '✓' : me.correct ? '✓' : !me.answered ? '—' : '×'}</span><div><strong>${status}</strong>${!unscored ? `<span class="result-points">+${Number(me.points || 0).toLocaleString()} pts</span>` : ''}</div></div>` : ''}<div class="reveal-answer">${correctOptions.length ? `<p class="reveal-label">Correct answer${correctOptions.length === 1 ? '' : 's'}</p><div class="correct-answer-list">${correctOptions.map(o => `<div class="correct-answer-tile">${icon('check', 19)}<div>${o.text ? `<strong>${esc(o.text)}</strong>` : ''}${safeImage(o.image) ? `${roomImage(o.image, '', o.text || 'Correct answer')}` : ''}</div>${isHost && dist ? `<span class="small muted">${dist[o.id] || 0}</span>` : ''}</div>`).join('')}</div>` : ''}${wrongOptions.length ? `<div class="your-answer"><span>Your answer</span>${wrongOptions.map(o => `<div>${esc(o.text)}${safeImage(o.image) ? `${roomImage(o.image, '', o.text || 'Your answer')}` : ''}</div>`).join('')}</div>` : ''}${q.type === 'short_answer' && !isHost && me?.answered && !me.correct ? `<div class="your-answer"><span>Your answer</span>${esc(S.selection || '')}</div>` : ''}${q.type === 'short_answer' ? `<p class="reveal-label">Accepted answer${st.reveal?.acceptedAnswers?.length === 1 ? '' : 's'}</p><div class="correct-answer-list">${(st.reveal?.acceptedAnswers || []).map(a => `<div class="correct-answer-tile">${icon('check', 19)}<strong>${esc(a)}</strong></div>`).join('')}</div>` : ''}${q.type === 'order' ? '<p class="reveal-label">Correct order</p>' + orderView(q, st, isHost, false) : ''}${q.type === 'slider' ? '<p class="reveal-label">Correct number</p>' + sliderView(q, st, isHost, false) : ''}${q.type === 'pin' ? '' + pinView(q, st, isHost, false) : ''}${q.type === 'poll' ? `<p class="reveal-label">Responses</p><div class="answer-grid ${q.options.some(o => safeImage(o.image)) ? 'image-choice-grid' : ''}">${q.options.map((o, i) => answerOption(o, i, st, isHost, false)).join('')}</div>` : ''}${q.type === 'slide' && safeImage(q.image) ? roomImage(q.image, 'live-question-image', 'Slide image') : ''}${q.type === 'word_cloud' && dist ? `<div class="cloud-words">${Object.entries(dist).map(([word, count]) => `<span style="font-size:${Math.min(34, 14 + Number(count) * 3)}px">${esc(word)}</span>`).join('')}</div>` : ''}${q.type === 'open_ended' && st.reveal?.responses?.length ? `<div class="leaderboard">${st.reveal.responses.slice(0, 100).map(word => `<div class="leader-row"><span class="leader-name">${esc(word)}</span></div>`).join('')}</div>` : ''}${st.reveal?.explanation ? `<p class="explanation">${esc(st.reveal.explanation)}</p>` : ''}</div>${st.settings?.showLeaderboard && st.leaderboard?.length && q.type !== 'slide' ? `<div class="reveal-leaders"><p class="reveal-label">Leaderboard</p>${leaderboard(st.leaderboard.slice(0, 5))}</div>` : ''}${competition}`;
    }
    return { renderRoom, lobbyView, roundLabel, countdownView, roundResultsView, questionView, revealView };
}
