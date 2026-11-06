export function createLearnReviewView(viewContext) {
    function reviewEntries() {
        const now = Date.now();
        return Object.entries(viewContext.store.value.items as Record<string,import('../../../../shared/types.js').LearningItem>).filter(([, value]) => value.nextReviewAt <= now).map(([key, value]) => { const [topic, code] = key.split(':'); return { topic, country: viewContext.countryByCode.get(code), value }; }).filter(entry => entry.country).sort((a, b) => a.value.nextReviewAt - b.value.nextReviewAt);
    }
    function reviewView() {
        const entries = reviewEntries();
        viewContext.shownReviewCount = entries.length;
        viewContext.frame(`${viewContext.back()}<header class="learn-heading"><h1>Review</h1><p>${entries.length ? 'A few familiar faces. Let’s make them stick.' : 'Your next step starts with a little practice.'}</p></header><section class="learn-review-panel"><span class="learn-review-large">${viewContext.symbol('review', 40)}</span><h2>${entries.length ? `${entries.length} ready to revisit` : 'You’re all caught up'}</h2><p>${entries.length ? 'Missed answers return sooner. Remembered ones get more space.' : 'Practise a topic, then return here to refresh your memory.'}</p>${entries.length ? '<button class="btn primary" data-learn-action="review-start">Start review</button>' : '<a class="btn primary" href="#learn">Explore topics</a>'}</section>${entries.length ? `<div class="learn-review-preview">${entries.slice(0, 6).map(entry => `<span>${viewContext.esc(viewContext.TOPICS[entry.topic].name)} <b>·</b> ${viewContext.esc(entry.country.name)}</span>`).join('')}${entries.length > 6 ? `<span>+${entries.length - 6} more</span>` : ''}</div>` : ''}`, 'learn-review-page');
    }
    return { reviewEntries, reviewView };
}
