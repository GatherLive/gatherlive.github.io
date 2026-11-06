import type {AppContext} from '../../app/context.js';
import { $$, $, esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
export function createFeaturesChatAccess(context: AppContext) {
    const S = context.state;
    const activeUser = (...args) => context.activeUser(...args);
    const backend = (...args) => context.backend(...args);
    const toast = (...args) => context.toast(...args);
    let inFlight=null;
    function rememberChatAccess(result){const owner=activeUser()?.id;if(owner)S.chatAccessCache={owner,checkedAt:Date.now(),...result};}
    function cachedAccountChatView(){const cached=S.chatAccessCache;return cached?.owner===activeUser()?.id?accountChatView(cached.unlocked,'',cached.application):accountChatView();}
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
            rememberChatAccess(result);
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
            return `<p class="account-chat-status">${icon('check', 17)} Chat unlocked</p>`;
        return `<form id="account-chat-form"><div class="field"><label for="account-chat-code">12-digit invitation code</label><input id="account-chat-code" type="password" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" placeholder="••••••••••••" required></div><div id="account-chat-error" role="alert"></div><div class="chat-access-actions"><button class="btn primary" type="submit">${icon('lock', 16)} Unlock chat</button>${chatApplicationControls(application)}</div><p class="small muted" data-chat-application-note hidden></p></form>`;
    }
    async function loadAccountChat({force=false}={}) {
        const owner=activeUser()?.id,cached=S.chatAccessCache;
        if(!owner)return false;
        if(!force&&cached?.owner===owner&&Date.now()-cached.checkedAt<(cached.application?.status==='pending'?15000:300000))return true;
        if(inFlight?.owner===owner)return inFlight.promise;
        const promise=(async()=>{
            try{
                const result=await backend('/api/account/chat',null,'GET');if(activeUser()?.id!==owner)return false;
                rememberChatAccess(result);updateChatApplication(result.application);
                if(['#account','#settings/account'].includes(location.hash.split('?')[0])&&$('#account-chat-content'))$('#account-chat-content').innerHTML=accountChatView(result.unlocked===true,'',result.application);
                return true;
            }catch(error){if(activeUser()?.id===owner&&$('#account-chat-content')&&!cached)$('#account-chat-content').innerHTML=accountChatView(null,error.message);return false;}
        })();inFlight={owner,promise};try{return await promise;}finally{if(inFlight?.promise===promise)inFlight=null;}
    }
    return { rememberChatAccess,cachedAccountChatView,chatApplicationControls, updateChatApplication, applyForChat, accountChatView, loadAccountChat };
}
