import type {DataRecord} from '../../../shared/types.js';
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

export function resultLives(lives: number | undefined, max: number) {
    if (!Number.isInteger(lives) || lives < 0 || lives > 12) return '—';
    if (lives === 0) return '<span class="result-eliminated">Eliminated</span>';
    const compact = max > 5;
    const hearts = Array.from({length: compact ? 1 : max}, (_, index) =>
        `<span class="result-heart${index >= lives ? ' result-heart-empty' : ''}">${icon('heart', 14)}</span>`).join('');
    return `<span class="result-lives" role="img" aria-label="${lives} of ${max} lives">${hearts}${compact ? `<strong aria-hidden="true">${lives}</strong>` : ''}</span>`;
}

export function resultMetrics(player: DataRecord | undefined, max: number, showPoints: boolean) {
    const score = Number(player?.overallScore ?? player?.score ?? 0);
    return `<span class="result-metrics">${max ? resultLives(player?.lives, max) : ''}${showPoints ? `<span class="result-points">${score.toLocaleString()} pts</span>` : ''}</span>`;
}

export function lifeOutcome(result: DataRecord) {
    const competition = result.competition;
    const teams = competition?.winningTeams;
    const winners = competition?.winners ?? result.winners ?? [];
    if (teams?.length) return {label: teams.length > 1 ? 'Winning teams' : 'Winning team', names: teams.map(competitionTeamName)};
    return {label: winners.length > 1 ? 'Winners' : 'Winner', names: winners.map(player => typeof player === 'string' ? player : player.name)};
}

export function lifeStandings(players: DataRecord[], max: number, {
    ownId, points = false, ownPointsOnly = false
}: {ownId?: string; points?: boolean; ownPointsOnly?: boolean} = {}) {
    const sorted = [...players].sort((a, b) => (b.lives ?? -1) - (a.lives ?? -1) || a.name.localeCompare(b.name));
    return `<ul class="life-result-list">${sorted.map(player => `<li><strong dir="auto">${esc(player.name)}${player.id === ownId ? ' <small>You</small>' : ''}</strong>${resultMetrics(player, max, points && (!ownPointsOnly || player.id === ownId))}</li>`).join('')}</ul>`;
}

export function lifeGameFinish(state: DataRecord, show: boolean) {
    const max = startingLives(state);
    const {label, names} = lifeOutcome(state);
    const winners = state.competition?.winners ?? state.winners ?? [];
    const winnerIds = new Set(winners.map(player => player.id));
    const available = show ? state.competition?.lifeStandings ?? state.leaderboard ?? [] : state.me ? [state.me] : [];
    const totals = new Map(available.map(player => [player.id, player]));
    const winningRows = winners.map(player => totals.get(player.id) ?? player);
    const others = available.filter(player => !winnerIds.has(player.id));
    const display = {ownId: state.me?.id, points: resultHasPoints(state), ownPointsOnly: !show};
    const heading = names.length ? label : show && !available.length ? 'No participants' : 'No winner';
    return `<div class="life-game-finish">
        <section class="life-result-card"><h2>${heading}</h2>
        ${state.competition?.winningTeams?.length ? `<p class="life-result-team">${names.map(esc).join(' · ')}</p>` : ''}
        ${winningRows.length ? lifeStandings(winningRows, max, display) : ''}</section>
        ${others.length ? `<section class="life-result-card"><h2>${show ? 'Participants' : 'Your finish'}</h2>${lifeStandings(others, max, display)}</section>` : ''}
    </div>`;
}
