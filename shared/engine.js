import {createImagePlan, imageSource} from './media.js';
import {RoomConversation,chatSettings,CONVERSATION_COMMANDS} from './conversation.js';
/** Server-authoritative, transport-independent live quiz engine. */
export class EngineError extends Error {
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
const randomInt = (max) => {
  if (!Number.isInteger(max) || max < 1 || max > 0x100000000) throw new Error('Invalid random range');
  const limit = 0x100000000 - (0x100000000 % max);
  const data = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(data); } while (data[0] >= limit);
  return data[0] % max;
};
const shuffled = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};
const token = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
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
    const q = { id, type, prompt, image: imageUrl(raw.image), timeLimit: finite(raw.timeLimit, 20, 1, 600, 'Time limit'), points: finite(raw.points, OPINION.has(type) ? 0 : 1000, 0, 2000, 'Points'), explanation: clean(raw.explanation, 2000, 'Explanation') };
    if (![0, 1000, 2000].includes(q.points)) fail('INVALID_QUIZ', 'Points must be 0, 1000 or 2000.');
    if (OPINION.has(type)) q.points = 0;
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
      if (type !== 'poll') {
        if (!Array.isArray(raw.correct) || raw.correct.length === 0 || raw.correct.some((value) => typeof value !== 'string' || !optionIds.has(value)) || new Set(raw.correct).size !== raw.correct.length) fail('INVALID_QUIZ', 'Choose valid correct answers.');
        if (['single', 'true_false'].includes(type) && raw.correct.length !== 1) fail('INVALID_QUIZ', 'Choose one correct answer.');
        if (type === 'order' && raw.correct.length !== q.options.length) fail('INVALID_QUIZ', 'Order must include every option.');
        q.correct = [...raw.correct];
      }
    }
    if (type === 'short_answer') {
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
      q.target = { x: finite(raw.target?.x, 0.5, 0, 1, 'Pin X'), y: finite(raw.target?.y, 0.5, 0, 1, 'Pin Y') };
      q.tolerance = finite(raw.tolerance, 0.1, 0.001, 1.5, 'Pin tolerance');
    }
    return q;
  });
  const result = { id: clean(input.id, 100, 'Quiz ID'), title, description: clean(input.description, 2000, 'Description'), questions };
  if (JSON.stringify(result).length > 10_000_000) fail('INVALID_QUIZ', 'Quiz is too large.');
  return result;
}

function settingsFrom(raw = {}, questions = []) {
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
  return { shuffleQuestions: boolean('shuffleQuestions', false), shuffleOptions: boolean('shuffleOptions', false), scoring, allowLateJoin: boolean('allowLateJoin', true), showLeaderboard: boolean('showLeaderboard', true), showQuestionType: boolean('showQuestionType', false), showAnswerOptions: boolean('showAnswerOptions', true), participantLimit, questionDelay, roundsEnabled, rounds, ...chatSettings(raw) };
}

