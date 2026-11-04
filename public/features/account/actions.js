import { $ } from '../../core/dom.js';
export function createFeaturesAccountActions(context) {
    const S = context.state;
    const authRequest = (...args) => context.authRequest(...args);
    const getToken = (...args) => context.getToken(...args);
    const saveSession = (...args) => context.saveSession(...args);
    const home = (...args) => context.home(...args);
    const toast = (...args) => context.toast(...args);
    const modal = (...args) => context.modal(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const backend = (...args) => context.backend(...args);
    const forgetLearningAccount = (...args) => context.forgetLearningAccount(...args);
    const closeModal = (...args) => context.closeModal(...args);
    return { actions: {
            'sign-out': async () => { try {
                await authRequest('logout', null, 'POST', await getToken());
            }
            catch { } saveSession(null); S.quizzes = []; S.reports = []; S.draft = null; S.dirty = false; location.hash = '#'; home(); toast('Signed out.'); },
            'delete-account': () => modal('Delete your account?', `<p>This permanently removes your account, every quiz, your uploaded images and all saved results. This can’t be undone.</p><div class="field"><label for="delete-confirm">Type DELETE to continue</label><input id="delete-confirm" autocomplete="off" placeholder="DELETE"></div><div id="delete-error" role="alert"></div>`, '<button class="btn danger" id="delete-account-button" data-action="confirm-delete-account" disabled>Permanently delete</button>'),
            'confirm-delete-account': async () => { if ($('#delete-confirm')?.value !== 'DELETE')
                return; const deletedUser = activeUser()?.id; await backend('/api/account', null, 'DELETE'); if (deletedUser)
                forgetLearningAccount(deletedUser); closeModal(); saveSession(null); S.draft = null; S.quizzes = []; S.reports = []; S.dirty = false; location.hash = '#'; home(); toast('Your account and data have been deleted.'); }
        } };
}
