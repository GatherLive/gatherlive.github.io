import type {DataRecord} from '../../../shared/types.js';
import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {reviewableAnswer} from '../../core/live-game.js';

const TEAM_NAMES = {a: 'Team A', b: 'Team B'};
export const competitionTeamName = (team: 'a' | 'b') => TEAM_NAMES[team];
const REASONS = {
    safe: 'Accepted', blank: 'No answer', duplicate: 'Duplicate', 'host-match': 'Matched the host',
    rejected: 'Rejected', wrong: 'Incorrect'
};

let previousLives: {key: string; count: number} | null = null;

export function competitionMode(state: DataRecord) {
    return state.competition?.questionMode ?? state.question?.competition?.mode ?? 'classic';
}

export function roomLifeStatus(state: DataRecord) {
    const me = state.me, lives = me?.lives;
    if (!Number.isInteger(lives)) return '';
    const key = state.code + '/' + me.id;
    const before = previousLives?.key === key ? previousLives.count : lives;
    previousLives = {key, count: lives};
    if (me.eliminated || lives === 0)
        return '<span class="room-life-status is-eliminated" role="status">Eliminated</span>';
    const max = Math.min(12, Number(state.competition?.lives) || lives);
    const compact = max > 3;
    const hearts = Array.from({length: compact ? 1 : max}, (_, i) => {
        const empty = i >= lives;
        const justLost = lives < before && (compact || empty && i < before);
        return `<span class="life-heart${empty ? ' life-empty' : ''}${justLost ? ' life-lost' : ''}">${icon('heart', 14)}</span>`;
    }).join('');
    const team = state.competition?.teams?.sharedLives ? 'team ' : '';
    return `<span class="room-life-status" role="status" title="${lives} of ${max} ${team}lives">
        <span class="sr-only">${lives} of ${max} ${team}lives</span>
        <span class="life-hearts" aria-hidden="true">${hearts}${compact ? `<b>${lives}</b>` : ''}</span>
    </span>`;
}

export function competitionTeams(state: DataRecord, isHost: boolean) {
    const teams = state.competition?.teams;
    if (!teams?.entries?.length) return '';
    const lobby = state.phase === 'lobby';
    const showScore = isHost || state.settings?.showLeaderboard || state.phase === 'finished';
    return `<div class="competition-teams" aria-label="Teams">${teams.entries.map(team => {
        const name = TEAM_NAMES[team.id];
        const count = Number(team.size) || 0;
        const tally = lobby ? `${count} / ${Number(team.capacity) || 0} players`
            : Number.isInteger(team.lives) ? `${team.lives} lives`
            : teams.scoring === 'elimination' ? `${Number(team.alive) || 0} in play`
            : showScore ? `${Number(team.score || 0).toLocaleString(undefined, {maximumFractionDigits: 1})} pts avg.` : `${count} players`;
        return `<div class="competition-team"><strong>${esc(name)}</strong><span>${esc(tally)}</span></div>`;
    }).join('')}</div>`;
}

export function competitionQuestionHint(state: DataRecord) {
    const mode = competitionMode(state);
    if (mode === 'unique') return '<p class="competition-question-hint">Give an answer nobody else uses.</p>';
    if (mode === 'avoid-host') return '<p class="competition-question-hint">Pick an answer that differs from the host’s.</p>';
    return '';
}

export function competitionReviewPending(state: DataRecord | null) {
    const stage = state?.competition?.review?.stage;
    return stage === 'revealing' || stage === 'review';
}

export function answerLabel(state: DataRecord, answer: unknown) {
    if (typeof answer === 'string') {
        const options = state.question?.options;
        const index = options?.findIndex(option => option.id === answer) ?? -1;
        return index >= 0 ? options[index].text || 'Choice ' + (index + 1) : answer;
    }
    if (Array.isArray(answer)) return answer.map(item => answerLabel(state, item)).join(', ');
    if (answer && typeof answer === 'object' && 'x' in answer && 'y' in answer) return 'Pin placed';
    return typeof answer === 'number' ? answer : '';
}

