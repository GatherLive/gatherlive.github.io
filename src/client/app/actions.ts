import type {AppContext} from './context.js';
export function createAppActions(context: AppContext) {
    const S = context.state;
    const closeModal = (...args) => context.closeModal(...args);
    return { actions: {
            'close-modal': closeModal
        } };
}
