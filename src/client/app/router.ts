import type {AppContext} from './context.js';
import { icon } from '../core/icons.js';
import { policyPage } from '../features/legal/page.js';
import { settingsDestination } from '../features/settings/navigation.js';
export function createAppRouter(context: AppContext) {
    const S = context.state;
    const discardTurnstile = (...args) => context.discardTurnstile(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const disconnectRoom = (...args) => context.disconnectRoom(...args);
    const shell = (...args) => context.shell(...args);
    const showLearning = (...args) => context.showLearning(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const authView = (...args) => context.authView(...args);
    const dashboard = (...args) => context.dashboard(...args);
    const accountView = (...args) => context.accountView(...args);
    const openEditor = (...args) => context.openEditor(...args);
    const joinView = (...args) => context.joinView(...args);
    const renderRoom = (...args) => context.renderRoom(...args);
    const playerRoomKey = (...args) => context.playerRoomKey(...args);
    const connectRoom = (...args) => context.connectRoom(...args);
    const home = (...args) => context.home(...args);
    let routeVersion = 0;
    async function route() {
        discardTurnstile();
        S.disposeSettings?.();
        S.disposeSettings = null;
        S.disposeResults?.();
        S.disposeResults = null;
        const version = ++routeVersion, raw = location.hash.slice(1), queryIndex = raw.indexOf('?');
        const [path, ...parts] = (queryIndex < 0 ? raw : raw.slice(0, queryIndex)).split('/');
        const policyRoute = path === 'terms' || path === 'privacy';
        if(path==='settings'&&!/^#(?:settings|account|terms|privacy)(?:[/?]|$)/.test(S.lastRoute||'')){
            let origin=S.lastRoute||'#';if(!S.lastRoute)try{origin=sessionStorage.getItem('gather.settings.return')||'#';}catch{}
            S.settingsReturn=settingsDestination(origin);
            try{sessionStorage.setItem('gather.settings.return',S.settingsReturn);}catch{}
        }
        S.lastRoute=location.hash||'#';
        if(!['settings','host','terms','privacy'].includes(path))S.authReturnTo=null;
        const returnTo = new URLSearchParams(queryIndex < 0 ? '' : raw.slice(queryIndex + 1)).get('return') || '#';
        if (path === 'learn') {
            S.section = 'learn';
            S.learnReturn = location.hash;
            try {
                sessionStorage.setItem('gather.section', 'learn');
                sessionStorage.setItem('gather.learn.route', S.learnReturn);
            }
            catch { }
        }
        else if ((path === 'account' || path === 'settings' || policyRoute) && !S.section) {
            try {
                S.section = sessionStorage.getItem('gather.section') || 'quiz';
                S.learnReturn = sessionStorage.getItem('gather.learn.route') || '#learn';
            }
            catch {
                S.section = 'quiz';
            }
        }
        else if (path !== 'account' && path !== 'settings' && !policyRoute) {
            S.section = 'quiz';
            try {
                sessionStorage.setItem('gather.section', 'quiz');
            }
            catch { }
        }
        closeModal();
        window.scrollTo(0, 0);
        if (path !== 'learn' && S.learning) {
            S.learning.destroy();
            S.learning = null;
        }
        if (!['learn', 'host', 'reset', 'terms', 'privacy'].includes(path))
            try {
                sessionStorage.removeItem('gather.learn.return');
            }
            catch { }
        if (path !== 'room' && (S.ws || (path === 'learn' && S.room))) {
            disconnectRoom();
            S.roomState = null;
            if (path === 'learn')
                S.room = null;
        }
        if (policyRoute) {
            shell(policyPage(path, icon('back', 15), returnTo));
            document.querySelector<HTMLElement>('.legal-heading h1')?.focus({ preventScroll: true });
            return;
        }
        if (path === 'account') { location.replace('#settings/account'); return; }
        if (path === 'settings') {
            if (!activeUser() && parts[0] !== 'about') { S.authReturnTo = location.hash; S.authMode = 'login'; authView(); return; }
            context.settingsView(['account','usage','about'].includes(parts[0])?parts[0]:''); return;
        }
        if (path === 'learn') {
            await showLearning(parts, version);
            return;
        }
        if (path === 'host' || path === 'dashboard' || path === 'account' || path === 'edit' || path === 'results') {
            if (!activeUser()) {
                S.authMode = path === 'host' && parts[0] === 'signup' ? 'signup' : 'login';
                authView();
                return;
            }
            if (path === 'host' || path === 'dashboard') {
                await dashboard();
                return;
            }
            if (path === 'account') {
                accountView();
                return;
            }
            if (path === 'edit') {
                await openEditor(parts[0]);
                return;
            }
            if (path === 'results') {
                await context.showResults(parts, version);
                return;
            }
        }
        if (path === 'join') {
            joinView(parts[0] || '');
            return;
        }
        if (path === 'room') {
            const code = parts[0];
            if (!/^\d{6}$/.test(code || '')) {
                location.hash = '#join';
                return;
            }
            if (S.room?.code === code && S.ws) {
                renderRoom();
                return;
            }
            if (!S.room || S.room.code !== code) {
                let player;
                try {
                    player = JSON.parse(sessionStorage.getItem(playerRoomKey(code)) || 'null');
                }
                catch { }
                if (!player)
                    try {
                        player = JSON.parse(localStorage.getItem(playerRoomKey(code)) || 'null');
                    }
                    catch { }
                let hosting = false;
                try { hosting = !!sessionStorage.getItem(`gather.host.${code}`); } catch { }
                if (hosting && activeUser())
                    S.room = { code, role: 'host' };
                else if (player)
                    S.room = player;
                else {
                    location.hash = `#join/${code}`;
                    return;
                }
            }
            S.fatalRoomError = null;
            connectRoom();
            return;
        }
        if (path === 'reset') {
            S.authMode = 'reset';
            authView();
            return;
        }
        if (version === routeVersion)
            home();
    }
    return { get routeVersion() { return routeVersion; }, route };
}
