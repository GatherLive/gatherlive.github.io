import type {AccountSession, AccountUser, PublicConfig, Quiz, Question, Point, DataRecord, GameSettings} from '../../shared/types.js';
import type {RoomChat} from '../features/chat/room-chat.js';
import type {RoomClock} from '../features/live/clock.js';
import type {RoomImages} from '../features/media/images.js';
import type {ReorderLists} from '../core/reorder.js';

export interface AppState {
 config: PublicConfig; session: AccountSession | null; quizzes: Quiz[]; reports: DataRecord[];
 openRooms: DataRecord[]; roomsError: string; dashboardTab: string; filter: string; search: string;
 draft: Quiz | null; questionIndex: number; dirty: boolean; saving: boolean;
 room: DataRecord | null; roomState: DataRecord | null; ws: WebSocket | null; wsGeneration: number;
 reconnectTimer: ReturnType<typeof setTimeout> | null; retries: number; connected: boolean;
 selection: import('../../shared/types.js').AnswerValue | null; answerPending: boolean; answerSent: boolean; order: string[];
 pin: Point | null; authMode: string; authMessage: string; loading: boolean;
 reorder?: ReorderLists; chat?: RoomChat; clock?: RoomClock; images?: RoomImages;
 editorPanels?: Map<string,boolean>; syncTimers?: Array<ReturnType<typeof setTimeout>>;
 answerAttempt?: number; currentRoundId?: string; connectTimeout?: ReturnType<typeof setTimeout>;
 heartbeat?: ReturnType<typeof setInterval>; lastSocketMessage?: number; lastRoute?: string;
 connectionStatus?: string; roomUnavailable?: boolean; fatalRoomError?: string;
 accountUsage?: DataRecord | null; usageOwner?: string; usageImages?: DataRecord[];
 settingsReturn?: string; authReturnTo?: string; learnReturn?: string;
 chatApplication?: DataRecord | null; chatApplicationOwner?: string; chatAccessCache?: DataRecord;
 previousFocus?: HTMLElement; previousFocusAction?: string; hostedQuizzes?: Record<string,{lastHostedAt: number}>;
 quizFiltersOpen?: boolean; quizSearchOpen?: boolean; quizHostFilter?: string; quizSort?: string;
 reportPage?: number; reportTotal?: number; roomsToClose?: Array<{code: string; roomId: string}>;
 participants?: DataRecord[]; section?: string; learning?: DataRecord;
 disposeResults?: () => void; disposeSettings?: () => void; cancelUsageDelete?: () => void;
}

type RuntimeCallback = (...args: any[]) => any;
type Action = (element?: HTMLButtonElement) => void | Promise<unknown>;
type FormHandler = {submit: (form: HTMLFormElement) => unknown; ownFeedback?: boolean; onError?: (error: any) => string; errorTarget?: string; afterSubmit?: () => void};
type RuntimeMethod =
  'accountChatView'
  | 'accountView'
  | 'activeUser'
  | 'answerOption'
  | 'answerStatus'
  | 'apiURL'
  | 'applyForChat'
  | 'assignQuestion'
  | 'authRequest'
  | 'authView'
  | 'backend'
  | 'bindEvents'
  | 'blankQuiz'
  | 'boot'
  | 'cachedAccountChatView'
  | 'captchaBody'
  | 'cloneQuizQuestions'
  | 'closeAllRooms'
  | 'closeModal'
  | 'commitQuizTag'
  | 'confirmCloseAllRooms'
  | 'confirmCloseRoom'
  | 'connectRoom'
  | 'connectionLabel'
  | 'copyAIPrompt'
  | 'copyLink'
  | 'csvFor'
  | 'dashboard'
  | 'db'
  | 'defaultSettings'
  | 'discardTurnstile'
  | 'disconnectRoom'
  | 'dragHandle'
  | 'ensureRounds'
  | 'exportQuiz'
  | 'fitChoiceQuestion'
  | 'forgetClosedRoom'
  | 'forgetLearningAccount'
  | 'forgetPlayer'
  | 'getToken'
  | 'home'
  | 'hostQuiz'
  | 'hydrateRoomImages'
  | 'importQuiz'
  | 'isOpenRoom'
  | 'joinView'
  | 'leaderboard'
  | 'learningReturn'
  | 'loadAccountChat'
  | 'loadOpenRooms'
  | 'loadSavedReport'
  | 'loadSavedReports'
  | 'loading'
  | 'markDirty'
  | 'modal'
  | 'mountTurnstile'
  | 'moveReordered'
  | 'newQuestion'
  | 'openEditor'
  | 'openRoomCards'
  | 'openSocket'
  | 'orderView'
  | 'pinView'
  | 'playerNameKey'
  | 'playerRoomKey'
  | 'questionRound'
  | 'quizCards'
  | 'quizTagEditor'
  | 'refreshAnswerUI'
  | 'refreshFeedback'
  | 'refreshToken'
  | 'rememberChatAccess'
  | 'renderDashboard'
  | 'renderEditor'
  | 'renderRoom'
  | 'reorderAllowed'
  | 'request'
  | 'resetTurnstile'
  | 'resultsView'
  | 'roomImage'
  | 'roomLink'
  | 'roundHistory'
  | 'route'
  | 'sampleQuiz'
  | 'saveQuiz'
  | 'saveSession'
  | 'savedPlayer'
  | 'scheduleRefresh'
  | 'send'
  | 'sendAnswer'
  | 'settingsView'
  | 'shell'
  | 'showLearning'
  | 'showResults'
  | 'sliderView'
  | 'syncQuizFilters'
  | 'syncRoundOrder'
  | 'textAnswerView'
  | 'toast'
  | 'turnstileToken'
  | 'updateChatApplication'
  | 'updateConnection'
  | 'updateTimer'
  | 'uploadImage'
  | 'validateDraft'
  | 'zoomAnswer';

// Controllers register these callbacks during bootstrap. Keeping the names explicit
// catches disconnected controllers without introducing circular runtime imports.
export type AppContext = Record<RuntimeMethod,RuntimeCallback> & {
 state: AppState; actions: Record<string,Action>; forms: Record<string,FormHandler>;
 inputs: Array<(event: Event) => unknown>; changes: Array<(event: Event) => unknown>;
 clicks: Array<(event: MouseEvent) => unknown>; keys: Array<(event: KeyboardEvent) => unknown>;
 escapeForError: (value: unknown) => string;
 routeVersion: number;
 app: HTMLElement;
 siteNews: import('../features/news/index.js').SiteNews;
 apiURL: (path: string) => string; activeUser: () => AccountUser | null;
 getToken: () => Promise<string>; defaultSettings: () => GameSettings;
 newQuestion: (type?: Question['type']) => Question;
 toast: (message: string, error?: boolean) => void;
};
