import { $ } from '../../core/dom.js';
export function createFeaturesAccountEvents(context) {
    const S = context.state;
    function onInput(event) { const el = event.target; if (el.id === 'delete-confirm') {
        $('#delete-account-button').disabled = el.value !== 'DELETE';
        return true;
    } return false; }
    return { inputs: [onInput] };
}
