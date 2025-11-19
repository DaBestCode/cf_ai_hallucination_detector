// worker/src/DurableChat.ts

import { Env } from "./index"; 

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export class DurableChat implements DurableObject {
  private state: DurableObjectState;
  // Initialize history to null/undefined, and let fetch() handle loading.
  private history: ChatMessage[] | undefined; 

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.history = undefined; // Initialize history without async operations
  }

  // THIS IS THE CRITICAL LOGIC FOR RPC COMMUNICATION
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 🛑 CRITICAL FIX: Ensure history is loaded before any operation
    if (this.history === undefined) {
        this.history = (await this.state.storage.get('history')) || [];
    }

    // 1. Endpoint for GET History
    if (url.pathname === '/chat' && request.method === 'GET') { 
        return new Response(JSON.stringify(this.history), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    }

    // 2. Endpoint for POST History (Update/Save)
    if (url.pathname === '/chat' && request.method === 'POST') {
        try {
            const { message, assistantAnswer } = await request.json() as { 
                message: string, 
                assistantAnswer: string 
            };
            
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
        } catch (e) {
            console.error("DO POST body parsing failed:", e);
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