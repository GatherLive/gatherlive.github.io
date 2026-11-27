import type {CompetitionSettings, Question, QuestionType, Quiz, TeamSettings} from '../../../shared/types.js';
import {esc} from '../../core/dom.js';
import {TYPES} from '../../core/quiz-types.js';
import {DEFAULT_REVEAL_DELAY, MAX_REVEAL_DELAY} from '../../core/live-game.js';

const specialTypes = [
    {value: 'unique', mode: 'unique', response: 'text', label: 'Don’t Repeat Each Other'},
    {value: 'avoid-host-text', mode: 'avoid-host', response: 'text', label: 'Text · Don’t Say the Same Thing as Me'},
    {value: 'avoid-host-choice', mode: 'avoid-host', response: 'choice', label: 'Choices · Don’t Say the Same Thing as Me'}
] as const;
const maxLives = 12;
const maxTeamCapacity = 500;

export function isTextResponse(type: QuestionType) {
    return type === 'short_answer' || type === 'open_ended';
}

export function isCompetitionQuestion(question: Question) {
    return question.competition?.mode === 'unique' || question.competition?.mode === 'avoid-host';
}
export function usesPoints(question: Question) {
    return !isCompetitionQuestion(question) && !['poll', 'word_cloud', 'open_ended', 'slide'].includes(question.type);
}

