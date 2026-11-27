import type {AppContext} from '../../app/context.js';
import {checkHoneypot} from '../../core/forms.js';
import {esc} from '../../core/dom.js';

export function createFeaturesAuthForms(context: AppContext) {
    const S = context.state;

    async function submitAuth(form: HTMLFormElement) {
        if (form.dataset.submitting) return;
        const mode = S.authMode;
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        const errorTarget = form.querySelector('#form-error');
        const buttonText = button.innerHTML;
        const fields = new FormData(form);
        const email = String(fields.get('email') ?? '').trim();
        const password = String(fields.get('password') ?? '');
        form.dataset.submitting = 'true';
        button.disabled = true;
        button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Loading…';
        errorTarget.replaceChildren();

        try {
            checkHoneypot(form);
            if (mode === 'reset') {
                await context.authRequest('user', {password}, 'PUT', await context.getToken());
                if (!form.isConnected) return;
                S.authMode = 'login';
                context.toast('New password saved.');
                location.hash = '#dashboard';
                return;
            }

            const captcha = context.captchaBody(form);
            const redirect = encodeURIComponent(location.origin + location.pathname);
            if (mode === 'recover') {
                await context.authRequest(`recover?redirect_to=${redirect}`, {email, ...captcha});
                if (!form.isConnected) return;
                S.authMessage = 'Check your inbox for a password reset link.';
                context.authView();
                return;
            }

            const path = mode === 'signup' ? `signup?redirect_to=${redirect}` : 'token?grant_type=password';
            const data = await context.authRequest(path, {email, password, ...captcha});
            if (!form.isConnected) return;
            if (data.access_token) {
                context.discardTurnstile();
                context.saveSession(data);
                S.authMessage = '';
                const destination = /^#settings(?:\/(?:account|usage|about))?$/.test(S.authReturnTo || '') ? S.authReturnTo : '#dashboard';
                S.authReturnTo = null;
                if (location.hash === destination) await context.route();
                else location.hash = destination;
            } else {
                S.authMessage = 'Check your email to confirm your account, then sign in here.';
                S.authMode = 'login';
                context.authView();
            }
        } catch (error) {
            const message = /captcha/i.test(error.message) ? 'Verification failed. Please try again.' : error.message;
            errorTarget.innerHTML = `<div class="error-note">${esc(message)}</div>`;
        } finally {
            delete form.dataset.submitting;
            if (form.isConnected) {
                button.innerHTML = buttonText;
                if (mode === 'reset') button.disabled = false;
                else context.resetTurnstile();
            }
        }
    }

    return { forms: { 'auth-form': { submit: submitAuth, ownFeedback: true } } };
}
