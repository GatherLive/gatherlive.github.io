import type {AppContext} from '../../app/context.js';
import { esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { reportIcon } from './icons.js';
export function createFeaturesResultsSummary(context: AppContext) {
    const S = context.state;
    function leaderboard(players) { return `<div class="leaderboard">${players.map((p, i) => `<div class="leader-row"><span class="leader-rank">${(p.rank ?? i + 1) === 1 ? '✳' : String(p.rank ?? i + 1).padStart(2, '0')}</span><span class="leader-name">${esc(p.name)}${p.id === S.room?.playerId ? ' <span class="muted">(you)</span>' : ''}</span><span class="leader-points">${Number(p.score || 0).toLocaleString()} <span class="muted small">pts</span></span></div>`).join('')}</div>`; }
    function resultsView(st, isHost) {
        const rounds = st.roundResults || [], show = st.settings?.showLeaderboard || isHost;
        return `<main><div class="results-head"><h1>Quiz complete</h1><p>${esc(st.title)}</p></div>${rounds.length ? roundHistory(rounds, show) : show ? leaderboard(st.leaderboard || []) : ''}${st.winners?.length ? `<div class="card draw-card results-controls"><h2>Draw winner${st.winners.length === 1 ? '' : 's'}</h2>${st.winners.map(p => `<div class="winner-name">${esc(p.name)}</div>`).join('')}</div>` : ''}${isHost ? `<section class="results-controls"><div class="row wrap results-actions"><a class="btn" href="#results/live/${st.code}">${reportIcon('analytics', 18)} Detailed results</a><button class="btn" data-action="save-report">${icon('check', 15)} Save results</button><button class="btn" data-action="results-csv">${icon('download', 15)} CSV</button><a class="btn primary" href="#dashboard">My quizzes ${icon('arrow', 15)}</a></div><p class="results-expiry-note muted">Unsaved results are deleted 15 minutes after the quiz ends.</p><details class="card draw-card"><summary>Random draw</summary><form id="draw-form" class="draw-form"><label class="sr-only" for="draw-mode">Eligible group</label><select class="input" id="draw-mode"><option value="all">All players</option><option value="correct">Players with a correct answer</option><option value="top">Top scorers</option></select><label class="sr-only" for="draw-count">Number of winners</label><input class="input" id="draw-count" type="number" min="1" max="50" value="1" required><button class="btn green" type="submit">${icon('shuffle', 16)} Draw</button></form></details></section>` : `<div class="results-home"><a class="quiet-button" href="#">Home ${icon('arrow', 14)}</a></div>`}</main>`;
    }
    function roundHistory(rounds, show = true) {
        return `<div class="round-history">${rounds.map(r => `<section class="card round-history-card"><div class="row between"><h2>${esc(r.title)}</h2>${r.reward ? `<span class="round-reward">${icon('trophy', 15)} ${esc(r.reward)}</span>` : ''}</div><div class="round-history-winners">${r.winners?.length ? r.winners.map(p => esc(p.name)).join(' · ') : 'No winner'}${r.tied ? ' <span class="muted">(tied)</span>' : ''}</div>${show ? `<details><summary>Leaderboard</summary>${leaderboard(r.leaderboard || [])}</details>` : ''}</section>`).join('')}</div>`;
    }
    function csvFor(players, rounds = []) {
        const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s))
            s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
        const rows = rounds.length ? [['Round', 'Reward', 'Rank', 'Player', 'Points', 'Winner'], ...rounds.flatMap(r => (r.leaderboard || []).map((p, i) => [r.title, r.reward, p.rank ?? i + 1, p.name, p.score || 0, (r.winners || []).some(w => w.id === p.id) ? 'Yes' : '']))] : [['Rank', 'Player', 'Points'], ...players.map((p, i) => [p.rank ?? i + 1, p.name, p.score || 0])];
        return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
    }
    return { leaderboard, resultsView, roundHistory, csvFor };
}
