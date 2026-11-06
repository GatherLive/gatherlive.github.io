import type {AppContext} from '../../app/context.js';
import { $, esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
export function createFeaturesLibraryRooms(context: AppContext) {
    const S = context.state;
    const backend = (...args) => context.backend(...args);
    const modal = (...args) => context.modal(...args);
    const disconnectRoom = (...args) => context.disconnectRoom(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const toast = (...args) => context.toast(...args);
    async function loadOpenRooms(update = true) {
        try {
            const data = await backend('/api/rooms', null, 'GET');
            if(data?.hosted){S.hostedQuizzes||={};for(const [id,row]of Object.entries(data.hosted as Record<string,{lastHostedAt: number}>))if((row.lastHostedAt||0)>(S.hostedQuizzes[id]?.lastHostedAt||0))S.hostedQuizzes[id]=row;}
            S.openRooms = (Array.isArray(data?.rooms) ? data.rooms : []).filter(isOpenRoom);
            S.roomsError = '';
        }
        catch (error) {
            S.openRooms = [];
            S.roomsError = error.message;
        }
        if (update && $('#open-rooms'))
            $('#open-rooms').innerHTML = openRoomCards();
        if ($('#open-room-count'))
            $('#open-room-count').textContent = String(S.openRooms.length);
        return !S.roomsError;
    }
    function isOpenRoom(room) { return room && room.phase !== 'finished' && room.phase !== 'closed'; }
    function openRoomCards() {
        if (S.roomsError)
            return `<div class="room-list-notice"><span>Rooms unavailable</span><button class="quiet-button" data-action="refresh-rooms">Try again</button></div>`;
        const rooms = S.openRooms.filter(isOpenRoom), phases = { lobby: 'Waiting', countdown: 'Starting', question: 'In progress', reveal: 'Between questions', round_results: 'Round results' };
        return `<section class="open-rooms" aria-label="Open rooms"><div class="room-list-tools"><button class="quiet-button" data-action="refresh-rooms">Refresh</button>${rooms.length ? '<button class="quiet-button room-close-button" data-action="close-all-rooms">Close all rooms</button>' : ''}</div>${rooms.length ? `<div class="quiz-grid">${rooms.map(room => `<article class="quiz-card card open-room-card"><div class="row between"><div class="quiz-illustration">${icon('users', 21)}</div><span class="pill">${esc(phases[room.phase] || 'Open')}</span></div><h3>${esc(room.title)}</h3><div class="quiz-meta"><b class="open-room-code">${esc(room.code)}</b><span>·</span><span>${Number(room.participants) || 0} player${Number(room.participants) === 1 ? '' : 's'}</span></div><div class="quiz-card-footer"><button class="quiet-button room-close-button" data-action="close-room" data-code="${esc(room.code)}">Close</button><button class="btn small primary" data-action="rejoin-room" data-code="${esc(room.code)}">${icon('play', 13)} Rejoin</button></div></article>`).join('')}</div>` : `<div class="empty"><div class="empty-icon">${icon('users', 27)}</div><h2>No open rooms</h2></div>`}</section>`;
    }
    function confirmCloseRoom(code) {
        const room = S.openRooms.find(r => r.code === code && isOpenRoom(r));
        if (!room)
            return;
        modal('Close room?', `<p>Disconnects all players and deletes this room’s live data, including unsaved results and chat. Your saved quizzes and saved results stay available.</p>`, `<button class="btn danger" data-action="confirm-close-room" data-code="${esc(code)}" data-room-id="${esc(room.roomId)}">Close room</button>`);
    }
    function confirmCloseAllRooms() {
        S.roomsToClose = S.openRooms.filter(isOpenRoom).map(({ code, roomId }) => ({ code, roomId }));
        if (!S.roomsToClose.length)
            return;
        modal('Close all rooms?', `<p>Disconnects all players in these ${S.roomsToClose.length} room${S.roomsToClose.length === 1 ? '' : 's'} and deletes their live data, including unsaved results and chat. Your saved quizzes and saved results stay available.</p>`, '<button class="btn danger" data-action="confirm-close-all-rooms">Close all rooms</button>');
    }
    function forgetClosedRoom(code) {
        sessionStorage.removeItem(`gather.host.${code}`);
        if (S.room?.code === code) {
            disconnectRoom();
            S.room = null;
            S.roomState = null;
        }
    }
    async function closeAllRooms() {
        const rooms = S.roomsToClose?.map(room => ({ ...room })) || [];
        if (!rooms.length)
            return;
        let closed = 0, failed = 0;
        for (let start = 0; start < rooms.length; start += 100) {
            const batch = rooms.slice(start, start + 100);
            try {
                const result = await backend('/api/rooms', { rooms: batch }, 'DELETE');
                if (!Number.isInteger(result?.closed) || !Number.isInteger(result?.failed) || result.closed < 0 || result.failed < 0 || result.closed + result.failed !== batch.length)
                    throw new Error('Incomplete room response.');
                closed += result.closed;
                failed += result.failed;
            }
            catch {
                failed += batch.length;
            }
        }
        closeModal();
        S.roomsToClose = [];
        await loadOpenRooms();
        if (!S.roomsError)
            for (const room of rooms)
                if (!S.openRooms.some(open => open.code === room.code && open.roomId === room.roomId))
                    forgetClosedRoom(room.code);
        toast(`${closed} room${closed === 1 ? '' : 's'} closed.${failed ? ` ${failed} could not be confirmed closed. Refresh and try again.` : ''}`, failed > 0);
    }
    return { loadOpenRooms, isOpenRoom, openRoomCards, confirmCloseRoom, confirmCloseAllRooms, forgetClosedRoom, closeAllRooms };
}
