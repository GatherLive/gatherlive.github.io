export function createFeaturesAuthActions(context) {
    const S = context.state;
    const authView = (...args) => context.authView(...args);
    return { actions: {
            'auth-mode': el => { S.authMode = el.dataset.mode; S.authMessage = ''; authView(); }
        } };
}
