import { uid, esc } from '../../core/dom.js';
export function createFeaturesLibraryActions(context) {
    const S = context.state;
    const dashboard = (...args) => context.dashboard(...args);
    const renderDashboard = (...args) => context.renderDashboard(...args);
    const loadOpenRooms = (...args) => context.loadOpenRooms(...args);
    const isOpenRoom = (...args) => context.isOpenRoom(...args);
    const confirmCloseRoom = (...args) => context.confirmCloseRoom(...args);
    const backend = (...args) => context.backend(...args);
    const forgetClosedRoom = (...args) => context.forgetClosedRoom(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const toast = (...args) => context.toast(...args);
    const confirmCloseAllRooms = (...args) => context.confirmCloseAllRooms(...args);
    const closeAllRooms = (...args) => context.closeAllRooms(...args);
    const cloneQuizQuestions = (...args) => context.cloneQuizQuestions(...args);
    const db = (...args) => context.db(...args);
    const modal = (...args) => context.modal(...args);
    return { actions: {
            'reload-dashboard': dashboard,
            'dashboard-tab': async (el) => { S.dashboardTab = el.dataset.tab; renderDashboard(); if (S.dashboardTab === 'rooms')
                await loadOpenRooms(); },
            'refresh-rooms': () => loadOpenRooms(),
            'rejoin-room': el => { if (!S.openRooms.some(room => room.code === el.dataset.code && isOpenRoom(room)))
                return; S.room = { code: el.dataset.code, role: 'host' }; S.fatalRoomError = null; sessionStorage.setItem(`gather.host.${el.dataset.code}`, '1'); location.hash = `#room/${el.dataset.code}`; },
            'close-room': el => confirmCloseRoom(el.dataset.code),
            'confirm-close-room': async (el) => { await backend(`/api/rooms/${el.dataset.code}`, { roomId: el.dataset.roomId }, 'DELETE'); forgetClosedRoom(el.dataset.code); closeModal(); await loadOpenRooms(); toast('Room closed.'); },
            'close-all-rooms': confirmCloseAllRooms,
            'confirm-close-all-rooms': closeAllRooms,
            'duplicate-quiz': async (el) => { const quiz = S.quizzes.find(q => q.id === el.dataset.id), copy = cloneQuizQuestions(structuredClone(quiz)); delete copy.created_at; copy.id = uid(); copy.title = `${quiz.title.slice(0, 110)} (copy)`; copy.updated_at = new Date().toISOString(); const result = await db('giveaway_quizzes', { method: 'POST', body: copy }); S.quizzes.unshift(result[0]); renderDashboard(); toast('Quiz duplicated.'); },
            'delete-quiz': el => { const quiz = S.quizzes.find(q => q.id === el.dataset.id); modal('Delete this quiz?', `<p>“${esc(quiz.title)}” will be permanently deleted. Saved results will stay.</p>`, `<button class="btn danger" data-action="confirm-delete-quiz" data-id="${quiz.id}">Delete quiz</button>`); },
            'confirm-delete-quiz': async (el) => { await db(`giveaway_quizzes?id=eq.${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' }); S.quizzes = S.quizzes.filter(q => q.id !== el.dataset.id); closeModal(); renderDashboard(); toast('Quiz deleted.'); }
        } };
}
