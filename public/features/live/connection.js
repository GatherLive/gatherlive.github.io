import { uid, $, $$, esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { RoomClock } from './clock.js';
import { RoomChat } from '../chat/room-chat.js';
import { RoomImages } from '../media/images.js';
export function createFeaturesLiveConnection(context) {
    const S = context.state;
    const toast = (...args) => context.toast(...args);
    const backend = (...args) => context.backend(...args);
    const defaultSettings = (...args) => context.defaultSettings(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const updateChatApplication = (...args) => context.updateChatApplication(...args);
    const modal = (...args) => context.modal(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const renderRoom = (...args) => context.renderRoom(...args);
    const getToken = (...args) => context.getToken(...args);
    const apiURL = (...args) => context.apiURL(...args);
    const playerRoomKey = (...args) => context.playerRoomKey(...args);
    const playerNameKey = (...args) => context.playerNameKey(...args);
    const updateTimer = (...args) => context.updateTimer(...args);
    const refreshAnswerUI = (...args) => context.refreshAnswerUI(...args);
    const forgetPlayer = (...args) => context.forgetPlayer(...args);
    const roomLink = (...args) => context.roomLink(...args);
    async function hostQuiz(quizId, settings) {
        toast('Opening room…');
        const quiz = S.quizzes.find(q => q.id === quizId) || S.draft;
        const result = await backend('/api/rooms', { quizId, settings: { ...defaultSettings(), ...(quiz?.settings || {}), ...(settings || {}) } });
        S.room = { code: result.code, role: 'host' };
        sessionStorage.setItem(`gather.host.${result.code}`, '1');
        location.hash = `#room/${result.code}`;
        connectRoom();
    }
    function disconnectRoom() {
        S.syncTimers?.forEach(clearTimeout);
        S.syncTimers = [];
        S.chat?.destroy();
        S.chat = null;
        S.wsGeneration++;
        clearTimeout(S.reconnectTimer);
        clearInterval(S.heartbeat);
        clearTimeout(S.connectTimeout);
        if (S.ws) {
            S.ws.onclose = null;
            S.ws.close();
        }
        S.ws = null;
        S.connected = false;
        S.connectionStatus = 'disconnected';
        S.images?.close();
        S.images = null;
    }
    function connectRoom() {
        const room = S.room;
        if (!room)
            return;
        disconnectRoom();
        S.clock = new RoomClock();
        S.chat = new RoomChat({ state: () => S, accessStatus: async () => { const owner = activeUser()?.id; const result = await backend('/api/account/chat', null, 'GET'); if (activeUser()?.id === owner)
                updateChatApplication(result.application); return result; }, send, notify: toast, modal, closeModal, id: uid, icon });
        S.images = new RoomImages(S.config.apiUrl || '', room.code);
        S.connectionStatus = 'connecting';
        S.roomState = null;
        S.selection = null;
        S.answerSent = false;
        S.answerPending = false;
        S.retries = 0;
        renderRoom();
        openSocket();
    }
    async function openSocket() {
        const room = S.room, generation = ++S.wsGeneration;
        if (!room)
            return;
        S.syncTimers?.forEach(clearTimeout);
        S.syncTimers = [];
        clearTimeout(S.reconnectTimer);
        clearInterval(S.heartbeat);
        clearTimeout(S.connectTimeout);
        S.connected = false;
        S.connectionStatus = navigator.onLine === false ? 'offline' : S.retries ? 'reconnecting' : 'connecting';
        updateConnection();
        if (navigator.onLine === false)
            return;
        const previous = S.ws;
        if (previous) {
            previous.onclose = null;
            previous.close();
        }
        S.ws = null;
        let token;
        try {
            if (room.role === 'host')
                token = await getToken();
        }
        catch (error) {
            toast(error.message, true);
            location.hash = '#host';
            return;
        }
        if (generation !== S.wsGeneration)
            return;
        let url;
        try {
            url = new URL(apiURL(`/api/rooms/${room.code}/ws`), location.href);
            url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        }
        catch {
            toast('Check your backend URL in config.js.', true);
            return;
        }
        const ws = new WebSocket(url);
        let firstState = true;
        S.ws = ws;
        const syncClock = () => { if (generation === S.wsGeneration && S.connected && ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify(S.clock.request())); };
        S.connectTimeout = setTimeout(() => { if (generation === S.wsGeneration && ws.readyState < 2) {
            S.retries++;
            void openSocket();
        } }, 12000);
        ws.onopen = () => {
            if (generation !== S.wsGeneration)
                return;
            S.lastSocketMessage = Date.now();
            ws.send(JSON.stringify(room.role === 'host' ? { type: 'auth', role: 'host', token, mediaVersion: globalThis.crypto?.subtle ? 2 : 1, conversationVersion: 1, chatSubscribed: !S.chat.hidden } : { type: 'auth', role: 'player', name: room.name, playerId: room.playerId, resumeToken: room.resumeToken, mediaVersion: globalThis.crypto?.subtle ? 2 : 1, conversationVersion: 1, chatSubscribed: !S.chat.hidden }));
            let heartbeatTicks = 0;
            S.heartbeat = setInterval(() => { if (generation !== S.wsGeneration)
                return; if (navigator.onLine === false || Date.now() - S.lastSocketMessage >= 7500) {
                S.connected = false;
                S.connectionStatus = navigator.onLine === false ? 'offline' : 'reconnecting';
                updateConnection();
                if (navigator.onLine !== false) {
                    S.retries++;
                    void openSocket();
                }
                else
                    ws.close();
                return;
            } if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
                if (++heartbeatTicks % 12 === 0)
                    syncClock();
            } }, 2500);
        };
        ws.onmessage = event => {
            if (generation !== S.wsGeneration)
                return;
            S.lastSocketMessage = Date.now();
            if (event.data === 'pong')
                return;
            let data;
            try {
                data = JSON.parse(event.data);
            }
            catch {
                return;
            }
            if (data.type === 'welcome') {
                room.playerId = data.playerId;
                room.resumeToken = data.resumeToken;
                if (room.role === 'player') {
                    const saved = JSON.stringify(room);
                    try {
                        localStorage.setItem(playerRoomKey(room.code), saved);
                        localStorage.setItem(playerNameKey(room.code, room.name), saved);
                    }
                    catch { }
                    try {
                        sessionStorage.setItem(playerRoomKey(room.code), saved);
                    }
                    catch { }
                }
                S.images?.prepare(data.imageManifest);
                clearTimeout(S.connectTimeout);
            }
            else if (S.chat?.receive(data)) {
                return;
            }
            else if (data.type === 'state') {
                const initialState = firstState;
                if (firstState) {
                    S.answerPending = false;
                    firstState = false;
                }
                const previousId = S.roomState?.question?.id, newId = data.state?.question?.id, previousPhase = S.roomState?.phase;
                if ($('.image-modal') && (previousId !== newId || previousPhase !== data.state.phase))
                    closeModal();
                S.connected = true;
                S.connectionStatus = 'connected';
                S.retries = 0;
                S.roomState = data.state;
                S.chat?.setState(data.state);
                S.clock.observe(data.state.serverNow);
                S.images?.release(data.state.imageKeys);
                S.images?.pause(data.state.phase === 'question' || data.state.phase === 'finished');
                if (data.state.mediaPreparation)
                    S.images?.prepareCurrent(data.state.mediaPreparation, token => { if (S.roomState?.phase === 'countdown' && S.roomState.mediaPreparation?.token === token)
                        send({ type: 'media_ready', token }); });
                if (data.state.imageManifest)
                    S.images?.prepare(data.state.imageManifest);
                else if (data.state.phase === 'finished')
                    S.images?.prepare([]);
                if (initialState) {
                    syncClock();
                    S.syncTimers = [setTimeout(syncClock, 350), setTimeout(syncClock, 1000)];
                }
                if (previousId !== newId) {
                    S.selection = null;
                    S.pin = null;
                    S.order = data.state.question?.options?.map(o => o.id) || [];
                    S.answerSent = false;
                    S.answerPending = false;
                }
                if (data.state.me?.answered) {
                    S.answerSent = true;
                    S.answerPending = false;
                    S.selection = data.state.me.answer ?? S.selection;
                }
                else if (newId && room.role === 'player') {
                    try {
                        const saved = JSON.parse(sessionStorage.getItem(`gather.answer.${room.code}.${newId}`) || 'null');
                        if (saved) {
                            S.answerSent = true;
                            S.selection = saved.answer;
                        }
                    }
                    catch { }
                }
                if (data.state.question?.type === 'order' && Array.isArray(S.selection))
                    S.order = [...S.selection];
                if (data.state.question?.type === 'pin' && S.selection && typeof S.selection === 'object')
                    S.pin = S.selection;
                renderRoom();
                if (previousId !== newId || previousPhase !== data.state.phase) {
                    window.scrollTo(0, 0);
                    if (S.room.role === 'player' && data.state.phase === 'question')
                        $('#live-question-title')?.focus({ preventScroll: true });
                }
            }
            else if (data.type === 'media_progress') {
                if (S.roomState?.phase === 'countdown') {
                    S.roomState.mediaProgress = { ready: data.ready, total: data.total, waiting: data.waiting };
                    updateTimer();
                }
            }
            else if (data.type === 'progress') {
                if (data.questionId && data.questionId !== S.roomState?.question?.id)
                    return;
                if (S.roomState)
                    S.roomState.answerCount = data.answerCount;
                $$('[data-answer-count]').forEach(el => el.textContent = data.answerCount);
                if (data.me?.answered) {
                    S.answerSent = true;
                    S.answerPending = false;
                    refreshAnswerUI();
                }
            }
            else if (data.type === 'answer_ack') {
                S.answerPending = false;
                if (data.accepted || data.answered) {
                    S.answerSent = true;
                    sessionStorage.setItem(`gather.answer.${room.code}.${data.questionId}`, JSON.stringify({ answer: S.selection }));
                    refreshAnswerUI();
                }
                else {
                    toast(data.message || 'Your answer could not be accepted.', true);
                    refreshAnswerUI();
                }
            }
            else if (data.type === 'draw') {
                if (S.roomState)
                    S.roomState.winners = data.winners;
                renderRoom();
            }
            else if (data.type === 'error') {
                S.answerPending = false;
                const invalidSession = /session could not be restored/i.test(data.message || '');
                if (invalidSession || /removed from this quiz/i.test(data.message || ''))
                    forgetPlayer(room, true);
                if (invalidSession && room.role === 'player') {
                    delete room.playerId;
                    delete room.resumeToken;
                    S.roomState = null;
                    S.selection = null;
                    S.pin = null;
                    S.order = [];
                    S.answerSent = false;
                    S.answerPending = false;
                    S.fatalRoomError = null;
                    renderRoom();
                    void openSocket();
                    return;
                }
                toast(data.message || 'Something went wrong. Please try again.', true);
                if ((!S.connected && !S.roomState && !/temporar|retry|try again|slow down/i.test(data.message || '')) || /kick|removed|not found|not exist|expired|unauthorized|invalid.*token|session.*restored/i.test(data.message || '')) {
                    S.fatalRoomError = data.message;
                    clearTimeout(S.reconnectTimer);
                    clearInterval(S.heartbeat);
                    clearTimeout(S.connectTimeout);
                    S.wsGeneration++;
                    ws.close();
                    S.connected = false;
                    S.connectionStatus = 'disconnected';
                    renderRoom();
                }
                else
                    renderRoom();
            }
            else if (data.type === 'pong') {
                if (S.clock.accept(data))
                    updateTimer();
            }
        };
        ws.onclose = event => {
            if (generation !== S.wsGeneration)
                return;
            clearInterval(S.heartbeat);
            clearTimeout(S.connectTimeout);
            S.connected = false;
            S.connectionStatus = navigator.onLine === false ? 'offline' : 'reconnecting';
            updateConnection();
            if ([4001, 4003].includes(event.code) || (event.code === 1000 && /closed|expired|deleted/i.test(event.reason || ''))) {
                S.connectionStatus = 'disconnected';
                S.fatalRoomError = event.code === 4001 ? 'This player is connected in another tab. Return to that tab to continue.' : event.reason || 'This quiz has closed.';
                renderRoom();
                return;
            }
            if (navigator.onLine !== false) {
                const delay = Math.min(700 * 2 ** S.retries++, 5000) + Math.random() * 250;
                S.reconnectTimer = setTimeout(openSocket, delay);
            }
        };
        ws.onerror = () => { };
    }
    function updateConnection() {
        $$('.connection').forEach(el => { el.classList.toggle('offline', !S.connected); el.dataset.state = S.connectionStatus || 'connecting'; el.innerHTML = connectionLabel(); });
        $$('[data-needs-connection]').forEach(el => el.disabled = !S.connected || (el.dataset.action === 'room-start' && !(S.roomState?.participantCount ?? S.roomState?.players?.length)));
        if (!S.connected)
            $$('.live-question button,.live-question input,.live-question textarea').forEach(el => el.disabled = true);
        S.chat?.refresh();
    }
    function connectionLabel() { const text = S.connected ? 'Connected' : ({ connecting: 'Connecting', reconnecting: 'Reconnecting', offline: 'Offline', disconnected: 'Disconnected' }[S.connectionStatus] || 'Connecting'); return `<span class="connection-dot" aria-hidden="true"></span><span>${text}</span>${!S.connected && S.room && !S.fatalRoomError ? '<button class="connection-retry" data-action="reconnect" aria-label="Reconnect now" title="Reconnect now">↻</button>' : ''}`; }
    function send(command) {
        if (!S.connected || S.ws?.readyState !== WebSocket.OPEN) {
            toast('Waiting for your connection to return.', true);
            return false;
        }
        S.ws.send(JSON.stringify(command));
        return true;
    }
    async function copyLink() {
        const link = roomLink(S.room.code);
        try {
            await navigator.clipboard.writeText(link);
            toast('Link copied.');
        }
        catch {
            modal('Share link', `<input class="input" value="${esc(link)}" readonly aria-label="Invitation link">`, '', () => { $('.modal input').select(); });
        }
    }
    return { hostQuiz, disconnectRoom, connectRoom, openSocket, updateConnection, connectionLabel, send, copyLink };
}
