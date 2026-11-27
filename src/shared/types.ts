import type {AvatarProfile} from './avatars/profile.js';

/** Data contracts shared by the browser, live engine and service adapters. */
export type QuestionType = 'single' | 'multi' | 'true_false' | 'short_answer' | 'poll' | 'order' | 'slider' | 'word_cloud' | 'open_ended' | 'pin' | 'slide';
export type RoomPhase = 'lobby' | 'countdown' | 'question' | 'results' | 'reveal' | 'round_results' | 'finished';
export type RoomMode = 'live' | 'self-study' | 'group-study';
export type ChatMode = 'off' | 'lobby' | 'breaks' | 'rounds';
export interface Point { x: number; y: number }
export interface AnswerRegion extends Point { shape: 'circle' | 'box'; width: number; height: number }
export type AnswerValue = string | string[] | number | Point;
export interface QuizOption { id: string; text: string; image?: string }
export type TeamId = 'a' | 'b';
export interface TeamSettings {
  a: number; b: number; assignment: 'auto' | 'pick'; scoring: 'points' | 'elimination'; sharedLives?: boolean;
}
export interface CompetitionSettings {
  lives: number; livesReset?: 'game' | 'round'; teams?: TeamSettings;
}
export type AnswerReveal = 'all' | 'turns';
export interface LiveGameSettings { reveal: AnswerReveal | 'auto'; revealDelay?: number }
export interface QuestionCompetition {
  mode?: 'classic' | 'unique' | 'avoid-host'; reveal: AnswerReveal; publicAnswers: boolean; secretAnswer?: string;
}
export type CompetitionReason = 'safe' | 'blank' | 'duplicate' | 'host-match' | 'rejected' | 'wrong';
export interface CompetitionRow {
  playerId: string; name: string; answer: AnswerValue | null; reason: CompetitionReason; accepted?: boolean; lostLife?: boolean; note?: string;
}
export interface CompetitionReview {
  id?: string; questionId: string; rows: CompetitionRow[]; revealed: number; applied: boolean;
  reveal?: AnswerReveal;
  autoRevealAt?: number;
}
export interface Question {
  id: string; type: QuestionType; prompt: string; image?: string;
  timeLimit: number; points: number; explanation?: string;
  options?: QuizOption[]; correct?: string[]; acceptedAnswers?: string[];
  min?: number; max?: number; target?: number | Point; tolerance?: number;
  answerRegion?: AnswerRegion;
  competition?: QuestionCompetition;
}
export interface QuizRound { id: string; title: string; reward: string; questionIds: string[] }
export interface ChatSettings { chatMode: ChatMode; chatReplies: boolean; chatReactions: boolean; chatMentions: boolean }
export interface AutoplayOptions {
  questionWait: number;
  roundWait: number;
  questionDelay: number;
  finishWhenAnswered: boolean;
}
export interface RoomAutoplay {
  status: 'off' | 'running' | 'paused';
  options: AutoplayOptions;
  startsAt: number | null;
  pausedAt: number | null;
  clockPaused: boolean;
  resumeTo?: 'off' | 'running';
  activityAt?: number;
  pauseReason?: 'empty' | 'idle';
}
export interface GameSettings extends ChatSettings {
  shuffleQuestions: boolean; shuffleOptions: boolean; shuffleTrueFalse: boolean;
  scoring: 'speed' | 'accuracy'; allowLateJoin: boolean; showLeaderboard: boolean;
  showQuestionType: boolean; showAnswerOptions: boolean; participantLimit: number;
  questionDelay: number; roundsEnabled: boolean; rounds: QuizRound[]; tags?: string[];
  joinVerification?: boolean;
  selfStudy?: boolean;
  competition?: CompetitionSettings;
  game?: LiveGameSettings;
}
export interface Quiz {
  id?: string; owner_id?: string; title: string; description?: string;
  questions: Question[]; settings?: GameSettings; collection?: string; tags?: string[];
  created_at?: string; updated_at?: string; hosted_at?: string; last_hosted_at?: string;
}
export interface PlayerAnswer { answer: AnswerValue; elapsed: number; correct: boolean; points: number; awarded: boolean; receivedAt?: number; reviewNote?: string }
export interface Elimination { question: number; turn?: number }
export interface RoomPlayer {
  id: string; name: string; resumeToken: string; score: number; overallScore: number;
  joinedAt: number; connected: boolean; answers: Record<string, PlayerAnswer>;
  mediaVersion?: number; mediaReady?: string; mediaReadyToken?: string; kicked?: boolean; lastSeenAt?: number;
  lives?: number; team?: TeamId; joinOrder?: number; avatar?: AvatarProfile; elimination?: Elimination;
}
export interface Standing { id: string; name: string; score: number; rank?: number; correct?: number; connected?: boolean; lives?: number; team?: TeamId; elimination?: Elimination }
export interface RoundResult {
  id: string; index: number; title: string; reward: string; leaderboard: Standing[];
  winners: Standing[]; tied: boolean; completedAt: number; tiedLeaders?: Standing[]; tieResolvedAt?: number;
  winningTeams?: TeamId[];
  hasPoints?: boolean;
}
export interface ImageAsset { id: string; key: string; question: number; option: number | null }
export interface MediaGate {
  token: string; ids?: string[]; forced?: boolean; deadline?: number; startedAt?: number; hostRequired?: boolean;
  hostReady?: boolean; ready?: string[]; assetIds?: string[];
  playerIds?: string[]; readyIds?: string[]; earliestStart?: number; timeoutAt?: number;
}
export interface RoomMeta { ownerId: string; quizId: string; title: string; reportId: string; expiresAt: number }
export interface RoomIdentity {
  role?: 'host' | 'player'; userId?: string; playerId?: string; roomId?: string;
  mediaVersion?: number; conversationVersion?: number; chatSubscribed?: boolean;
  superseded?: boolean; authenticating?: boolean; acceptedAt?: number;
  mediaReadyToken?: string; chatWindowStart?: number; chatMessages?: number;
  windowStart?: number; messages?: number;
  typingWindowStart?: number; typingMessages?: number;
  avatarUpdatedAt?: number;
  chatViewing?: boolean; chatTypingUntil?: number;
  rateErrorAt?: number; rateErrors?: number;
}
export interface Mention { id: string; start: number; end: number; name?: string }
export interface ChatMember { id: string; name: string; role: 'host' | 'player' | 'all' }
export interface Announcement {
  id: string; text: string; at?: number; createdAt?: number; countdown?: {endsAt: number; start: number; end: number; minutes?: number};
}
export interface ChatMessage {
  id: string; text: string; senderId: string; senderName: string; role: string;
  senderAvatar?: AvatarProfile;
  at: number; createdAt?: number; requestId?: string; replyTo?: string; mentions?: Mention[];
  reactions: Record<string, string | number>; myReaction?: string; deleted?: boolean;
}
export interface ChatTypingEvent { type: 'chat_typing'; senderId: string; senderName?: string; remainingMs: number }
export interface ChatMetadata extends ChatSettings { unlocked: boolean; open: boolean; revision: number; typingIndicators?: boolean }
export interface UsageLimits { images: number; quizzes: number; results: number; participants: number }
export interface AccountUser { id: string; email?: string }
export interface AccountSession { access_token: string; refresh_token: string; expires_at?: number; user: AccountUser }
export interface PublicConfig { apiUrl?: string; supabaseUrl?: string; supabaseKey?: string; turnstileSiteKey?: string }
export interface ChatApplicationStatus { status: string; createdAt: number; updatedAt: number; retryAt?: number }
export interface ChatAccessState { unlocked: boolean; application: ChatApplicationStatus | null }
export type RpcResult<T extends object> = ({ok: true} & T) | {ok: false; status: number; message: string};

/** Legacy or provider JSON is validated at its existing boundary before use. */
export type DataRecord = Record<string, any>;
