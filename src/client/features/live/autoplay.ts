import type {AppContext} from '../../app/context.js';
import type {AutoplayOptions, DataRecord} from '../../../shared/types.js';
import {$, uid} from '../../core/dom.js';
import {icon} from '../../core/icons.js';

const PREFERENCES_KEY = 'gather.autoplay.timing';
const MINUTE_MS = 60000;

function timeFieldValue(at: number) {
    const date = new Date(at);
    return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
}

export function nextStartTime(value: string, now: number, latestStartAt: number) {
    if (!Number.isFinite(latestStartAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
    const [hours, minutes] = value.split(':').map(Number);
    const firstMinute = Math.floor(now / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
    const date = new Date(firstMinute);
    // Follow elapsed minutes so the next occurrence is found when clocks repeat an hour.
    for (let at = firstMinute; at < latestStartAt; at += MINUTE_MS) {
        date.setTime(at);
        if (date.getHours() === hours && date.getMinutes() === minutes) return at;
    }
    return NaN;
}

function countdownText(at: number, now: number, label: string) {
    const seconds = Math.max(0, Math.ceil((at - now) / 1000));
    if (!seconds) return label === 'Starts in' ? 'Waiting to start' : 'Continuing…';
    const minutes = Math.floor(seconds / 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    const time = minutes >= 60 ? Math.floor(minutes / 60) + ':' + pad(minutes % 60) : String(minutes);
    return label + ' ' + time + ':' + pad(seconds % 60);
}

export function autoplayTimerMarkup(state: DataRecord, now: number) {
    const auto = state?.autoplay;
    if (auto?.status !== 'running') return '';
    const lobby = state.phase === 'lobby';
    const at = lobby ? auto.startsAt : ['reveal', 'round_results'].includes(state.phase) ? auto.nextAt : null;
    if (!Number.isFinite(at)) return '';
    const label = lobby ? 'Starts in' : 'Next in';
    return `<span class="room-autoplay-timer" role="timer" data-autoplay-at="${at}" data-autoplay-label="${label}">
        ${icon('clock', 15)} <span>${countdownText(at, now, label)}</span>
    </span>`;
}

export function tickAutoplayTimer(now: number, state: DataRecord | null) {
    const timer = $<HTMLElement>('[data-autoplay-at]');
    const label = timer?.lastElementChild;
    if (label) {
        const text = countdownText(Number(timer.dataset.autoplayAt), now, timer.dataset.autoplayLabel);
        if (label.textContent !== text) label.textContent = text;
    }

    const estimate = $<HTMLElement>('#autoplay-estimate');
    if (!estimate) return;
    const auto = state?.autoplay;
    const finishAt = auto?.estimatedFinishAt;
    estimate.hidden = auto?.status !== 'running' || !Number.isFinite(finishAt);
    if (estimate.hidden) return;

    // A scheduled room can wait for players after its start time.
    const estimateNow = state.phase === 'lobby' ? Math.min(now, Math.max(state.serverNow, auto.startsAt ?? 0)) : now;
    const seconds = Math.ceil(Math.max(0, finishAt - estimateNow) / 1000);
    const minutes = Math.floor(seconds / 60);
    const text = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
        : minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    const value = estimate.lastElementChild;
    if (value.textContent !== text) value.textContent = text;
}

function rememberedTiming(key: string): AutoplayOptions | null {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (saved && validTiming(saved)) {
            const {questionWait, roundWait, questionDelay, finishWhenAnswered} = saved;
            return {questionWait, roundWait, questionDelay, finishWhenAnswered};
        }
    } catch {}
    return null;
}

function validTiming(options: AutoplayOptions) {
    const valid = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
    return typeof options.finishWhenAnswered === 'boolean' && valid(options.questionWait, 0, 3600) &&
        valid(options.roundWait, 5, 3600) && valid(options.questionDelay, 0, 30);
}

function durationField(name: string, label: string, seconds: number, hint = '') {
    const minutes = seconds >= 60 && seconds % 60 === 0;
    return `<div class="autoplay-field">
        <label for="${name}">${label}${hint ? `<small class="autoplay-hint">${hint}</small>` : ''}</label>
        <div class="autoplay-duration">
            <input class="input" id="${name}" name="${name}" type="number" inputmode="numeric" min="0" step="1" value="${minutes ? seconds / 60 : seconds}" required>
            <select class="input" name="${name}-unit" aria-label="${label} unit"><option value="1">Seconds</option><option value="60"${minutes ? ' selected' : ''}>Minutes</option></select>
        </div>
    </div>`;
}

function duration(form: FormData, name: string) {
    return Number(form.get(name)) * Number(form.get(name + '-unit'));
}

export function createFeaturesAutoplay(context: AppContext) {
    const S = context.state;
    const timingKey = () => PREFERENCES_KEY + (S.roomState?.study ? '.study' : '');
    let pending: {id: string; timer: ReturnType<typeof setTimeout>; finish: (message?: string) => void} | null = null;
    const canControl = () => S.room?.role === 'host' && S.connected && S.roomState?.autoplay && S.roomState.phase !== 'finished';
    function playbackTiming(): AutoplayOptions {
        const auto = S.roomState?.autoplay;
        const fallback = auto?.options ?? {questionWait: 5, roundWait: 15, questionDelay: S.roomState?.settings?.questionDelay ?? 3, finishWhenAnswered: !!S.roomState?.study};
        const saved = auto?.status === 'off' && rememberedTiming(timingKey());
        return saved ? {...saved, finishWhenAnswered: fallback.finishWhenAnswered} : fallback;
    }
    function sendAutoplay(action: string, values = {}) {
        if (!canControl()) return Promise.reject(new Error('Reconnect to change Autoplay.'));
        if (pending) return Promise.reject(new Error('Autoplay is updating.'));
        const id = uid();
        return new Promise<void>((resolve, reject) => {
            const finish = (message?: string) => {
                clearTimeout(pending?.timer);
                pending = null;
                if (message) reject(new Error(message));
                else resolve();
            };
            const timer = setTimeout(() => finish('Autoplay did not confirm. Check your room and try again.'), 8000);
            pending = {id, timer, finish};
            if (!context.send({type: 'autoplay', action, requestId: id, ...values}, {quiet: true})) finish('Reconnect to change Autoplay.');
        });
    }
    function receiveAutoplay(data: DataRecord) {
        if (data.type !== 'autoplay_updated' && data.scope !== 'autoplay') return false;
        if (pending && pending.id === data.requestId) {
            pending.finish(data.type === 'error' ? data.message || 'Could not update Autoplay.' : undefined);
        }
        return true;
    }
    function disposeAutoplay() {
        pending?.finish('Reconnect to change Autoplay.');
    }
    function startFields() {
        const auto = S.roomState.autoplay, scheduled = Number.isFinite(auto.startsAt);
        const now = S.clock?.now() ?? Date.now();
        const firstMinute = Math.floor(now / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
        const lastMinute = Math.floor((auto.latestStartAt - 1) / MINUTE_MS) * MINUTE_MS;
        const canPickTime = firstMinute <= lastMinute;
        const clockRange = canPickTime && new Date(firstMinute).getTimezoneOffset() === new Date(lastMinute).getTimezoneOffset();
        return `<div class="autoplay-start">
            <div class="autoplay-field autoplay-start-mode">
                <label for="autoplay-start-mode">Start</label>
                <select class="input" name="start-mode" id="autoplay-start-mode">
                    ${scheduled ? '<option value="keep">Keep scheduled time</option>' : ''}
                    <option value="now">Now</option><option value="delay">After a delay</option><option value="time" ${canPickTime ? '' : 'disabled'}>At a specific time</option>
                </select>
            </div>
            <div class="autoplay-start-option" data-autoplay-start="delay" hidden>${durationField('start-delay', 'Start after', 60)}</div>
            <div class="autoplay-start-option" data-autoplay-start="time" hidden>
                <div class="autoplay-field">
                    <label for="autoplay-start-time">Local time</label>
                    <input class="input" id="autoplay-start-time" type="time" name="start-time" aria-describedby="autoplay-start-hint" ${clockRange ? `min="${timeFieldValue(firstMinute)}" max="${timeFieldValue(lastMinute)}"` : ''} required>
                </div>
                <small class="autoplay-hint" id="autoplay-start-hint">Within 24 hours of opening the room.</small>
            </div>
        </div>`;
    }
    function updateStartFields(form: HTMLFormElement) {
        const mode = form.querySelector<HTMLSelectElement>('#autoplay-start-mode')?.value;
        form.querySelectorAll<HTMLElement>('[data-autoplay-start]').forEach(field => {
            const hidden = field.dataset.autoplayStart !== mode;
            field.hidden = hidden;
            field.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select').forEach(input => input.disabled = hidden);
        });
    }
    function openAutoplay() {
        if (!canControl()) throw new Error('Reconnect to change Autoplay.');
        const state = S.roomState, status = state.autoplay.status;
        const timing = playbackTiming();
        context.modal('Autoplay', `<form id="autoplay-form" class="autoplay-form">
            ${state.phase === 'lobby' ? startFields() : ''}
            <div class="autoplay-estimate" id="autoplay-estimate" title="Assumes full question timers and uninterrupted play." hidden>
                <span>Estimated time left</span><strong></strong>
            </div>
            <label class="room-setting-row autoplay-answer-setting" for="autoplay-finish">
                <span><strong id="autoplay-finish-label">Finish when everyone answers</strong><small id="autoplay-finish-hint">Works during manual play too.</small></span>
                <input id="autoplay-finish" type="checkbox" role="switch" aria-labelledby="autoplay-finish-label" aria-describedby="autoplay-finish-hint"${timing.finishWhenAnswered ? ' checked' : ''}>
            </label>
            <details class="autoplay-timing">
                <summary>Timing ${icon('chevron', 16)}</summary>
                <div class="autoplay-timing-fields">
                    ${durationField('question-wait', 'Between questions', timing.questionWait, '0 for no wait')}
                    ${state.settings?.roundsEnabled ? durationField('round-wait', 'Between rounds', timing.roundWait, 'At least 5 seconds') : ''}
                    <div class="autoplay-field">
                        <label for="autoplay-question-delay">Question countdown</label>
                        <div class="autoplay-duration">
                            <input class="input" type="number" name="question-delay" id="autoplay-question-delay" min="0" max="30" inputmode="numeric" value="${timing.questionDelay}" aria-describedby="autoplay-countdown-unit" required>
                            <span class="autoplay-unit" id="autoplay-countdown-unit">Seconds</span>
                        </div>
                    </div>
                    <label class="checkbox-row"><input type="checkbox" name="remember" ${rememberedTiming(timingKey()) ? 'checked' : ''}>Remember timing on this device</label>
                </div>
            </details>
            ${status !== 'off' ? `<div class="autoplay-playback">
                <button type="button" class="btn" data-action="${status === 'running' ? 'autoplay-pause' : 'autoplay-resume'}">${status === 'running' ? 'Pause' : 'Resume'}</button>
                <button type="button" class="quiet-button" data-action="autoplay-off">Use manual controls</button>
            </div>` : ''}
            <div id="autoplay-error" role="alert"></div>
            <div class="autoplay-footer">
                <button type="button" class="btn ghost" data-action="room-settings">Back to settings</button>
                <button class="btn primary" type="submit">${status === 'running' ? 'Apply timing' : status === 'paused' ? 'Apply and resume' : 'Start Autoplay'}</button>
            </div>
        </form>`);
        updateStartFields($<HTMLFormElement>('#autoplay-form'));
        tickAutoplayTimer(S.clock?.now() ?? Date.now(), S.roomState);
    }
    async function submitAutoplay(form: HTMLFormElement) {
        const data = new FormData(form);
        const preference = timingKey();
        const options = {
            questionWait: duration(data, 'question-wait'),
            roundWait: data.has('round-wait') ? duration(data, 'round-wait') : playbackTiming().roundWait,
            questionDelay: Number(data.get('question-delay')),
            finishWhenAnswered: !!form.querySelector<HTMLInputElement>('#autoplay-finish')?.checked
        };
        if (!validTiming(options)) {
            form.querySelector<HTMLDetailsElement>('.autoplay-timing').open = true;
            throw new Error('Use 0–60 minutes between questions, 5 seconds to 60 minutes between rounds, and a countdown of 0–30 seconds.');
        }
        const mode = data.get('start-mode');
        const now = S.clock?.now() ?? Date.now();
        const start = mode === 'delay' ? {mode, seconds: duration(data, 'start-delay')}
            : mode === 'time' ? {mode, at: nextStartTime(String(data.get('start-time')), now, S.roomState?.autoplay?.latestStartAt)}
            : {mode: mode || 'now'};
        if (mode === 'delay' && (!Number.isInteger(start.seconds) || start.seconds <= 0)) throw new Error('Enter a delay of at least one second.');
        if (mode === 'time' && !Number.isFinite(start.at)) throw new Error('Choose a time before this room’s 24-hour window ends.');
        await sendAutoplay('apply', {options, start});
        try {
            if (data.has('remember')) localStorage.setItem(preference, JSON.stringify(options));
            else localStorage.removeItem(preference);
        } catch {}
        context.closeModal();
    }
    async function control(action: string) {
        await sendAutoplay(action);
        if ($('#autoplay-form')) context.closeModal();
    }
    async function setAnswerReveal(input: HTMLInputElement) {
        const error = $('#autoplay-error');
        if (error) error.textContent = '';
        input.disabled = true;
        try {
            await sendAutoplay('finish-when-answered', {enabled: input.checked});
        } catch (failure) {
            input.checked = !!S.roomState?.autoplay?.options?.finishWhenAnswered;
            if (error) error.textContent = failure.message;
        } finally {
            input.disabled = false;
        }
    }
    return {
        receiveAutoplay, disposeAutoplay,
        actions: {
            'room-autoplay': openAutoplay,
            'autoplay-pause': () => control('pause'),
            'autoplay-resume': () => control('resume'),
            'autoplay-off': () => control('off')
        },
        changes: [event => {
            if (event.target.id === 'autoplay-finish') {
                void setAnswerReveal(event.target);
                return true;
            }
            if (event.target.id !== 'autoplay-start-mode') return false;
            updateStartFields(event.target.form);
            return true;
        }],
        forms: {'autoplay-form': {submit: submitAutoplay, errorTarget: '#autoplay-error'}}
    };
}
