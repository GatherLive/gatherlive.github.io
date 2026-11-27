import {makeJoinCode,sameJoinCode,JOIN_CODE_PERIOD} from '../rooms/join-verification.js';
import {normalizeAvatar, type AvatarProfile} from '../avatars/profile.js';
import type {Quiz, Question, GameSettings, RoomPhase, RoomMode, RoomPlayer, RoomIdentity, Standing, RoundResult, ImageAsset, MediaGate, RoomAutoplay, DataRecord, CompetitionSettings, CompetitionReview, CompetitionRow, CompetitionReason, TeamId} from '../types.js';
import {createImagePlan, imageSource} from '../media/room-media.js';
import {RoomConversation,chatSettings,CONVERSATION_COMMANDS,type ConversationPhase} from '../chat/conversation.js';
import {AUTOPLAY_IDLE_MS, AUTOPLAY_IMAGE_WAIT_MS, AUTOPLAY_SLIDE_MS, ROOM_LIFETIME_MS, FINISHED_RETENTION_MS, defaultAutoplay, validAutoplayOptions} from '../rooms/autoplay.js';
import {validPinRegion,pinInside,pinRegion} from '../../client/core/pin-regions.js';
import {DEFAULT_REVEAL_DELAY, MAX_REVIEW_NOTE_LENGTH, REVIEW_QUICK_REPLIES, questionAwardsPoints, reviewableAnswer, validRevealDelay} from '../../client/core/live-game.js';
/** Server-authoritative, transport-independent live quiz engine. */
export class EngineError extends Error {
  declare code: string;

  constructor(code, message) { super(message); this.name = 'EngineError'; this.code = code; }
}
const fail = (code, message) => { throw new EngineError(code, message); };
const TYPES = new Set(['single', 'multi', 'true_false', 'short_answer', 'poll', 'order', 'slider', 'word_cloud', 'open_ended', 'pin', 'slide']);
const OPINION = new Set(['poll', 'word_cloud', 'open_ended', 'slide']);
const CHOICE = new Set(['single', 'multi', 'true_false', 'poll', 'order']);
const clone = (value) => JSON.parse(JSON.stringify(value));
const clean = (value, max, label, fallback = '') => {
  if (value == null) value = fallback;
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('INVALID_QUIZ', `${label} is invalid.`);
  return value.trim();
};
const finite = (value, fallback, min, max, label) => {
  const n = value == null ? fallback : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) fail('INVALID_QUIZ', `${label} is invalid.`);
  return n;
};
const normalized = (value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
const competitiveText = (value: string) => normalized(value.replace(/\p{Default_Ignorable_Code_Point}/gu,''));
const questionRule = (q: Question) => q?.competition?.mode ?? 'classic';
const validGameReveal = (value: unknown) => value === 'all' || value === 'turns' || value === 'auto';
const TEAM_IDS: TeamId[] = ['a','b'];
const MAX_COMPETITION_PLAYERS = 500;
const randomInt = (max) => {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new Error('Invalid random range');
  const limit = 0x100000000 - (0x100000000 % max);
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % max;
};
const shuffled = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
const tokenEquals = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== 64 || right.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
};
const imageUrl = (value) => {
  const image = clean(value, 2_800_000, 'Image URL');
  if (!image) return '';
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/u.test(image)) return image;
  if (image.length > 4096) fail('INVALID_QUIZ', 'Image URL is too long.');
  if (image.startsWith('/') && !image.startsWith('//') && !image.includes('\\')) return image;
  try {
    const url = new URL(image);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) fail('INVALID_QUIZ', 'Images must use a secure URL.');
    return url.href;
  } catch (error) {
    if (error instanceof EngineError) throw error;
    fail('INVALID_QUIZ', 'Image URL is invalid.');
  }
};

export function validateQuiz(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_QUIZ', 'A quiz is required.');
  const title = clean(input.title, 120, 'Quiz title');
  if (!title) fail('INVALID_QUIZ', 'Give your quiz a title.');
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 500) fail('INVALID_QUIZ', 'A quiz needs between 1 and 500 questions.');
  const ids = new Set();
  const questions = input.questions.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_QUIZ', 'Question is invalid.');
    const type = raw.type ?? 'single';
    if (!TYPES.has(type)) fail('INVALID_QUIZ', 'Question type is unsupported.');
    const id = clean(raw.id, 80, 'Question ID', `question-${index + 1}`);
    if (!id || ids.has(id)) fail('INVALID_QUIZ', 'Question IDs must be unique.');
    ids.add(id);
    const prompt = clean(raw.prompt, 1000, 'Question');
    if (!prompt) fail('INVALID_QUIZ', 'Every question needs a prompt.');
    const q: Question = { id, type, prompt, image: imageUrl(raw.image), timeLimit: finite(raw.timeLimit, 20, 1, 600, 'Time limit'), points: finite(raw.points, OPINION.has(type) ? 0 : 1000, 0, 2000, 'Points'), explanation: clean(raw.explanation, 2000, 'Explanation') };
    if (raw.competition != null) {
      const {mode='classic', reveal='all', publicAnswers=false, secretAnswer} = raw.competition;
      if (typeof raw.competition !== 'object' || Array.isArray(raw.competition) || !['classic','unique','avoid-host'].includes(mode) ||
        !['all','turns'].includes(reveal) || typeof publicAnswers !== 'boolean') fail('INVALID_QUIZ', 'Choose valid question rules.');
      const isText=type==='short_answer'||type==='open_ended';
      if (mode==='unique'&&!isText) fail('INVALID_QUIZ', 'Unique answers need a text question.');
      if (mode==='avoid-host'&&!isText&&!['single','true_false','poll'].includes(type)) fail('INVALID_QUIZ', 'Avoid the host needs a text or single-choice question.');
      q.competition={mode,reveal,publicAnswers};
      if (mode==='avoid-host') {
        const answer=clean(secretAnswer,200,'Host answer');
        if (!competitiveText(answer)) fail('INVALID_QUIZ', 'Set a secret host answer before opening this room.');
        q.competition.secretAnswer=answer;
      }
    }
    const classic=questionRule(q)==='classic';
    if (![0, 1000, 2000].includes(q.points)) fail('INVALID_QUIZ', 'Points must be 0, 1000 or 2000.');
    if (!classic||OPINION.has(type)) q.points = 0;
    let opts = raw.options;
    if (type === 'true_false' && (!Array.isArray(opts) || opts.length === 0)) opts = [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
    if (CHOICE.has(type)) {
      if (!Array.isArray(opts) || opts.length < 2 || opts.length > 12 || (type === 'true_false' && opts.length !== 2)) fail('INVALID_QUIZ', 'Choice questions need 2–12 options.');
      const optionIds = new Set();
      q.options = opts.map((option, optionIndex) => {
        if (!option || typeof option !== 'object') fail('INVALID_QUIZ', 'Option is invalid.');
        const optionId = clean(option.id, 80, 'Option ID', `option-${optionIndex + 1}`);
        const text = clean(option.text, 500, 'Option text');
        const image = imageUrl(option.image);
        if (!optionId || optionIds.has(optionId) || (!text && !image)) fail('INVALID_QUIZ', 'Options need unique IDs and text or an image.');
        optionIds.add(optionId);
        return { id: optionId, text, image };
      });
      if (questionRule(q)==='avoid-host'&&!optionIds.has(q.competition.secretAnswer)) fail('INVALID_QUIZ', 'Choose a valid secret host option.');
      if (classic&&type !== 'poll') {
        if (!Array.isArray(raw.correct) || raw.correct.length === 0 || raw.correct.some((value) => typeof value !== 'string' || !optionIds.has(value)) || new Set(raw.correct).size !== raw.correct.length) fail('INVALID_QUIZ', 'Choose valid correct answers.');
        if (['single', 'true_false'].includes(type) && raw.correct.length !== 1) fail('INVALID_QUIZ', 'Choose one correct answer.');
        if (type === 'order' && raw.correct.length !== q.options.length) fail('INVALID_QUIZ', 'Order must include every option.');
        q.correct = [...raw.correct];
      }
    }
    if (classic&&type === 'short_answer') {
      if (!Array.isArray(raw.acceptedAnswers) || raw.acceptedAnswers.length < 1 || raw.acceptedAnswers.length > 30) fail('INVALID_QUIZ', 'Provide an accepted answer.');
      q.acceptedAnswers = raw.acceptedAnswers.map((a) => clean(a, 200, 'Accepted answer'));
      if (q.acceptedAnswers.some((a) => !a)) fail('INVALID_QUIZ', 'Accepted answers cannot be empty.');
    }
    if (type === 'slider') {
      q.min = finite(raw.min, 0, -1e9, 1e9, 'Minimum');
      q.max = finite(raw.max, 100, -1e9, 1e9, 'Maximum');
      if (q.min >= q.max) fail('INVALID_QUIZ', 'Maximum must exceed minimum.');
      q.target = finite(raw.target, q.min, q.min, q.max, 'Target');
      q.tolerance = finite(raw.tolerance, 0, 0, q.max - q.min, 'Tolerance');
    }
    if (type === 'pin') {
      if (!q.image) fail('INVALID_QUIZ', 'A pin question needs an image.');
      if (raw.answerRegion != null) {
        if (!validPinRegion(raw.answerRegion)) fail('INVALID_QUIZ', 'Choose a valid correct area.');
        const {shape, x, y, width, height} = raw.answerRegion;
        q.answerRegion = {shape, x, y, width, height};
        q.target = {x, y};
      }else{
        q.target = { x: finite(raw.target?.x, 0.5, 0, 1, 'Pin X'), y: finite(raw.target?.y, 0.5, 0, 1, 'Pin Y') };
        q.tolerance = finite(raw.tolerance, 0.1, 0.001, 1.5, 'Pin tolerance');
      }
    }
    return q;
  });
  const result = { id: clean(input.id, 100, 'Quiz ID'), title, description: clean(input.description, 2000, 'Description'), questions };
  if (JSON.stringify(result).length > 10_000_000) fail('INVALID_QUIZ', 'Quiz is too large.');
  return result;
}

function competitionFrom(raw: Partial<CompetitionSettings> | undefined, questions: Question[]): CompetitionSettings | undefined {
  const special=questions.some(q=>questionRule(q)!=='classic');
  if(raw==null)return special?{lives:3,livesReset:'game'}:undefined;
  if(typeof raw!=='object'||Array.isArray(raw))fail('INVALID_SETTINGS','Competition settings are invalid.');
  const {lives=0,livesReset='game',teams}=raw;
  if(!Number.isSafeInteger(lives)||lives<0||lives>12||!['game','round'].includes(livesReset))fail('INVALID_SETTINGS','Choose 0–12 lives and a valid reset.');
  const result: CompetitionSettings={lives:special&&!lives?3:lives,livesReset};
  if(teams!=null){
    const {a,b,assignment,scoring,sharedLives=false}=teams;
    if(typeof teams!=='object'||Array.isArray(teams)||!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<1||b<1||a+b>MAX_COMPETITION_PLAYERS||
      !['auto','pick'].includes(assignment)||!['points','elimination'].includes(scoring)||typeof sharedLives!=='boolean'||
      (sharedLives&&scoring!=='elimination'))fail('INVALID_SETTINGS','Choose two valid teams with a combined capacity of up to 500.');
    result.teams={a,b,assignment,scoring,sharedLives};
    if(scoring==='elimination'&&!result.lives)result.lives=3;
  }
  return result.lives||result.teams?result:undefined;
}

