import { $ } from '../../core/dom.js';
export function createFeaturesLibraryEvents(context) {
    const S = context.state;
    const quizCards = (...args) => context.quizCards(...args);
    function onInput(event) { const el = event.target; if (el.id === 'quiz-search') {
        S.search = el.value;
        $('#quiz-list').innerHTML = quizCards();
        return true;
    } return false; }
    return { inputs: [onInput] };
}
