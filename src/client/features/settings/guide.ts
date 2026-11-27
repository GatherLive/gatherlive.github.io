import {icon} from '../../core/icons.js';
import {TYPES} from '../../core/quiz-types.js';

const questionHelp: Record<keyof typeof TYPES, string> = {
    single: 'Choose one correct option.',
    multi: 'Select all correct options.',
    true_false: 'Decide whether a statement is true.',
    short_answer: 'Type an answer that matches an accepted response.',
    poll: 'Vote for an option. No points.',
    order: 'Arrange the items in the correct order.',
    slider: 'Pick a number within the accepted range.',
    word_cloud: 'Add a word or phrase to a shared cloud. No points.',
    open_ended: 'Write a longer response. No points.',
    pin: 'Tap a point inside the correct circle or box.',
    slide: 'Show information or an image before continuing.'
};

function guideSection(title: string, symbol: string, body: string) {
    return `<details class="settings-disclosure guide-section"><summary>
        <span>${icon(symbol, 18)} ${title}</span>${icon('chevron', 16)}
    </summary><div class="guide-section-body">${body}</div></details>`;
}

function guidePath(...labels: string[]) {
    return `<strong class="guide-path">${labels.map(label=>`<span>${label}</span>`).join(' '+icon('chevron',12)+' ')}</strong>`;
}

export function guideSettings() {
    const types = Object.entries(TYPES).map(([key, title]) =>
        `<div><dt>${title}</dt><dd>${questionHelp[key]}</dd></div>`).join('');
    return `<section class="settings-group guide-prompts">
        <h2>Create with AI</h2>
        <p>Copy a prompt into your AI, then choose <strong>Import quiz</strong> in My quizzes to open its JSON file.</p>
        <button type="button" class="settings-link" data-action="copy-ai-prompt">
            ${icon('users', 20)}<span><strong>Host quiz prompt</strong><small>Create an editable quiz for a group.</small></span>${icon('copy', 18)}
        </button>
        <button type="button" class="settings-link" data-action="copy-study-prompt">
            ${icon('quiz', 20)}<span><strong>Solo play prompt</strong><small>Practice from a topic or your notes with questions hidden in the editor.</small></span>${icon('copy', 18)}
        </button>
    </section>
    <section class="settings-group guide-topics" aria-label="Using Gather">
        ${guideSection('Play a quiz', 'play', `<p>Choose <strong>Host</strong> to open a room. In the lobby, use ${guidePath('Settings','Play mode')} before starting.</p><p><strong>Host only</strong> runs a quiz for others. <strong>Group play</strong> puts you in the quiz too. Share the room code with friends so they can join.</p><p><strong>Solo play</strong> is private. Choose <strong>Save and leave</strong> to pause, then resume from ${guidePath('My quizzes','Open rooms')} within 24 hours of opening the room.</p>`)}
        ${guideSection('Game settings', 'settings', `<p>Open <strong>Game settings</strong> for scoring, shuffling, countdowns and rounds. Choose <strong>Use these settings for new questions</strong> to reuse time and points. Use the toolbar’s undo and redo buttons to restore edits.</p><p>Use ${guidePath('Settings','Two-step verification')} in the lobby to require a second code. Select <strong>Verification code</strong> to show it.</p>`)}
        ${guideSection('Autoplay', 'clock', `<p>Open ${guidePath('Room Settings','Autoplay')}. Start now, after a delay or at a clock time within 24 hours of opening the room. The countdown appears to the left of Chat.</p><p>Set waits between questions and rounds and choose the question countdown. Turn on <strong>Finish when everyone answers</strong> to reveal early during manual play or Autoplay.</p><p>Autoplay pauses when everyone disconnects or after five minutes without an answer once the quiz starts. Resume or use manual controls from the same settings.</p>`)}
        ${guideSection('Room chat', 'chat', `<p>Once chat is unlocked, use ${guidePath('Room Settings','Chat settings')} to choose when chat opens and whether participants can reply, react or mention each other.</p><p>Use <strong>Announce</strong> to post a message. For a display countdown, write <strong>Quiz starting in {20} minutes</strong>. Use Autoplay to start a quiz automatically.</p>`)}
        ${guideSection('Question types', 'quiz', `<dl class="guide-question-types">${types}</dl>`)}
        ${guideSection('Live game', 'users', `<p>Choose <strong>Live game</strong> under ${guidePath('Game settings','Game type')}. Edit your avatar in the lobby and tap the room code to copy it.</p><p>Reveal answers together or one at a time. Automatic turns use the interval in <strong>Answer reveal</strong>. In <strong>Review answers</strong>, post a quick reply or your own note, or reject an incorrect answer.</p><p>Set lives and teams under ${guidePath('Game settings','Competition')}. Players with zero lives can watch until lives reset.</p>`)}
        ${guideSection('Results', 'usage', '<p>Open <strong>Detailed results</strong> to review questions, responses and host notes. Games with lives show winners and remaining hearts. Save results to revisit them in My quizzes or download a report.</p>')}
    </section>`;
}