export function competitionRevealView(state: DataRecord, isHost: boolean) {
    const review = state.competition?.review;
    if (!review) return '';
    const pending = competitionReviewPending(state);
    const reviewing = isHost && review.stage === 'review' && competitionMode(state) === 'unique';
    const game = !!state.settings?.game;
    const rows = reviewing ? (review.rows ?? []).filter(reviewableAnswer)
        : game ? [] : (review.rows ?? []).filter(row => row.connected !== false);
    const canReview = reviewing && rows.length > 0;
    const count = Number(review.revealed) || 0, total = Number(review.total) || 0;
    const progress = !game && review.stage === 'revealing' ? `<span class="muted">${count} / ${total}</span>` : '';
    const hostAnswer = !game && review.hostAnswer != null
        ? `<div class="competition-host-answer"><span>Host’s answer</span><strong>${esc(review.hostAnswer)}</strong></div>` : '';
    const automatic = game && review.automatic === true;
    const autoButton = game && review.reveal === 'turns' ? `<button class="btn ghost" id="competition-auto-reveal" type="button" data-action="competition-auto-reveal" data-enabled="${!automatic}" data-needs-connection>${automatic ? 'Pause auto reveal' : 'Auto reveal'}</button>` : '';
    const revealButton = `<button class="btn primary" id="competition-reveal-next" type="button" data-action="competition-reveal" data-revealed="${count}" data-needs-connection>Reveal next</button>`;
    const action = !pending ? '' : isHost
        ? review.stage === 'revealing'
            ? autoButton + (automatic ? '' : revealButton)
            : '<button class="btn primary" type="button" data-action="competition-apply" data-needs-connection>Apply results</button>'
        : game ? '' : '<p class="answer-note" role="status">Waiting for the host</p>';

    if (game && !rows.length && !action) return '';
    return `<section class="competition-review" aria-label="${game ? 'Reveal controls' : 'Answer reveal'}">
        ${hostAnswer}
        ${canReview ? `<details class="game-answer-review" data-answer-review="${esc(review.id ?? state.code + '/' + state.question?.id)}">
            <summary>Review answers</summary>
            ${review.id ? `<div class="competition-review-tools">
                <div class="competition-review-bulk" role="group" aria-label="Review all answers">
                    <button class="quiet-button" type="button" id="approve-all-answers" data-action="competition-review-all" data-verdict="approve" title="Approve all" aria-label="Approve all" data-needs-connection>${icon('check', 17)}</button>
                    <button class="quiet-button" type="button" id="reject-all-answers" data-action="competition-review-all" data-verdict="reject" title="Reject all" aria-label="Reject all" data-needs-connection>${icon('close', 17)}</button>
                </div>
                <div>
                    <button class="quiet-button" type="button" id="copy-answer-review" data-action="competition-copy-review">${icon('copy', 16)} Copy for AI</button>
                    <button class="quiet-button" type="button" id="paste-answer-review" data-action="competition-paste-review" data-needs-connection>Paste JSON</button>
                </div>
            </div>` : ''}
        ` : ''}
        ${!game && !canReview && (rows.length || progress) ? `<div class="competition-review-heading"><h2>Answers</h2>${progress}</div>` : ''}
        ${rows.length ? `<ul class="competition-answers">${rows.map((row, index) => {
            const choice = canReview;
            const last = review.stage === 'revealing' && row === (isHost ? review.rows[count - 1] : rows.at(-1));
            const label = REASONS[row.reason] ?? (row.accepted === false ? 'Rejected' : row.accepted === true ? 'Accepted' : '');
            const verdictClass = label === REASONS.safe ? ' is-accepted' : label === REASONS.rejected ? ' is-rejected' : '';
            return `<li class="competition-answer${last ? ' competition-answer-enter' : ''}">
                <div><span class="competition-answer-name">${choice && review.id ? (index + 1) + '. ' : ''}${esc(row.name)}${row.playerId === state.me?.id ? ' (you)' : ''}</span>
                <strong>${esc(answerLabel(state, row.answer) || '—')}</strong>
                ${row.note ? `<p class="game-review-note" dir="auto">${esc(row.note)}</p>` : ''}</div>
                ${label ? `<span class="competition-verdict${verdictClass}">${esc(label)}</span>` : ''}
                ${choice ? `<div class="competition-review-actions">
                    <button class="quiet-button" type="button" id="approve-${esc(row.playerId)}" data-action="competition-approve" data-id="${esc(row.playerId)}" aria-label="Approve ${esc(row.name)}’s answer" aria-pressed="${row.accepted === true}" data-needs-connection>${icon('check', 16)} Approve</button>
                    <button class="quiet-button" type="button" id="reject-${esc(row.playerId)}" data-action="competition-reject" data-id="${esc(row.playerId)}" aria-label="Reject ${esc(row.name)}’s answer" aria-pressed="${row.accepted === false}" data-needs-connection>${icon('close', 16)} Reject</button>
                    ${game ? `<button class="quiet-button" type="button" id="note-${esc(row.playerId)}" data-action="competition-note" data-id="${esc(row.playerId)}" aria-label="Post a note for ${esc(row.name)}’s answer" title="Post note" data-needs-connection>${icon('chat', 16)}</button>` : ''}
                </div>` : ''}
            </li>`;
        }).join('')}</ul>` : ''}
        ${canReview ? '</details>' : ''}
        ${action ? `<div class="competition-review-footer">${action}</div>` : ''}
    </section>`;
}

export function competitionWinners(state: DataRecord, isHost: boolean) {
    const competition = state.competition;
    if (!competition) return '';
    const names = competition.winningTeams?.length
        ? competition.winningTeams.map(team => TEAM_NAMES[typeof team === 'string' ? team : team.id])
        : (competition.winners || []).map(winner => typeof winner === 'string' ? winner : winner.name);
    const winners = names.length ? `<section class="competition-win"><h2>${names.length > 1 ? 'Winners' : 'Winner'}</h2><p>${names.map(esc).join(' · ')}</p></section>`
        : competition.lives > 0 ? '<p class="competition-win muted">No survivors</p>' : '';
    return `${winners}
        ${competitionTeams(state, isHost)}`;
}
