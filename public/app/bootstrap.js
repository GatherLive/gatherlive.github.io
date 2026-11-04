import { createFeaturesResultsPage } from '../features/results/page.js';
import { createFeaturesChatForms } from '../features/chat/forms.js';
import { createFeaturesAccountForms } from '../features/account/forms.js';
import { createFeaturesAuthForms } from '../features/auth/forms.js';
import { createFeaturesJoinForms } from '../features/join/forms.js';
import { createFeaturesLiveForms } from '../features/live/forms.js';
import { createFeaturesChatEvents } from '../features/chat/events.js';
import { createAppAccessibility } from './accessibility.js';
import { createFeaturesAccountEvents } from '../features/account/events.js';
import { createFeaturesJoinEvents } from '../features/join/events.js';
import { createFeaturesLibraryEvents } from '../features/library/events.js';
import { createFeaturesLiveEvents } from '../features/live/events.js';
import { createFeaturesEditorEvents } from '../features/editor/events.js';
import { createFeaturesLibraryChanges } from '../features/library/changes.js';
import { createFeaturesEditorChanges } from '../features/editor/changes.js';
import { createFeaturesLivePinPlacement } from '../features/live/pin-placement.js';
import { esc } from '../core/dom.js';
import { S } from './state.js';
import { ReorderLists } from '../core/reorder.js';
import { createAppUi } from './ui.js';
import { createServicesApi } from '../services/api.js';
import { createServicesSession } from '../services/session.js';
import { createFeaturesAuthTurnstile } from '../features/auth/turnstile.js';
import { createFeaturesAuthPage } from '../features/auth/page.js';
import { createFeaturesHomePage } from '../features/home/page.js';
import { createFeaturesJoinPage } from '../features/join/page.js';
import { createFeaturesLibraryPage } from '../features/library/page.js';
import { createFeaturesLibraryRooms } from '../features/library/rooms.js';
import { createFeaturesEditorModel } from '../features/editor/model.js';
import { createFeaturesEditorPage } from '../features/editor/page.js';
import { createFeaturesEditorData } from '../features/editor/data.js';
import { createFeaturesEditorImportExport } from '../features/editor/import-export.js';
import { createCoreReordering } from '../core/reordering.js';
import { createFeaturesLiveSession } from '../features/live/session.js';
import { createFeaturesLiveConnection } from '../features/live/connection.js';
import { createFeaturesLiveMedia } from '../features/live/media.js';
import { createFeaturesLivePage } from '../features/live/page.js';
import { createFeaturesLiveAnswers } from '../features/live/answers.js';
import { createFeaturesLiveTimer } from '../features/live/timer.js';
import { createFeaturesChatAccess } from '../features/chat/access.js';
import { createFeaturesAccountPage } from '../features/account/page.js';
import { createFeaturesResultsSummary } from '../features/results/summary.js';
import { createFeaturesLearnPage } from '../features/learn/page.js';
import { createAppRouter } from './router.js';
import { createAppStartup } from './startup.js';
import { createAppActions } from './actions.js';
import { createFeaturesChatActions } from '../features/chat/actions.js';
import { createFeaturesLiveActions } from '../features/live/actions.js';
import { createFeaturesAuthActions } from '../features/auth/actions.js';
import { createFeaturesLibraryActions } from '../features/library/actions.js';
import { createFeaturesEditorActions } from '../features/editor/actions.js';
import { createFeaturesResultsActions } from '../features/results/actions.js';
import { createFeaturesAccountActions } from '../features/account/actions.js';
import { createAppEvents } from './events.js';
// One shared runtime connects feature controllers without circular module imports.
const context = { state: S, actions: {}, forms: {}, inputs: [], changes: [], clicks: [], keys: [], escapeForError: esc };
const factories = [createFeaturesResultsPage, createAppUi, createServicesApi, createServicesSession, createFeaturesAuthTurnstile, createFeaturesAuthPage, createFeaturesHomePage, createFeaturesJoinPage, createFeaturesLibraryPage, createFeaturesLibraryRooms, createFeaturesEditorModel, createFeaturesEditorPage, createFeaturesEditorData, createFeaturesEditorImportExport, createCoreReordering, createFeaturesLiveSession, createFeaturesLiveConnection, createFeaturesLiveMedia, createFeaturesLivePage, createFeaturesLiveAnswers, createFeaturesLiveTimer, createFeaturesChatAccess, createFeaturesAccountPage, createFeaturesResultsSummary, createFeaturesLearnPage, createAppRouter, createAppStartup, createAppActions, createFeaturesChatActions, createFeaturesLiveActions, createFeaturesAuthActions, createFeaturesLibraryActions, createFeaturesEditorActions, createFeaturesResultsActions, createFeaturesAccountActions, createAppEvents, createFeaturesChatForms, createFeaturesAccountForms, createFeaturesAuthForms, createFeaturesJoinForms, createFeaturesLiveForms, createFeaturesChatEvents, createAppAccessibility, createFeaturesAccountEvents, createFeaturesJoinEvents, createFeaturesLibraryEvents, createFeaturesLiveEvents, createFeaturesEditorEvents, createFeaturesLibraryChanges, createFeaturesEditorChanges, createFeaturesLivePinPlacement];
for (const create of factories) {
    const feature = create(context);
    const descriptors = Object.getOwnPropertyDescriptors(feature);
    for (const name of ['actions', 'forms'])
        if (descriptors[name]) {
            Object.assign(context[name], feature[name]);
            delete descriptors[name];
        }
    for (const name of ['inputs', 'changes', 'clicks', 'keys'])
        if (descriptors[name]) {
            context[name].push(...feature[name]);
            delete descriptors[name];
        }
    Object.defineProperties(context, descriptors);
}
S.reorder = new ReorderLists({ move: context.moveReordered, allowed: context.reorderAllowed });
context.bindEvents();
void context.boot();
