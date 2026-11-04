import { $ } from '../../core/dom.js';
export function createFeaturesLiveEvents(context) {
    const S = context.state;
    function onInput(event) {
        const el = event.target;
        if (el.id === 'player-slider') {
            S.selection = Number(el.value);
            $('#slider-output').textContent = el.value;
            return true;
        }
        if (el.id === 'player-text') {
            S.selection = el.value;
            return true;
        }
        return false;
    }
    function onKeydown(event) {
        if (S.room?.role === 'player' && S.roomState?.phase === 'question' && !S.answerSent && !S.answerPending && /^[1-8]$/.test(event.key)) {
            const q = S.roomState.question;
            if (!['single', 'multi', 'true_false', 'poll'].includes(q.type))
                return true;
            const o = q.options[Number(event.key) - 1];
            if (o) {
                event.preventDefault();
                const el = $(`[data-action="choose-answer"][data-id="${o.id}"]`);
                el?.click();
            }
        }
        return false;
    }
    return { inputs: [onInput], keys: [onKeydown] };
}
