import { $ } from '../../core/dom.js';
export function createFeaturesLivePinPlacement(context) {
    const S = context.state;
    const markDirty = (...args) => context.markDirty(...args);
    function onPinClick(event) {
        const pin = event.target.closest('#editor-pin, #player-pin');
        if (!pin)
            return;
        const box = pin.getBoundingClientRect(), point = { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
        if (pin.id === 'player-pin' && (!S.connected || $('img', pin)?.dataset.ready !== 'true'))
            return;
        if (pin.id === 'editor-pin') {
            S.draft.questions[S.questionIndex].target = point;
            markDirty();
        }
        else {
            if (S.answerSent || S.answerPending || S.roomState?.phase !== 'question')
                return;
            S.pin = point;
            const submit = $('[data-action="submit-pin"]');
            if (submit)
                submit.disabled = false;
        }
        let marker = $('.pin-dot', pin);
        if (!marker) {
            marker = document.createElement('span');
            marker.className = 'pin-dot' + (pin.id === 'editor-pin' ? ' target' : '');
            pin.append(marker);
        }
        marker.style.left = point.x * 100 + '%';
        marker.style.top = point.y * 100 + '%';
    }
    return { clicks: [onPinClick] };
}
