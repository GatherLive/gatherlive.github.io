import { $ } from '../../core/dom.js';
export function createFeaturesLibraryChanges(context) {
    const S = context.state;
    const quizCards = (...args) => context.quizCards(...args);
    async function onChange(event) { const el = event.target; if (el.id === 'collection-filter') {
        S.filter = el.value;
        $('#quiz-list').innerHTML = quizCards();
        return true;
    } return false; }
    return { changes: [onChange] };
}
