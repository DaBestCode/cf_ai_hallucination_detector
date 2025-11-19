export class DurableChat {
    state;
    history;
    constructor(state, env) {
        this.state = state;
        this.history = [];
        this.state.blockConcurrencyWhile(async () => {
            this.history = (await this.state.storage.get('history')) || [];
        });
    }
    // THIS IS THE CRITICAL LOGIC FOR RPC COMMUNICATION
    async fetch(request) {
        const url = new URL(request.url);
        // 1. Endpoint for GET History
        if (request.method === 'GET') {
            return new Response(JSON.stringify(this.history), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        }
        // 2. Endpoint for POST History (Update/Save)
        if (request.method === 'POST') {
            if (url.pathname === '/reset') {
                this.history = [];
                await this.state.storage.delete('history');
                return new Response('History reset for session.', { status: 200 });
            }
            // This is the /chat logic where the Worker sends the new messages
            try {
                const { message, assistantAnswer } = await request.json();
                // Add messages
                this.history.push({ role: 'user', content: message });
                this.history.push({ role: 'assistant', content: assistantAnswer });
                // Truncate and save
                const MAX_HISTORY = 10;
                if (this.history.length > MAX_HISTORY) {
                    this.history = this.history.slice(this.history.length - MAX_HISTORY);
                }
                await this.state.storage.put('history', this.history);
                return new Response('Messages added successfully.', { status: 200 });
            }
            catch (e) {
                // Log parsing failure if the POST body is malformed
                console.error("DO POST body parsing failed:", e);
                return new Response(`Error processing history update: ${e}`, { status: 400 });
            }
        }
        return new Response('Method Not Allowed', { status: 405 });
    }
}
