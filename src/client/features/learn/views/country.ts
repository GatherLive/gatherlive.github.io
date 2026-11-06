export function createLearnCountryView(viewContext) {
    function showCountry(code) {
        const country = viewContext.countryByCode.get(code);
        if (!country)
            return;
        const previous = document.getElementById('learn-country-dialog');
        if (previous) {
            viewContext.disposeMaps(previous);
            previous.remove();
        }
        const dialog = document.createElement('dialog');
        dialog.id = 'learn-country-dialog';
        dialog.className = 'learn-dialog';
        dialog.innerHTML = `<div class="learn-dialog-head"><span>${viewContext.esc(country.region)}</span><button class="icon-btn learn-dialog-close" aria-label="Close details">${viewContext.icon?.('close', 20) || '×'}</button></div>${viewContext.flag(country)}<h2>${viewContext.esc(country.name)}</h2><dl class="learn-country-facts"><div><dt>${viewContext.esc(viewContext.capitalFactLabel(country))}</dt><dd>${viewContext.esc(viewContext.capitalLabel(country))}</dd></div></dl>${country.capitalNote ? `<p class="learn-note">${viewContext.esc(country.capitalNote)}</p>` : ''}${country.flagNote ? `<p class="learn-note">${viewContext.esc(country.flagNote)}</p>` : ''}${viewContext.mapMarkup(country, true)}<button class="btn primary full learn-dialog-done">Done</button>`;
        document.body.append(dialog);
        dialog.querySelector<HTMLButtonElement>('.learn-dialog-close').onclick = () => dialog.close();
        dialog.querySelector<HTMLButtonElement>('.learn-dialog-done').onclick = () => dialog.close();
        dialog.addEventListener('click', event => { if (event.target === dialog)
            dialog.close(); });
        dialog.addEventListener('close', () => { viewContext.disposeMaps(dialog); dialog.remove(); }, { once: true });
        dialog.showModal();
        viewContext.mountMaps(dialog);
    }
    return { showCountry };
}
