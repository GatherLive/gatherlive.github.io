import { $$, $, esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
export function createFeaturesChatAccess(context) {
    const S = context.state;
    const activeUser = (...args) => context.activeUser(...args);
    const backend = (...args) => context.backend(...args);
    const toast = (...args) => context.toast(...args);
    function chatApplicationControls(application = null) {
        const pending = application?.status === 'pending', waiting = application?.status === 'declined' && application.retryAt > Date.now();
        return `<button class="btn ghost" type="button" data-action="apply-chat" data-apply-chat ${pending || waiting ? 'disabled' : ''}>${pending ? 'Request pending' : waiting ? 'Request declined' : 'Apply for chat access'}</button>`;
    }
    function updateChatApplication(application) {
        S.chatApplication = application;
        S.chatApplicationOwner = activeUser()?.id;
        for (const button of $$('[data-apply-chat]')) {
            const pending = application?.status === 'pending', waiting = application?.status === 'declined' && application.retryAt > Date.now();
            button.disabled = pending || waiting;
            button.textContent = pending ? 'Request pending' : waiting ? 'Request declined' : 'Apply for chat access';
            button.title = waiting ? 'You can apply again on ' + new Date(application.retryAt).toLocaleDateString() : '';
        }
        for (const note of $$('[data-chat-application-note]')) {
            note.textContent = application?.status === 'declined' ? 'Request declined.' + (application.retryAt > Date.now() ? ' You can apply again on ' + new Date(application.retryAt).toLocaleDateString() + '.' : ' You can apply again.') : '';
            note.hidden = !note.textContent;
        }
        S.chat?.refresh();
    }
    async function applyForChat(button) {
        const userId = activeUser()?.id;
        if (!userId)
            throw new Error('Please sign in to apply.');
        button.disabled = true;
        try {
            const result = await backend('/api/account/chat/request', {});
            if (activeUser()?.id !== userId)
                return;
            updateChatApplication(result.application);
            S.chat?.refresh();
            if (result.unlocked) {
                if ($('#account-chat-content'))
                    $('#account-chat-content').innerHTML = accountChatView(true);
                toast('Chat is already unlocked.');
            }
            else
                toast('Request sent.');
        }
        catch (error) {
            button.disabled = false;
            throw error;
        }
    }
    function accountChatView(unlocked = null, error = '', application = null) {
        if (error)
            return `<div class="error-note" role="alert">${esc(error)}</div><button class="btn" data-action="account-chat-refresh">Try again</button>`;
        if (unlocked === null)
            return '<p class="muted"><span class="spinner"></span> Loading…</p>';
        if (unlocked)
            return `<p class="account-chat-status">${icon('check', 17)} Chat unlocked</p><p class="small muted">Available for all your quizzes.</p>`;
        return `<form id="account-chat-form"><div class="field"><label for="account-chat-code">12-digit invitation code</label><input id="account-chat-code" type="password" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" placeholder="••••••••••••" required></div><div id="account-chat-error" role="alert"></div><div class="chat-access-actions"><button class="btn primary" type="submit">${icon('lock', 16)} Unlock chat</button>${chatApplicationControls(application)}</div><p class="small muted" data-chat-application-note hidden></p></form>`;
    }
    async function loadAccountChat() {
        const ownerId = activeUser()?.id;
        try {
            const result = await backend('/api/account/chat', null, 'GET');
            if (location.hash === '#account' && activeUser()?.id === ownerId && $('#account-chat-content')) {
                $('#account-chat-content').innerHTML = accountChatView(result.unlocked === true, '', result.application);
                updateChatApplication(result.application);
            }
        }
        catch (error) {
            if (location.hash === '#account' && activeUser()?.id === ownerId && $('#account-chat-content'))
                $('#account-chat-content').innerHTML = accountChatView(null, error.message);
        }
    }
    return { chatApplicationControls, updateChatApplication, applyForChat, accountChatView, loadAccountChat };
}
