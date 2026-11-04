export function createServicesApi(context) {
    const S = context.state;
    const getToken = (...args) => context.getToken(...args);
    const apiURL = path => `${S.config.apiUrl || ''}${path}`;
    async function request(url, options = {}) {
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
            const error = new Error(data?.message || data?.msg || data?.error_description || data?.error || `Request failed (${response.status}).`);
            error.status = response.status;
            if (data?.progress)
                error.progress = data.progress;
            throw error;
        }
        return data;
    }
    async function db(path, options = {}) {
        const token = await getToken();
        return request(`${S.config.supabaseUrl}/rest/v1/${path}`, { ...options, headers: { apikey: S.config.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers }, ...(options.body && typeof options.body !== 'string' ? { body: JSON.stringify(options.body) } : {}) });
    }
    async function backend(path, body, method = 'POST', auth = true) {
        return request(apiURL(path), { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${await getToken()}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    return { apiURL, request, db, backend };
}
