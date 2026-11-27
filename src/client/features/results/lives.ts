import type {DataRecord, Elimination} from '../../../shared/types.js';
import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {competitionTeamName} from '../live/competition.js';

export function startingLives(result: DataRecord) {
    const lives = result.competition?.lives ?? result.settings?.competition?.lives;
    return Number.isInteger(lives) && lives > 0 && lives <= 12 ? lives : 0;
}

export const livesText = (lives?: number) => lives === 0 ? 'Eliminated' : Number.isInteger(lives) ? String(lives) : '—';

export function resultHasPoints(result: DataRecord) {
    if (typeof result.hasPoints === 'boolean') return result.hasPoints;
    const standings = result.competition?.lifeStandings ?? result.overallLeaderboard ?? result.leaderboard ?? [];
    return standings.some(player => player.score > 0) || (result.me?.overallScore ?? result.me?.score ?? 0) > 0 ||
        (result.roundResults ?? []).some(round => resultHasPoints(round));
}

export function resultLives(lives: number | undefined, max: number, elimination?: Elimination) {
    if (!Number.isInteger(lives) || lives < 0 || lives > 12) return '—';
    if (lives === 0) {
        const question = elimination?.question;
        return `<span class="result-eliminated">Eliminated${Number.isSafeInteger(question) && question > 0 ? ' · Q' + question : ''}</span>`;
    }
    const compact = max > 5;
    const hearts = Array.from({length: compact ? 1 : max}, (_, index) =>
        `<span class="result-heart${index >= lives ? ' result-heart-empty' : ''}">${icon('heart', 14)}</span>`).join('');
    return `<span class="result-lives" role="img" aria-label="${lives} of ${max} lives">${hearts}${compact ? `<strong aria-hidden="true">${lives}</strong>` : ''}</span>`;
}

export function resultMetrics(player: DataRecord | undefined, max: number, showPoints: boolean) {
    const score = Number(player?.overallScore ?? player?.score ?? 0);
    return `<span class="result-metrics">${max ? resultLives(player?.lives, max, player?.elimination) : ''}${showPoints ? `<span class="result-points">${score.toLocaleString()} pts</span>` : ''}</span>`;
}

export function lifeOutcome(result: DataRecord) {
    const competition = result.competition;
    const teams = competition?.winningTeams;
    const winners = competition?.winners ?? result.winners ?? [];
    if (teams?.length) return {label: teams.length > 1 ? 'Winning teams' : 'Winning team', names: teams.map(competitionTeamName)};
    return {label: winners.length > 1 ? 'Winners' : 'Winner', names: winners.map(player => typeof player === 'string' ? player : player.name)};
}

export function lifeStandings(players: DataRecord[], max: number, {
    ownId, points = false, ownPointsOnly = false, ranked = false, numbered = false, winnerIds
}: {ownId?: string; points?: boolean; ownPointsOnly?: boolean; ranked?: boolean; numbered?: boolean; winnerIds?: ReadonlySet<string>} = {}) {
    const sorted = ranked ? players : [...players].sort((a, b) => (b.lives ?? -1) - (a.lives ?? -1) || a.name.localeCompare(b.name));
    const tag = numbered ? 'ol' : 'ul';
    return `<${tag} class="life-result-list${ranked ? ' life-result-ranked' : ''}">${sorted.map((player, index) => {
        const rank = Number.isSafeInteger(player.rank) && player.rank > 0 ? player.rank : null;
        const tied = numbered && rank != null && (sorted[index - 1]?.rank === rank || sorted[index + 1]?.rank === rank);
        const number = numbered ? index + 1 : rank;
        const label = numbered ? 'Participant ' + number : rank ? 'Rank ' + rank : 'Rank unavailable';
        return `<li>${ranked ? `<span class="life-result-rank" aria-label="${label}">${number ?? '—'}</span>` : ''}
            <strong dir="auto">${esc(player.name)}${player.id === ownId ? ' <small>You</small>' : ''}${winnerIds?.has(player.id) ? ' <small class="life-result-winner">Winner</small>' : ''}
                ${tied ? `<small class="life-result-tie">Tied for ${rank}</small>` : numbered && rank == null ? '<small class="life-result-tie">Rank unavailable</small>' : ''}</strong>
            ${resultMetrics(player, max, points && (!ownPointsOnly || player.id === ownId))}</li>`;
    }).join('')}</${tag}>`;
}

export function lifeGameFinish(state: DataRecord, show: boolean) {
    const max = startingLives(state);
    const {label, names} = lifeOutcome(state);
    const winners = state.competition?.winners ?? state.winners ?? [];
    const winnerIds = new Set<string>(winners.map(player => player.id));
    const available = show ? state.competition?.lifeStandings ?? state.leaderboard ?? [] : state.me ? [state.me] : [];
    const display = {ownId: state.me?.id, points: resultHasPoints(state), ownPointsOnly: !show};
    if (state.competition?.rankedByElimination) {
        const winnerLine = names.length && (!show || state.competition.winningTeams?.length)
            ? `<p class="life-result-team">${label} · ${names.map(esc).join(' · ')}</p>` : '';
        return `<div class="life-game-finish"><section class="life-result-card">
            <h2>${show ? 'Final standings' : 'Your finish'}</h2>${winnerLine}
            ${!show && state.me?.spectating ? '<p class="muted">Spectator</p>'
                : available.length ? lifeStandings(available, max, {...display, ranked: true, numbered: show, winnerIds})
                : '<p class="muted">No participants</p>'}
        </section></div>`;
    }
    const totals = new Map(available.map(player => [player.id, player]));
    const winningRows = winners.map(player => totals.get(player.id) ?? player);
    const others = available.filter(player => !winnerIds.has(player.id));
    const heading = names.length ? label : show && !available.length ? 'No participants' : 'No winner';
    return `<div class="life-game-finish">
        <section class="life-result-card"><h2>${heading}</h2>
        ${state.competition?.winningTeams?.length ? `<p class="life-result-team">${names.map(esc).join(' · ')}</p>` : ''}
        ${winningRows.length ? lifeStandings(winningRows, max, display) : ''}</section>
        ${others.length ? `<section class="life-result-card"><h2>${show ? 'Participants' : 'Your finish'}</h2>${lifeStandings(others, max, display)}</section>` : ''}
    </div>`;
}
