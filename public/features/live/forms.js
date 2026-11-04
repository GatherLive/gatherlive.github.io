import { $ } from '../../core/dom.js';
export function createFeaturesLiveForms(context) {
    const S = context.state;
    const sendAnswer = (...args) => context.sendAnswer(...args);
    const send = (...args) => context.send(...args);
    return { forms: { "text-answer-form": { submit: async (form) => { const answer = $('#player-text').value.trim(); if (answer)
                    sendAnswer(answer); }, afterSubmit: () => context.refreshAnswerUI() }, "draw-form": { submit: async (form) => { send({ type: 'draw', mode: $('#draw-mode').value, count: Number($('#draw-count').value) }); } } } };
}
