import type {AutoplayOptions, RoomAutoplay} from '../types.js';

export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const AUTOPLAY_IMAGE_WAIT_MS = 5000;
export const AUTOPLAY_SLIDE_MS = 8000;
export const AUTOPLAY_IDLE_MS = 5 * 60 * 1000;

export function defaultAutoplay(questionDelay: number, study = false): RoomAutoplay {
  return {
    status: 'off', options: {questionWait: 5, roundWait: 15, questionDelay, finishWhenAnswered: study},
    startsAt: null, pausedAt: null, clockPaused: false
  };
}

export function validAutoplayOptions(raw: Partial<AutoplayOptions>): boolean {
  const inRange = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;
  return !!raw && typeof raw.finishWhenAnswered === 'boolean' && inRange(raw.questionWait, 0, 3600) &&
    inRange(raw.roundWait, 5, 3600) && inRange(raw.questionDelay, 0, 30);
}
