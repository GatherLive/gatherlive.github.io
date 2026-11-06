import type {AppContext} from '../app/context.js';
export function createServicesApi(context: AppContext) {
    const S = context.state;
    const getToken = (...args) => context.getToken(...args);
    const apiURL = path => `${S.config.apiUrl || ''}${path}`;
    async function request(url, options: RequestInit & {body?: any} = {}) {
        const response = await fetch(url, options);
        const body = await response.text();
        let data;
        try {
            data = body ? JSON.parse(body) : null;
        }
        catch {
            data = null;
        }
        if (!response.ok) {
            const error: Error & {status?: number; progress?: unknown} = new Error(data?.message || data?.msg || data?.error_description || data?.error || `Request failed (${response.status}).`);
            error.status = response.status;
            if (data?.progress)
                error.progress = data.progress;
            throw error;
        }
        return data;
    }
    async function db(path, options: RequestInit & {body?: any} = {}) {
        if(path.split('?')[0]==='giveaway_quizzes'&&options.method&&options.method!=='GET'){
            S.accountUsage=null;
            if(options.method==='POST'){const result=await backend('/api/account/quizzes',typeof options.body==='string'?JSON.parse(options.body):options.body);return [result.quiz];}
            if(options.method==='DELETE'){const id=new URLSearchParams(path.split('?')[1]||'').get('id')?.replace(/^eq\./,'');if(!/^[a-f0-9-]{36}$/i.test(id||''))throw new Error('Choose a quiz to delete.');await backend('/api/account/quizzes/'+id,null,'DELETE');return null;}
        }
        if(options.method&&options.method!=='GET'&&path.startsWith('giveaway_reports'))S.accountUsage=null;
        const token = await getToken();
        return request(`${S.config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: S.config.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers }, ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
    }
    async function backend(path, body, method = 'POST', auth = true, options: RequestInit & {body?: any} = {}) {
        return request(apiURL(path), { ...options, method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${await getToken()}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    return { apiURL, request, db, backend };
}
