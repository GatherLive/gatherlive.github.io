import type {AppContext} from '../app/context.js';
export function createServicesSession(context: AppContext) {
    const S = context.state;
    const request = (...args) => context.request(...args);
    let sessionRefresh;
    let refreshInFlight;
    async function authRequest(path, body, method = 'POST', token?: string) {
        if (!S.config.supabaseUrl || !S.config.supabaseKey)
            throw new Error('Authentication unavailable. Check the server configuration.');
        return request(`${S.config.supabaseUrl}/auth/v1/${path}`, { method, headers: { apikey: S.config.supabaseKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    function saveSession(session) {
        const previousUser = S.session?.user?.id || (S.session as import('../../shared/types.js').DataRecord)?.id || '';
        S.session = session;
        if(previousUser!==(session?.user?.id||'')){S.chatAccessCache=null;S.hostedQuizzes={};S.accountUsage=null;S.reportPage=0;S.reportTotal=null;S.dashboardTab='quizzes';S.search='';S.filter='';S.quizHostFilter='all';S.quizSort='updated';S.quizSearchOpen=false;S.quizFiltersOpen=false;}
        try {
            if (session) localStorage.setItem('gather.session', JSON.stringify(session));
            else localStorage.removeItem('gather.session');
        } catch { }
        scheduleRefresh();
        if (previousUser !== (S.session?.user?.id || (S.session as import('../../shared/types.js').DataRecord)?.id || '') && S.learning) {
            const learning = S.learning;
            void Promise.resolve().then(() => S.learning === learning ? learning.sessionChanged() : null).catch(() => { });
        }
    }
    function scheduleRefresh() {
        clearTimeout(sessionRefresh);
        if (!S.session?.refresh_token)
            return;
        const wait = Math.max(1000, ((S.session.expires_at || Date.now() / 1000 + 3600) * 1000 - Date.now() - 60000));
        sessionRefresh = setTimeout(() => refreshToken().catch(() => { }), Math.min(wait, 2147483647));
    }
    async function refreshToken() {
        if (refreshInFlight)
            return refreshInFlight;
        if (!S.session?.refresh_token)
            return null;
        refreshInFlight = authRequest('token?grant_type=refresh_token', { refresh_token: S.session.refresh_token }).then(data => { saveSession(data); return data; }).catch(error => { if (/invalid|expired|not found|already used/i.test(error.message))
            saveSession(null); throw error; }).finally(() => refreshInFlight = null);
        return refreshInFlight;
    }
    async function getToken() { if (!S.session)
        throw new Error('Please sign in to continue.'); if ((S.session.expires_at || 0) * 1000 < Date.now() + 30000)
        await refreshToken(); return S.session?.access_token; }
    const activeUser = () => S.session?.user;
    return { get sessionRefresh() { return sessionRefresh; }, get refreshInFlight() { return refreshInFlight; }, authRequest, saveSession, scheduleRefresh, refreshToken, getToken, activeUser };
}
