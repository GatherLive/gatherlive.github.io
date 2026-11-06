import type {AppContext} from '../../app/context.js';
import { $, esc } from '../../core/dom.js';
export function createFeaturesAuthTurnstile(context: AppContext) {
    const S = context.state;
    let turnstileScriptPromise = null;
    let turnstileWidgetId = null;
    let turnstileToken = '';
    function loadTurnstile() {
        if (window.turnstile)
            return Promise.resolve(window.turnstile);
        if (!turnstileScriptPromise)
            turnstileScriptPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
                script.async = true;
                script.onload = () => resolve(window.turnstile);
                script.onerror = () => { turnstileScriptPromise = null; script.remove(); reject(new Error('Verification could not load. Refresh and try again.')); };
                document.head.append(script);
            });
        return turnstileScriptPromise;
    }
    function discardTurnstile() {
        turnstileToken = '';
        if (turnstileWidgetId !== null && window.turnstile) {
            try {
                window.turnstile.remove(turnstileWidgetId);
            }
            catch { }
        }
        turnstileWidgetId = null;
    }
    function resetTurnstile() {
        turnstileToken = '';
        if (turnstileWidgetId !== null && window.turnstile) {
            try {
                window.turnstile.reset(turnstileWidgetId);
            }
            catch { }
        }
    }
    function captchaBody() {
        if (!turnstileToken)
            throw new Error('Complete the verification, then try again.');
        return { gotrue_meta_security: { captcha_token: turnstileToken } };
    }
    async function mountTurnstile() {
        const mode = S.authMode;
        const slot = $('#turnstile-slot');
        if (!slot)
            return;
        const sitekey = S.config.turnstileSiteKey;
        if (!sitekey) {
            slot.innerHTML = '<div class="error-note">Verification is not configured.</div>';
            return;
        }
        let api;
        try {
            api = await loadTurnstile();
        }
        catch (error) {
            slot.innerHTML = `<div class="error-note">${esc(error.message)}</div>`;
            return;
        }
        if (!slot.isConnected || S.authMode !== mode)
            return;
        try {
            turnstileWidgetId = api.render(slot, {
                sitekey,
                action: mode === 'signup' ? 'signup' : mode === 'recover' ? 'recover' : 'login',
                theme: 'auto',
                appearance: mode === 'signup' ? 'always' : 'interaction-only',
                callback: token => { turnstileToken = token; },
                'expired-callback': () => { turnstileToken = ''; },
                'error-callback': () => { turnstileToken = ''; }
            });
        }
        catch {
            slot.innerHTML = '<div class="error-note">Verification could not load. Refresh and try again.</div>';
        }
    }
    return { get turnstileScriptPromise() { return turnstileScriptPromise; }, get turnstileWidgetId() { return turnstileWidgetId; }, get turnstileToken() { return turnstileToken; }, loadTurnstile, discardTurnstile, resetTurnstile, captchaBody, mountTurnstile };
}
