import type {AppContext} from '../../app/context.js';
import { $ } from '../../core/dom.js';
import { TYPES } from '../../core/quiz-types.js';
import {secretChoiceLabel} from './competition.js';
export function createFeaturesEditorEvents(context: AppContext) {
    const S = context.state;
    function onInput(event) {
        const el = event.target;
        const markDirty = () => context.markDirty(el);
        if (!S.draft)
            return false;
        if (el.dataset.competitionSetting === 'lives') {
            const settings = S.draft.settings.competition ??= {lives: 3};
            settings.lives = el.value === '' ? NaN : Number(el.value);
            markDirty();
            return true;
        }
        const teams = S.draft.settings.competition?.teams;
        const team = el.dataset.teamSetting;
        if (teams && (team === 'a' || team === 'b')) {
            teams[team] = el.value === '' ? NaN : Number(el.value);
            markDirty();
            return true;
        }
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
            return false;
        if (el.dataset.questionCompetition === 'secretAnswer' && q.competition?.mode === 'avoid-host' && el.tagName === 'INPUT') {
            q.competition.secretAnswer = el.value;
            markDirty();
            return true;
        }
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
                if (el.dataset.ofield === 'text' && q.competition?.mode === 'avoid-host') {
                    const secret = $<HTMLSelectElement>('select#competition-secret');
                    const choice = secret && Array.from(secret.options).find(item => item.value === option.id);
                    if (choice) choice.textContent = secretChoiceLabel(option.text, q.options.indexOf(option));
                }
                markDirty();
            }
        }
        return false;
    }
    return { inputs: [onInput] };
}
