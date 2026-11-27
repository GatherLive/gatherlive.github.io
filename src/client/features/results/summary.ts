import type {AppContext} from '../../app/context.js';
import { esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { reportIcon } from './icons.js';
import {competitionWinners} from '../live/competition.js';
import {lifeGameFinish, lifeStandings, livesText, resultHasPoints, resultMetrics, startingLives} from './lives.js';
import {csv} from './data.js';
export function createFeaturesResultsSummary(context: AppContext) {
    const S = context.state;
    function leaderboard(players) { return `<div class="leaderboard">${players.map((p, i) => `<div class="leader-row"><span class="leader-rank">${(p.rank ?? i + 1) === 1 ? '✳' : String(p.rank ?? i + 1).padStart(2, '0')}</span><span class="leader-name">${esc(p.name)}${p.id === S.room?.playerId ? ' <span class="muted">(you)</span>' : ''}</span><span class="leader-points">${Number(p.score || 0).toLocaleString()} <span class="muted small">pts</span></span></div>`).join('')}</div>`; }
    function resultsView(st, isHost) {
        const rounds = st.roundResults || [], show = st.settings?.showLeaderboard || isHost;
        const lives = startingLives(st);
        if(st.study) {
            return `<main><div class="results-head"><h1>Practice complete</h1><p>${esc(st.title)}</p>
                <p><strong>${lives ? resultMetrics(st.me, lives, resultHasPoints(st)) : Number(st.me?.overallScore ?? st.me?.score ?? 0).toLocaleString() + ' pts'}</strong></p>
            </div>${rounds.length ? `<div class="leaderboard">${rounds.map(round =>
                `<div class="leader-row"><span class="leader-rank">${round.index+1}</span><span class="leader-name">${esc(round.title)}</span><span class="leader-points">${lives ? resultMetrics(round.leaderboard?.[0], lives, resultHasPoints(round)) : Number(round.leaderboard?.[0]?.score || 0).toLocaleString() + ' pts'}</span></div>`).join('')}</div>` : ''}
            <section class="results-controls"><div class="row wrap results-actions">
                <a class="btn primary" href="#results/live/${st.code}">${reportIcon('analytics',18)} Review answers</a>
                <button class="btn" data-action="save-report">${icon('check',15)} Save results</button>
                <a class="quiet-button" href="#dashboard">My quizzes ${icon('arrow',15)}</a>
            </div><p class="results-expiry-note muted">Unsaved results are deleted 15 minutes after practice ends.</p></section></main>`;
        }
        const outcome = lives ? lifeGameFinish(st, show)
            : competitionWinners(st, isHost) + (!rounds.length && show ? leaderboard(st.leaderboard || []) : '');
        return `<main><div class="results-head"><h1>${lives ? 'Game complete' : 'Quiz complete'}</h1><p>${esc(st.title)}</p></div>${outcome}${rounds.length ? roundHistory(rounds, show, lives) : ''}${!st.competition && st.winners?.length ? `<div class="card draw-card results-controls"><h2>Draw winner${st.winners.length === 1 ? '' : 's'}</h2>${st.winners.map(p => `<div class="winner-name">${esc(p.name)}</div>`).join('')}</div>` : ''}${isHost ? `<section class="results-controls"><div class="row wrap results-actions"><a class="btn" href="#results/live/${st.code}">${reportIcon('analytics', 18)} Detailed results</a><button class="btn" data-action="save-report">${icon('check', 15)} Save results</button><button class="btn" data-action="results-csv">${icon('download', 15)} CSV</button><a class="btn primary" href="#dashboard">My quizzes ${icon('arrow', 15)}</a></div><p class="results-expiry-note muted">Unsaved results are deleted 15 minutes after the quiz ends.</p>${st.competition ? '' : `<details class="card draw-card"><summary>Random draw</summary><form id="draw-form" class="draw-form"><label class="sr-only" for="draw-mode">Eligible group</label><select class="input" id="draw-mode"><option value="all">All players</option><option value="correct">Players with a correct answer</option><option value="top">Top scorers</option></select><label class="sr-only" for="draw-count">Number of winners</label><input class="input" id="draw-count" type="number" min="1" max="50" value="1" required><button class="btn green" type="submit">${icon('shuffle', 16)} Draw</button></form></details>`}</section>` : `<div class="results-home"><a class="quiet-button" href="#">Home ${icon('arrow', 14)}</a></div>`}</main>`;
    }
    function roundHistory(rounds, show = true, lives = 0) {
        const history = `<div class="round-history">${rounds.map(r => `<section class="card round-history-card"><div class="row between"><h2>${esc(r.title)}</h2>${r.reward ? `<span class="round-reward">${icon('trophy', 15)} ${esc(r.reward)}</span>` : ''}</div><div class="round-history-winners">${r.winners?.length ? r.winners.map(p => esc(p.name)).join(' · ') : 'No winner'}${r.tied ? ' <span class="muted">(tied)</span>' : ''}</div>${show ? `<details><summary>${lives ? 'Lives remaining' : 'Leaderboard'}</summary>${lives ? lifeStandings(r.leaderboard || [], lives, {points: resultHasPoints(r)}) : leaderboard(r.leaderboard || [])}</details>` : ''}</section>`).join('')}</div>`;
        return lives ? `<details class="life-round-history"><summary>Round results</summary>${history}</details>` : history;
    }
    function csvFor(players, rounds = [], lives = 0, winners = [], hasPoints = false, ranked = false) {
        const points = !lives || hasPoints || resultHasPoints({leaderboard: players, roundResults: rounds});
        const columns = [...(!lives || ranked ? ['Rank'] : []), 'Player', ...(lives ? ['Lives remaining'] : []), ...(ranked ? ['Eliminated on question'] : []), ...(points ? ['Points'] : [])];
        const playerCells = (player, index, showPoints = true, overall = true) => [
            ...(!lives ? [player.rank ?? index + 1] : ranked ? [overall ? player.rank ?? '' : ''] : []), player.name,
            ...(lives ? [livesText(player.lives)] : []), ...(ranked ? [overall ? player.elimination?.question ?? '' : ''] : []),
            ...(points ? [showPoints ? player.score ?? 0 : ''] : [])
        ];
        const winnerCell = (player, winners) => winners.some(winner => winner.id === player.id) ? 'Yes' : '';
        const overallRows = () => players.map((player, index) => [
            ...playerCells(player, index), ...(lives ? [winnerCell(player, winners)] : [])
        ]);
        return rounds.length
            ? csv([['Round', 'Reward', ...columns, 'Winner'], ...(ranked ? overallRows().map(row => ['Overall', '', ...row]) : []), ...rounds.flatMap(round => (round.leaderboard ?? []).map((player, index) => [
                round.title, round.reward, ...playerCells(player, index, !lives || resultHasPoints(round), false), winnerCell(player, round.winners ?? [])
            ]))])
            : csv([[...columns, ...(lives ? ['Winner'] : [])], ...overallRows()]);
    }
    return { leaderboard, resultsView, roundHistory, csvFor };
}
