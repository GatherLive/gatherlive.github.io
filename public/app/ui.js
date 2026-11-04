import { $, esc } from '../core/dom.js';
import { brand } from '../core/icons.js';
import { SiteNews } from '../features/news/index.js';
export function createAppUi(context) {
    const S = context.state;
    const apiURL = (...args) => context.apiURL(...args);
    const activeUser = (...args) => context.activeUser(...args);
    let toastTimer;
    const app = $('#app');
    const siteNews = new SiteNews(apiURL);
    function toast(message, error = false) { clearTimeout(toastTimer); $('#toast').innerHTML = `<div class="toast ${error ? 'error' : ''}">${esc(message)}</div>`; toastTimer = setTimeout(() => $('#toast').innerHTML = '', 4200); }
    function nav() { return `<nav class="site-nav">${brand()}<div class="nav-right">${activeUser() ? `${S.section === 'learn' ? '' : '<a class="quiet-button" href="#dashboard">My quizzes</a>'}<a class="avatar" href="#account" aria-label="Account settings">${esc(activeUser().email?.[0]?.toUpperCase() || 'G')}</a>` : ''}</div></nav>`; }
    function shell(content) { app.innerHTML = `<div class="shell">${nav()}</div>${siteNews.slot()}<div class="shell">${content}</div>`; siteNews.render(); }
    function loading(message = 'Loading…') { shell(`<div class="loading-section"><span class="spinner"></span>${esc(message)}</div>`); }
    function modal(title, body, actions = '', onSetup) {
        $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2>${body}<div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button>${actions}</div></section></div>`;
        S.previousFocus = document.activeElement;
        requestAnimationFrame(() => $('.modal input, .modal button')?.focus());
        onSetup?.();
    }
    function closeModal() { $('#modal-root').innerHTML = ''; S.previousFocus?.focus(); }
    return { get toastTimer() { return toastTimer; }, get app() { return app; }, get siteNews() { return siteNews; }, toast, nav, shell, loading, modal, closeModal };
}