export class RoomEngine {
  constructor({ code, ownerId, quiz, settings, mediaOrigin } = {}, savedState = null, { now = () => Date.now() } = {}) {
    this.now = now;
    if (savedState) { this._restore(savedState); return; }
    if (typeof code !== 'string' || !/^\d{6}$/u.test(code)) fail('INVALID_ROOM', 'Room code must have six digits.');
    if (typeof ownerId !== 'string' || !ownerId || ownerId.length > 200) fail('INVALID_ROOM', 'Room owner is required.');
    this.code = code;
    this.ownerId = ownerId;
    this.quiz = validateQuiz(quiz);
    this.settings = settingsFrom(settings, this.quiz.questions);
    this.chatUnlocked = false;
    this.conversation = new RoomConversation(this.settings);
    if (this.settings.roundsEnabled) {
      const questionsById = new Map(this.quiz.questions.map((q) => [q.id, q]));
      this.quiz.questions = this.settings.rounds.flatMap((round) => {
        const ids = this.settings.shuffleQuestions ? shuffled(round.questionIds) : round.questionIds;
        return ids.map((id) => questionsById.get(id));
      });
    } else if (this.settings.shuffleQuestions) this.quiz.questions = shuffled(this.quiz.questions);
    for (const q of this.quiz.questions) if (q.options && (this.settings.shuffleOptions || q.type === 'order')) q.options = shuffled(q.options);
    this.imagePlan = createImagePlan(this.quiz.questions, mediaOrigin);
    this._indexImages();
    this.phase = 'lobby';
    this.questionIndex = -1;
    this.roundIndex = 0;
    this.roundResults = [];
    this.mediaGate = null;
    this.startedAt = null;
    this.finishedAt = null;
    this.deadline = null;
    this._answerCount = 0;
    this.createdAt = now();
    this.updatedAt = this.createdAt;
    this.locked = false;
    this.players = new Map();
    this._names = new Map();
    this._standings = null;
    this._publicReveal = null;
    this.winners = [];
    this.drawnPlayerIds = new Set();
    this.draws = [];
  }
  static restore(savedState, options = {}) { return new RoomEngine({}, savedState, options); }
  _restore(raw) {
    if (!raw || raw.version !== 1) fail('INVALID_STATE', 'Saved room version is unsupported.');
    this.code = raw.code;
    this.ownerId = raw.ownerId;
    this.quiz = validateQuiz(raw.quiz);
    this.imagePlan = clone(raw.imagePlan ?? []);
    this._indexImages();
    this.settings = settingsFrom(raw.settings, this.quiz.questions);
    this.chatUnlocked = raw.chatUnlocked===true;
    this.conversation = new RoomConversation(this.settings,raw.conversation,{unlocked:this.chatUnlocked});
    this.phase = raw.phase;
    this.questionIndex = raw.questionIndex;
    this.roundIndex = raw.roundIndex ?? 0;
    this.roundResults = clone(raw.roundResults ?? []);
    this.mediaGate = clone(raw.mediaGate ?? null);
    this.startedAt = raw.startedAt;
    this.finishedAt = raw.finishedAt ?? null;
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
    if(this.phase==='finished')this.conversation.end();
  }
  serialize({ includePlayers = true, includeConversation = true } = {}) {
    return clone({ version: 1, code: this.code, ownerId: this.ownerId, chatUnlocked: this.chatUnlocked, quiz: this.quiz, imagePlan: this.imagePlan, mediaGate:this.mediaGate, settings: this.settings, ...(includeConversation?{conversation:this.conversation.serialize()}:{}), phase: this.phase, questionIndex: this.questionIndex, roundIndex: this.roundIndex, roundResults: this.roundResults, startedAt: this.startedAt, finishedAt: this.finishedAt, deadline: this.deadline, createdAt: this.createdAt, updatedAt: this.updatedAt, locked: this.locked, players: includePlayers ? [...this.players.values()] : [], winners: this.winners, drawnPlayerIds: [...this.drawnPlayerIds], draws: this.draws });
  }
  _indexImages() { this._images = new Map(this.imagePlan.map(asset => [imageSource(this.quiz.questions,asset),asset])); }
  authorizeChat({enable=true}={}) {
    if(this.phase==='finished')fail('INVALID_PHASE','This quiz has ended.');
    this.chatUnlocked=true;this.conversation.unlocked=true;
    if(enable&&this.conversation.config.chatMode==='off')this.conversation.config.chatMode='breaks';
    this.conversation.revision++;
  }
  imageManifest() { return this.imagePlan.filter(asset=>!this.imageReleased(asset)).map(asset => asset.id); }
  imageReleased(asset) { return asset.question < this.questionIndex || (asset.question === this.questionIndex && this.startedAt != null && this.phase !== 'countdown' && this.phase !== 'lobby'); }
  serializePlayer(playerId) { const player = this.players.get(playerId); return player ? clone(player) : null; }
  restorePlayer(raw) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.resumeToken !== 'string' || !/^[a-f0-9]{64}$/u.test(raw.resumeToken) || !raw.answers || typeof raw.answers !== 'object' || Array.isArray(raw.answers) || !Number.isFinite(raw.score)) fail('INVALID_STATE', 'Saved player is invalid.');
    const previous = this.players.get(raw.id);
    if (this.question && previous && Object.hasOwn(previous.answers, this.question.id)) this._answerCount--;
    const player = { ...clone(raw), overallScore: raw.overallScore ?? raw.score };
    if (previous) this._names.delete(normalized(previous.name));
    this._names.set(normalized(player.name), player.id);
    this._standings = null;
    this._publicReveal = null;
    this.players.set(player.id, player);
    if (this.question && Object.hasOwn(player.answers, this.question.id)) this._answerCount++;
  }
  _touch() { this.updatedAt = this.now(); }
  get question() { return this.quiz.questions[this.questionIndex] ?? null; }
  nextDeadline() { if(this.phase==='countdown'&&this.deadline<=this.now()&&this.waitingForImages())return null;return this.phase === 'question' || this.phase === 'countdown' ? this.deadline : null; }
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
    if(identity.role==='player'){const p=this.players.get(identity.playerId);if(!p)fail('PLAYER_MISSING','Your player session is no longer active.');changed=p.mediaReadyToken!==message.token;p.mediaReadyToken=message.token;}
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
  addPlayer(name, playerId = null, resumeToken = null) {
    this.tick();
    if (playerId != null || resumeToken != null) {
      const player = this.players.get(playerId);
      if (!player || !tokenEquals(player.resumeToken, resumeToken)) fail('RESUME_INVALID', 'Your player session could not be restored. Join again.');
      player.connected = true;
      this._touch();
      return { playerId: player.id, resumeToken: player.resumeToken };
    }
    if (this.phase === 'finished') fail('ROOM_FINISHED', 'This quiz has finished.');
    if (this.locked || (this.phase !== 'lobby' && !this.settings.allowLateJoin)) fail('ROOM_LOCKED', 'The host has closed joining.');
    if (this.settings.participantLimit > 0 && this.players.size >= this.settings.participantLimit) fail('ROOM_FULL', 'This room has reached the host’s participant limit.');
    if (typeof name !== 'string') fail('INVALID_NAME', 'Enter a nickname.');
    name = name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 32 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) fail('INVALID_NAME', 'Use a nickname of 1–32 characters.');
    if (this._names.has(normalized(name))) fail('NAME_TAKEN', 'That nickname is already in use.');
    const id = `p_${globalThis.crypto.randomUUID()}`;
    const secret = token();
    this._names.set(normalized(name), id);
    this._standings = null;
    this._publicReveal = null;
    this.players.set(id, { id, name, resumeToken: secret, joinedAt: this.now(), connected: true, score: 0, overallScore: 0, answers: {} });
    this._touch();
    return { playerId: id, resumeToken: secret };
  }
  authenticatePlayer(playerId, resumeToken) { return tokenEquals(this.players.get(playerId)?.resumeToken, resumeToken); }
  disconnect(playerId) {
    const player = this.players.get(playerId);
    if (player) { player.connected = false; this._touch(); }
  }
  tick() {
    if (this.phase === 'countdown' && this.deadline != null && this.now() >= this.deadline && !this.waitingForImages()) { this._activateQuestion(); return true; }
    if (this.phase === 'question' && this.deadline != null && this.now() >= this.deadline) { this._reveal(); return true; }
    return false;
  }
  command(identity, message) {
    this.tick();
    if (!message || typeof message !== 'object' || Array.isArray(message)) fail('INVALID_COMMAND', 'Command is invalid.');
    if(message.type==='media_ready')return this._mediaReady(identity,message);
    if(CONVERSATION_COMMANDS.has(message.type)){
      if(identity?.role==='host'&&identity.userId!=null&&identity.userId!==this.ownerId)fail('FORBIDDEN','Only the host can control this quiz.');
      return this.conversation.command(identity,message,{phase:this.phase,players:this.players,now:this.now()});
    }
    if (identity?.role === 'player') {
      if (message.type !== 'answer') fail('FORBIDDEN', 'Only the host can control the quiz.');
      return this._answer(identity.playerId, message);
    }
    if (identity?.role !== 'host' || (identity.userId != null && identity.userId !== this.ownerId)) fail('FORBIDDEN', 'Only the host can control the quiz.');
    this.mediaHost=identity.mediaVersion===2;
    switch (message.type) {
      case 'start':
        if (this.phase !== 'lobby') fail('INVALID_PHASE', 'This quiz has already started.');
        this._queueQuestion(0);
        return { type: 'started' };
      case 'media_skip':
        if(this.phase!=='countdown'||!this.mediaGate)fail('INVALID_PHASE','There are no images to wait for.');
        this.mediaGate.forced=true;this.tick();return {type:'media_skipped'};
      case 'reveal':
        if (this.phase !== 'question') fail('INVALID_PHASE', 'There is no active question.');
        this._reveal();
        return { type: 'revealed' };
      case 'next':
        if (this.phase !== 'reveal' && !(this.phase === 'question' && this.question?.type === 'slide')) fail('INVALID_PHASE', 'Reveal answers before continuing.');
        if (this.settings.roundsEnabled && this.questionIndex + 1 >= this._roundStartIndex() + this.settings.rounds[this.roundIndex].questionIds.length) {
          if (this.phase === 'question') this._reveal();
          this._completeRound();
          return { type: 'round_results' };
        }
        if (this.questionIndex + 1 >= this.quiz.questions.length) this._finish(); else this._queueQuestion(this.questionIndex + 1);
        return { type: this.phase === 'finished' ? 'finished' : 'started' };
      case 'next_round':
        if (!this.settings.roundsEnabled || this.phase !== 'round_results' || this.roundIndex + 1 >= this.settings.rounds.length) fail('INVALID_PHASE', 'There is no next round.');
        this.roundIndex++;
        for (const player of this.players.values()) player.score = 0;
        this._standings = null;
        this._queueQuestion(this._roundStartIndex());
        return { type: 'started' };
      case 'finish':
        if (this.phase === 'finished') fail('INVALID_PHASE', 'This quiz has finished.');
        if (this.phase === 'question') this._reveal();
        if (this.settings.roundsEnabled && this.phase === 'reveal' && this.questionIndex + 1 === this._roundStartIndex() + this.settings.rounds[this.roundIndex].questionIds.length) this._completeRound();
        this._finish();
        return { type: 'finished' };
      case 'lock':
        if (typeof message.locked !== 'boolean') fail('INVALID_COMMAND', 'Choose whether joining is locked.');
        this.locked = message.locked;
        this._touch();
        return { type: 'locked', locked: this.locked };
      case 'kick': {
        if (typeof message.playerId !== 'string' || !this.players.has(message.playerId)) fail('PLAYER_MISSING', 'Player was not found.');
        if (this.question && Object.hasOwn(this.players.get(message.playerId).answers, this.question.id)) this._answerCount--;
        this._names.delete(normalized(this.players.get(message.playerId).name));
        this._standings = null;
        this._publicReveal = null;
        this.players.delete(message.playerId);
        this._touch();
        return { type: 'kicked', playerId: message.playerId };
      }
      case 'draw': return this._draw(message);
      case 'draw_round': return this._drawRound();
      default: fail('INVALID_COMMAND', 'Command is unsupported.');
    }
  }
  _queueQuestion(index) {
    this.questionIndex = index;
    this._answerCount = 0;
    this._publicReveal = null;
    this.startedAt = null;
    const q=this.question,ids=[...new Set([q.image,...(q.options||[]).map(o=>o.image)].map(source=>this._images.get(source)?.id).filter(Boolean))];
    this.mediaGate=ids.length&&(this.mediaHost||[...this.players.values()].some(p=>p.connected&&p.mediaVersion===2))?{token:crypto.randomUUID(),ids,forced:false,hostRequired:this.mediaHost===true,hostReady:false}:null;
    if (this.settings.questionDelay === 0&&!this.waitingForImages()) { this._activateQuestion(); return; }
    this.phase = 'countdown';
    this.deadline = this.now() + this.settings.questionDelay * 1000;
    this._touch();
  }
  _activateQuestion() {
    this.phase = 'question';
    this.mediaGate=null;
    this.startedAt = this.now();
    this.deadline = this.question.type === 'slide' ? null : this.startedAt + this.question.timeLimit * 1000;
    this._touch();
  }
  _completeRound() {
    const round = this._round();
    if (!round || this.roundResults.some((result) => result.id === round.id)) return;
    const leaderboard = clone(this._leaderboard());
    const topScore = leaderboard[0]?.score ?? 0;
    const winners = topScore > 0 ? leaderboard.filter((p) => p.score === topScore) : [];
    this.roundResults.push({ id: round.id, index: round.index, title: round.title, reward: round.reward, leaderboard, winners, tied: winners.length > 1, completedAt: this.now() });
    this.phase = 'round_results';
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
  _finish() { this.phase = 'finished'; this.deadline = null; this.finishedAt = this.now(); this.conversation.end(); this._touch(); }
  _answer(playerId, message) {
    const player = this.players.get(playerId);
    if (!player) fail('PLAYER_MISSING', 'Your player session is no longer active.');
    if (this.phase !== 'question' || !this.question || this.question.type === 'slide') fail('QUESTION_CLOSED', 'This question is closed.');
    const q = this.question;
    const receivedAt = this.now();
    if (this.deadline != null && receivedAt >= this.deadline) { this._reveal(); fail('QUESTION_CLOSED', 'This question is closed.'); }
    if (message.questionId !== q.id) fail('WRONG_QUESTION', 'This answer belongs to a different question.');
    if (Object.hasOwn(player.answers, q.id)) fail('ALREADY_ANSWERED', 'Your answer has already been received.');
    const answer = this._validateAnswer(q, message.answer);
    const elapsed = Math.max(0, receivedAt - this.startedAt);
    const correct = this._isCorrect(q, answer);
    const points = correct ? Math.round(q.points * (this.settings.scoring === 'accuracy' ? 1 : 1 - 0.5 * Math.min(1, elapsed / (q.timeLimit * 1000)))) : 0;
    Object.defineProperty(player.answers, q.id, { value: { answer, receivedAt, elapsed, correct, points, awarded: false }, enumerable: true, configurable: true, writable: true });
    this._answerCount++;
    this._touch();
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
    const maximum = q.type === 'open_ended' ? 1000 : q.type === 'word_cloud' ? 60 : 200;
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
    if (q.type === 'pin') return Math.hypot(answer.x - q.target.x, answer.y - q.target.y) <= q.tolerance;
    return false;
  }
  _reveal() {
    const q = this.question;
    if (!q) return;
    for (const player of this.players.values()) {
      const result = Object.hasOwn(player.answers, q.id) ? player.answers[q.id] : null;
      if (result && !result.awarded) { player.score += result.points; player.overallScore = (player.overallScore ?? player.score - result.points) + result.points; result.awarded = true; }
    }
    this._standings = null;
    this._publicReveal = null;
    this.phase = 'reveal';
    this.deadline = null;
    this._touch();
  }
  _leaderboard() {
    if (this._standings) return this._standings;
    let rank = 0;
    let previousScore = null;
    this._standings = [...this.players.values()].sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id)).map((p, index) => {
      if (previousScore !== p.score) rank = index + 1;
      previousScore = p.score;
      return { id: p.id, name: p.name, score: p.score, rank };
    });
    return this._standings;
  }
  _draw(message) {
    if (this.phase !== 'finished') fail('INVALID_PHASE', 'Finish the quiz before drawing winners.');
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
    const me = { id: player.id, name: player.name, score: player.score, answered: !!answer };
    if (answer) {
      me.answer = clone(answer.answer);
      if (this.phase === 'reveal' || this.phase === 'finished') Object.assign(me, { correct: answer.correct, points: answer.points });
    }
    return me;
  }
  progress(playerId = null) {
    const me = this._me(playerId);
    return { type: 'progress', answerCount: this._answerCount, participantCount: this.players.size, ...(me ? { me } : {}) };
  }
  snapshot(forHost = false, playerId = null, {media = false, conversation = false} = {}) {
    const q = this.question;
    const revealed = this.startedAt != null && (this.phase === 'reveal' || this.phase === 'finished');
    let question = null;
    if (q && this.startedAt != null && ['question', 'reveal', 'finished'].includes(this.phase)) {
      const { correct, acceptedAnswers, target, explanation, tolerance, ...publicQuestion } = q;
      question = clone(publicQuestion);
      if (revealed) Object.assign(question, clone({ ...(correct ? { correct } : {}), ...(acceptedAnswers ? { acceptedAnswers } : {}), ...(target != null ? { target } : {}), ...(tolerance != null ? { tolerance } : {}), explanation }));
    }
    if (question && !forHost && !revealed && !this.settings.showAnswerOptions && ['single','multi','true_false','poll'].includes(q.type)) {
      question.options = question.options.map(option => ({id:option.id,text:'',image:''}));
    }
    const visiblePlayers = [];
    const visibleLimit = forHost ? this.players.size : this.phase === 'lobby' ? 50 : 10;
    for (const player of this.players.values()) {
      if (visiblePlayers.length >= visibleLimit) break;
      visiblePlayers.push(player);
    }
    const showScores = forHost || this.settings.showLeaderboard || this.phase === 'finished';
    const players = visiblePlayers.map((p) => ({ id: p.id, name: p.name, ...(showScores ? { score: p.score } : {}), connected: p.connected, answered: !!q && Object.hasOwn(p.answers, q.id) }));
    // Public live updates stay bounded even with large rooms; reports retain every standing.
    const roundResults = this.roundResults.map((round) => ({ ...round, leaderboard: forHost ? round.leaderboard : this.settings.showLeaderboard ? round.leaderboard.slice(0, 10) : [] }));
    const result = { code: this.code, title: this.quiz.title, phase: this.phase, role: forHost ? 'host' : playerId ? 'player' : 'spectator', questionIndex: this.questionIndex, totalQuestions: this.quiz.questions.length, round: this._round(), roundResults: clone(roundResults), question, deadline: this.deadline, serverNow: this.now(), players, participantCount: this.players.size, leaderboard: this.settings.showLeaderboard || forHost || this.phase === 'finished' ? clone(forHost ? this._leaderboard() : this._leaderboard().slice(0, 10)) : [], answerCount: this._answerCount, settings: clone(this.settings), locked: this.locked, winners: clone(this.winners) };
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
    if(conversation){result.chat=this.conversation.metadata(this.phase);result.announcement=this.conversation.visibleAnnouncement(this.phase);}
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
    if (q && revealed) result.reveal = clone(this._revealSummary());
    return result;
  }
  _revealSummary() {
    if (this._publicReveal) return this._publicReveal;
    const q = this.question;
    const distribution = Object.create(null);
    if (q.options) for (const option of q.options) distribution[option.id] = 0;
    const responses = [];
    let responseCount = 0;
    for (const p of this.players.values()) {
      const a = Object.hasOwn(p.answers, q.id) ? p.answers[q.id] : null;
      if (!a) continue;
      if (q.options) for (const id of Array.isArray(a.answer) ? a.answer : [a.answer]) distribution[id]++;
      else if (q.type === 'word_cloud') { const key = normalized(a.answer); distribution[key] = (distribution[key] ?? 0) + 1; }
      if (['open_ended', 'word_cloud', 'slider', 'pin'].includes(q.type)) {
        responseCount++;
        if (responses.length < 200) responses.push(clone(a.answer));
      }
    }
    // Bound public opinion summaries; the owner's final report retains every response.
    const summaryDistribution = q.type === 'word_cloud' ? Object.fromEntries(Object.entries(distribution).sort((a, b) => b[1] - a[1]).slice(0, 100)) : distribution;
    this._publicReveal = { ...(q.correct ? { correct: [...q.correct] } : {}), ...(q.acceptedAnswers ? { acceptedAnswers: [...q.acceptedAnswers] } : {}), ...(q.target != null ? { target: clone(q.target) } : {}), ...(q.tolerance != null ? { tolerance: q.tolerance } : {}), explanation: q.explanation, distribution: summaryDistribution, responses, responseCount };
    return this._publicReveal;
  }
  /** Call only from an authenticated owner endpoint. Reports contain player answers. */
  report() {
    if (this.phase !== 'finished') fail('INVALID_PHASE', 'Finish the quiz to view its report.');
    return clone({ code: this.code, title: this.quiz.title, createdAt: this.createdAt, finishedAt: this.finishedAt, settings: this.settings, leaderboard: this._leaderboard(), overallLeaderboard: [...this.players.values()].sort((a, b) => (b.overallScore ?? b.score) - (a.overallScore ?? a.score) || a.joinedAt - b.joinedAt).map((p, index) => ({ id: p.id, name: p.name, score: p.overallScore ?? p.score, rank: index + 1 })), roundResults: this.roundResults, winners: this.winners, draws: this.draws, questions: this.quiz.questions, players: [...this.players.values()].map(({ resumeToken, ...p }) => p) });
  }
}
