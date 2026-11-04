import { $ } from '../../core/dom.js';
export function createFeaturesAccountForms(context) {
    const S = context.state;
    const backend = (...args) => context.backend(...args);
    const accountChatView = (...args) => context.accountChatView(...args);
    const toast = (...args) => context.toast(...args);
    const authRequest = (...args) => context.authRequest(...args);
    const getToken = (...args) => context.getToken(...args);
    return { forms: { "account-chat-form": { submit: async (form) => {
                    await backend('/api/account/chat', { code: $('#account-chat-code').value });
                    if ($('#account-chat-content'))
                        $('#account-chat-content').innerHTML = accountChatView(true);
                    toast('Chat unlocked.');
                }, errorTarget: '#account-chat-error' }, "password-form": { submit: async (form) => { await authRequest('user', { password: $('#new-password').value }, 'PUT', await getToken()); form.reset(); toast('Your password has been updated.'); } } } };
}