function settingsFrom(raw: Partial<GameSettings> = {}, questions: Question[] = []): GameSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_SETTINGS', 'Settings are invalid.');
  const boolean = (key, fallback) => {
    if (raw[key] == null) return fallback;
    if (typeof raw[key] !== 'boolean') fail('INVALID_SETTINGS', `${key} must be true or false.`);
    return raw[key];
  };
  const scoring = raw.scoring ?? 'speed';
  if (!['speed', 'accuracy'].includes(scoring)) fail('INVALID_SETTINGS', 'Scoring is invalid.');
  const participantLimit = raw.participantLimit ?? 0;
  if (!Number.isSafeInteger(participantLimit) || participantLimit < 0 || participantLimit > 1_000_000) fail('INVALID_SETTINGS', 'Participant limit is invalid.');
  const questionDelay = raw.questionDelay ?? 0;
  if (!Number.isSafeInteger(questionDelay) || questionDelay < 0 || questionDelay > 30) fail('INVALID_SETTINGS', 'Question countdown must be 0–30 seconds.');
  const roundsEnabled = boolean('roundsEnabled', false);
  const rounds = [];
  if (roundsEnabled) {
    if (!Array.isArray(raw.rounds) || raw.rounds.length < 1 || raw.rounds.length > 100) fail('INVALID_SETTINGS', 'Use between 1 and 100 rounds.');
    const roundIds = new Set();
    const assigned = new Set();
    const questionIds = new Set(questions.map((q) => q.id));
    for (const [index, rawRound] of raw.rounds.entries()) {
      if (!rawRound || typeof rawRound !== 'object' || Array.isArray(rawRound)) fail('INVALID_SETTINGS', 'Round is invalid.');
      // Use the quiz text validator but keep errors specific to game settings.
      const text = (value, max, label, fallback = '') => {
        try { return clean(value, max, label, fallback); }
        catch { fail('INVALID_SETTINGS', `${label} is invalid.`); }
      };
      const id = text(rawRound.id, 80, 'Round ID', `round-${index + 1}`);
      const title = text(rawRound.title, 120, 'Round title', `Round ${index + 1}`) || `Round ${index + 1}`;
      const reward = text(rawRound.reward, 240, 'Round reward');
      if (!id || roundIds.has(id)) fail('INVALID_SETTINGS', 'Round IDs must be unique.');
      if (!Array.isArray(rawRound.questionIds) || rawRound.questionIds.length < 1 || rawRound.questionIds.length > 500) fail('INVALID_SETTINGS', 'Every round needs a question.');
      const ids = [];
      for (const questionId of rawRound.questionIds) {
        if (typeof questionId !== 'string' || !questionIds.has(questionId) || assigned.has(questionId)) fail('INVALID_SETTINGS', 'Assign each question to exactly one round.');
        assigned.add(questionId);
        ids.push(questionId);
      }
      roundIds.add(id);
      rounds.push({ id, title, reward, questionIds: ids });
    }
    if (assigned.size !== questions.length) fail('INVALID_SETTINGS', 'Assign each question to exactly one round.');
  }
  const competition=competitionFrom(raw.competition,questions);
  const allowLateJoin=boolean('allowLateJoin',true);
  const game=raw.game;
  if(game!=null&&(typeof game!=='object'||Array.isArray(game)||!validGameReveal(game.reveal)))fail('INVALID_SETTINGS','Choose a valid answer reveal.');
  const revealDelay=game?.revealDelay??DEFAULT_REVEAL_DELAY;
  if(!validRevealDelay(revealDelay))fail('INVALID_SETTINGS','Choose a reveal delay from 1 to 30 seconds.');
  return { joinVerification: boolean('joinVerification', false), shuffleQuestions: boolean('shuffleQuestions', false), shuffleOptions: boolean('shuffleOptions', false), shuffleTrueFalse: boolean('shuffleTrueFalse', false), scoring, allowLateJoin: !competition&&allowLateJoin, showLeaderboard: boolean('showLeaderboard', true), showQuestionType: boolean('showQuestionType', false), showAnswerOptions: boolean('showAnswerOptions', true), participantLimit, questionDelay, roundsEnabled, rounds, ...chatSettings(raw),...(competition?{competition}:{}),...(game?{game:{reveal:game.reveal,revealDelay}}:{}) };
}

export class RoomEngine {
  declare now: () => number;
  declare code: string;
  declare ownerId: string;
  declare quiz: Quiz;
  declare settings: GameSettings;
  declare capacityLimit: number;
  declare chatUnlocked: boolean;
  declare conversation: RoomConversation;
  declare imagePlan: ImageAsset[];
  declare phase: RoomPhase;
  declare phaseSince: number;
  declare autoplay: RoomAutoplay;
  declare mode: RoomMode;
  declare hostPlayerId: string | null;
  declare questionIndex: number;
  declare roundIndex: number;
  declare roundResults: RoundResult[];
  declare mediaGate: MediaGate | null;
  declare startedAt: number | null;
  declare finishedAt: number | null;
  declare questionTimings: Record<string, {openedAt: number; closedAt: number | null}>;
  declare deadline: number | null;
  declare _answerCount: number;
  declare createdAt: number;
  declare updatedAt: number;
  declare locked: boolean;
  declare players: Map<string, RoomPlayer>;
  declare _names: Map<string, string>;
  declare _standings: Standing[] | null;
  declare _publicReveal: DataRecord | null;
  declare winners: Standing[];
  declare drawnPlayerIds: Set<string>;
  declare draws: DataRecord[];
  declare _images: Map<string, ImageAsset>;
  declare mediaHost: boolean;
  declare joinVerificationSecret: string;
  declare joinVerificationKey: CryptoKey | null;
  declare competitionEntrants: Set<string>;
  declare competitionReview: CompetitionReview | null;
  declare competitionRoster: Set<string> | null;
  declare competitionJoinOrder: number;
  declare competitionRevealCount: number;
  declare namedAnswers: boolean;
  declare teamRoster: Record<TeamId,number> | null;
  declare teamLives: Record<TeamId,number> | null;
  declare hostAvatar: AvatarProfile | null;

