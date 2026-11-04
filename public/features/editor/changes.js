export function createFeaturesEditorChanges(context) {
    const S = context.state;
    const importQuiz = (...args) => context.importQuiz(...args);
    const toast = (...args) => context.toast(...args);
    const uploadImage = (...args) => context.uploadImage(...args);
    const ensureRounds = (...args) => context.ensureRounds(...args);
    const markDirty = (...args) => context.markDirty(...args);
    const renderEditor = (...args) => context.renderEditor(...args);
    const assignQuestion = (...args) => context.assignQuestion(...args);
    const newQuestion = (...args) => context.newQuestion(...args);
    async function onChange(event) {
        const el = event.target;
        if (el.id === 'import-quiz') {
            await importQuiz(el.files[0]);
            el.value = '';
            return true;
        }
        if (el.dataset.upload) {
            el.disabled = true;
            toast('Uploading your image…');
            await uploadImage(el.files[0], el.dataset.upload);
            return true;
        }
        if (!S.draft)
            return true;
        if (el.dataset.sfield === 'roundsEnabled') {
            if (el.checked)
                ensureRounds();
            markDirty();
            renderEditor();
            return true;
        }
        if (el.id === 'question-round') {
            assignQuestion(S.draft.questions[S.questionIndex].id, el.value);
            S.currentRoundId = el.value;
            markDirty();
            renderEditor();
            return true;
        }
        const q = S.draft.questions[S.questionIndex];
        if (!q)
            return true;
        if (el.dataset.qfield === 'type') {
            const fresh = newQuestion(el.value);
            S.draft.questions[S.questionIndex] = { ...fresh, id: q.id, prompt: q.prompt, image: q.image, timeLimit: q.timeLimit, explanation: q.explanation };
            markDirty();
            renderEditor();
        }
        else if (el.dataset.correct) {
            if (['single', 'true_false'].includes(q.type))
                q.correct = el.checked ? [el.dataset.correct] : [];
            else
                q.correct = el.checked ? [...new Set([...q.correct, el.dataset.correct])] : q.correct.filter(id => id !== el.dataset.correct);
            markDirty();
            renderEditor();
        }
        else if (el.dataset.qfield === 'image' || el.dataset.ofield === 'image') {
            renderEditor();
        }
        return false;
    }
    return { changes: [onChange] };
}
