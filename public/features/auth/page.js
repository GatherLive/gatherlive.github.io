import { icon } from '../../core/icons.js';
import { esc } from '../../core/dom.js';
import { policyNotice } from '../legal/page.js';
export function createFeaturesAuthPage(context) {
    const S = context.state;
    const discardTurnstile = (...args) => context.discardTurnstile(...args);
    const shell = (...args) => context.shell(...args);
    const mountTurnstile = (...args) => context.mountTurnstile(...args);
    function authView() {
        discardTurnstile();
        const signup = S.authMode === 'signup', recover = S.authMode === 'recover', reset = S.authMode === 'reset';
        shell(`<main class="auth-layout"><section class="auth-card"><a class="quiet-button back-link" href="#">${icon('back', 15)} Home</a><h1>${reset ? 'Reset password' : recover ? 'Forgot password?' : signup ? 'Create account' : 'Sign in'}</h1><form id="auth-form">${reset ? '' : `<div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254"></div>`}${recover ? '' : `<div class="field"><label for="auth-password">${reset ? 'New password' : 'Password'}</label><input id="auth-password" name="password" type="password" autocomplete="${signup || reset ? 'new-password' : 'current-password'}" placeholder="${signup || reset ? 'At least 8 characters' : 'Your password'}" minlength="${signup || reset ? 8 : 1}" required maxlength="128"></div>`}${S.authMessage ? `<div class="info-note">${esc(S.authMessage)}</div>` : ''}${reset ? '' : '<div id="turnstile-slot" class="turnstile-slot"></div>'}<div id="form-error" role="alert"></div>${signup ? policyNotice() : ''}<button class="btn primary full" type="submit">${reset ? 'Save password' : recover ? 'Send reset link' : signup ? 'Create account' : 'Sign in'} ${icon('arrow', 16)}</button></form>${!reset ? `<div class="auth-foot"><button class="quiet-button" data-action="auth-mode" data-mode="${signup || recover ? 'login' : 'signup'}">${signup || recover ? 'Sign in' : 'Create account'}</button>${!signup && !recover ? '<button class="quiet-button" data-action="auth-mode" data-mode="recover">Forgot password?</button>' : ''}</div>` : ''}</section></main>`);
        if (!reset)
            void mountTurnstile();
    }
    return { authView };
}
