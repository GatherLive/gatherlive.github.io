import { $ } from '../../core/dom.js';
export function createFeaturesAuthForms(context) {
    const S = context.state;
    const authRequest = (...args) => context.authRequest(...args);
    const captchaBody = (...args) => context.captchaBody(...args);
    const authView = (...args) => context.authView(...args);
    const getToken = (...args) => context.getToken(...args);
    const toast = (...args) => context.toast(...args);
    const discardTurnstile = (...args) => context.discardTurnstile(...args);
    const saveSession = (...args) => context.saveSession(...args);
    const learningReturn = (...args) => context.learningReturn(...args);
    return { forms: { "auth-form": { submit: async (form) => {
                    const email = $('#auth-email')?.value.trim(), password = $('#auth-password')?.value;
                    if (S.authMode === 'recover') {
                        await authRequest(`recover?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { email, ...captchaBody() });
                        S.authMessage = 'Check your inbox for a password reset link.';
                        authView();
                    }
                    else if (S.authMode === 'reset') {
                        await authRequest('user', { password }, 'PUT', await getToken());
                        S.authMode = 'login';
                        toast('New password saved.');
                        location.hash = '#dashboard';
                    }
                    else {
                        const signup = S.authMode === 'signup';
                        const data = await authRequest(signup ? `signup?redirect_to=${encodeURIComponent(location.origin + location.pathname)}` : 'token?grant_type=password', { email, password, ...captchaBody() });
                        if (data.access_token) {
                            discardTurnstile();
                            saveSession(data);
                            S.authMessage = '';
                            location.hash = learningReturn();
                        }
                        else {
                            S.authMessage = 'Check your email to confirm your account, then sign in here.';
                            S.authMode = 'login';
                            authView();
                        }
                    }
                }, onError: error => { if (S.authMode !== 'reset' && context.turnstileToken)
                    context.resetTurnstile(); return /captcha/i.test(error.message) ? 'Verification failed. Please try again.' : error.message; } } } };
}
