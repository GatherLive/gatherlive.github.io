import type {AppContext} from '../../app/context.js';
import {$, esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';

export function createRoomSettings(context: AppContext) {
    const S = context.state;
    let timer: ReturnType<typeof setInterval> | null = null, pendingAt = 0;
    let pendingChange: {roomCode: string; enabled: boolean} | null = null;
    let changeTimeout: ReturnType<typeof setTimeout> | null = null;
    function clearChange() {if(changeTimeout)clearTimeout(changeTimeout);changeTimeout=null;pendingChange=null;}
    const enabled = () => S.room?.role === 'host' && S.connected && S.roomState?.settings?.joinVerification && S.roomState.phase !== 'finished';
    function requestChallenge() {
        if (!enabled() || document.hidden || Date.now() - pendingAt < 5000) return;
        pendingAt = Date.now();context.send({type: 'join_code_request'});
    }
    function joinVerificationMarkup() {
        return `<div class="room-join-verification" data-join-verification ${enabled() ? '' : 'hidden'}><span>Verification code</span><strong data-join-code>······</strong><small data-join-expiry>Changes every 30 seconds</small></div>`;
    }
    function paint() {
        for (const element of document.querySelectorAll<HTMLElement>('[data-join-verification]')) element.hidden = !enabled();
        if (!enabled()) return;
        const current = S.joinChallenge, valid = current?.roomCode === S.room.code && current.localDeadline > Date.now();
        document.querySelectorAll('[data-join-code]').forEach(element => element.textContent = valid ? current.code : '······');
        document.querySelectorAll('[data-join-expiry]').forEach(element => element.textContent = valid ? `Changes in ${Math.max(1, Math.ceil((current.localDeadline - Date.now()) / 1000))}s` : 'Updating verification code…');
        if (!valid) requestChallenge();
    }
    function updateRoomSettings() {
        if(pendingChange&&(pendingChange.roomCode!==S.room?.code||!S.connected||S.roomState?.phase!=='lobby'||S.roomState?.settings?.joinVerification===pendingChange.enabled))clearChange();
        const checkbox = $<HTMLInputElement>('#room-join-verification');
        if (checkbox) {
            checkbox.checked = pendingChange?.enabled ?? (S.roomState?.settings?.joinVerification === true);
            checkbox.disabled = !!pendingChange || !S.connected || S.roomState?.phase !== 'lobby';
            checkbox.closest('.room-setting-row')?.setAttribute('aria-busy',String(!!pendingChange));
        }
        const saving=document.querySelector<HTMLElement>('[data-room-setting-save]');
        if(saving){saving.hidden=!pendingChange;saving.textContent=pendingChange?'Saving…':'';}
        if (enabled() && !timer) timer = setInterval(paint, 1000);
        else if (!enabled() && timer) {clearInterval(timer);timer = null;}
        paint();
    }
    function roomSettings() {
        if (S.room?.role !== 'host') return;
        const checked = S.roomState?.settings?.joinVerification === true;
        context.modal('Settings', `<label class="room-setting-row" for="room-join-verification"><span><strong>Join verification</strong><small>Participants enter a second code from your screen.</small><small class="room-setting-save" data-room-setting-save role="status" hidden></small></span><input type="checkbox" role="switch" id="room-join-verification" ${checked ? 'checked' : ''} ${S.roomState?.phase !== 'lobby' || !S.connected ? 'disabled' : ''}></label>${joinVerificationMarkup()}<button class="room-chat-setting" type="button" data-action="chat-settings"><span>${icon('chat', 19)} Chat settings</span>${icon('chevron', 18)}</button>`);
        const done=document.querySelector('.modal-actions [data-action="close-modal"]');if(done)done.textContent='Done';
        updateRoomSettings();
    }
    function promptForVerification(message: string) {
        const room = S.room;if (!room || room.role !== 'player') return;
        S.joinVerificationPrompt = {code: room.code, name: room.name, message};
        context.disconnectRoom();S.room = null;S.roomState = null;
        const destination = '#join/' + room.code;
        if (location.hash === destination) context.joinView(room.code);else location.replace(destination);
    }
    function receiveRoomSettings(data) {
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
    function disposeRoomSettings() {if (timer) clearInterval(timer);clearChange();timer = null;pendingAt = 0;S.joinChallenge = null;}
    return {joinVerificationMarkup, updateRoomSettings, receiveRoomSettings, disposeRoomSettings, actions: {'room-settings': roomSettings}, changes: [event => {
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
