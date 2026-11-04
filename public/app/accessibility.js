import { $, $$ } from '../core/dom.js';
export function createAppAccessibility(context) {
    const S = context.state;
    const closeModal = (...args) => context.closeModal(...args);
    function onKeydown(event) {
        if (event.key === 'Escape' && $('.modal')) {
            closeModal();
            return true;
        }
        if (event.key === 'Tab' && ($('.modal') || $('.chat-panel'))) {
            const all = $$('button:not(:disabled),input:not(:disabled),select,a[href],textarea:not(:disabled)', $('.modal') || $('.chat-panel'));
            const first = all[0], last = all[all.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                last?.focus();
                event.preventDefault();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                first?.focus();
                event.preventDefault();
            }
        }
        if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || $('.modal') || $('.chat-panel'))
            return true;
        return false;
    }
    return { keys: [onKeydown] };
}
