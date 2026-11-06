import type {AppContext} from './context.js';
import { $, esc } from '../core/dom.js';
export function createAppEvents(context: AppContext) {
    const S = context.state;
    const closeModal = (...args) => context.closeModal(...args);
    const toast = (...args) => context.toast(...args);
    const refreshAnswerUI = (...args) => context.refreshAnswerUI(...args);
    const updateChatApplication = (...args) => context.updateChatApplication(...args);
    const updateTimer = (...args) => context.updateTimer(...args);
    const route = (...args) => context.route(...args);
    const fitChoiceQuestion = (...args) => context.fitChoiceQuestion(...args);
    const openSocket = (...args) => context.openSocket(...args);
    const updateConnection = (...args) => context.updateConnection(...args);
    const loadAccountChat = (...args) => context.loadAccountChat(...args);
    function bindEvents() {
        const actions = context.actions;
        document.addEventListener('click', async (event) => {
            if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
                closeModal();
                return;
            }
            const el = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
            if (!el || el.disabled)
                return;
            if (S.chat?.handleAction(el.dataset.action, el)) {
                event.preventDefault();
                return;
            }
            const action = actions[el.dataset.action];
            if (!action)
                return;
            event.preventDefault();
            try {
                const result = /^(?:refresh-|account-chat-refresh$)/.test(el.dataset.action)?context.refreshFeedback(el,()=>action(el)):action(el);
                if (result && typeof result.then === 'function') {
                    el.disabled = true;
                    await result;
                }
            }
            catch (error) {
                toast(error.message || 'Something went wrong. Please try again.', true);
                if (el.dataset.action === 'confirm-delete-report' && $('#delete-report-error'))
                    $('#delete-report-error').textContent = error.message || 'Could not delete these results. Please try again.';
                if (el.dataset.action === 'confirm-delete-account' && $('#delete-error'))
                    $('#delete-error').innerHTML = `<div class="error-note">${esc(error.message)}</div>`;
            }
            finally {
                if (el.isConnected) {
                    if (el.closest('.live-question'))
                        refreshAnswerUI();
                    else if (el.dataset.action === 'apply-chat')
                        updateChatApplication(S.chatApplication);
                    else if (el.dataset.action === 'clear-quiz-filters')
                        context.syncQuizFilters();
                    else if (!['submit-multi', 'submit-pin'].includes(el.dataset.action))
                        el.disabled = false;
                }
            }
        });
        document.addEventListener('input', event => { for (const handle of context.inputs)
            if (handle(event))
                break; });
        document.addEventListener('change', async (event) => { const el = event.target as HTMLInputElement; try {
            for (const handle of context.changes)
                if (await handle(event))
                    break;
        }
        catch (error) {
            context.toast(error.message, true);
            el.disabled = false;
        } });
        for (const handle of context.clicks)
            document.addEventListener('click', handle);
        document.addEventListener('submit', async (event) => {
            const form = event.target as HTMLFormElement, descriptor = context.forms[form.id];
            if (!descriptor)
                return;
            event.preventDefault();
            if (descriptor.ownFeedback) {
                try {
                    await descriptor.submit(form);
                }
                catch (error) {
                    context.toast(error.message, true);
                }
                return;
            }
            const button = form.querySelector<HTMLButtonElement>('button[type="submit"]'), original = button?.innerHTML;
            if (button) {
                button.disabled = true;
                button.innerHTML = '<span class="spinner"></span> Loading…';
            }
            try {
                await descriptor.submit(form);
            }
            catch (error) {
                const message = descriptor.onError?.(error) || error.message;
                const target = document.querySelector<HTMLElement>(descriptor.errorTarget || '#form-error');
                if (target)
                    target.innerHTML = '<div class="error-note">' + context.escapeForError(message) + '</div>';
                else
                    context.toast(message, true);
            }
            finally {
                if (button?.isConnected) {
                    button.innerHTML = original;
                    if (descriptor.afterSubmit)
                        descriptor.afterSubmit();
                    else
                        button.disabled = false;
                }
            }
        });
        document.addEventListener('keydown', event => { for (const handle of context.keys)
            if (handle(event))
                break; });
        setInterval(updateTimer, 250);
        window.addEventListener('hashchange', () => route().catch(error => toast(error.message, true)));
        window.addEventListener('resize', fitChoiceQuestion);
        window.visualViewport?.addEventListener('resize', fitChoiceQuestion);
        document.fonts?.ready.then(fitChoiceQuestion);
        window.addEventListener('beforeunload', event => { if (S.dirty) {
            event.preventDefault();
            event.returnValue = '';
        } });
        window.addEventListener('online', () => { if (S.room && !S.fatalRoomError) {
            S.retries = 1;
            void openSocket();
        } });
        window.addEventListener('offline', () => { if (S.room && !S.fatalRoomError) {
            S.connected = false;
            S.connectionStatus = 'offline';
            clearTimeout(S.reconnectTimer);
            clearInterval(S.heartbeat);
            clearTimeout(S.connectTimeout);
            S.wsGeneration++;
            const ws = S.ws;
            S.ws = null;
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
            updateConnection();
        } });
        setInterval(() => { if (!document.hidden && ['#account','#settings/account'].includes(location.hash.split('?')[0]) && S.chatApplication?.status === 'pending' && !document.activeElement?.closest('#account-chat-form'))
            void loadAccountChat(); }, 20000);
    }
    return { bindEvents };
}
