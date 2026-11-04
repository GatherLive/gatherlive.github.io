import { $ } from '../../core/dom.js';
export function createFeaturesChatEvents(context) {
    const S = context.state;
    function onInput(event) {
        const el = event.target;
        if (el.id === 'chat-input') {
            if (S.chat)
                S.chat.mentions.input(el, event.isComposing);
            el.style.height = 'auto';
            el.style.height = Math.min(140, el.scrollHeight) + 'px';
            return true;
        }
        if (el.id === 'announcement-text') {
            const error = $('#form-error'); if (error) error.textContent = ''; return true;
        }
        if (['chat-unlock-code', 'account-chat-code'].includes(el.id)) {
            el.value = el.value.replace(/\D/g, '').slice(0, 12);
            return true;
        }
        return false;
    }
    function onKeydown(event) {
        if (S.chat?.mentions.keydown(event)) return true;
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.target.id === 'chat-input') {
            event.preventDefault();
            if (!S.chat?.sending && event.target.value.trim())
                $('#chat-form')?.requestSubmit();
            return true;
        }
        if (event.key === 'Escape' && S.chat?.open && (S.chat.menuFor || S.chat.emojiFor)) {
            S.chat.menuFor = null;
            S.chat.emojiFor = null;
            S.chat.refresh();
            return true;
        }
        if (event.key === 'Escape' && S.chat?.open) {
            S.chat.close();
            S.chat.refresh();
            document.querySelector('.chat-launch')?.focus();
            return true;
        }
        return false;
    }
    return { inputs: [onInput], keys: [onKeydown] };
}
