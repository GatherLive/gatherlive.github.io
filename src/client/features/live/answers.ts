import type {AppContext} from '../../app/context.js';
import { icon } from '../../core/icons.js';
import { $, $$, safeImage, esc } from '../../core/dom.js';
export function createFeaturesLiveAnswers(context: AppContext) {
    const S = context.state;
    const send = (...args) => context.send(...args);
    const toast = (...args) => context.toast(...args);
    const roomImage = (...args) => context.roomImage(...args);
    const dragHandle = (...args) => context.dragHandle(...args);
    function answerStatus(q, isHost = false) {
        if (isHost || q.type === 'slide')
            return '';
        return `<div class="live-answer-status" role="status">${S.answerSent ? `<div class="answer-result neutral">${icon('check', 19)} Answer received</div>` : S.answerPending ? '<p class="answer-note"><span class="spinner"></span> Sending…</p>' : ['multi', 'order', 'pin'].includes(q.type) ? `<p class="answer-note">${q.type === 'multi' ? 'Select all correct answers' : q.type === 'order' ? 'Arrange in order' : 'Tap a location'}</p>` : ''}</div>`;
    }
    function refreshAnswerUI() {
        const st = S.roomState, q = st?.question, section = $('.live-question');
        if (st?.phase !== 'question' || !q || !section || S.room?.role === 'host')
            return;
        const blocked = !S.connected || S.answerSent || S.answerPending || section.getAttribute('aria-busy') === 'true';
        $$('[data-action="choose-answer"]', section).forEach(el => { const selected = Array.isArray(S.selection) ? S.selection.includes(el.dataset.id) : S.selection === el.dataset.id; el.classList.toggle('selected', selected); el.setAttribute('aria-pressed', String(selected)); el.disabled = blocked; const mark = $('.option-mark', el); if (mark)
            mark.textContent = selected ? '●' : ''; });
        $$('[data-action^="submit-"],.text-answer button,#player-text,#player-slider,[data-reorder-handle],[data-action="player-order"]', section).forEach(el => {
            const action = el.dataset.action;
            el.disabled = blocked || (action === 'submit-multi' && !(S.selection as string[])?.length) || (action === 'submit-pin' && !S.pin) || (action === 'player-order' && (Number(el.dataset.index) + Number(el.dataset.direction) < 0 || Number(el.dataset.index) + Number(el.dataset.direction) >= S.order.length));
        });
        const status = $('.live-answer-status', section);
        if (status) {
            const next = document.createElement('template');
            next.innerHTML = answerStatus(q);
            if (status.innerHTML !== next.content.firstElementChild.innerHTML)
                status.innerHTML = next.content.firstElementChild.innerHTML;
        }
    }
    function sendAnswer(answer) {
        if (!S.connected || S.answerSent || S.answerPending || S.roomState?.phase !== 'question')
            return;
        const questionId = S.roomState.question.id, attempt = S.answerAttempt = (S.answerAttempt || 0) + 1;
        S.selection = answer;
        S.answerPending = true;
        if (send({ type: 'answer', questionId, answer })) {
            refreshAnswerUI();
            setTimeout(() => { if (S.answerPending && S.answerAttempt === attempt && S.roomState?.question?.id === questionId) {
                S.answerPending = false;
                refreshAnswerUI();
                toast('Your answer has not been confirmed. Tap to retry.', true);
            } }, 7000);
        }
        else {
            S.answerPending = false;
            refreshAnswerUI();
        }
    }
    function answerOption(o, i, st, isHost, answerable) {
        const q = st.question, reveal = st.phase === 'reveal', correct = reveal && st.reveal?.correct?.includes(o.id), selected = Array.isArray(S.selection) ? S.selection.includes(o.id) : S.selection === o.id;
        const dist = st.reveal?.distribution, count = dist?.[o.id] ?? 0, image = !!safeImage(o.image), lettersOnly = !isHost && !reveal && st.settings?.showAnswerOptions === false;
        const button = `<button class="answer-option ${lettersOnly ? 'letter-only' : ''} ${image ? 'image-answer' : ''} ${selected ? 'selected' : ''} ${correct ? 'correct-answer' : reveal && selected && !correct && q.type !== 'poll' ? 'wrong-answer' : ''}" ${!answerable ? 'disabled' : ''} data-action="choose-answer" data-id="${esc(o.id)}" aria-pressed="${selected}" aria-label="${esc((reveal && correct ? 'Correct: ' : '') + (o.text || 'Answer ' + String.fromCharCode(65 + i)))}"><span class="option-letter">${String.fromCharCode(65 + i)}</span><span class="option-body">${esc(o.text)}${reveal && count ? `<span class="small muted" style="display:block;margin-top:6px">${count} answer${count === 1 ? '' : 's'}</span>` : ''}</span>${correct ? '<span class="answer-check">✓</span>' : selected ? '<span class="option-mark" style="color:var(--accent)">●</span>' : isHost ? `<span class="kbd">${i + 1}</span>` : '<span class="option-mark"></span>'}${image ? roomImage(o.image, 'answer-option-image', o.text || 'Answer ' + String.fromCharCode(65 + i)) : ''}${reveal && count ? `<span class="distribution" style="width:${Math.round(count / Math.max(1, st.answerCount) * 100)}%"></span>` : ''}</button>`;
        return image ? `<div class="answer-card">${button}<button type="button" class="answer-zoom" data-action="zoom-answer" aria-label="Enlarge answer ${String.fromCharCode(65 + i)} image">${icon('expand', 17)}</button></div>` : button;
    }
    function orderView(q, st, isHost, answerable) {
        const ids = st.phase === 'reveal' ? (st.reveal?.correct || S.order) : S.order;
        return `<div class="order-list" ${answerable ? 'data-reorder-list="player-order"' : ''}>${ids.map((id, i) => { const o = q.options.find(x => x.id === id); return `<div class="order-item" ${answerable ? `data-reorder-item="${esc(id)}"` : ''}>${answerable ? dragHandle('answer ' + (i + 1)) : ''}<span class="question-number">${i + 1}</span><span class="order-text">${esc(o?.text || '')}${safeImage(o?.image) ? roomImage(o.image, 'order-option-image', o.text || 'Answer image') : ''}</span>${answerable ? `<div class="row" style="gap:2px"><button class="icon-btn" data-action="player-order" data-index="${i}" data-direction="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(o?.text)} up">↑</button><button class="icon-btn" data-action="player-order" data-index="${i}" data-direction="1" ${i === ids.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(o?.text)} down">↓</button></div>` : ''}</div>`; }).join('')}</div>${answerable ? '<button class="btn primary" data-action="submit-order">Submit order</button>' : ''}`;
    }
    function sliderView(q, st, isHost, answerable) {
        const v = typeof S.selection === 'number' ? S.selection : (q.min + q.max) / 2;
        if (isHost || st.phase === 'reveal')
            return `<div class="range-answer"><output>${st.phase === 'reveal' ? esc(st.reveal?.target ?? '—') : `${q.min} — ${q.max}`}</output><p class="small muted">${st.phase === 'reveal' ? 'Correct number' : 'Range'}</p></div>`;
        return `<div class="range-answer"><output id="slider-output">${esc(v)}</output><input type="range" min="${q.min}" max="${q.max}" step="${(q.max - q.min) < 10 ? .1 : 1}" value="${v}" id="player-slider" aria-label="Your number" ${!answerable ? 'disabled' : ''}><div class="range-labels"><span>${q.min}</span><span>${q.max}</span></div>${answerable ? '<button class="btn primary" data-action="submit-slider">Submit</button>' : ''}</div>`;
    }
    function pinView(q, st, isHost, answerable) {
        const target = st.phase === 'reveal' ? st.reveal?.target : S.pin;
        return `<div class="pin-area" ${answerable ? 'id="player-pin"' : ''}>${roomImage(q.image, 'pin-question-image', answerable ? 'Tap to choose your location' : 'Question image')}${target && typeof target === 'object' ? `<span class="pin-dot ${st.phase === 'reveal' ? 'target' : ''}" style="left:${target.x * 100}%;top:${target.y * 100}%"></span>` : ''}</div>${answerable ? `<div style="margin-top:20px"><button class="btn primary" data-action="submit-pin" ${!S.pin ? 'disabled' : ''}>Submit</button></div>` : ''}`;
    }
    function textAnswerView(q, st, isHost, answerable) {
        if (isHost)
            return `<p class="answer-note">${q.type === 'short_answer' ? 'Waiting for answers' : 'Waiting for responses'}</p>`;
        if (!answerable)
            return S.selection ? `<p class="subtle" style="margin:20px">Your answer: ${esc(S.selection)}</p>` : '';
        const input = q.type === 'open_ended' ? `<textarea id="player-text" class="input" maxlength="1000" placeholder="Your answer…" required>${esc(S.selection || '')}</textarea>` : `<input id="player-text" class="input" maxlength="${q.type === 'word_cloud' ? 60 : 200}" placeholder="${q.type === 'word_cloud' ? 'A word or two…' : 'Your answer…'}" value="${esc(S.selection || '')}" autocomplete="off" required>`;
        return `<form id="text-answer-form" class="text-answer"><div class="field"><label class="sr-only" for="player-text">Your answer</label>${input}</div><button type="submit" class="btn primary full">Submit ${icon('arrow', 15)}</button></form>`;
    }
    return { answerStatus, refreshAnswerUI, sendAnswer, answerOption, orderView, sliderView, pinView, textAnswerView };
}
