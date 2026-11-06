import type {AppContext} from '../../app/context.js';
import { $ } from '../../core/dom.js';
export function createFeaturesLibraryEvents(context: AppContext) {
    const S = context.state;
    const quizCards = (...args) => context.quizCards(...args);
    function onInput(event) { const el = event.target; if (el.id === 'quiz-search') {
        S.search = el.value;
        $('[data-action=toggle-quiz-search]')?.classList.toggle('has-filter',!!S.search);
        $('#quiz-list').innerHTML = quizCards();
        return true;
    } return false; }
    return { inputs: [onInput] };
}
