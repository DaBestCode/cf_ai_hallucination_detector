export class DurableChat {
    state;
    history;
    constructor(state, env) {
        this.state = state;
        this.history = undefined;
    }
    async fetch(request) {
        const url = new URL(request.url);
        // 🛑 CRITICAL FIX: Ensure history is loaded and IS an array.
        if (this.history === undefined) {
            console.log("[DO] Loading history from storage...");
            // Retrieve and force initialization to an empty array if null/undefined
            const storedHistory = await this.state.storage.get('history');
            this.history = Array.isArray(storedHistory) ? storedHistory : [];
            console.log(`[DO] History loaded. Initial size: ${this.history.length}`);
        }
        // ... (rest of the fetch handler is now safe)
        // All subsequent .push() calls are now guaranteed to work.
        // 1. Endpoint for GET History (Used by /chat route)
        if (url.pathname === '/chat' && request.method === 'GET') {
            return new Response(JSON.stringify(this.history), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        }
        // 2. Endpoint for POST History (Update/Save)
        if (url.pathname === '/chat' && request.method === 'POST') {
            try {
                const { message, assistantAnswer } = await request.json();
                this.history.push({ role: 'user', content: message });
                this.history.push({ role: 'assistant', content: assistantAnswer });
                const MAX_HISTORY = 10;
                if (this.history.length > MAX_HISTORY) {
                    this.history = this.history.slice(this.history.length - MAX_HISTORY);
                }
                await this.state.storage.put('history', this.history);
                return new Response('Messages added successfully.', { status: 200 });
            }
            catch (e) {
                console.error("[DO] POST body parsing failed:", e);
                return new Response(`Error processing history update: ${e}`, { status: 400 });
            }
        }
        // 3. Endpoint for POST Reset History
        if (url.pathname === '/reset' && request.method === 'POST') {
            this.history = [];
            await this.state.storage.delete('history');
            return new Response('History reset for session.', { status: 200 });
        }
        return new Response('DO Endpoint Not Found or Method Not Allowed', { status: 404 });
    }
}
