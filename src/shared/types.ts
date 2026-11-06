/** Data contracts shared by the browser, live engine and service adapters. */
export type QuestionType = 'single' | 'multi' | 'true_false' | 'short_answer' | 'poll' | 'order' | 'slider' | 'word_cloud' | 'open_ended' | 'pin' | 'slide';
export type RoomPhase = 'lobby' | 'countdown' | 'question' | 'results' | 'reveal' | 'round_results' | 'finished';
export type ChatMode = 'off' | 'lobby' | 'breaks' | 'rounds';
export interface Point { x: number; y: number }
export type AnswerValue = string | string[] | number | Point;
export interface QuizOption { id: string; text: string; image?: string }
export interface Question {
  id: string; type: QuestionType; prompt: string; image?: string;
  timeLimit: number; points: number; explanation?: string;
  options?: QuizOption[]; correct?: string[]; acceptedAnswers?: string[];
  min?: number; max?: number; target?: number | Point; tolerance?: number;
}
export interface QuizRound { id: string; title: string; reward: string; questionIds: string[] }
export interface ChatSettings { chatMode: ChatMode; chatReplies: boolean; chatReactions: boolean; chatMentions: boolean }
export interface GameSettings extends ChatSettings {
  shuffleQuestions: boolean; shuffleOptions: boolean; shuffleTrueFalse: boolean;
  scoring: 'speed' | 'accuracy'; allowLateJoin: boolean; showLeaderboard: boolean;
  showQuestionType: boolean; showAnswerOptions: boolean; participantLimit: number;
  questionDelay: number; roundsEnabled: boolean; rounds: QuizRound[]; tags?: string[];
}
export interface Quiz {
  id?: string; owner_id?: string; title: string; description?: string;
  questions: Question[]; settings?: GameSettings; collection?: string; tags?: string[];
  created_at?: string; updated_at?: string; hosted_at?: string; last_hosted_at?: string;
}
export interface PlayerAnswer { answer: AnswerValue; elapsed: number; correct: boolean; points: number; awarded: boolean; receivedAt?: number }
export interface RoomPlayer {
  id: string; name: string; resumeToken: string; score: number; overallScore: number;
  joinedAt: number; connected: boolean; answers: Record<string, PlayerAnswer>;
  mediaVersion?: number; mediaReady?: string; mediaReadyToken?: string; kicked?: boolean; lastSeenAt?: number;
}
export interface Standing { id: string; name: string; score: number; rank?: number; correct?: number; connected?: boolean }
export interface RoundResult {
  id: string; index: number; title: string; reward: string; leaderboard: Standing[];
  winners: Standing[]; tied: boolean; completedAt: number; tiedLeaders?: Standing[]; tieResolvedAt?: number;
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
}
export interface Mention { id: string; start: number; end: number; name?: string }
export interface ChatMember { id: string; name: string; role: 'host' | 'player' | 'all' }
export interface Announcement {
  id: string; text: string; at?: number; createdAt?: number; countdown?: {endsAt: number; start: number; end: number; minutes?: number};
}
export interface ChatMessage {
  id: string; text: string; senderId: string; senderName: string; role: string;
  at: number; createdAt?: number; requestId?: string; replyTo?: string; mentions?: Mention[];
  reactions: Record<string, string | number>; myReaction?: string; deleted?: boolean;
}
export interface ChatMetadata extends ChatSettings { unlocked: boolean; open: boolean; revision: number }
export interface LearningTest { id: string; topic: string; region: string; total: number; correct: number; at: number }
export interface LearningDevice { items: Record<string, number[]> }
export interface LearningItem { seen: number; correct: number; wrong: number; lastCorrect: number; lastWrong: number; updatedAt: number; streak?: number; nextReviewAt?: number }
export interface LearningProgress {
  version: number; generation: number; updatedAt: number; devices: Record<string, LearningDevice>;
  tests: LearningTest[]; items?: Record<string, LearningItem>; _writer?: string;
}
export interface UsageLimits { images: number; quizzes: number; results: number; participants: number }
export interface AccountUser { id: string; email?: string }
export interface AccountSession { access_token: string; refresh_token: string; expires_at?: number; user: AccountUser }
export interface PublicConfig { apiUrl?: string; supabaseUrl?: string; supabaseKey?: string; turnstileSiteKey?: string }
export interface ChatApplicationStatus { status: string; createdAt: number; updatedAt: number; retryAt?: number }
export interface ChatAccessState { unlocked: boolean; application: ChatApplicationStatus | null }
export type RpcResult<T extends object> = ({ok: true} & T) | {ok: false; status: number; message: string; progress?: LearningProgress};

/** Legacy or provider JSON is validated at its existing boundary before use. */
export type DataRecord = Record<string, any>;
