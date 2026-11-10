import type {AppContext} from '../../app/context.js';

/** Copy deterrents for the active participant view; authorization stays on the server. */
export function createRoomContentGuard(context: AppContext) {
    const active = () => context.state.room?.role === 'player' && context.state.roomState?.phase === 'question';
    function protectedTarget(value: EventTarget | Node | null): boolean {
        const element = value instanceof Element ? value : value instanceof Node ? value.parentElement : null;
        return !!element?.closest('.live-question') && !element.closest('input,textarea,[contenteditable="true"]');
    }
    function updateContentProtection() {document.documentElement.classList.toggle('quiz-content-protected', active());}
    function bindContentProtection() {
        document.addEventListener('copy', event => {
            if (active() && (protectedTarget(event.target) || protectedTarget(window.getSelection()?.anchorNode))) event.preventDefault();
        });
        for (const name of ['contextmenu', 'dragstart', 'selectstart']) document.addEventListener(name, event => {
            if (active() && protectedTarget(event.target)) event.preventDefault();
        });
    }
    return {updateContentProtection, bindContentProtection};
}
