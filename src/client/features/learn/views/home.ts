export function createLearnHomeView(viewContext) {
    function homeView() {
        viewContext.frame(`<header class="learn-heading"><div class="learn-title-line"><h1>Learn</h1>${viewContext.beta}</div></header><section class="learn-category-grid" aria-label="Learning topics"><a class="learn-topic-card learn-lavender" href="#learn/world"><span class="learn-topic-icon">${viewContext.symbol('map', 28)}</span><span class="learn-card-arrow" aria-hidden="true">↗</span><h2>World geography</h2><p>Flags, maps &amp; capitals.</p><div class="learn-topic-art" aria-hidden="true"><img src="${viewContext.flagURL('jp')}" alt="" width="80" height="54"><img src="${viewContext.flagURL('br')}" alt="" width="80" height="54"><img src="${viewContext.flagURL('za')}" alt="" width="80" height="54"></div></a></section>`);
    }
    return { homeView };
}
