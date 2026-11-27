import type {AppContext} from '../../app/context.js';
import { $ } from '../../core/dom.js';

const LOAD_TIMEOUT = 12000;
// Leave a small margin before Turnstile's five-minute token expiry.
const TOKEN_LIFETIME = 295000;
type TurnstileApi = NonNullable<Window['turnstile']>;
type Challenge = {
    form: HTMLFormElement;
    status: HTMLElement;
    retry: HTMLElement;
    submit: HTMLButtonElement;
    id: string | null;
    token: string;
    expiresAt: number;
    submitted: boolean;
};

export function createFeaturesAuthTurnstile(context: AppContext) {
    const S = context.state;
    let scriptLoad: Promise<TurnstileApi> | null = null;
    let active: Challenge | null = null;

    function loadTurnstile() {
        if (scriptLoad) return scriptLoad;
        if (typeof window.turnstile?.render === 'function') return Promise.resolve(window.turnstile);
        scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
            const script = document.createElement('script');
            const cleanup = () => {
                clearTimeout(timeout);
                delete window.gatherTurnstileLoaded;
                script.onerror = null;
            };
            const fail = () => {
                cleanup();
                script.remove();
                reject(new Error('Verification could not load.'));
            };
            const timeout = setTimeout(fail, LOAD_TIMEOUT);
            // Turnstile's ready() rejects scripts loaded with async.
            window.gatherTurnstileLoaded = () => {
                const api = window.turnstile;
                if (typeof api?.render !== 'function') return fail();
                cleanup();
                resolve(api);
            };
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=gatherTurnstileLoaded';
            script.async = true;
            script.onerror = fail;
            document.head.append(script);
        }).catch(error => {
            scriptLoad = null;
            throw error;
        });
        return scriptLoad;
    }

    function isCurrent(challenge: Challenge) {
        return active === challenge && challenge.form.isConnected;
    }

    function update(challenge: Challenge, message: string, retry = false) {
        if (!isCurrent(challenge)) return;
        challenge.status.textContent = message;
        challenge.status.hidden = !message;
        challenge.retry.hidden = !retry;
        challenge.submit.disabled = challenge.submitted || !challenge.token;
    }

    function clearToken(challenge: Challenge) {
        challenge.token = '';
        challenge.expiresAt = 0;
    }

    function discardTurnstile() {
        const challenge = active;
        active = null;
        if (!challenge) return;
        if (challenge.id !== null) {
            try { window.turnstile?.remove(challenge.id); } catch { }
        }
    }

    function resetTurnstile() {
        const challenge = active;
        if (!challenge || !isCurrent(challenge)) return;
        if (!challenge.submitted) {
            challenge.submit.disabled = !challenge.token;
            return;
        }
        challenge.submitted = false;
        clearToken(challenge);
        update(challenge, '');
        try { window.turnstile.reset(challenge.id); }
        catch { update(challenge, 'Verification could not restart.', true); }
    }

    function captchaBody(form: HTMLFormElement) {
        const challenge = active;
        if (!challenge || challenge.form !== form || challenge.submitted || !challenge.token)
            throw new Error('Wait for verification to finish.');
        if (Date.now() >= challenge.expiresAt) {
            void mountTurnstile();
            throw new Error('Verification expired. A new check is starting.');
        }
        const token = challenge.token;
        clearToken(challenge);
        challenge.submitted = true;
        update(challenge, '');
        return { gotrue_meta_security: { captcha_token: token } };
    }

    async function mountTurnstile() {
        const slot = $<HTMLElement>('#turnstile-slot');
        const form = slot?.closest('form');
        if (!form) return;
        discardTurnstile();
        const challenge: Challenge = {
            form, status: form.querySelector('#turnstile-status'),
            retry: form.querySelector('#turnstile-retry'), submit: form.querySelector('button[type="submit"]'),
            id: null, token: '', expiresAt: 0, submitted: false
        };
        active = challenge;
        slot.replaceChildren();
        const mode = S.authMode;
        const sitekey = S.config.turnstileSiteKey;
        if (!sitekey) {
            update(challenge, 'Verification is unavailable.');
            return;
        }
        update(challenge, 'Loading verification…');
        try {
            const api = await loadTurnstile();
            if (!isCurrent(challenge)) return;
            update(challenge, '');
            const refresh = () => {
                if (!isCurrent(challenge) || challenge.submitted) return;
                clearToken(challenge);
                update(challenge, '');
            };
            challenge.id = api.render(slot, {
                sitekey,
                action: mode === 'signup' ? 'signup' : mode === 'recover' ? 'recover' : 'login',
                theme: 'dark',
                size: slot.clientWidth < 300 ? 'compact' : 'normal',
                appearance: mode === 'signup' ? 'always' : 'interaction-only',
                execution: 'render',
                'response-field': false,
                'refresh-expired': 'auto',
                'refresh-timeout': 'auto',
                callback: (token: string) => {
                    if (!isCurrent(challenge) || challenge.submitted) return;
                    challenge.token = token;
                    challenge.expiresAt = Date.now() + TOKEN_LIFETIME;
                    update(challenge, '');
                },
                'expired-callback': refresh,
                'timeout-callback': refresh,
                'error-callback': () => {
                    if (isCurrent(challenge) && !challenge.submitted) {
                        clearToken(challenge);
                        update(challenge, 'Verification could not finish.', true);
                    }
                    return true;
                }
            });
        } catch {
            update(challenge, 'Verification could not load.', true);
        }
    }

    return {
        actions: { 'retry-turnstile': mountTurnstile },
        discardTurnstile, resetTurnstile, captchaBody, mountTurnstile
    };
}
