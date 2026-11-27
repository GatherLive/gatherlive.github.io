import type {AppContext} from '../../app/context.js';
import { $ } from '../../core/dom.js';
import {DEFAULT_REVEAL_DELAY, MAX_REVEAL_DELAY, validRevealDelay} from '../../core/live-game.js';
import {defaultTeams, isCompetitionQuestion, selectQuestionType} from './competition.js';
export function createFeaturesEditorChanges(context: AppContext) {
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
            return false;
        if (el.id === 'reuse-question-settings') {
            S.reuseQuestionSettings = el.checked;
            return true;
        }
        if (el.id === 'quiz-game-type') {
            if (el.value === 'live') S.draft.settings.game = {reveal: 'all'};
            else delete S.draft.settings.game;
            markDirty();
            renderEditor();
            $('#quiz-game-type')?.focus({preventScroll: true});
            return true;
        }
        if (el.id === 'quiz-game-reveal' && S.draft.settings.game) {
            S.draft.settings.game.reveal = el.value === 'turns' || el.value === 'auto' ? el.value : 'all';
            markDirty();
            renderEditor();
            $('#quiz-game-reveal')?.focus({preventScroll: true});
            return true;
        }
        if (el.id === 'quiz-game-reveal-delay' && S.draft.settings.game) {
            if (validRevealDelay(el.valueAsNumber)) {
                S.draft.settings.game.revealDelay = el.valueAsNumber;
                markDirty();
            } else {
                el.value = String(S.draft.settings.game.revealDelay ?? DEFAULT_REVEAL_DELAY);
                toast(`Choose 1–${MAX_REVEAL_DELAY} seconds.`, true);
            }
            return true;
        }
        const competitionSetting = el.dataset.competitionSetting;
        if (competitionSetting === 'enabled' || competitionSetting === 'livesReset') {
            const settings = S.draft.settings.competition ??= {lives: 0};
            if (competitionSetting === 'enabled') settings.lives = el.checked ? 3 : 0;
            else settings.livesReset = el.value === 'round' ? 'round' : 'game';
            markDirty();
            if (competitionSetting === 'enabled') {
                renderEditor();
                $('#competition-lives-enabled')?.focus({preventScroll: true});
            }
            return true;
        }
        const teamSetting = el.dataset.teamSetting;
        if (teamSetting === 'enabled') {
            const settings = S.draft.settings.competition ??= {lives: 0};
            if (el.checked) settings.teams = defaultTeams();
            else delete settings.teams;
            markDirty();
            renderEditor();
            $('#competition-teams-enabled')?.focus({preventScroll: true});
            return true;
        }
        const teams = S.draft.settings.competition?.teams;
        if (teams && ['assignment', 'scoring', 'sharedLives'].includes(teamSetting)) {
            if (teamSetting === 'assignment') teams.assignment = el.value === 'pick' ? 'pick' : 'auto';
            if (teamSetting === 'scoring') {
                teams.scoring = el.value === 'elimination' ? 'elimination' : 'points';
                if (teams.scoring === 'points') teams.sharedLives = false;
            }
            if (teamSetting === 'sharedLives') teams.sharedLives = el.checked;
            markDirty();
            if (teamSetting === 'scoring') {
                renderEditor();
                $('#competition-scoring')?.focus({preventScroll: true});
            }
            return true;
        }
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
            return false;
        const questionSetting = el.dataset.questionCompetition;
        if (questionSetting === 'publicAnswers') {
            const rules = q.competition ??= {mode: 'classic', reveal: 'all', publicAnswers: false};
            rules.publicAnswers = el.checked;
            if (!rules.publicAnswers) {
                rules.reveal = 'all';
                if (!isCompetitionQuestion(q)) delete q.competition;
            }
            markDirty();
            renderEditor();
            $('#competition-public-answers')?.focus({preventScroll: true});
            return true;
        }
        if (questionSetting === 'reveal' && q.competition) {
            q.competition.reveal = el.value === 'turns' ? 'turns' : 'all';
            markDirty();
            return true;
        }
        if (questionSetting === 'secretAnswer' && q.competition?.mode === 'avoid-host' && el.tagName === 'SELECT') {
            q.competition.secretAnswer = el.value;
            markDirty();
            return true;
        }
        if (el.dataset.qfield === 'type') {
            const next = selectQuestionType(q, el.value, newQuestion);
            S.draft.questions[S.questionIndex] = next;
            markDirty();
            renderEditor();
            if (isCompetitionQuestion(next) && !isCompetitionQuestion(q)) {
                const reveal = $<HTMLDetailsElement>('.question-editor .competition-editor');
                if (reveal) reveal.open = true;
            }
            $('#question-type')?.focus({preventScroll: true});
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