export function questionTypeOptions(question: Question) {
    const active = question.competition?.mode;
    const current = active === 'unique' ? 'unique' : active === 'avoid-host'
        ? isTextResponse(question.type) ? 'avoid-host-text' : 'avoid-host-choice'
        : question.type;
    const option = (value: string, label: string) =>
        `<option value="${value}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
    return Object.entries(TYPES).map(([value, label]) => option(value, label)).join('') +
        `<optgroup label="Competition">${specialTypes.map(({value, label}) => option(value, label)).join('')}</optgroup>`;
}

export function selectQuestionType(question: Question, value: string, newQuestion: (type: QuestionType) => Question) {
    const special = specialTypes.find(item => item.value === value);
    if (!special && !Object.hasOwn(TYPES, value)) return question;
    let type = value as QuestionType;
    if (special?.response === 'text') type = isTextResponse(question.type) ? question.type : 'short_answer';
    if (special?.response === 'choice') {
        type = ['single', 'true_false', 'poll'].includes(question.type) ? question.type : 'single';
    }
    const sameType = type === question.type;
    const next = sameType ? {...question, correct: question.correct ?? [], acceptedAnswers: question.acceptedAnswers ?? []} : {
        ...newQuestion(type), id: question.id, prompt: question.prompt, image: question.image,
        timeLimit: question.timeLimit, explanation: question.explanation
    };
    const previous = question.competition;
    if (special) {
        next.competition = {
            mode: special.mode,
            reveal: previous?.reveal ?? 'all',
            publicAnswers: previous?.publicAnswers ?? false
        };
        if (special.mode === 'avoid-host' && previous?.mode === 'avoid-host' && sameType) {
            next.competition.secretAnswer = previous.secretAnswer;
        }
    } else if (type !== 'slide' && previous?.publicAnswers) {
        next.competition = {mode: 'classic', reveal: 'all', publicAnswers: true};
    } else {
        delete next.competition;
    }
    if (!usesPoints(next)) next.points = 0;
    else if (usesPoints(question)) next.points = question.points;
    return next;
}

export function needsLives(quiz: Quiz) {
    return quiz.questions.some(isCompetitionQuestion) || quiz.settings?.competition?.teams?.scoring === 'elimination';
}

export function defaultTeams(): TeamSettings {
    return {a: 1, b: 7, assignment: 'auto', scoring: 'points', sharedLives: false};
}

const selected = (current: string, value: string) => current === value ? 'selected' : '';
const checked = (value: boolean) => value ? 'checked' : '';

export function liveGameEditor(quiz: Quiz) {
    const game = quiz.settings.game;
    return `<div${game ? ' class="two-col"' : ''}>
        <div class="field"><label for="quiz-game-type">Game type</label>
            <select id="quiz-game-type">
                <option value="quiz" ${game ? '' : 'selected'}>Quiz</option>
                <option value="live" ${game ? 'selected' : ''}>Live game</option>
            </select>
            ${game ? '<span class="hint">Players see each other’s answers during the reveal.</span>' : ''}
        </div>
        ${game ? `<div class="field"><label for="quiz-game-reveal">Answer reveal</label>
            <select id="quiz-game-reveal">
                <option value="all" ${selected(game.reveal, 'all')}>All at once</option>
                <option value="turns" ${selected(game.reveal, 'turns')}>One at a time</option>
                <option value="auto" ${selected(game.reveal, 'auto')}>One at a time · automatic</option>
            </select>
        </div>` : ''}
        ${game?.reveal === 'auto' ? `<div class="field"><label for="quiz-game-reveal-delay">Automatic reveal interval (seconds)</label>
            <input type="number" id="quiz-game-reveal-delay" min="1" max="${MAX_REVEAL_DELAY}" step="1" inputmode="numeric" value="${game.revealDelay ?? DEFAULT_REVEAL_DELAY}"></div>` : ''}
    </div>`;
}

export function competitionSettingsEditor(quiz: Quiz) {
    const settings = quiz.settings.competition;
    const teams = settings?.teams;
    const required = needsLives(quiz);
    const lives = settings?.lives === 0 && required ? 3 : settings?.lives ?? (required ? 3 : 0);
    const enabled = lives !== 0;
    return `<details class="editor-disclosure competition-editor" data-editor-panel="competition">
        <summary>Competition</summary>
        <fieldset class="competition-group">
            <legend>Player lives</legend>
            <label class="checkbox-row">
                <input type="checkbox" id="competition-lives-enabled" data-competition-setting="enabled" ${checked(enabled)} ${required ? 'disabled aria-describedby="competition-lives-note"' : ''}>
                Enable lives
            </label>
            ${required ? '<p class="competition-hint" id="competition-lives-note">Required by your questions or team rules.</p>' : ''}
            ${enabled ? `<div class="two-col competition-fields">
                <div class="field"><label for="competition-lives">Starting lives</label><input type="number" id="competition-lives" data-competition-setting="lives" value="${Number.isFinite(lives) ? esc(lives) : ''}" min="1" max="${maxLives}" step="1" inputmode="numeric"></div>
                ${quiz.settings.roundsEnabled ? `<div class="field"><label for="competition-lives-reset">Restore lives</label><select id="competition-lives-reset" data-competition-setting="livesReset"><option value="game" ${selected(settings?.livesReset ?? 'game', 'game')}>Next game</option><option value="round" ${selected(settings?.livesReset, 'round')}>Each round</option></select></div>` : ''}
            </div>` : ''}
        </fieldset>
        <fieldset class="competition-group">
            <legend>Teams</legend>
            <label class="checkbox-row"><input type="checkbox" id="competition-teams-enabled" data-team-setting="enabled" ${checked(!!teams)}>Enable teams</label>
            ${teams ? `<div class="two-col competition-fields competition-team-fields">
                <div class="field"><label for="competition-team-a">Team A capacity</label><input type="number" id="competition-team-a" data-team-setting="a" value="${esc(teams.a)}" min="1" max="${maxTeamCapacity - 1}" step="1" inputmode="numeric"></div>
                <div class="field"><label for="competition-team-b">Team B capacity</label><input type="number" id="competition-team-b" data-team-setting="b" value="${esc(teams.b)}" min="1" max="${maxTeamCapacity - 1}" step="1" inputmode="numeric"></div>
                <div class="field competition-select"><label for="competition-assignment">Team assignment</label><select id="competition-assignment" data-team-setting="assignment"><option value="auto" ${selected(teams.assignment, 'auto')}>Assign automatically</option><option value="pick" ${selected(teams.assignment, 'pick')}>Players choose</option></select></div>
                <div class="field competition-select"><label for="competition-scoring">Winning team</label><select id="competition-scoring" data-team-setting="scoring"><option value="points" ${selected(teams.scoring, 'points')}>Highest average score</option><option value="elimination" ${selected(teams.scoring, 'elimination')}>Last team standing</option></select></div>
            </div>
            ${teams.scoring === 'elimination' ? '<label class="checkbox-row"><input type="checkbox" id="competition-shared-lives" data-team-setting="sharedLives" ' + checked(teams.sharedLives === true) + '>Share lives within each team</label>' : '<p class="competition-hint">Each team’s score is averaged across its players.</p>'}` : ''}
        </fieldset>
    </details>`;
}

export function secretChoiceLabel(text: string, index: number) {
    return text.trim() ? text.trim() : `Choice ${index + 1}`;
}

export function questionCompetitionEditor(question: Question, liveGame = false) {
    if (question.type === 'slide') return '';
    const rules = question.competition;
    const special = isCompetitionQuestion(question);
    let secret = '';
    if (rules?.mode === 'avoid-host') {
        const answer = rules.secretAnswer ?? '';
        const field = isTextResponse(question.type)
            ? `<input id="competition-secret" data-question-competition="secretAnswer" type="text" maxlength="200" value="${esc(answer)}" autocomplete="off" aria-describedby="competition-secret-hint">`
            : `<select id="competition-secret" data-question-competition="secretAnswer" aria-describedby="competition-secret-hint">
                <option value="">Choose an answer</option>
                ${question.options.map((option, index) => `<option value="${esc(option.id)}" ${selected(answer, option.id)}>${esc(secretChoiceLabel(option.text, index))}</option>`).join('')}
              </select>`;
        secret = `<div class="field competition-secret"><label for="competition-secret">Secret host answer</label>${field}<span class="hint" id="competition-secret-hint">Players who match this answer lose a life.</span></div>`;
    }
    if (liveGame) return secret;
    return `${secret}<details class="editor-disclosure competition-editor" data-editor-panel="${esc(question.id)}:competition" ${special ? 'open' : ''}>
        <summary>Answer reveal</summary>
        <label class="checkbox-row"><input id="competition-public-answers" type="checkbox" data-question-competition="publicAnswers" ${checked(rules?.publicAnswers === true)}>Show names and answers after this question</label>
        ${special && rules?.publicAnswers ? `<div class="field">
            <label for="competition-reveal">Reveal order</label>
            <select id="competition-reveal" data-question-competition="reveal">
                <option value="all" ${selected(rules.reveal, 'all')}>All at once</option>
                <option value="turns" ${selected(rules.reveal, 'turns')}>One at a time (alternating)</option>
            </select>
        </div>` : ''}
    </details>`;
}

export function validateCompetitionSettings(settings: CompetitionSettings | undefined) {
    if (settings == null) return;
    const {lives = 0, livesReset = 'game', teams} = settings;
    if (typeof settings !== 'object' || Array.isArray(settings) || !Number.isSafeInteger(lives) ||
        lives < 0 || lives > maxLives || !['game', 'round'].includes(livesReset)) {
        throw new Error('Choose between 1 and 12 lives, or turn lives off.');
    }
    if (teams == null) return;
    const {a, b, assignment, scoring, sharedLives = false} = teams;
    if (typeof teams !== 'object' || Array.isArray(teams) || !Number.isSafeInteger(a) || !Number.isSafeInteger(b) ||
        a < 1 || b < 1 || a + b > maxTeamCapacity || !['auto', 'pick'].includes(assignment) ||
        !['points', 'elimination'].includes(scoring) || typeof sharedLives !== 'boolean' ||
        (sharedLives && scoring !== 'elimination')) {
        throw new Error('Give both teams a capacity, up to 500 players combined.');
    }
}

export function validateQuestionCompetition(question: Question, prefix: string) {
    const rules = question.competition;
    if (rules == null) return;
    const {mode = 'classic', reveal = 'all', publicAnswers = false, secretAnswer} = rules;
    if (typeof rules !== 'object' || Array.isArray(rules) || !['classic', 'unique', 'avoid-host'].includes(mode) ||
        !['all', 'turns'].includes(reveal) || typeof publicAnswers !== 'boolean') {
        throw new Error(prefix + 'choose valid competition settings.');
    }
    if (mode === 'unique' && !isTextResponse(question.type)) throw new Error(prefix + 'unique answers need a text question.');
    if (mode !== 'avoid-host') return;
    if (typeof secretAnswer !== 'string' || !secretAnswer.replace(/\p{Default_Ignorable_Code_Point}/gu, '').trim() || secretAnswer.length > 200) {
        throw new Error(prefix + 'set a secret host answer.');
    }
    if (!isTextResponse(question.type) && (!['single', 'true_false', 'poll'].includes(question.type) ||
        !question.options?.some(option => option.id === secretAnswer))) {
        throw new Error(prefix + 'choose a secret host option.');
    }
}
