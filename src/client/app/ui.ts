import type {AppContext} from './context.js';
import { $, esc } from '../core/dom.js';
import { brand, icon } from '../core/icons.js';
import {refreshFeedback} from '../core/refresh.js';
import { SiteNews } from '../features/news/index.js';
export function createAppUi(context: AppContext) {
    const S = context.state;
    const apiURL = (...args) => context.apiURL(...args);
    const activeUser = (...args) => context.activeUser(...args);
    let toastTimer;
    const app = $('#app');
    const siteNews = new SiteNews(apiURL);
    function toast(message, error = false) { clearTimeout(toastTimer); $('#toast').innerHTML = `<div class="toast ${error ? 'error' : ''}">${esc(message)}</div>`; toastTimer = setTimeout(() => $('#toast').innerHTML = '', 4200); }
    function nav() { return `<nav class="site-nav">${brand()}<div class="nav-right" aria-label="Account navigation">${activeUser() ? `${S.section === 'learn' ? '' : '<a class="quiet-button nav-quizzes" href="#dashboard">My quizzes</a>'}<a class="quiet-button nav-settings" href="#settings" aria-label="Settings">${icon('settings',18)}<span class="settings-nav-label">Settings</span></a>` : ''}</div></nav>`; }
    function shell(content) { app.innerHTML = `<div class="shell">${nav()}</div>${siteNews.slot()}<div class="shell">${content}</div>`; siteNews.render(); }
    function loading(message = 'Loading…') { shell(`<div class="loading-section" role="status"><span class="spinner" aria-hidden="true"></span>${esc(message)}</div>`); }
    function modal(title, body, actions = '', onSetup) {
        S.cancelUsageDelete?.(); S.cancelUsageDelete = null;
        $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2>${body}<div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button>${actions}</div></section></div>`;
        S.previousFocus = document.activeElement as HTMLElement;S.previousFocusAction=S.previousFocus?.dataset?.action;
        requestAnimationFrame(() => $('.modal input, .modal button')?.focus());
        onSetup?.();
    }
    function closeModal() { S.cancelUsageDelete?.(); S.cancelUsageDelete = null; $('#modal-root').innerHTML = ''; if(S.previousFocus?.isConnected)S.previousFocus.focus();else [...document.querySelectorAll<HTMLButtonElement>('[data-action]')].find(button=>button.dataset.action===S.previousFocusAction)?.focus(); }
    return { refreshFeedback,get toastTimer() { return toastTimer; }, get app() { return app; }, get siteNews() { return siteNews; }, toast, nav, shell, loading, modal, closeModal };
}
