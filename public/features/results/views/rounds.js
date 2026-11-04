export function createResultsRoundsView(viewContext) {
    function rounds() {
        const rows = viewContext.data.participantStats.slice(viewContext.state.roundPage * viewContext.PAGE, (viewContext.state.roundPage + 1) * viewContext.PAGE);
        return `<section class="analytics-panel rounds-report"><h2>Rounds</h2>${viewContext.report.settings?.roundsEnabled ? `${viewContext.table(['Participant', ...(viewContext.report.settings.rounds || []).map(r => r.title), 'Total'], rows.map(p => `<tr><td><button class="participant-name" data-result="student" data-id="${viewContext.esc(p.player.id)}">${viewContext.esc(p.player.name)}</button></td>${p.rounds.map(r => `<td class="numeric">${viewContext.fmt(r.score)}</td>`).join('')}<td class="numeric">${viewContext.fmt(p.score)}</td></tr>`), 'analytics-rounds', 'No participants.', 'Points across rounds')}${viewContext.pager(viewContext.data.participantStats.length, 'roundPage')}` : '<p class="muted">No rounds.</p>'}</section>`;
    }
    return { rounds };
}
