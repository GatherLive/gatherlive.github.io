import type {AppContext} from '../../app/context.js';
export function createFeaturesChatActions(context: AppContext) {
    const S = context.state;
    const loadAccountChat = (...args) => context.loadAccountChat(...args);
    const applyForChat = (...args) => context.applyForChat(...args);
    return { actions: {
            'account-chat-refresh': ()=>loadAccountChat({force:true}),
            'apply-chat': applyForChat
        } };
}
