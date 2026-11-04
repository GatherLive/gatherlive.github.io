import { $ } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
export function createFeaturesEditorEvents(context) {
    const S = context.state;
    const markDirty = (...args) => context.markDirty(...args);
    function onInput(event) {
        const el = event.target;
        if (!S.draft)
            return true;
        if (el.dataset.rfield) {
            const round = S.draft.settings.rounds.find(r => r.id === el.dataset.roundId);
            if (round) {
                round[el.dataset.rfield] = el.value;
                markDirty();
            }
            return true;
        }
        if (el.dataset.dfield) {
            S.draft[el.dataset.dfield] = el.value;
            markDirty();
        }
        if (el.dataset.sfield) {
            S.draft.settings[el.dataset.sfield] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(0, Math.floor(Number(el.value))) : el.value;
            markDirty();
        }
        const q = S.draft.questions[S.questionIndex];
        if (!q)
            return true;
        if (el.dataset.qfield && el.dataset.qfield !== 'type') {
            const key = el.dataset.qfield;
            q[key] = key === 'acceptedAnswers' ? el.value.split('\n').map(s => s.trim()).filter(Boolean) : ['min', 'max', 'target', 'tolerance', 'timeLimit', 'points'].includes(key) ? Number(el.value) : el.value;
            markDirty();
            const label = $('.question-item.active strong'), meta = $('.question-item.active small');
            if (label)
                label.textContent = q.prompt || 'Your next question';
            if (meta)
                meta.textContent = `${TYPES[q.type]} · ${q.timeLimit}s`;
        }
        if (el.dataset.option) {
            const option = q.options.find(o => o.id === el.dataset.option);
            if (option) {
                option[el.dataset.ofield] = el.value;
                markDirty();
            }
        }
        if (el.hasAttribute('data-pin-tolerance')) {
            q.tolerance = Number(el.value) / 100;
            markDirty();
        }
        return false;
    }
    return { inputs: [onInput] };
}
