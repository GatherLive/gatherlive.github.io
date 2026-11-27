import type {AppContext} from '../../app/context.js';
import type {RoomMode} from '../../../shared/types.js';
import {$, uid} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {DEFAULT_REVEAL_DELAY, MAX_REVEAL_DELAY, validRevealDelay} from '../../core/live-game.js';

const MODES: Record<RoomMode, {label: string; description: string}> = {
    live: {label: 'Host only', description: 'Run the quiz for others.'},
    'self-study': {label: 'Solo play', description: 'Take the quiz privately and resume later.'},
    'group-study': {label: 'Group play', description: 'Invite friends and answer alongside them.'}
};

export function backToRoomSettings() {
    const back = $<HTMLButtonElement>('.modal-actions [data-action="close-modal"]');
    if (back) {
        back.dataset.action = 'room-settings';
        back.textContent = 'Back to settings';
    }
}

export function createRoomSettings(context: AppContext) {
    const S = context.state;
    let timer: ReturnType<typeof setInterval> | null = null, pendingAt = 0;
    let pendingChange: {roomCode: string; enabled: boolean} | null = null;
    let changeTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingMode: {id: string; timer: ReturnType<typeof setTimeout>; finish: (error?: string) => void} | null = null;
    function clearChange() {if(changeTimeout)clearTimeout(changeTimeout);changeTimeout=null;pendingChange=null;}
    const enabled = () => S.room?.role === 'host' && S.connected && !S.roomState?.study && S.roomState?.settings?.joinVerification && S.roomState.phase !== 'finished';
    function requestChallenge() {
        if (!enabled() || document.hidden || Date.now() - pendingAt < 5000) return;
        pendingAt = Date.now();context.send({type: 'join_code_request'});
    }
    function joinVerificationMarkup() {
        if (!S.roomState?.settings?.joinVerification || S.roomState.study) return '';
        return `<button class="quiet-button lobby-verification-link" type="button" data-action="room-two-step">${icon('lock',14)} Verification code</button>`;
    }
    function paint() {
        const display = $<HTMLElement>('[data-join-verification]');
        if (display) display.hidden = !enabled();
        if (!display || !enabled()) {
            if (timer) clearInterval(timer);
            timer = null;
            return;
        }
        const current = S.joinChallenge, valid = current?.roomCode === S.room.code && current.localDeadline > Date.now();
        document.querySelectorAll('[data-join-code]').forEach(element => element.textContent = valid ? current.code : '······');
        document.querySelectorAll('[data-join-expiry]').forEach(element => element.textContent = valid ? `Changes in ${Math.max(1, Math.ceil((current.localDeadline - Date.now()) / 1000))}s` : 'Updating verification code…');
        if (!valid) requestChallenge();
    }
    function updateRoomSettings(revealMode = S.roomState?.settings?.game?.reveal ?? 'all') {
        const canChangeReveal = S.connected && S.roomState?.phase !== 'finished';
        const reveal = $<HTMLSelectElement>('#room-game-reveal');
        if (reveal) {
            reveal.disabled = !canChangeReveal;
            reveal.value = revealMode;
        }
        const delay = $<HTMLInputElement>('#room-game-reveal-delay');
        if (delay) {
            const automatic = revealMode === 'auto';
            delay.closest('.room-game-reveal-interval')?.toggleAttribute('hidden', !automatic);
            delay.disabled = !canChangeReveal || !automatic;
            if (document.activeElement !== delay) delay.value = String(S.roomState?.settings?.game?.revealDelay ?? DEFAULT_REVEAL_DELAY);
        }
        const modeEditable = S.connected && S.roomState?.phase === 'lobby';
        const modeButton = $<HTMLButtonElement>('.modal [data-action="room-play-mode"]');
        if (modeButton) modeButton.disabled = !modeEditable;
        const modeForm = $<HTMLFormElement>('#room-mode-form');
        if (modeForm) {
            modeForm.querySelector<HTMLFieldSetElement>('fieldset').disabled = !modeEditable || !!pendingMode;
            modeForm.querySelector<HTMLButtonElement>('button[type="submit"]').disabled = !modeEditable || !!pendingMode;
        }
        if(pendingChange&&(pendingChange.roomCode!==S.room?.code||!S.connected||S.roomState?.phase!=='lobby'||S.roomState?.settings?.joinVerification===pendingChange.enabled))clearChange();
        const checkbox = $<HTMLInputElement>('#room-join-verification');
        if (checkbox) {
            checkbox.checked = pendingChange?.enabled ?? (S.roomState?.settings?.joinVerification === true);
            checkbox.disabled = !!pendingChange || !S.connected || S.roomState?.phase !== 'lobby';
            checkbox.closest('.room-setting-row')?.setAttribute('aria-busy',String(!!pendingChange));
        }
        const saving=document.querySelector<HTMLElement>('[data-room-setting-save]');
        if(saving){saving.hidden=!pendingChange;saving.textContent=pendingChange?'Saving…':'';}
        if (enabled() && $('[data-join-verification]') && !timer) timer = setInterval(paint, 1000);
        paint();
    }
    function settingRow(action: string, symbol: string, label: string, detail = '', disabled = false) {
        return `<button type="button" class="room-chat-setting" data-action="${action}" ${disabled ? 'disabled' : ''}>
            <span>${icon(symbol,19)} ${label}</span><span>${detail ? `<small>${detail}</small>` : ''}${icon('chevron',18)}</span>
        </button>`;
    }
    function roomSettings() {
        if (S.room?.role !== 'host') return;
        const st = S.roomState;
        const mode = MODES[st?.mode] ?? MODES.live;
        const modes = st?.mode ? settingRow('room-play-mode','users','Play mode',mode.label,!S.connected || st.phase !== 'lobby') : '';
        const verification = st?.study ? '' : settingRow('room-two-step','lock','Two-step verification',st?.settings?.joinVerification ? 'On' : 'Off');
        const chat = st?.study ? '' : settingRow('chat-settings','chat','Chat settings');
        const autoplay = st?.autoplay ? settingRow('room-autoplay','clock','Autoplay','',!S.connected) : '';
        const reveal = st?.settings?.game ? `<div class="field room-game-reveal"><label for="room-game-reveal">Answer reveal</label>
            <select id="room-game-reveal" aria-describedby="room-game-reveal-hint"><option value="all">All at once</option><option value="turns">One at a time</option><option value="auto">One at a time · automatic</option></select>
            <span class="hint" id="room-game-reveal-hint">Applies to the next reveal.</span></div>
            <div class="field room-game-reveal-interval"${st.settings.game.reveal === 'auto' ? '' : ' hidden'}><label for="room-game-reveal-delay">Automatic reveal interval (seconds)</label>
            <input type="number" id="room-game-reveal-delay" min="1" max="${MAX_REVEAL_DELAY}" step="1" inputmode="numeric" value="${st.settings.game.revealDelay ?? DEFAULT_REVEAL_DELAY}"></div>` : '';
        context.modal('Settings', modes + autoplay + verification + chat + reveal);
        const done=document.querySelector('.modal-actions [data-action="close-modal"]');if(done)done.textContent='Done';
        updateRoomSettings();
    }
    function openVerification() {
        if(S.room?.role!=='host'||!S.roomState||S.roomState.study)return;
        context.modal('Two-step verification', `
            <label class="room-setting-row" for="room-join-verification"><span>
                <strong>Require a second code</strong><small>Participants enter the rotating code from your screen.</small>
                <small class="room-setting-save" data-room-setting-save role="status" hidden></small>
            </span><input type="checkbox" role="switch" id="room-join-verification"></label>
            <div class="room-join-verification" data-join-verification hidden><span>Verification code</span>
                <strong data-join-code>······</strong><small data-join-expiry>Changes every 30 seconds</small>
            </div>`);
        backToRoomSettings();
        updateRoomSettings();
    }
    function openPlayMode() {
        const st = S.roomState;
        if (S.room?.role !== 'host' || !S.connected || st?.phase !== 'lobby') return;
        context.modal('Play mode', `<form id="room-mode-form">
            <fieldset class="room-mode-options"><legend class="sr-only">Play mode</legend>
                ${Object.entries(MODES).map(([value, mode]) => `<label class="room-mode-option">
                    <input type="radio" name="mode" value="${value}" ${value === st.mode ? 'checked' : ''} required>
                    <span><strong>${mode.label}</strong><small>${mode.description}</small></span>
                </label>`).join('')}
            </fieldset><div id="room-mode-error" role="alert"></div>
            <button class="btn primary" type="submit">Save</button>
        </form>`);
        backToRoomSettings();
    }
    async function savePlayMode(form: HTMLFormElement) {
        if (pendingMode || !S.connected || S.roomState?.phase !== 'lobby') throw new Error('Choose a mode before the quiz starts.');
        const mode = new FormData(form).get('mode'), id = uid();
        await new Promise<void>((resolve, reject) => {
            const finish = (error?: string) => {
                clearTimeout(pendingMode?.timer);
                pendingMode = null;
                if (error) reject(new Error(error));
                else resolve();
            };
            const timer = setTimeout(() => finish('The room did not confirm. Check your connection.'), 8000);
            pendingMode = {id, timer, finish};
            if (!context.send({type:'room_mode',mode,requestId:id}, {quiet:true})) finish('Reconnect to change the play mode.');
        });
        if(form.isConnected)context.closeModal();
    }
    function promptForVerification(message: string) {
        const room = S.room;if (!room || room.role !== 'player') return;
        if (S.joinTeamPrompt?.code === room.code) {
            S.joinTeamPrompt.verificationCode = undefined;
            S.joinTeamPrompt.team = room.team;
        }
        S.joinVerificationPrompt = {code: room.code, name: room.name, message};
        context.disconnectRoom();S.room = null;S.roomState = null;
        const destination = '#join/' + room.code;
        if (location.hash === destination) context.joinView(room.code);else location.replace(destination);
    }
    function receiveRoomSettings(data) {
        if(data.type==='room_mode_updated'||data.scope==='room-mode'){
            if(pendingMode?.id===data.requestId)pendingMode.finish(data.type==='error'?data.message||'Could not change the play mode.':undefined);
            return true;
        }
        if(data.type==='room_settings_updated'){
            if(S.room?.role==='host'&&S.roomState&&typeof data.joinVerification==='boolean'){
                S.roomState.settings||={};S.roomState.settings.joinVerification=data.joinVerification;
                clearChange();if(!data.joinVerification){S.joinChallenge=null;pendingAt=0;}
                updateRoomSettings();
            }
            return true;
        }
        if(data.type==='error'&&pendingChange&&!data.scope){clearChange();updateRoomSettings();}
        if (data.type === 'join_code') {
            if (S.room?.role !== 'host' || data.roomCode !== S.room.code || !/^\d{6}$/.test(data.code) || !Number.isFinite(data.expiresAt) || !Number.isFinite(data.serverNow)) return true;
            pendingAt = 0;S.joinChallenge = {...data, localDeadline: Date.now() + Math.max(0, Math.min(30000, data.expiresAt - data.serverNow))};paint();return true;
        }
        if (data.type === 'error' && ['JOIN_VERIFICATION_REQUIRED', 'JOIN_VERIFICATION_FAILED'].includes(data.code)) {
            promptForVerification(data.code === 'JOIN_VERIFICATION_REQUIRED' ? 'Enter the verification code shown by your host.' : 'Check the current verification code with your host and try again.');return true;
        }
        return false;
    }
    function disposeRoomSettings() {if (timer) clearInterval(timer);clearChange();pendingMode?.finish('Reconnect to change the play mode.');timer = null;pendingAt = 0;S.joinChallenge = null;}
    return {joinVerificationMarkup, updateRoomSettings, receiveRoomSettings, disposeRoomSettings,
        actions: {'room-settings': roomSettings,'room-two-step':openVerification,'room-play-mode':openPlayMode},
        forms: {'room-mode-form':{submit:savePlayMode,errorTarget:'#room-mode-error'}}, changes: [event => {
        if (event.target instanceof HTMLSelectElement && event.target.id === 'room-game-reveal') {
            if (S.room?.role === 'host' && S.roomState?.settings?.game) {
                const mode = event.target.value;
                if (context.send({type: 'game_reveal', reveal: mode})) updateRoomSettings(mode);
                else updateRoomSettings();
            }
            return true;
        }
        if (event.target instanceof HTMLInputElement && event.target.id === 'room-game-reveal-delay') {
            if (event.target.disabled) return true;
            const delay = event.target.valueAsNumber;
            if (S.room?.role === 'host' && S.roomState?.settings?.game && validRevealDelay(delay) &&
                context.send({type: 'game_reveal', revealDelay: delay})) return true;
            event.target.value = String(S.roomState?.settings?.game?.revealDelay ?? DEFAULT_REVEAL_DELAY);
            if (!validRevealDelay(delay)) context.toast(`Choose 1–${MAX_REVEAL_DELAY} seconds.`, true);
            return true;
        }
        if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'room-join-verification') return false;
        if(pendingChange||S.room?.role!=='host'||S.roomState?.phase!=='lobby'){updateRoomSettings();return true;}
        const selected=event.target.checked;
        pendingChange={roomCode:S.room.code,enabled:selected};
        if (!context.send({type: 'room_settings', joinVerification: selected})) {clearChange();updateRoomSettings();return true;}
        changeTimeout=setTimeout(()=>{clearChange();updateRoomSettings();context.toast('Could not save join verification. Reconnect and try again.',true);},8000);
        updateRoomSettings();
        return true;
    }]};
}
