export function createLearnSharedView(viewContext) {
    function progressBar() { return `<div class="learn-save-row"><span id="learn-save-state"></span><span id="learn-save-action"></span></div>`; }
    function learningFooter() {
        const reset = (viewContext.routeParts[0] === 'world' || Object.hasOwn(viewContext.TOPICS, viewContext.routeParts[0])) && !viewContext.current;
        return `<footer class="learn-footer">${progressBar()}<div class="learn-footer-links"><a href="#learn/sources">Sources &amp; notes</a>${viewContext.policyLinks({ newTab: true, returnTo: location.hash || '#learn' })}${reset ? '<button class="quiet-button" data-learn-action="reset">Reset progress</button>' : ''}</div></footer>`;
    }
    function overview() {
        const stats = viewContext.progressStats(viewContext.store.value), due = viewContext.reviewEntries().length;
        return `<div class="learn-overview"><section class="learn-stat-strip" aria-label="Your learning progress"><div><strong>${stats.practised}</strong><span>Practised</span></div><div><strong>${stats.learned}</strong><span>Remembered</span></div><div><strong>${stats.answers ? stats.accuracy + '%' : '—'}</strong><span>Accuracy</span></div></section><a class="learn-review-link" href="#learn/review"><span class="learn-review-mark">${viewContext.symbol('review', 25)}</span><span><strong>Review</strong><small>${due ? `${due} ready to revisit` : 'Keep what you learn'}</small></span>${viewContext.icon?.('arrow', 19) || '↗'}</a></div>`;
    }
    return { progressBar, learningFooter, overview };
}