  constructor({ code, ownerId, quiz, settings, mediaOrigin, capacityLimit=500, study=false }: {code?: string; ownerId?: string; quiz?: Quiz; settings?: Partial<GameSettings>; mediaOrigin?: string; capacityLimit?: number; study?: boolean} = {}, savedState = null, { now = () => Date.now() } = {}) {
    this.now = now;
    if (savedState) { this._restore(savedState); return; }
    if (typeof code !== 'string' || !/^\d{6}$/u.test(code)) fail('INVALID_ROOM', 'Room code must have six digits.');
    if (typeof ownerId !== 'string' || !ownerId || ownerId.length > 200) fail('INVALID_ROOM', 'Room owner is required.');
    this.code = code;
    this.ownerId = ownerId;
    this.quiz = validateQuiz(quiz);
    this.settings = settingsFrom(settings, this.quiz.questions);
    if(!Number.isSafeInteger(capacityLimit)||capacityLimit<1||capacityLimit>1000000)fail('INVALID_SETTINGS','Account participant limit is invalid.');
    this.capacityLimit=capacityLimit;
    this.settings.participantLimit=this.settings.participantLimit===0?capacityLimit:Math.min(this.settings.participantLimit,capacityLimit);
    this._limitCompetitionSeats();
    this.competitionEntrants=new Set();
    this.competitionReview=null;
    this.competitionRoster=null;
    this.competitionJoinOrder=0;
    this.competitionRevealCount=0;
    this.teamRoster=null;
    this.hostAvatar=null;
    this.teamLives=this.settings.competition?.teams?.sharedLives?{a:this.settings.competition.lives,b:this.settings.competition.lives}:null;
    if(study)this._checkPlayMode('self-study');
    this.joinVerificationSecret = token();this.joinVerificationKey = null;
    this.chatUnlocked = false;
    this.conversation = new RoomConversation(this.settings);
    if (this.settings.roundsEnabled) {
      const questionsById = new Map(this.quiz.questions.map((q) => [q.id, q]));
      this.quiz.questions = this.settings.rounds.flatMap((round) => {
        const ids = this.settings.shuffleQuestions ? shuffled(round.questionIds) : round.questionIds;
        return ids.map((id) => questionsById.get(id));
      });
    } else if (this.settings.shuffleQuestions) this.quiz.questions = shuffled(this.quiz.questions);
    for (const q of this.quiz.questions) if (q.options && (q.type === 'order' || (this.settings.shuffleOptions && (q.type !== 'true_false' || this.settings.shuffleTrueFalse)))) q.options = shuffled(q.options);
    this.imagePlan = createImagePlan(this.quiz.questions, mediaOrigin);
    this._indexImages();
    this.phase = 'lobby';
    this.questionIndex = -1;
    this.roundIndex = 0;
    this.roundResults = [];
    this.mediaGate = null;
    this.startedAt = null;
    this.finishedAt = null;
    this.questionTimings = {};
    this.deadline = null;
    this._answerCount = 0;
    this.createdAt = now();
    this.phaseSince = this.createdAt;
    this.autoplay = defaultAutoplay(this.settings.questionDelay, study);
    this.mode = study ? 'self-study' : 'live';
    this.hostPlayerId = null;
    this.updatedAt = this.createdAt;
    this.locked = false;
    this.players = new Map();
    this._names = new Map();
    this._standings = null;
    this._publicReveal = null;
    this.winners = [];
    this.drawnPlayerIds = new Set();
    this.draws = [];
    if(study){
      this.hostPlayerId=this._addPlayer('You').playerId;
      this.disconnect(this.hostPlayerId);
    }
  }
  static restore(savedState, options = {}) { return new RoomEngine({}, savedState, options); }
  _restore(raw) {
    if (!raw || raw.version !== 1) fail('INVALID_STATE', 'Saved room version is unsupported.');
    this.joinVerificationSecret = /^[a-f0-9]{64}$/.test(raw.joinVerificationSecret || '') ? raw.joinVerificationSecret : token();
    this.joinVerificationKey = null;
    this.code = raw.code;
    this.ownerId = raw.ownerId;
    this.quiz = validateQuiz(raw.quiz);
    this.imagePlan = clone(raw.imagePlan ?? []);
    this._indexImages();
    this.settings = settingsFrom(raw.settings, this.quiz.questions);
    this.capacityLimit=Number.isSafeInteger(raw.capacityLimit)&&raw.capacityLimit>0&&raw.capacityLimit<=1000000?raw.capacityLimit:500;
    this.settings.participantLimit=this.settings.participantLimit===0?this.capacityLimit:Math.min(this.settings.participantLimit,this.capacityLimit);
    this._limitCompetitionSeats();
    this.competitionEntrants=new Set(raw.competitionEntrants??[]);
    this.competitionReview=clone(raw.competitionReview??null);
    if(this.competitionReview&&!this.competitionReview.applied)this.competitionReview.id??=crypto.randomUUID();
    this.competitionRoster=Array.isArray(raw.competitionRoster)?new Set(raw.competitionRoster):null;
    this.competitionJoinOrder=raw.competitionJoinOrder??0;
    this.competitionRevealCount=raw.competitionRevealCount??0;
    this.hostAvatar=normalizeAvatar(raw.hostAvatar);
    this.teamRoster=clone(raw.teamRoster??null);
    this.teamLives=clone(raw.teamLives??(this.settings.competition?.teams?.sharedLives?{a:this.settings.competition.lives,b:this.settings.competition.lives}:null));
    this.chatUnlocked = raw.chatUnlocked===true;
    this.conversation = new RoomConversation(this.settings,raw.conversation,{unlocked:this.chatUnlocked});
    this.phase = raw.phase;
    this.phaseSince = raw.phaseSince ?? raw.updatedAt ?? raw.createdAt;
    this.hostPlayerId = raw.hostPlayerId ?? raw.studyPlayerId ?? null;
    this.mode = raw.mode ?? (this.hostPlayerId ? 'self-study' : 'live');
    this.autoplay = validAutoplayOptions(raw.autoplay?.options) ? clone(raw.autoplay) : defaultAutoplay(this.settings.questionDelay, this.isSelfStudy);
    if(this.autoplay.status==='running')this.autoplay.activityAt??=raw.updatedAt??raw.createdAt;
    this.questionIndex = raw.questionIndex;
    this.roundIndex = raw.roundIndex ?? 0;
    this.roundResults = clone(raw.roundResults ?? []);
    this.mediaGate = clone(raw.mediaGate ?? null);
    this.startedAt = raw.startedAt;
    this.finishedAt = raw.finishedAt ?? null;
    this.questionTimings = clone(raw.questionTimings ?? {});
    this.deadline = raw.deadline;
    this.createdAt = raw.createdAt;
    this.updatedAt = raw.updatedAt;
    this.locked = !!raw.locked;
    this.players = new Map((raw.players ?? []).map((p) => [p.id, { ...clone(p), overallScore: p.overallScore ?? p.score }]));
    this._names = new Map([...this.players.values()].map((p) => [normalized(p.name), p.id]));
    this._standings = null;
    this._publicReveal = null;
    this._answerCount = this.question ? [...this.players.values()].filter((p) => Object.hasOwn(p.answers, this.question.id)).length : 0;
    this.winners = clone(raw.winners ?? []);
    this.drawnPlayerIds = new Set(raw.drawnPlayerIds ?? []);
    this.draws = clone(raw.draws ?? []);
    if(this.phase==='finished')this.conversation.finish();
  }
  serialize({ includePlayers = true, includeConversation = true } = {}) {
    const competition=this.settings.competition||this.settings.game?{
      competitionEntrants:[...this.competitionEntrants],competitionReview:this.competitionReview,
      competitionRoster:this.competitionRoster?[...this.competitionRoster]:null,competitionJoinOrder:this.competitionJoinOrder,
      competitionRevealCount:this.competitionRevealCount,teamRoster:this.teamRoster,teamLives:this.teamLives
    }:{};
    return clone({ version: 1, code: this.code, joinVerificationSecret: this.joinVerificationSecret, ownerId: this.ownerId, capacityLimit: this.capacityLimit, chatUnlocked: this.chatUnlocked, quiz: this.quiz, imagePlan: this.imagePlan, mediaGate:this.mediaGate, settings: this.settings, ...(includeConversation?{conversation:this.conversation.serialize()}:{}), phase: this.phase, phaseSince: this.phaseSince, autoplay: this.autoplay, mode: this.mode, hostPlayerId: this.hostPlayerId, ...(this.hostAvatar?{hostAvatar:this.hostAvatar}:{}), questionIndex: this.questionIndex, roundIndex: this.roundIndex, roundResults: this.roundResults, startedAt: this.startedAt, finishedAt: this.finishedAt, questionTimings: this.questionTimings, deadline: this.deadline, createdAt: this.createdAt, updatedAt: this.updatedAt, locked: this.locked, players: includePlayers ? [...this.players.values()] : [], winners: this.winners, drawnPlayerIds: [...this.drawnPlayerIds], draws: this.draws,...competition });
  }
  _limitCompetitionSeats() {
    const competition=this.settings.competition;
    this.namedAnswers=!!this.settings.game||this.quiz.questions.some(question=>question.competition?.publicAnswers===true);
    if(!competition&&!this.namedAnswers)return;
    const teams=competition?.teams;
    this.settings.participantLimit=Math.min(this.settings.participantLimit,teams?teams.a+teams.b:MAX_COMPETITION_PLAYERS);
  }
  _checkPlayMode(mode: RoomMode) {
    if(mode==='live')return;
    if(this.quiz.questions.some(q=>questionRule(q)==='avoid-host'))fail('INVALID_SETTINGS','Use Host only for questions with a secret host answer.');
    if(mode==='self-study'&&this.settings.competition?.teams)fail('INVALID_SETTINGS','Use a live room for teams.');
  }
  get isSelfStudy() {return this.mode==='self-study';}
  get chatPhase(): ConversationPhase {
    if(this.isSelfStudy||this.phase==='finished'&&this.finishedAt!=null&&this.now()>=this.finishedAt+FINISHED_RETENTION_MS)return 'disabled';
    return this.phase;
  }
  get announcementPhase(): ConversationPhase {
    const phase=this.chatPhase;
    return phase==='reveal'&&this.competitionReview&&!this.competitionReview.applied?'question':phase;
  }
  conversationSnapshot(identity: RoomIdentity) {
    return this.conversation.snapshot(identity,this.chatPhase,this.announcementPhase);
  }
  playerIdFor(identity: RoomIdentity) {
    if(identity.role==='host')return identity.userId===this.ownerId?this.hostPlayerId:null;
    return identity.role==='player'?identity.playerId:null;
  }
  connectHostPlayer(identity: RoomIdentity) {
    if(identity.role!=='host')return;
    this.mediaHost=!this.hostPlayerId&&identity.mediaVersion===2;
    const playerId=this.playerIdFor(identity);
    if(!playerId)return;
    const player=this.players.get(playerId);
    if(!player)fail('PLAYER_MISSING','This practice session could not be restored.');
    player.connected=true;
    if(identity.mediaVersion===2||player.mediaVersion!==2)this.registerMedia(player.id,identity.mediaVersion);
    this._touch();
  }
  _changeMode(identity: RoomIdentity, mode: RoomMode) {
    if(identity.userId!==this.ownerId)fail('FORBIDDEN','Only the host can change play mode.');
    if(this.phase!=='lobby')fail('INVALID_PHASE','Choose the play mode before starting.');
    if(!['live','self-study','group-study'].includes(mode))fail('INVALID_SETTINGS','Choose a play mode.');
    if(mode===this.mode)return;
    this._checkPlayMode(mode);
    const guests=this.players.size-(this.hostPlayerId?1:0);
    if(mode==='self-study'&&guests)fail('ROOM_NOT_PRIVATE','Start a fresh room for Solo play after others have joined.');
    if(mode==='group-study'&&(guests>=this.capacityLimit||guests>=this.settings.participantLimit)){
      fail('ROOM_FULL','Group play needs one free place for the host.');
    }
    const wasPrivate=this.isSelfStudy;
    const oldHost=this.players.get(this.hostPlayerId);
    if(oldHost){
      this.players.delete(oldHost.id);
      this._names.delete(normalized(oldHost.name));
    }
    this.mode=mode;
    this.hostPlayerId=null;
    if(mode!=='live'){
      let name=mode==='self-study'?'You':'Host';
      for(let suffix=2;this._names.has(normalized(name));suffix++)name='Host '+suffix;
      this.hostPlayerId=this._addPlayer(name,undefined,this.hostAvatar).playerId;
    }
    this.connectHostPlayer(identity);
    if(wasPrivate!==this.isSelfStudy&&this.autoplay.status==='off')this.autoplay.options.finishWhenAnswered=this.isSelfStudy;
    this._standings=null;
    this._touch();
  }
  _indexImages() { this._images = new Map(this.imagePlan.map(asset => [imageSource(this.quiz.questions,asset),asset])); }
  authorizeChat({enable=true}={}) {
    if(this.phase==='finished')fail('INVALID_PHASE','This quiz has ended.');
    this.chatUnlocked=true;this.conversation.unlocked=true;
    if(enable&&this.conversation.config.chatMode==='off')this.conversation.config.chatMode='breaks';
    this.conversation.revision++;
  }
  revokeChat() {
    this.chatUnlocked=false;this.conversation.unlocked=false;this.conversation.config.chatMode='off';
    this.conversation.messages=[];this.conversation.revision++;
  }
  imageManifest() {
    // Prefetch ciphertext for nearby questions, rather than downloading a long
    // quiz that a participant may never finish. Keys still wait for opening.
    const last = Math.max(1, this.questionIndex + 2);
    return this.imagePlan.filter(asset=>!this.imageReleased(asset)&&asset.question<=last).map(asset => asset.id);
  }
  imageReleased(asset) { return asset.question < this.questionIndex || (asset.question === this.questionIndex && this.startedAt != null && this.phase !== 'countdown' && this.phase !== 'lobby'); }
  serializePlayer(playerId) { const player = this.players.get(playerId); return player ? clone(player) : null; }
  restorePlayer(raw) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.resumeToken !== 'string' || !/^[a-f0-9]{64}$/u.test(raw.resumeToken) || !raw.answers || typeof raw.answers !== 'object' || Array.isArray(raw.answers) || !Number.isFinite(raw.score)) fail('INVALID_STATE', 'Saved player is invalid.');
    const previous = this.players.get(raw.id);
    if (this.question && previous && Object.hasOwn(previous.answers, this.question.id)) this._answerCount--;
    const player: RoomPlayer = { ...clone(raw), overallScore: raw.overallScore ?? raw.score };
    if(this.settings.competition)this.competitionJoinOrder=Math.max(this.competitionJoinOrder,player.joinOrder??0);
    if (previous) this._names.delete(normalized(previous.name));
    this._names.set(normalized(player.name), player.id);
    this._standings = null;
    this._publicReveal = null;
    this.players.set(player.id, player);
    // Player journals may include responses accepted after the room checkpoint.
    if(this.autoplay.status==='running'){
      for(const {receivedAt} of Object.values(player.answers)){
        if(Number.isFinite(receivedAt))this.autoplay.activityAt=Math.max(this.autoplay.activityAt??0,receivedAt);
      }
    }
    if (this.question && Object.hasOwn(player.answers, this.question.id)) this._answerCount++;
  }
  _touch() { this.updatedAt = this.now(); }
  _setPhase(phase: RoomPhase) {
    const now=this.now();
    if(this.phase==='lobby'&&this.autoplay.status==='running')this.autoplay.activityAt=now;
    this.phase=phase;
    this.phaseSince=now;
    this.autoplay.startsAt=null;
    this.autoplay.clockPaused=false;
    if(this.autoplay.status==='paused')this.autoplay.pausedAt=this.phaseSince;
  }
  get participantCount() { return [...this.players.values()].filter(player => player.connected).length; }
  get question() { return this.quiz.questions[this.questionIndex] ?? null; }
  _autoplayDeadline(now = this.now()) {
    if(this.autoplay.status!=='running')return null;
    if(this.phase==='lobby'){
      const at=this.autoplay.startsAt;
      return at!==null&&(at>now||this.participantCount>0&&this._competitionReady())?at:null;
    }
    if(this.competitionReview&&!this.competitionReview.applied)return null;
    if(this.phase==='reveal')return this.phaseSince+this.autoplay.options.questionWait*1000;
    if(this.phase==='round_results')return this.phaseSince+this.autoplay.options.roundWait*1000;
    if(this.phase==='question'&&this.question?.type==='slide')return this.phaseSince+AUTOPLAY_SLIDE_MS;
    return null;
  }
  _estimatedAutoplayFinish(now: number, advanceAt: number | null) {
    const {questionDelay,questionWait,roundWait}=this.autoplay.options;
    const questionDuration=(q: Question)=>q.type==='slide'?AUTOPLAY_SLIDE_MS:(q.timeLimit+questionWait)*1000;
    let finishAt=Math.max(now,this.deadline??advanceAt??now);

    if(this.phase==='countdown'&&this.question)finishAt+=questionDuration(this.question);
    if(this.phase==='question'&&this.question?.type!=='slide')finishAt+=questionWait*1000;

    for(let index=this.questionIndex+1;index<this.quiz.questions.length;index++){
      finishAt+=questionDelay*1000+questionDuration(this.quiz.questions[index]);
    }
    if(this.settings.roundsEnabled){
      // The current round break is already included in advanceAt.
      const roundsLeft=this.settings.rounds.length-this.roundIndex-(this.phase==='round_results'?1:0);
      finishAt+=roundsLeft*roundWait*1000;
    }
    return finishAt;
  }
  _autoplayIdleAt() {
    if(this.autoplay.status!=='running'||this.phase==='lobby'||this.phase==='finished'||this.competitionReview&&!this.competitionReview.applied)return null;
    return (this.autoplay.activityAt??this.phaseSince)+AUTOPLAY_IDLE_MS;
  }
  _automaticRevealAt() {
    const review=this.competitionReview;
    if(this.phase!=='reveal'||review?.autoRevealAt===undefined||review.applied||review.revealed>=review.rows.length||!this.participantCount)return null;
    return review.autoRevealAt;
  }
  _scheduleReveal() {
    return this.now()+(this.settings.game?.revealDelay??DEFAULT_REVEAL_DELAY)*1000;
  }
  nextDeadline() {
    if(this.autoplay.clockPaused)return null;
    const now=this.now();
    let deadline=this.deadline??this._automaticRevealAt()??this._autoplayDeadline(now);
    if(this.phase==='countdown'&&this.deadline<=now&&this.waitingForImages()){
      deadline=this.autoplay.status==='running'?this.deadline+AUTOPLAY_IMAGE_WAIT_MS:null;
    }
    const idleAt=this._autoplayIdleAt();
    if(idleAt===null)return deadline;
    return deadline===null?idleAt:Math.min(deadline,idleAt);
  }
  mediaStatus(){
    const gate=this.mediaGate;let total=0,ready=0;
    if(gate?.hostRequired){total++;if(gate.hostReady)ready++;}
    if(gate)for(const p of this.players.values())if(p.connected&&p.mediaVersion===2){total++;if(p.mediaReadyToken===gate.token)ready++;}
    return {total,ready,waiting:!!gate&&!gate.forced&&ready<total};
  }
  waitingForImages(){return this.mediaStatus().waiting;}
  registerMedia(playerId,version){const p=this.players.get(playerId);if(p)p.mediaVersion=version===2?2:1;}
  _mediaReady(identity,message){
    if(identity?.mediaVersion!==2||!this.mediaGate||message.token!==this.mediaGate.token||this.phase!=='countdown')return {type:'media_ready_ack',token:message.token,changed:false};
    let changed=false;
    const playerId=this.playerIdFor(identity);
    if(identity.role==='player'||playerId){
      const p=this.players.get(playerId);if(!p)fail('PLAYER_MISSING','Your player session is no longer active.');
      changed=p.mediaReadyToken!==message.token;p.mediaReadyToken=message.token;
    }
    else if(identity.role!=='host'||identity.userId!=null&&identity.userId!==this.ownerId)fail('FORBIDDEN','Join this quiz first.');
    else if(this.mediaGate.hostRequired){changed=!this.mediaGate.hostReady;this.mediaGate.hostReady=true;}
    this.tick();return {type:'media_ready_ack',token:message.token,changed};
  }
  _roundStartIndex(index = this.roundIndex) {
    return this.settings.rounds.slice(0, index).reduce((sum, round) => sum + round.questionIds.length, 0);
  }
  _round() {
    if (!this.settings.roundsEnabled) return null;
    const round = this.settings.rounds[this.roundIndex];
    return { index: this.roundIndex, total: this.settings.rounds.length, id: round.id, title: round.title, reward: round.reward, questionIndex: Math.max(0, this.questionIndex - this._roundStartIndex()), questionCount: round.questionIds.length };
  }
  async joinChallenge() {
    if (!this.joinVerificationKey) this.joinVerificationKey = await crypto.subtle.importKey('raw', Uint8Array.from(this.joinVerificationSecret.match(/../g), value => parseInt(value, 16)), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
    return makeJoinCode(this.joinVerificationKey, this.code, this.now());
  }
  async verifyJoin(code) {
    if (!this.settings.joinVerification) return;
    if (code == null || code === '') fail('JOIN_VERIFICATION_REQUIRED', 'Enter the verification code shown by your host.');
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) fail('JOIN_VERIFICATION_FAILED', 'Enter the current verification code from your host.');
    const now = this.now(), current = await this.joinChallenge();
    if (sameJoinCode(code, current.code)) return;
    // Let a code being typed finish briefly across its rotation boundary.
    if (now % JOIN_CODE_PERIOD < 5000 && sameJoinCode(code, (await makeJoinCode(this.joinVerificationKey, this.code, now - JOIN_CODE_PERIOD)).code)) return;
    fail(code == null || code === '' ? 'JOIN_VERIFICATION_REQUIRED' : 'JOIN_VERIFICATION_FAILED', 'Enter the current verification code from your host.');
  }
  addPlayer(name, playerId = null, resumeToken = null, requestedTeam?: unknown, profile?: unknown) {
    if(this.isSelfStudy)fail('ROOM_NOT_AVAILABLE','Room is not available.');
    this.tick();
    if (playerId != null || resumeToken != null) {
      const player = this.players.get(playerId);
      if (!player || playerId===this.hostPlayerId || !tokenEquals(player.resumeToken, resumeToken)) fail('RESUME_INVALID', 'Your player session could not be restored. Join again.');
      player.connected = true;
      this._touch();
      return { playerId: player.id, resumeToken: player.resumeToken };
    }
    if (this.phase === 'finished') fail('ROOM_FINISHED', 'This quiz has finished.');
    if (this.locked || (this.phase !== 'lobby' && !this.settings.allowLateJoin)) fail('ROOM_LOCKED', 'The host has closed joining.');
    if(this.players.size>=this.capacityLimit)fail('ROOM_FULL','This room has reached the account’s participant limit.');
    if((this.settings.competition||this.namedAnswers)&&this.players.size>=this.settings.participantLimit)fail('ROOM_FULL','This room has no free seats.');
    if (this.settings.participantLimit > 0 && this.participantCount >= this.settings.participantLimit) fail('ROOM_FULL', 'This room has reached the host’s participant limit.');
    if (typeof name !== 'string') fail('INVALID_NAME', 'Enter a nickname.');
    name = name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 32 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) fail('INVALID_NAME', 'Use a nickname of 1–32 characters.');
    if (this._names.has(normalized(name))) fail('NAME_TAKEN', 'That nickname is already in use.');
    const teams=this.settings.competition?.teams;
    if(teams?.assignment==='pick'&&requestedTeam!=='a'&&requestedTeam!=='b')fail('TEAM_REQUIRED','Choose Team A or Team B.');
    return this._addPlayer(name,teams?.assignment==='pick'?requestedTeam as TeamId:undefined,normalizeAvatar(profile));
  }
  _teamSeats(connectedOnly = false): Record<TeamId,number> {
    const seats={a:0,b:0};
    for(const player of this.players.values())if(player.team&&(!connectedOnly||player.connected))seats[player.team]++;
    return seats;
  }
  _assignTeam(requestedTeam?: TeamId): TeamId | undefined {
    const teams=this.settings.competition?.teams;
    if(!teams)return;
    const seats=this._teamSeats();
    if(requestedTeam){
      if(seats[requestedTeam]>=teams[requestedTeam])fail('TEAM_FULL','That team is full. Choose the other team.');
      return requestedTeam;
    }
    const available=TEAM_IDS.filter(team=>seats[team]<teams[team]);
    if(!available.length)fail('ROOM_FULL','Both teams are full.');
    if(available.length===1)return available[0];
    // Fill the emptier share of the intended lineup, while seeding both sides.
    if(!seats.a||!seats.b)return !seats.a?'a':'b';
    return seats.a*teams.b<=seats.b*teams.a?'a':'b';
  }
  _addPlayer(name: string, requestedTeam?: TeamId, avatar?: AvatarProfile | null) {
    const team=this._assignTeam(requestedTeam);
    const lives=this.settings.competition?.lives;
    const id = `p_${crypto.randomUUID()}`;
    const portrait=avatar??(this.settings.game?{style:'dicebear:critters',seed:id.slice(2).replaceAll('-','')}:null);
    const secret = token();
    this._names.set(normalized(name), id);
    this._standings = null;
    this._publicReveal = null;
    this.players.set(id, { id, name, resumeToken: secret, joinedAt: this.now(), connected: true, score: 0, overallScore: 0, answers: {},...(lives?{lives}:{}),...(team?{team}:{}),...(this.settings.competition||this.settings.game?{joinOrder:++this.competitionJoinOrder}:{}),...(portrait?{avatar:portrait}:{}) });
    this._touch();
    return { playerId: id, resumeToken: secret };
  }
  authenticatePlayer(playerId, resumeToken) { return tokenEquals(this.players.get(playerId)?.resumeToken, resumeToken); }
  disconnect(playerId) {
    const player = this.players.get(playerId);
    if (player) { player.connected = false; this._touch(); }
  }
  _removePlayer(player: RoomPlayer) {
    if(this.question&&Object.hasOwn(player.answers,this.question.id))this._answerCount--;
    this._names.delete(normalized(player.name));
    this.players.delete(player.id);
    this.competitionEntrants.delete(player.id);
    this._standings=null;
    this._publicReveal=null;
    const review=this.competitionReview;
    if(review&&!review.applied){
      const index=review.rows.findIndex(row=>row.playerId===player.id);
      if(index>=0){
        review.rows.splice(index,1);
        if(index<review.revealed)review.revealed--;
        review.id=crypto.randomUUID();
      }
    }
  }
  cancelPendingJoin(playerId: string, fresh: boolean) {
    const player=this.players.get(playerId);
    if(!player||playerId===this.hostPlayerId)return;
    if(!fresh){this.disconnect(playerId);return;}
    if(this.competitionRoster?.delete(playerId)&&player.team&&this.teamRoster)this.teamRoster[player.team]--;
    this._removePlayer(player);
    this._touch();
  }
  _lives(player: RoomPlayer) {
    const lives=this.settings.competition?.lives;
    if(!lives)return undefined;
    return this.teamLives&&player.team?this.teamLives[player.team]:player.lives??lives;
  }
  _competitionReady() {
    if(!this.settings.competition?.teams)return true;
    const seats=this._teamSeats(true);
    return seats.a>0&&seats.b>0;
  }
  _canAnswer(player: RoomPlayer) {
    return !this.settings.competition||this.competitionEntrants.has(player.id)&&this._lives(player)!==0;
  }
  _allConnectedAnswered() {
    if(this.autoplay.clockPaused||!this.autoplay.options.finishWhenAnswered||
      this.phase!=='question'||!this.question||this.question.type==='slide'||!this._answerCount)return false;
    let anyConnected=false;
    for(const player of this.players.values()){
      if(!player.connected||!this._canAnswer(player))continue;
      if(!Object.hasOwn(player.answers,this.question.id))return false;
      anyConnected=true;
    }
    return anyConnected;
  }
  tick() {
    if(this.autoplay.clockPaused)return false;
    const now=this.now();
    const idleAt=this._autoplayIdleAt();
    if(idleAt!==null&&now>=idleAt){
      this._pauseAutoplay(now,'idle');
      this._touch();
      return true;
    }
    if(this.phase==='countdown'&&this.deadline!=null&&now>=this.deadline){
      const imageWaitElapsed=this.autoplay.status==='running'&&now>=this.deadline+AUTOPLAY_IMAGE_WAIT_MS;
      if(!this.waitingForImages()||imageWaitElapsed){this._activateQuestion();return true;}
    }
    if(this.phase==='question'&&((this.deadline!=null&&now>=this.deadline)||this._allConnectedAnswered())){this._reveal();return true;}
    const revealAt=this._automaticRevealAt();
    if(revealAt!==null&&now>=revealAt){
      this._revealTurn(this.competitionReview);
      this._touch();
      return true;
    }
    const at=this._autoplayDeadline(now);
    if(at===null||now<at)return false;
    if(this.phase==='lobby')this._queueQuestion(0);
    else if(this.phase==='round_results'){
      if(this.roundResults.at(-1)?.tied)this._drawRound();
      if(this.roundIndex+1<this.settings.rounds.length&&!this._competitionGameDecided())this._nextRound();
      else this._finish();
    }else this._next();
    return true;
  }
  _autoplayStart(start, now: number) {
    let at=now;
    if(start?.mode==='keep'&&this.autoplay.startsAt!==null)at=Math.max(now,this.autoplay.startsAt);
    else if(start?.mode==='delay'&&Number.isInteger(start.seconds)&&start.seconds>0)at=now+start.seconds*1000;
    else if(start?.mode==='time'&&Number.isSafeInteger(start.at)&&start.at>now)at=start.at;
    else if(start?.mode!=='now')fail('INVALID_SETTINGS','Choose a start time in the future.');
    if(at>=this.createdAt+ROOM_LIFETIME_MS)fail('INVALID_SETTINGS','Choose a time before this room expires.');
    return at;
  }
  _resumeQuestionClock(now: number) {
    if(!this.autoplay.clockPaused)return;
    const pausedFor=Math.max(0,now-this.autoplay.pausedAt);
    if(this.deadline!==null)this.deadline+=pausedFor;
    if(this.startedAt!==null)this.startedAt+=pausedFor;
    this.autoplay.clockPaused=false;
  }
  _pauseAutoplay(at: number, reason?: RoomAutoplay['pauseReason']) {
    const auto=this.autoplay;
    auto.resumeTo=auto.status==='off'?'off':'running';
    auto.status='paused';
    auto.pausedAt=at;
    auto.pauseReason=reason;
    auto.clockPaused=(this.isSelfStudy||reason!==undefined)&&['countdown','question'].includes(this.phase);
  }
  pauseEmptyRoom(at=this.now()) {
    if(this.phase==='finished'||this.autoplay.status==='paused')return false;
    const soloInProgress=this.isSelfStudy&&this.phase!=='lobby';
    if(this.autoplay.status!=='running'&&!soloInProgress)return false;
    this._pauseAutoplay(Math.max(this.phaseSince,Math.min(at,this.now())),'empty');
    this._touch();
    return true;
  }
  _configureAutoplay(message: DataRecord) {
    if(this.phase==='finished')fail('INVALID_PHASE','This quiz has finished.');
    const now=this.now(),auto=this.autoplay;
    if(message.action==='apply'){
      const options=message.options;
      if(!validAutoplayOptions(options))fail('INVALID_SETTINGS','Use 0–60 minutes between questions, 5 seconds to 60 minutes between rounds, and a question countdown of 0–30 seconds.');
      const startsAt=this.phase==='lobby'?this._autoplayStart(message.start,now):null;
      this._resumeQuestionClock(now);
      this.phaseSince=now;
      this.autoplay={
        status:'running', options:{
          questionWait:options.questionWait,roundWait:options.roundWait,questionDelay:options.questionDelay,
          finishWhenAnswered:options.finishWhenAnswered
        },
        startsAt,pausedAt:null,clockPaused:false,activityAt:auto.status==='running'?auto.activityAt??now:now
      };
    }else if(message.action==='finish-when-answered'&&typeof message.enabled==='boolean'){
      auto.options.finishWhenAnswered=message.enabled;
    }else if(message.action==='pause'&&(auto.status==='running'||(this.isSelfStudy&&auto.status==='off'&&this.phase!=='lobby'))){
      this._pauseAutoplay(now);
    }else if(message.action==='resume'&&auto.status==='paused'){
      const pausedFor=Math.max(0,now-auto.pausedAt);
      const startsAt=this.phase==='lobby'?Math.max(now,(auto.startsAt??auto.pausedAt)+pausedFor):null;
      if(startsAt!==null&&startsAt>=this.createdAt+ROOM_LIFETIME_MS)fail('INVALID_SETTINGS','Choose a time before this room expires.');
      this._resumeQuestionClock(now);
      this.phaseSince+=pausedFor;
      Object.assign(auto,{status:auto.resumeTo??'running',startsAt,pausedAt:null,resumeTo:undefined,pauseReason:undefined,activityAt:now});
    }else if(message.action==='off'){
      this._resumeQuestionClock(now);
      Object.assign(auto,{status:'off',startsAt:null,pausedAt:null,resumeTo:undefined,pauseReason:undefined});
    }else fail('INVALID_SETTINGS','Choose an available Autoplay action.');
    this._touch();
    this.tick();
    const requestId=typeof message.requestId==='string'&&message.requestId.length<=80?message.requestId:undefined;
    return {type:'autoplay_updated',requestId};
  }
  _next() {
    if(this.phase!=='reveal'&&!(this.phase==='question'&&this.question?.type==='slide'))fail('INVALID_PHASE','Reveal answers before continuing.');
    if(this.competitionReview&&!this.competitionReview.applied)fail('REVIEW_PENDING','Finish reviewing the answers before continuing.');
    if(this.phase==='question')this._reveal();
    const decided=this._competitionDecided();
    if(this.settings.roundsEnabled&&(decided||this.questionIndex+1>=this._roundStartIndex()+this.settings.rounds[this.roundIndex].questionIds.length)){
      this._completeRound();
      return {type:'round_results'};
    }
    if(decided||this.questionIndex+1>=this.quiz.questions.length)this._finish();
    else this._queueQuestion(this.questionIndex+1);
    return {type:this.phase==='finished'?'finished':'started'};
  }
  _nextRound() {
    if(!this.settings.roundsEnabled||this.phase!=='round_results'||this.roundIndex+1>=this.settings.rounds.length)fail('INVALID_PHASE','There is no next round.');
    if(this._competitionGameDecided()){this._finish();return {type:'finished'};}
    this.roundIndex++;
    for(const player of this.players.values())player.score=0;
    const competition=this.settings.competition;
    if(competition?.livesReset==='round'&&competition.lives){
      for(const player of this.players.values()){
        player.lives=competition.lives;
        delete player.elimination;
      }
      if(this.teamLives)this.teamLives={a:competition.lives,b:competition.lives};
    }
    this._standings=null;
    this._queueQuestion(this._roundStartIndex());
    return {type:'started'};
  }
  _updateAvatar(identity: RoomIdentity, raw: unknown) {
    if(this.phase!=='lobby')fail('INVALID_PHASE','Change your avatar before the game starts.');
    const avatar=normalizeAvatar(raw);
    if(!avatar)fail('INVALID_COMMAND','Choose a valid avatar.');
    const player=this.players.get(this.playerIdFor(identity));
    if(identity.role==='host'&&identity.userId===this.ownerId){
      if(JSON.stringify(avatar)===JSON.stringify(this.hostAvatar))return {type:'avatar_updated',changed:false};
      this.hostAvatar=avatar;
      if(player)player.avatar=avatar;
    }else if(identity.role==='player'&&player?.connected){
      if(JSON.stringify(avatar)===JSON.stringify(player.avatar))return {type:'avatar_updated',changed:false};
      player.avatar=avatar;
    }
    else fail('FORBIDDEN','Join the room before choosing an avatar.');
    this._touch();
    return {type:'avatar_updated',changed:true};
  }
  command(identity: RoomIdentity, message: DataRecord): DataRecord {
    this.tick();
    if (!message || typeof message !== 'object' || Array.isArray(message)) fail('INVALID_COMMAND', 'Command is invalid.');
    if(message.type==='media_ready')return this._mediaReady(identity,message);
    if(message.type==='avatar_update')return this._updateAvatar(identity,message.avatar);
    if(CONVERSATION_COMMANDS.has(message.type)){
      if(identity?.role==='host'&&identity.userId!=null&&identity.userId!==this.ownerId)fail('FORBIDDEN','Only the host can control this quiz.');
      return this.conversation.command(identity,message,{phase:this.chatPhase,announcementPhase:this.announcementPhase,players:this.players,now:this.now(),hostPlayerId:this.hostPlayerId,hostAvatar:this.hostAvatar});
    }
    if (identity?.role === 'player') {
      if (message.type !== 'answer') fail('FORBIDDEN', 'Only the host can control the quiz.');
      return this._answer(identity.playerId, message);
    }
    if (identity?.role !== 'host' || (identity.userId != null && identity.userId !== this.ownerId)) fail('FORBIDDEN', 'Only the host can control the quiz.');
    if(this.hostPlayerId&&message.type==='answer'){
      const playerId=this.playerIdFor(identity);
      if(!playerId)fail('FORBIDDEN','Join as a participant to answer.');
      return this._answer(playerId,message);
    }
    if(!this.hostPlayerId&&identity.mediaVersion===2)this.mediaHost=true;
    switch (message.type) {
      case 'game_reveal':
        if(identity.userId!==this.ownerId)fail('FORBIDDEN','Only the host can change the reveal.');
        if(!this.settings.game||this.phase==='finished')fail('INVALID_PHASE','Open a live game to change the reveal.');
        {
          const previous=this.settings.game;
          const reveal=message.reveal??previous.reveal;
          const revealDelay=message.revealDelay??previous.revealDelay??DEFAULT_REVEAL_DELAY;
          if(!validGameReveal(reveal))fail('INVALID_SETTINGS','Choose a valid answer reveal.');
          if(!validRevealDelay(revealDelay))fail('INVALID_SETTINGS','Choose a reveal delay from 1 to 30 seconds.');
          this.settings.game={reveal,revealDelay};
          if(this.competitionReview?.autoRevealAt!==undefined&&revealDelay!==previous.revealDelay)
            this.competitionReview.autoRevealAt=this._scheduleReveal();
          this._touch();
        }
        return {type:'game_reveal_updated'};
      case 'autoplay': return this._configureAutoplay(message);
      case 'room_mode':
        this._changeMode(identity,message.mode);
        return {type:'room_mode_updated',requestId:typeof message.requestId==='string'&&message.requestId.length<=80?message.requestId:undefined,mode:this.mode};
      case 'room_settings':
        if (this.phase !== 'lobby'||this.isSelfStudy) fail('INVALID_PHASE', 'Change join verification in the lobby.');
        if (typeof message.joinVerification !== 'boolean') fail('INVALID_SETTINGS', 'Choose whether join verification is enabled.');
        this.settings.joinVerification = message.joinVerification;this._touch();
        return {type: 'room_settings_updated', joinVerification: this.settings.joinVerification};
      case 'start':
        if (this.phase !== 'lobby') fail('INVALID_PHASE', 'This quiz has already started.');
        if(!this._competitionReady())fail('TEAMS_NOT_READY','Connect at least one player on each team.');
        if(this.autoplay.status==='paused')this._configureAutoplay({action:'off'});
        this._queueQuestion(0);
        return { type: 'started' };
      case 'media_skip':
        if(this.phase!=='countdown'||!this.mediaGate)fail('INVALID_PHASE','There are no images to wait for.');
        this.mediaGate.forced=true;this.tick();return {type:'media_skipped'};
      case 'reveal':
        if (this.phase !== 'question') fail('INVALID_PHASE', 'There is no active question.');
        this._reveal();
        return { type: 'revealed' };
      case 'next': return this._next();
      case 'next_round': return this._nextRound();
      case 'competition_review':
      case 'competition_review_batch':
      case 'competition_reveal':
      case 'competition_auto_reveal':
      case 'competition_apply':
        if(identity.userId!==this.ownerId)fail('FORBIDDEN','Only the host can review these answers.');
        return this._reviewCommand(message);
      case 'finish':
        if (this.phase === 'finished') fail('INVALID_PHASE', 'This quiz has finished.');
        if (this.competitionReview&&!this.competitionReview.applied)fail('REVIEW_PENDING','Finish reviewing the answers before ending the quiz.');
        if(this.phase==='question'&&questionRule(this.question)!=='classic'){
          this._finish();return {type:'finished'};
        }
        if (this.phase === 'question') {
          this._reveal();
          if(this.competitionReview&&!this.competitionReview.applied){
            this.competitionReview.revealed=this.competitionReview.rows.length;
            this._applyReview();
          }
        }
        if (this.settings.roundsEnabled && this.phase === 'reveal' && this.questionIndex + 1 === this._roundStartIndex() + this.settings.rounds[this.roundIndex].questionIds.length) this._completeRound();
        this._finish();
        return { type: 'finished' };
      case 'lock':
        if (typeof message.locked !== 'boolean') fail('INVALID_COMMAND', 'Choose whether joining is locked.');
        this.locked = message.locked;
        this._touch();
        return { type: 'locked', locked: this.locked };
      case 'kick': {
        if (typeof message.playerId !== 'string' || message.playerId===this.hostPlayerId || !this.players.has(message.playerId)) fail('PLAYER_MISSING', 'Player was not found.');
        this._removePlayer(this.players.get(message.playerId));
        if(this._allConnectedAnswered())this._reveal();
        this._touch();
        return { type: 'kicked', playerId: message.playerId };
      }
      case 'draw': return this._draw(message);
      case 'draw_round': return this._drawRound();
      default: fail('INVALID_COMMAND', 'Command is unsupported.');
    }
  }
  _queueQuestion(index) {
    this.competitionReview=null;
    if(this.settings.competition&&this.phase==='lobby'){
      this.competitionRoster=new Set([...this.players.values()].filter(player=>player.connected).map(player=>player.id));
      if(this.settings.competition.teams)this.teamRoster=this._teamSeats(true);
    }
    this.questionIndex = index;
    this._answerCount = 0;
    this._publicReveal = null;
    this.startedAt = null;
    const q=this.question,ids=[...new Set([q.image,...(q.options||[]).map(o=>o.image)].map(source=>this._images.get(source)?.id).filter(Boolean))];
    this.mediaGate=ids.length&&(this.mediaHost||[...this.players.values()].some(p=>p.connected&&p.mediaVersion===2))?{token:crypto.randomUUID(),ids,forced:false,hostRequired:this.mediaHost===true,hostReady:false}:null;
    const delay=this.autoplay.status==='running'?this.autoplay.options.questionDelay:this.settings.questionDelay;
    if (delay === 0&&!this.waitingForImages()) { this._activateQuestion(); return; }
    this._setPhase('countdown');
    this.deadline = this.now() + delay * 1000;
    this._touch();
  }
  _activateQuestion() {
    this._setPhase('question');
    this.mediaGate=null;
    this.startedAt = this.now();
    if(this.settings.competition){
      this.competitionEntrants.clear();
      for(const id of this.competitionRoster??[]){
        const player=this.players.get(id);
        if(player&&this._lives(player)!==0)this.competitionEntrants.add(id);
      }
    }
    Object.defineProperty(this.questionTimings, this.question.id, {value:{openedAt:this.startedAt,closedAt:null},enumerable:true,configurable:true,writable:true});
    this.deadline = this.question.type === 'slide' ? null : this.startedAt + this.question.timeLimit * 1000;
    this._touch();
  }
  _completeRound() {
    const round = this._round();
    if (!round || this.roundResults.some((result) => result.id === round.id)) return;
    const leaderboard = clone(this._leaderboard());
    const topScore = leaderboard[0]?.score ?? 0;
    const competitive=this.settings.competition;
    const winningTeams=this._winningTeams(false);
    const winners = competitive ? this._competitionWinners(leaderboard,winningTeams) : topScore > 0 ? leaderboard.filter((p) => p.score === topScore) : [];
    const points=competitive?.lives?{hasPoints:topScore>0||this._playedForPoints(this.quiz.questions.slice(this._roundStartIndex(),this.questionIndex+1))}:{};
    this.roundResults.push({ id: round.id, index: round.index, title: round.title, reward: round.reward, leaderboard, winners, ...points, tied: !competitive&&winners.length > 1, completedAt: this.now(),...(winningTeams?{winningTeams}:{}) });
    this._setPhase('round_results');
    this.deadline = null;
    this._touch();
  }
  _drawRound() {
    if (this.phase !== 'round_results') fail('INVALID_PHASE', 'Complete the round before resolving a tie.');
    const result = this.roundResults.find((round) => round.index === this.roundIndex);
    if (!result?.tied || result.winners.length < 2) fail('INVALID_PHASE', 'This round has no unresolved tie.');
    result.tiedLeaders = clone(result.winners);
    result.winners = [clone(result.winners[randomInt(result.winners.length)])];
    result.tied = false;
    result.tieResolvedAt = this.now();
    this._touch();
    return { type: 'round_draw', winners: clone(result.winners) };
  }
  _finish() {
    if(this.settings.competition)this.winners=this._competitionWinners(this._leaderboard(),this._winningTeams(true));
    this._setPhase('finished');
    this._standings=null;
    Object.assign(this.autoplay,{status:'off',pausedAt:null});
    this.deadline=null;this.finishedAt=this.now();this.conversation.finish();this._touch();
  }
  _answer(playerId, message) {
    if(this.autoplay.clockPaused)fail('INVALID_PHASE',this.isSelfStudy?'Resume your practice to answer.':'Wait for the host to resume.');
    const player = this.players.get(playerId);
    if (!player) fail('PLAYER_MISSING', 'Your player session is no longer active.');
    if (this.phase !== 'question' || !this.question || this.question.type === 'slide') fail('QUESTION_CLOSED', 'This question is closed.');
    const q = this.question;
    const receivedAt = this.now();
    if (this.deadline != null && receivedAt >= this.deadline) { this._reveal(); fail('QUESTION_CLOSED', 'This question is closed.'); }
    if (message.questionId !== q.id) fail('WRONG_QUESTION', 'This answer belongs to a different question.');
    if(!this._canAnswer(player))fail('SPECTATING','You are spectating this question.');
    if (Object.hasOwn(player.answers, q.id)) fail('ALREADY_ANSWERED', 'Your answer has already been received.');
    const answer = this._validateAnswer(q, message.answer);
    const elapsed = Math.max(0, receivedAt - this.startedAt);
    const correct = questionRule(q)==='classic'?this._isCorrect(q, answer):null;
    const points = correct ? Math.round(q.points * (this.settings.scoring === 'accuracy' ? 1 : 1 - 0.5 * Math.min(1, elapsed / (q.timeLimit * 1000)))) : 0;
    Object.defineProperty(player.answers, q.id, { value: { answer, receivedAt, elapsed, correct, points, awarded: false }, enumerable: true, configurable: true, writable: true });
    if(this.autoplay.status==='running')this.autoplay.activityAt=receivedAt;
    this._answerCount++;
    this._touch();
    if(this._allConnectedAnswered())this._reveal();
    return { type: 'answer_ack', questionId: q.id, answered: true };
  }
  _validateAnswer(q, raw) {
    const invalid = () => fail('INVALID_ANSWER', 'Choose a valid answer.');
    if (CHOICE.has(q.type)) {
      const validIds = new Set(q.options.map((o) => o.id));
      if (q.type === 'multi' || q.type === 'order') {
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > q.options.length || raw.some((id) => typeof id !== 'string' || !validIds.has(id)) || new Set(raw).size !== raw.length || (q.type === 'order' && raw.length !== q.options.length)) invalid();
        return [...raw];
      }
      if (Array.isArray(raw) && raw.length === 1) raw = raw[0];
      if (typeof raw !== 'string' || !validIds.has(raw)) invalid();
      return raw;
    }
    if (q.type === 'slider') {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < q.min || raw > q.max) invalid();
      return raw;
    }
    if (q.type === 'pin') {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.x !== 'number' || typeof raw.y !== 'number' || !Number.isFinite(raw.x) || !Number.isFinite(raw.y) || raw.x < 0 || raw.x > 1 || raw.y < 0 || raw.y > 1) invalid();
      return { x: raw.x, y: raw.y };
    }
    const maximum = q.type === 'open_ended' && questionRule(q)==='classic' ? 1000 : q.type === 'word_cloud' ? 60 : 200;
    if (typeof raw !== 'string' || raw.length > maximum || !raw.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(raw)) invalid();
    return raw.trim();
  }
  _isCorrect(q, answer) {
    if (OPINION.has(q.type)) return null;
    if (['single', 'true_false'].includes(q.type)) return q.correct.includes(answer);
    if (q.type === 'multi') return answer.length === q.correct.length && answer.every((id) => q.correct.includes(id));
    if (q.type === 'order') return answer.every((id, index) => id === q.correct[index]);
    if (q.type === 'short_answer') return q.acceptedAnswers.some((value) => normalized(value) === normalized(answer));
    if (q.type === 'slider') return Math.abs(answer - q.target) <= q.tolerance + Number.EPSILON * Math.max(1, Math.abs(q.target));
    if (q.type === 'pin') return pinInside(pinRegion(q), answer);
    return false;
  }
  _award(player: RoomPlayer, answer: RoomPlayer['answers'][string]) {
    if(!answer||answer.awarded)return;
    player.score+=answer.points;
    player.overallScore=(player.overallScore??player.score-answer.points)+answer.points;
    answer.awarded=true;
  }
  _deductLife(player: RoomPlayer, turn?: number) {
    const lives=this._lives(player);
    if(!lives)return false;
    const elimination=lives===1?{question:this.questionIndex+1,...(turn?{turn}:{})}:null;
    if(this.teamLives&&player.team){
      this.teamLives[player.team]=lives-1;
      if(elimination)for(const member of this.players.values()){
        if(member.team===player.team&&this.competitionRoster?.has(member.id))member.elimination=elimination;
      }
    }else{
      player.lives=lives-1;
      if(elimination)player.elimination=elimination;
    }
    return true;
  }
  _chargeReviewLife(row: CompetitionRow, turn?: number) {
    if(row.lostLife!==undefined)return;
    const player=this.players.get(row.playerId);
    row.lostLife=!!player&&this._deductLife(player,turn);
  }
  _revealTurn(review: CompetitionReview) {
    const row=review.rows[review.revealed++];
    const mode=questionRule(this.question);
    if(review.reveal!=='turns')return;
    if((row.reason==='blank'||row.reason==='wrong')&&(mode!=='classic'||!OPINION.has(this.question.type))){
      this._chargeReviewLife(row,review.revealed);
    }
    if(mode==='unique'&&typeof row.answer==='string'){
      const key=competitiveText(row.answer);
      const matched=key?review.rows.slice(0,review.revealed-1).filter(other=>
        typeof other.answer==='string'&&competitiveText(other.answer)===key):[];
      if(matched.length){
        for(const repeated of [...matched,row]){
          repeated.reason='duplicate';
          this._chargeReviewLife(repeated,review.revealed);
        }
      }
    }
    if(review.revealed===review.rows.length){
      delete review.autoRevealAt;
      if(mode!=='unique')this._applyReview(review.revealed);
    }else if(review.autoRevealAt!==undefined)review.autoRevealAt=this._scheduleReveal();
    this._standings=null;
  }
  _prepareReview(q: Question) {
    const mode=questionRule(q),classic=mode==='classic',unique=mode==='unique';
    const choice=CHOICE.has(q.type);
    const secret=q.competition?.secretAnswer;
    const match=choice?secret:competitiveText(secret??'');
    const roster=(this.settings.competition?[...this.competitionEntrants].map(id=>this.players.get(id)).filter(Boolean):
      [...this.players.values()].filter(player=>player.connected||Object.hasOwn(player.answers,q.id)))
      .sort((a,b)=>(a.joinOrder??0)-(b.joinOrder??0)||a.joinedAt-b.joinedAt||a.id.localeCompare(b.id));
    const gameReveal=this.settings.game?.reveal;
    const gameTurns=gameReveal==='turns'||gameReveal==='auto';
    const reveal=gameReveal&&(gameTurns?'turns':'all');
    const turns=gameReveal?gameTurns:q.competition?.publicAnswers&&q.competition.reveal==='turns';
    if(turns&&this.competitionRevealCount++%2===1)roster.reverse();

    const counts=new Map<string,number>();
    const keyFor=answer=>typeof answer==='string'?(choice?answer:competitiveText(answer)):'';
    if(unique&&!gameTurns)for(const player of roster){
      const key=keyFor(Object.hasOwn(player.answers,q.id)?player.answers[q.id].answer:null);
      if(key)counts.set(key,(counts.get(key)??0)+1);
    }
    const rows: CompetitionRow[]=roster.map(player=>{
      const record=Object.hasOwn(player.answers,q.id)?player.answers[q.id]:null;
      const answer=record?.answer??null;
      const key=keyFor(answer);
      let reason: CompetitionReason='safe';
      if(classic)reason=!record?'blank':OPINION.has(q.type)||record.correct?'safe':'wrong';
      else if(!key)reason='blank';
      else if(unique&&counts.get(key)>1)reason='duplicate';
      else if(!unique&&key===match)reason='host-match';
      return {playerId:player.id,name:player.name,answer,reason};
    });
    this.competitionReview={...(unique?{id:crypto.randomUUID()}:{}),questionId:q.id,rows,revealed:turns?0:rows.length,applied:false,
      ...(reveal?{reveal}:{}),
      ...(gameReveal==='auto'&&rows.length?{autoRevealAt:this._scheduleReveal()}:{})};
    if((!unique&&!turns)||!rows.length)this._applyReview();
  }
  _applyReview(revealTurn?: number) {
    const review=this.competitionReview;
    if(!review||review.applied)return;
    const classic=questionRule(this.question)==='classic';
    // Applying a manual review is a separate step after the last revealed answer.
    const turn=review.reveal==='turns'?(revealTurn??review.revealed+1):undefined;
    for(const row of review.rows){
      const player=this.players.get(row.playerId);
      if(!player)continue;
      const safe=row.reason==='safe';
      if(!safe&&(!classic||!OPINION.has(this.question.type)))this._chargeReviewLife(row,turn);
      const answer=Object.hasOwn(player.answers,review.questionId)?player.answers[review.questionId]:null;
      if(answer&&row.note)answer.reviewNote=row.note;
      if(answer&&!answer.awarded){
        if(!classic){
          answer.correct=safe;
          answer.points=safe&&this.settings.competition?.teams?.scoring==='points'?1000:0;
        }
        this._award(player,answer);
      }
    }
    review.applied=true;
    this.phaseSince=this.now();
    if(this.autoplay.status==='running')this.autoplay.activityAt=this.phaseSince;
    this._standings=null;
    this._touch();
  }
  _reviewCommand(message: DataRecord) {
    const review=this.competitionReview;
    if(this.phase!=='reveal'||!review||review.questionId!==message.questionId)fail('INVALID_PHASE','Open the current question’s review.');
    if(message.type==='competition_apply'&&review.applied)return {type:'competition_updated'};
    if(review.applied)fail('INVALID_PHASE','This review is complete.');

    if(message.type==='competition_reveal'){
      if(message.revealed!==review.revealed||review.revealed>=review.rows.length)fail('STALE_REVEAL','This answer has already been revealed.');
      this._revealTurn(review);
    }else if(message.type==='competition_auto_reveal'){
      if(review.reveal!=='turns'||review.revealed>=review.rows.length||typeof message.enabled!=='boolean')fail('INVALID_COMMAND','Choose a turn-by-turn reveal.');
      if(message.enabled)review.autoRevealAt??=this._scheduleReveal();
      else delete review.autoRevealAt;
    }else if(message.type==='competition_review'||message.type==='competition_review_batch'){
      if(questionRule(this.question)!=='unique'||review.revealed<review.rows.length)fail('REVIEW_PENDING','Reveal every answer before reviewing.');
      if(message.type==='competition_review_batch'){
        if(!review.id||message.reviewId!==review.id)fail('STALE_REVIEW','This review changed. Copy the current answers again.');
        this._reviewBatch(review.rows.filter(reviewableAnswer),message);
      }else{
        const row=review.rows.find(row=>row.playerId===message.playerId);
        const hasDecision=typeof message.accepted==='boolean', hasNote=message.note!==undefined;
        if((!hasDecision&&!hasNote)||!row||!reviewableAnswer(row))fail('INVALID_COMMAND','Choose a submitted answer to approve or reject.');
        if(hasNote&&(!this.settings.game||typeof message.note!=='string'||message.note.length>MAX_REVIEW_NOTE_LENGTH||
          /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(message.note)))fail('INVALID_COMMAND','Enter a short review note.');
        this._setReviewDecision(row,hasDecision?message.accepted:undefined,hasNote?message.note:undefined);
      }
    }else{
      if(review.revealed<review.rows.length)fail('REVIEW_PENDING','Reveal every answer before applying lives.');
      this._applyReview();
    }
    this._touch();
    return {type:'competition_updated'};
  }
  _setReviewDecision(row: CompetitionRow, accepted?: boolean, note?: string) {
    const reason=accepted===undefined?row.reason:accepted?'safe':'rejected';
    if(note!==undefined)row.note=note.trim()||undefined;
    else if(reason!==row.reason)delete row.note;
    if(accepted!==undefined){row.accepted=accepted;row.reason=reason;}
  }
  _reviewBatch(rows: CompetitionRow[], message: DataRecord) {
    if(message.all==='approve'||message.all==='reject'){
      for(const row of rows)this._setReviewDecision(row,message.all==='approve');
      return;
    }
    const decisions=message.decisions;
    if(!Array.isArray(decisions)||!decisions.length||decisions.length>rows.length)fail('INVALID_COMMAND','Choose at least one submitted answer to review.');
    const used=new Set<number>();
    const changes=decisions.map(decision=>{
      if(!Array.isArray(decision)||decision.length!==3)fail('INVALID_COMMAND','Invalid answer review.');
      const [index,accepted,reply]=decision;
      if(!Number.isInteger(index)||index<1||index>rows.length||used.has(index)||typeof accepted!=='boolean'||
        !Number.isInteger(reply)||reply<0||reply>REVIEW_QUICK_REPLIES.length||reply&&!this.settings.game)
        fail('INVALID_COMMAND','Invalid answer or quick reply in the review.');
      used.add(index);
      return {row:rows[index-1],accepted,note:REVIEW_QUICK_REPLIES[reply-1]??''};
    });
    for(const {row,accepted,note} of changes)this._setReviewDecision(row,accepted,note);
  }
  _reveal() {
    const q = this.question;
    if (!q) return;
    if (Object.hasOwn(this.questionTimings,q.id)) this.questionTimings[q.id].closedAt = this.now();
    this._standings = null;
    this._publicReveal = null;
    this._setPhase('reveal');
    this.deadline = null;
    if(this.settings.game&&q.type!=='slide')this._prepareReview(q);
    else if(questionRule(q)==='classic'){
      for(const player of this.players.values()){
        const answer=Object.hasOwn(player.answers,q.id)?player.answers[q.id]:null;
        this._award(player,answer);
        if(this._canAnswer(player)&&!OPINION.has(q.type)&&answer?.correct!==true)this._deductLife(player);
      }
    }else this._prepareReview(q);
    this._touch();
  }
  _competitionDecided() {
    const settings=this.settings.competition;
    if(!settings?.lives||!this.competitionRoster||this.competitionRoster.size<2)return false;
    const teams=settings.teams;
    if(teams?.scoring==='points')return false;
    const alive=[...this.players.values()].filter(player=>this.competitionRoster.has(player.id)&&this._lives(player)>0);
    return teams?new Set(alive.map(player=>player.team)).size<=1:alive.length<=1;
  }
  _competitionGameDecided() {
    return (!this.settings.roundsEnabled||this.settings.competition?.livesReset!=='round')&&this._competitionDecided();
  }
  _teamStandings(overall: boolean) {
    const teams=this.settings.competition?.teams;
    if(!teams)return;
    const seats=this._teamSeats();
    const scores={a:0,b:0},alive={a:0,b:0};
    for(const player of this.players.values()){
      if(!player.team||this.competitionRoster&&!this.competitionRoster.has(player.id))continue;
      scores[player.team]+=overall?(player.overallScore??player.score):player.score;
      if(this._lives(player)!==0)alive[player.team]++;
    }
    return TEAM_IDS.map(id=>({
      id,size:seats[id],capacity:teams[id],alive:alive[id],
      score:scores[id]/(this.teamRoster?.[id]||seats[id]||1),
      ...(this.teamLives?{lives:this.teamLives[id]}:{})
    }));
  }
  _winningTeams(overall: boolean): TeamId[] | undefined {
    const teams=this.settings.competition?.teams;
    if(!teams)return;
    if(!this.teamRoster)return [];
    const entries=this._teamStandings(overall).filter(entry=>this.teamRoster[entry.id]>0&&entry.size>0);
    if(teams.scoring==='elimination')return entries.filter(entry=>entry.alive>0).map(entry=>entry.id);
    const highest=Math.max(...entries.map(entry=>entry.score));
    return entries.filter(entry=>entry.score===highest).map(entry=>entry.id);
  }
  _competitionWinners(leaderboard: Standing[], winningTeams?: TeamId[]) {
    return leaderboard.filter(player=>this.competitionRoster?.has(player.id)&&(winningTeams?
      player.team&&winningTeams.includes(player.team)&&(this.settings.competition?.teams?.scoring==='points'||player.lives>0):player.lives>0));
  }
  _playingFields(player: RoomPlayer) {
    const lives=this._lives(player);
    return {...(lives!==undefined?{lives,eliminated:lives===0}:{}),...(player.team?{team:player.team}:{})};
  }
  _playedForPoints(questions = this.quiz.questions) {
    const teamScoring=this.settings.competition?.teams?.scoring;
    return questions.some(question=>Object.hasOwn(this.questionTimings,question.id)&&this.questionTimings[question.id]?.closedAt!=null&&questionAwardsPoints(question,teamScoring));
  }
  _hasResultPoints() {
    return this._playedForPoints()||[...this.players.values()].some(player=>(player.overallScore??player.score)>0);
  }
  _competitionSnapshot(forHost: boolean, q: Question, revealed: boolean) {
    const settings=this.settings.competition;
    const game=this.settings.game;
    if(!settings&&!game&&!(revealed&&q?.competition?.publicAnswers))return;
    const state: DataRecord={
      lives:settings?.lives??0,livesReset:settings?.livesReset??'game',
      ...(q&&this.startedAt!=null?{questionMode:questionRule(q)}:{})
    };
    if(game&&q!==null&&this.phase==='question')state.answering=settings?this.competitionEntrants.size:this.participantCount;
    if(game&&['lobby','reveal'].includes(this.phase)){
      state.stagePlayers=[...this.players.values()]
        .filter(player=>this.phase!=='lobby'||player.connected)
        .map(player=>({id:player.id,name:player.name,connected:player.connected,
          ...(this.competitionRoster&&!this.competitionRoster.has(player.id)?{spectating:true}:{}),
          ...(player.avatar?{avatar:player.avatar}:{}),...this._playingFields(player)}));
    }
    if(settings&&this.phase==='question')state.answering=this.competitionEntrants.size;
    if(settings?.teams){
      const {assignment,scoring,sharedLives}=settings.teams;
      const entries=this._teamStandings(this.phase==='finished');
      state.teams={assignment,scoring,sharedLives,entries:forHost||this.settings.showLeaderboard||this.phase==='finished'?
        entries:entries.map(({score,...entry})=>entry)};
      if(this.phase==='lobby')state.ready=this._competitionReady();
    }
    if(this.phase==='round_results'||this.phase==='reveal'&&(!this.competitionReview||this.competitionReview.applied))state.gameDecided=this._competitionGameDecided();
    if(this.phase==='finished'&&settings){
      state.winners=this.winners;
      if(this._ranksByElimination())state.rankedByElimination=true;
      const winningTeams=this._winningTeams(true);
      if(winningTeams)state.winningTeams=winningTeams;
    }
    if(!revealed||!q)return state;
    const review=this.competitionReview;
    if(review&&review.questionId===q.id){
      const revealing=review.revealed<review.rows.length;
      const gameTurns=review.reveal==='turns';
      const named=!!game||q.competition?.publicAnswers;
      const share=named&&(!!game||review.applied||q.competition?.reveal==='turns');
      const rows=forHost?review.rows:share?
        review.rows.slice(revealing&&!gameTurns?Math.max(0,review.revealed-1):0,review.revealed):[];
      const resultRows=rows.map(({playerId,name,answer,reason,accepted,lostLife,note})=>{
        const publicReason=review.applied||gameTurns&&lostLife!==undefined?reason:null;
        return {playerId,name,answer,...(forHost||publicReason?{reason}:{}),
          connected:this.players.get(playerId)?.connected===true,
          ...(forHost&&gameTurns?{publicReason}:{}),...(lostLife!==undefined?{lostLife}:{}),
          ...(forHost&&accepted!==undefined?{accepted}:{}),...(note?{note}:{})};
      });
      const secret=(!gameTurns||!revealing||forHost)?q.competition?.secretAnswer:null;
      const optionIndex=secret&&q.options?q.options.findIndex(option=>option.id===secret):-1;
      const hostAnswer=optionIndex>=0?(q.options[optionIndex].text||`Choice ${optionIndex+1}`):secret;
      state.review={
        stage:review.applied?'complete':revealing?'revealing':'review',total:review.rows.length,revealed:review.revealed,...(review.reveal?{reveal:review.reveal}:{}),
        ...(forHost&&!review.applied&&!revealing&&review.id?{id:review.id}:{}),
        ...(game?{stageTotal:review.rows.filter(row=>this.players.get(row.playerId)?.connected).length}:{}),
        ...(forHost&&revealing&&gameTurns?{automatic:review.autoRevealAt!==undefined}:{}),
        rows:resultRows,canReview:forHost&&!review.applied&&questionRule(q)==='unique',...(hostAnswer?{hostAnswer}:{})
      };
    }else if(q.competition?.publicAnswers&&questionRule(q)==='classic'){
      const rows=[];
      for(const player of this.players.values()){
        if(!Object.hasOwn(player.answers,q.id))continue;
        const answer=player.answers[q.id].answer;
        rows.push({playerId:player.id,name:player.name,connected:player.connected,answer:!forHost&&typeof answer==='string'&&answer.length>200?answer.slice(0,200)+'…':answer});
      }
      state.review={stage:'complete',total:rows.length,revealed:rows.length,rows};
    }
    return state;
  }
  _ranksByElimination() {
    const competition=this.settings.competition;
    return !!competition?.lives&&competition.teams?.scoring!=='points';
  }
  _eliminationStandings(): Standing[] {
    const compare=(a: Standing,b: Standing)=>
      Number(b.lives>0)-Number(a.lives>0)||
      (b.elimination?.question??0)-(a.elimination?.question??0)||
      (b.elimination?.turn??0)-(a.elimination?.turn??0);
    const entries=[...this.players.values()].filter(player=>this.competitionRoster?.has(player.id)).map(player=>{
      const lives=this._lives(player);
      return {id:player.id,name:player.name,score:player.overallScore??player.score,lives,
        ...(player.team?{team:player.team}:{}),...(lives===0&&player.elimination?{elimination:player.elimination}:{})};
    }).sort((a,b)=>compare(a,b)||b.lives-a.lives||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    let rank=0;
    return entries.map((entry,index)=>{
      if(!entry.lives&&!entry.elimination)return entry;
      if(!index||compare(entries[index-1],entry))rank=index+1;
      return {...entry,rank};
    });
  }
  _leaderboard() {
    if (this._standings) return this._standings;
    if(this.phase==='finished'&&this._ranksByElimination())return this._standings=this._eliminationStandings();
    let rank = 0;
    let previousScore = null;
    this._standings = [...this.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)).map((p, index) => {
      if (previousScore !== p.score) rank = index + 1;
      previousScore = p.score;
      return { id: p.id, name: p.name, score: p.score, rank, ...this._playingFields(p) };
    });
    return this._standings;
  }
  _draw(message) {
    if (this.phase !== 'finished') fail('INVALID_PHASE', 'Finish the quiz before drawing winners.');
    if(this.settings.competition)fail('INVALID_PHASE','Competition winners are based on lives or team scores.');
    const mode = message.mode ?? 'all';
    const count = message.count ?? 1;
    if (!['all', 'correct', 'top'].includes(mode) || !Number.isSafeInteger(count) || count < 1 || count > 100) fail('INVALID_COMMAND', 'Choose a valid draw mode and 1–100 winners.');
    let eligible = [...this.players.values()].filter((p) => !this.drawnPlayerIds.has(p.id));
    if (mode === 'correct') eligible = eligible.filter((p) => Object.values(p.answers).some((a) => a.correct === true));
    if (eligible.length < count) fail('NOT_ENOUGH_PLAYERS', 'There are not enough eligible players for this draw.');
    // Randomize before a stable score sort so equal scores have equal chances.
    eligible = shuffled(eligible);
    if (mode === 'top') eligible.sort((a, b) => b.score - a.score);
    const winners = eligible.slice(0, count).map((p) => ({ id: p.id, name: p.name, score: p.score }));
    for (const winner of winners) this.drawnPlayerIds.add(winner.id);
    this.winners.push(...winners);
    this.draws.push({ mode, winners, at: this.now() });
    this._touch();
    return { type: 'draw', winners: clone(winners) };
  }
  _me(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const answer = this.startedAt != null && this.question && Object.hasOwn(player.answers, this.question.id) ? player.answers[this.question.id] : null;
    const me: DataRecord = { id: player.id, name: player.name, score: player.score, answered: !!answer,...this._playingFields(player),...(player.avatar?{avatar:player.avatar}:{}) };
    if(this.phase==='question'&&!this._canAnswer(player))me.spectating=true;
    if(this.competitionReview?.applied){
      const row=this.competitionReview.rows.find(row=>row.playerId===player.id);
      if(row)me.competitionReason=row.reason;
    }
    if(this.phase==='finished'||this.isSelfStudy&&this.hostPlayerId===playerId)me.overallScore=player.overallScore;
    if(this.phase==='finished'&&this._ranksByElimination()){
      const placement=this._leaderboard().find(standing=>standing.id===playerId);
      if(placement)Object.assign(me,{rank:placement.rank,elimination:placement.elimination});
      else me.spectating=true;
    }
    if (answer) {
      me.answer = clone(answer.answer);
      if ((this.phase === 'reveal' || this.phase === 'finished')&&(!this.competitionReview||this.competitionReview.applied)) Object.assign(me, { correct: answer.correct, points: answer.points });
    }
    return me;
  }
  progress(playerId = null) {
    const me = this._me(playerId);
    const activePlayers = [...this.players.values()].filter(player => player.connected);
    const answerCount = this.phase === 'question' && this.question ? activePlayers.filter(player => Object.hasOwn(player.answers, this.question.id)).length : this._answerCount;
    return { type: 'progress', answerCount, participantCount: activePlayers.length, ...(me ? { me } : {}) };
  }
  snapshot(forHost = false, playerId = null, {media = false, conversation = false}: {media?: boolean | number; conversation?: boolean} = {}) {
    const q = this.question;
    const showAnswerOptions=this.mode!=='live'||this.settings.showAnswerOptions;
    const revealed = this.startedAt != null && (this.phase === 'reveal' || this.phase === 'finished');
    const answersVisible=revealed&&(!this.competitionReview||this.competitionReview.reveal!=='turns'||this.competitionReview.applied);
    let question = null;
    if (q && this.startedAt != null && ['question', 'reveal', 'finished'].includes(this.phase)) {
      const { correct, acceptedAnswers, target, explanation, tolerance, answerRegion, competition, ...publicQuestion } = q;
      question = clone(publicQuestion);
      if(competition){
        const {mode,reveal,publicAnswers}=competition;
        question.competition={mode,reveal,publicAnswers};
      }
      if (answersVisible) Object.assign(question, clone({ ...(correct ? { correct } : {}), ...(acceptedAnswers ? { acceptedAnswers } : {}), ...(target != null ? { target } : {}), ...(tolerance != null ? { tolerance } : {}), ...(answerRegion ? {answerRegion} : {}), explanation }));
    }
    if (question && !forHost && !revealed && !showAnswerOptions && ['single','multi','true_false','poll'].includes(q.type)) {
      question.options = question.options.map(option => ({id:option.id,text:'',image:''}));
    }
    const activePlayers = [...this.players.values()].filter(player => player.connected);
    const visibleLimit = forHost ? activePlayers.length : this.phase === 'lobby' ? 50 : 10;
    const visiblePlayers = activePlayers.slice(0, visibleLimit);
    const showScores = forHost || this.settings.showLeaderboard || this.phase === 'finished';
    const players = visiblePlayers.map((p) => ({ id: p.id, name: p.name, ...(showScores ? { score: p.score } : {}), connected: p.connected, answered: !!q && Object.hasOwn(p.answers, q.id),...this._playingFields(p),...(p.avatar&&this.phase==='lobby'?{avatar:p.avatar}:{}) }));
    const answerCount = this.phase === 'question' && q ? activePlayers.filter(player => Object.hasOwn(player.answers, q.id)).length : this._answerCount;
    // Public live updates stay bounded even with large rooms; reports retain every standing.
    const roundResults = this.roundResults.map((round) => ({ ...round, leaderboard: forHost ? round.leaderboard : this.settings.showLeaderboard ? round.leaderboard.slice(0, 10) : [] }));
    const showStandings = forHost || this.settings.showLeaderboard || this.phase === 'finished' && !this._ranksByElimination();
    const result: DataRecord = { code: this.code, title: this.quiz.title, phase: this.phase, role: forHost ? 'host' : playerId ? 'player' : 'spectator', questionIndex: this.questionIndex, totalQuestions: this.quiz.questions.length, round: this._round(), roundResults: clone(roundResults), question, deadline: this.deadline, serverNow: this.now(), players, participantCount: activePlayers.length, leaderboard: showStandings ? clone(forHost ? this._leaderboard() : this._leaderboard().slice(0, 10)) : [], answerCount, settings: clone(this.settings), locked: this.locked, winners: clone(this.winners) };
    const {status,startsAt,clockPaused,pausedAt,options,pauseReason}=this.autoplay;
    result.mode=this.mode;
    if(this.hostAvatar&&forHost)result.hostAvatar=this.hostAvatar;
    result.study=this.isSelfStudy;
    result.hostPlaying=forHost&&!!this.hostPlayerId;
    result.settings.showAnswerOptions=showAnswerOptions;
    if(this.isSelfStudy)result.settings.joinVerification=false;
    result.autoplay={
      status, startsAt: status==='running'?startsAt:null, nextAt: this._autoplayDeadline(result.serverNow),
      clockPaused, ...(pauseReason&&status==='paused'?{pauseReason}:{}),
      ...(clockPaused||forHost?{pausedAt}:{}),
      ...(forHost?{options:{...options},latestStartAt:this.createdAt+ROOM_LIFETIME_MS}: {})
    };
    if(forHost&&status==='running'&&(!this.competitionReview||this.competitionReview.applied)){
      result.autoplay.estimatedFinishAt=this._estimatedAutoplayFinish(result.serverNow,result.autoplay.nextAt);
    }
    // A countdown hint describes only the format. Never include content, IDs,
    // image URLs or decryption keys before the question opens. Opaque ciphertext
    // IDs may be sent separately for download readiness; they contain no answers.
    if (this.phase === 'countdown' && this.settings.showQuestionType && q) {
      result.questionHint = { type: q.type, hasImage: !!(q.image || q.options?.some(option => option.image)) };
    }
    if(media===2&&this.phase==='countdown'&&this.mediaGate)result.mediaPreparation={token:this.mediaGate.token,ids:[...this.mediaGate.ids]};
    if(forHost&&this.phase==='countdown'&&this.mediaGate)result.mediaProgress=this.mediaStatus();
    if(media&&this.phase!=='question')result.imageManifest=this.phase==='finished'?[]:this.imageManifest();
    const me = this._me(playerId);
    if (me) result.me = me;
    if(conversation){result.chat=this.conversation.metadata(this.chatPhase);result.announcement=this.conversation.visibleAnnouncement(this.announcementPhase);}
    if (question && media) {
      const keys = new Map();
      const prepare = value => {
        const asset = this._images.get(value);
        if (!asset) return value;
        keys.set(asset.id,{id:asset.id,key:asset.key});
        return `/api/rooms/${this.code}/media/${asset.id}/plain`;
      };
      question.image = prepare(question.image);
      for (const option of question.options || []) option.image = prepare(option.image);
      result.imageKeys = [...keys.values()];
    }
    if (q && answersVisible&&questionRule(q)==='classic') result.reveal = clone(this._revealSummary());
    const competition=this._competitionSnapshot(forHost,q,revealed);
    if(this.phase==='finished'&&competition?.lives>0){
      result.hasPoints=this._hasResultPoints();
      if(forHost||this.settings.showLeaderboard)
        competition.lifeStandings=this._ranksByElimination()?this._leaderboard():
          this._leaderboard().map(({id,name,lives,score})=>({id,name,lives,score:this.players.get(id)?.overallScore??score}));
    }
    if(competition)result.competition=clone(competition);
    return result;
  }
  _revealSummary() {
    if (this._publicReveal) return this._publicReveal;
    const q = this.question;
    const distribution: Record<string,number> = Object.create(null);
    if (q.options) for (const option of q.options) distribution[option.id] = 0;
    const responses = [];
    let responseCount = 0;
    for (const p of this.players.values()) {
      const a = Object.hasOwn(p.answers, q.id) ? p.answers[q.id] : null;
      if (!a) continue;
      if (q.options) for (const id of Array.isArray(a.answer) ? a.answer : [a.answer]) distribution[id as string]++;
      else if (q.type === 'word_cloud') { const key = normalized(a.answer); distribution[key] = (distribution[key] ?? 0) + 1; }
      if (['open_ended', 'word_cloud', 'slider', 'pin'].includes(q.type)) {
        responseCount++;
        if (responses.length < 200) responses.push(clone(a.answer));
      }
    }
    // Bound public opinion summaries; the owner's final report retains every response.
    const summaryDistribution = q.type === 'word_cloud' ? Object.fromEntries(Object.entries(distribution).sort((a, b) => b[1] - a[1]).slice(0, 100)) : distribution;
    this._publicReveal = { ...(q.correct ? { correct: [...q.correct] } : {}), ...(q.acceptedAnswers ? { acceptedAnswers: [...q.acceptedAnswers] } : {}), ...(q.target != null ? { target: clone(q.target) } : {}), ...(q.tolerance != null ? { tolerance: q.tolerance } : {}), ...(q.answerRegion ? {answerRegion: clone(q.answerRegion)} : {}), explanation: q.explanation, distribution: summaryDistribution, responses, responseCount };
    return this._publicReveal;
  }
  /** Call only from an authenticated owner endpoint. Reports contain player answers. */
  report() {
    if (this.phase !== 'finished') fail('INVALID_PHASE', 'Finish the quiz to view its report.');
    let rank = 0, previous = null;
    const overallLeaderboard = this._ranksByElimination()?this._leaderboard():[...this.players.values()].sort((a,b)=>(b.overallScore??b.score)-(a.overallScore??a.score)||a.joinedAt-b.joinedAt||a.id.localeCompare(b.id)).map((p,index)=>{
      const score=p.overallScore??p.score;
      if(score!==previous)rank=index+1;
      previous=score;
      return {id:p.id,name:p.name,score,rank,...this._playingFields(p)};
    });
    const competition=this._competitionSnapshot(true,null,false);
    return clone({ code: this.code, title: this.quiz.title, createdAt: this.createdAt, finishedAt: this.finishedAt, settings: this.settings, ...(competition?.lives>0?{hasPoints:this._hasResultPoints()}:{}), leaderboard: this._leaderboard(), overallLeaderboard, roundResults: this.roundResults, winners: this.winners, draws: this.draws, detailVersion: 1, participantCount:this.players.size, questionTimings:this.questionTimings, questions: this.quiz.questions, players: [...this.players.values()].map(p=>({id:p.id,name:p.name,joinedAt:p.joinedAt,connected:p.connected,score:p.score,overallScore:p.overallScore??p.score,answers:p.answers,...this._playingFields(p)})),...(competition?{competition}:{}) });

  }
}
