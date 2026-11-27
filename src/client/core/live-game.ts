export const DEFAULT_REVEAL_DELAY = 3;
export const MAX_REVEAL_DELAY = 30;
export const MAX_REVIEW_NOTE_LENGTH = 120;

export function validRevealDelay(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_REVEAL_DELAY;
}
import type {Question, TeamSettings} from '../../shared/types.js';


export function questionAwardsPoints(question: Question, teamScoring?: TeamSettings['scoring']) {
    const mode = question.competition?.mode;
    if (mode === 'unique' || mode === 'avoid-host') return teamScoring === 'points';
    return question.points > 0 && !['poll', 'word_cloud', 'open_ended', 'slide'].includes(question.type);
}
