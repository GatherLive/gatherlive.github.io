import type {AppContext} from '../../app/context.js';
export function createFeaturesAccountPage(context: AppContext) { return {accountView:()=>context.settingsView('account')}; }
