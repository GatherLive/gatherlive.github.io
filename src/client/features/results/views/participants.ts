export function createResultsParticipantsView(viewContext) {
    function participants() {
        if (viewContext.state.student) {
            const p = viewContext.data.participantStats.find(item => item.player.id === viewContext.state.student);
            if (!p)
                return '';
            return `<section class="analytics-panel participant-report"><button class="quiet-button participant-back" data-result="all-participants">${viewContext.icon('back', 16)} Participants</button><div class="participant-heading"><h2 tabindex="-1" dir="auto">${viewContext.esc(p.player.name)}</h2><button class="btn" data-result="student-export">${viewContext.icon('download', 16)} Download</button></div><dl class="detail-metrics"><div><dt>Points</dt><dd>${viewContext.fmt(p.score)}</dd></div><div><dt>Accuracy</dt><dd>${viewContext.rate(p.accuracy)}</dd></div><div><dt>Answered</dt><dd>${p.answered} <span>/ ${p.eligible}</span></dd></div></dl><section class="participant-answers">${p.rows.map(viewContext.participantAnswer).join('') || '<p class="muted">No responses.</p>'}</section></section>`;
        }
        const query = viewContext.state.search.toLocaleLowerCase(), rows = viewContext.data.participantStats.filter(p => p.player.name.toLocaleLowerCase().includes(query));
        rows.sort((a, b) => {
            const left = viewContext.state.sort === 'name' ? a.player.name : a[viewContext.state.sort], right = viewContext.state.sort === 'name' ? b.player.name : b[viewContext.state.sort];
            if (left == null || right == null)
                return left == null ? (right == null ? 0 : 1) : -1;
            const diff = typeof left === 'string' ? left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }) : left - right;
            return (viewContext.state.sortDirection === 'ascending' ? diff : -diff) || a.player.name.localeCompare(b.player.name);
        });
        return `<section class="analytics-panel report-participant-list"><div class="participant-heading"><h2 tabindex="-1">Participants <span>${viewContext.fmt(rows.length)}</span></h2><button class="btn" data-result="batch-export" ${!viewContext.data.players.length ? 'disabled' : ''}>${viewContext.icon('download', 16)} Reports</button></div><input id="results-participant-search" class="input participant-search" type="search" aria-label="Search participants" placeholder="Search participants…" value="${viewContext.esc(viewContext.state.search)}"><div id="participant-rows">${viewContext.participantTable(rows.slice(viewContext.state.page * viewContext.PAGE, (viewContext.state.page + 1) * viewContext.PAGE), true)}${viewContext.pager(rows.length, 'page')}</div></section>`;
    }
    return { participants };
}
