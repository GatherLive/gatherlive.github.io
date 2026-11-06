import type {AppContext} from '../../app/context.js';
export function createFeaturesAuthActions(context: AppContext) {
    const S = context.state;
    const authView = (...args) => context.authView(...args);
    return { actions: {
            'auth-mode': el => { S.authMode = el.dataset.mode; S.authMessage = ''; authView(); }
        } };
}
