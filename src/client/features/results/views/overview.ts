import {lifeOutcome} from '../lives.js';

export function createResultsOverviewView(viewContext) {
    function overview() {
        const max = viewContext.data.maxLives;
        const outcome = max ? lifeOutcome(viewContext.report) : null;
        const points = max ? viewContext.data.hasPoints : viewContext.data.questionStats.some(q => q.graded);
        const polls = viewContext.data.questionStats.filter(q => !q.graded && q.q.type !== 'slide');
        const chartModels = viewContext.data.questionStats.some(q => q.graded) ? viewContext.pies : viewContext.pies.filter(p => p.id === 'participation');
        return `<section class="analytics-overview" aria-label="Quiz overview"><dl class="analytics-totals"><div><dt>Participants</dt><dd>${viewContext.fmt(viewContext.data.players.length)}</dd></div><div><dt>Questions</dt><dd>${viewContext.fmt(viewContext.data.questions.length)}</dd></div>${max ? `<div><dt>Survivors</dt><dd>${viewContext.fmt(viewContext.data.participantStats.filter(player => player.lives > 0).length)}</dd></div>` : ''}${points ? `<div><dt>Average score</dt><dd>${viewContext.fmt(viewContext.data.averageScore)} <span>pts</span></dd></div>` : ''}<div><dt>Average response</dt><dd>${viewContext.seconds(viewContext.data.averageTime)}</dd></div></dl></section>${outcome ? `<section class="analytics-panel report-life-outcome"><h2>${outcome.names.length ? outcome.label : 'No winner'}</h2>${outcome.names.length ? `<p>${outcome.names.map(viewContext.esc).join(' · ')}</p>` : ''}</section>` : ''}<div class="report-chart-grid ${chartModels.length === 1 ? 'single-chart' : ''}">${chartModels.map(model => viewContext.renderPieChart(model, viewContext.state.pies[model.id])).join('')}</div>${polls.length ? `<section class="analytics-panel overview-feedback"><h2>Polls & feedback</h2>${polls.slice(0, 3).map(item => `<button class="analytics-review" data-result="question" data-index="${viewContext.data.questionStats.indexOf(item)}"><span>${viewContext.esc(item.q.prompt)}</span><strong>${item.answered} <span>responses</span></strong>${viewContext.icon('next', 16)}</button>`).join('')}</section>` : ''}<section class="analytics-panel"><div class="analytics-section-head"><h2>${viewContext.report.settings?.roundsEnabled ? 'Overall standings' : 'Participants'}</h2><button class="quiet-button" data-result="all-participants">View all ${viewContext.icon('next', 16)}</button></div>${viewContext.participantTable(viewContext.data.participantStats.slice(0, 5))}</section>`;
    }
    return { overview };
}
