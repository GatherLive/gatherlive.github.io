export function createFeaturesChatForms(context) {
    const S = context.state;
    return { forms: { "chat-unlock-form": { submit: async (form) => { await S.chat.submit(form); } }, "announcement-form": { submit: async (form) => { await S.chat.submit(form); } }, "chat-settings-form": { submit: async (form) => { await S.chat.submit(form); } }, 'chat-form': { ownFeedback: true, submit: form => S.chat?.submit(form) } } };
}
