export function createFeaturesJoinEvents(context) {
    const S = context.state;
    function onInput(event) { const el = event.target; if (el.id === 'join-code') {
        el.value = el.value.replace(/\D/g, '').slice(0, 6);
        return true;
    } return false; }
    return { inputs: [onInput] };
}
