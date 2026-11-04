import { $, uid } from '../../core/dom.js';
export function createFeaturesEditorData(context) {
    const S = context.state;
    const renderEditor = (...args) => context.renderEditor(...args);
    const loading = (...args) => context.loading(...args);
    const db = (...args) => context.db(...args);
    const toast = (...args) => context.toast(...args);
    const defaultSettings = (...args) => context.defaultSettings(...args);
    const validateDraft = (...args) => context.validateDraft(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const getToken = (...args) => context.getToken(...args);
    const request = (...args) => context.request(...args);
    async function openEditor(id) {
        if (S.draft?.id === id) {
            renderEditor();
            return;
        }
        let quiz = S.quizzes.find(q => q.id === id);
        if (!quiz) {
            loading('Opening your quiz…');
            try {
                quiz = (await db(`giveaway_quizzes?id=eq.${encodeURIComponent(id)}&select=*`))[0];
            }
            catch (e) {
                toast(e.message, true);
            }
        }
        if (!quiz) {
            location.hash = '#dashboard';
            return;
        }
        S.draft = structuredClone(quiz);
        S.draft.settings = { ...defaultSettings(), ...S.draft.settings };
        S.questionIndex = 0;
        S.dirty = false;
        renderEditor();
    }
    function markDirty() { S.dirty = true; const state = $('#save-state'); if (state)
        state.textContent = 'Unsaved'; }
    async function saveQuiz(silent = false) {
        if (S.saving)
            throw new Error('Your quiz is still saving. Try again in a moment.');
        validateDraft(S.draft);
        S.saving = true;
        $('#save-state') && ($('#save-state').textContent = 'Saving…');
        try {
            const { id, title, description, collection, questions, settings } = S.draft;
            const payload = { id, owner_id: activeUser().id, title: title.trim(), description, collection: collection.trim(), questions, settings, updated_at: new Date().toISOString() };
            const result = await db('giveaway_quizzes?on_conflict=id', { method: 'POST', body: payload, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
            const saved = result[0];
            S.draft = structuredClone(saved);
            S.dirty = false;
            const idx = S.quizzes.findIndex(q => q.id === saved.id);
            if (idx >= 0)
                S.quizzes[idx] = saved;
            else
                S.quizzes.unshift(saved);
            if ($('#save-state'))
                $('#save-state').textContent = 'Saved';
            if (!silent)
                toast('Quiz saved.');
            return saved;
        }
        finally {
            S.saving = false;
            if (S.dirty && $('#save-state'))
                $('#save-state').textContent = 'Unsaved';
        }
    }
    async function uploadImage(file, target) {
        if (!file)
            return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            throw new Error('Choose a JPG, PNG or WebP image.');
        if (file.size > 3 * 1024 * 1024)
            throw new Error('Keep your image under 3 MB.');
        const q = S.draft.questions[S.questionIndex], draftId = S.draft.id;
        const token = await getToken(), ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
        const path = `${activeUser().id}/${uid()}.${ext}`;
        await request(`${S.config.supabaseUrl}/storage/v1/object/giveaway-media/${path}`, { method: 'POST', headers: { apikey: S.config.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
        const url = `${S.config.supabaseUrl}/storage/v1/object/public/giveaway-media/${path}`;
        if (S.draft?.id !== draftId)
            return;
        if (target === 'question')
            q.image = url;
        else {
            const o = q.options.find(o => o.id === target);
            if (o)
                o.image = url;
        }
        markDirty();
        renderEditor();
        toast('Image uploaded.');
    }
    return { openEditor, markDirty, saveQuiz, uploadImage };
}
