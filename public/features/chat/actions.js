export function createFeaturesChatActions(context) {
    const S = context.state;
    const loadAccountChat = (...args) => context.loadAccountChat(...args);
    const applyForChat = (...args) => context.applyForChat(...args);
    return { actions: {
            'account-chat-refresh': loadAccountChat,
            'apply-chat': applyForChat
        } };
}
