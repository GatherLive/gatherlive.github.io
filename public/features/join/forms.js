import { $ } from '../../core/dom.js';
export function createFeaturesJoinForms(context) {
    const S = context.state;
    const savedPlayer = (...args) => context.savedPlayer(...args);
    const connectRoom = (...args) => context.connectRoom(...args);
    return { forms: { "join-form": { submit: async (form) => {
                    const code = $('#join-code').value, name = $('#join-name').value.trim();
                    if (!/^\d{6}$/.test(code) || !name)
                        throw new Error('Enter a six digit code and your name.');
                    const previous = savedPlayer(code, name);
                    S.room = { ...previous, code, role: 'player', name };
                    try { localStorage.setItem('gather.name', name); } catch { }
                    S.fatalRoomError = null;
                    location.hash = `#room/${code}`;
                    connectRoom();
                } } } };
}
