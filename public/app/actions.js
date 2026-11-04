export function createAppActions(context) {
    const S = context.state;
    const closeModal = (...args) => context.closeModal(...args);
    return { actions: {
            'close-modal': closeModal
        } };
}
