// worker/src/index.ts
import { Router, IRequest } from 'itty-router';
import { DurableChat } from './DurableChat'; 

// --- Type Definitions for Cloudflare Bindings ---
export interface Env {
  CHAT_STATE: DurableObjectNamespace; 
  AI: any; 
  LLM_MODEL: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// -------------------------------------------------
// EXPORT DurableChat for the DO namespace binding
// -------------------------------------------------
export { DurableChat };

// --- Main Worker Logic ---
const router = Router<IRequest, [Env]>(); 

// Endpoint to process a new chat message
router.post('/chat', async (request, env) => {
  try {
    // 1. CRITICAL: Consume the request body ONCE at the very beginning.
    const { userId, message } = await request.json() as { userId: string, message: string };

    const id = env.CHAT_STATE.idFromName(userId);
    const stub = env.CHAT_STATE.get(id);

    // 2. Get History (GET request to stub) - Use clean path
    const historyResponse = await stub.fetch(new Request(new URL('/chat', request.url), { method: 'GET' }));
    let history: ChatMessage[] = (await historyResponse.json()) || [];
    
    // 3. LLM Call for Primary Response
    const initialPrompt: ChatMessage[] = [...history, { role: 'user', content: message }];
    const initialResponse = await env.AI.run(env.LLM_MODEL, { messages: initialPrompt, stream: false });
    const initialAnswer = initialResponse.response;

    // 4. LLM Call for Hallucination Detection
    const critiquePrompt: ChatMessage[] = [
        { role: 'system', content: 'You are a fact-checker. Review the following statement and critically assess its factual accuracy and plausibility. If it contains plausible but incorrect information (hallucination), explicitly state the inaccuracy and provide a correction. If it appears correct, just respond with "Fact Check: The statement appears accurate."' },
        { role: 'user', content: `Statement to check: "${initialAnswer}"` }
    ];
    const critiqueResponse = await env.AI.run(env.LLM_MODEL, { messages: critiquePrompt, stream: false });
    const critiqueResult = critiqueResponse.response;
    
    // 5. Update DO (POST request to stub) - Use clean path and explicit body
    await stub.fetch(new Request(new URL('/chat', request.url), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, assistantAnswer: initialAnswer })
    }));

    // 6. Return Final Response
    return new Response(JSON.stringify({ response: initialAnswer, critique: critiqueResult }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
      },
    });

  } catch (err) {
    console.error(err);
    return new Response('Internal Server Error: ' + (err as Error).message, { 
        status: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
        }
    });
  }
});

// Endpoint to reset the chat history
router.post('/reset', async (request, env) => {
    // CRITICAL: Consume the request body here too
    const { userId } = await request.json() as { userId: string };
    if (!userId) {
        return new Response('Missing userId', { status: 400 });
    }
    const id = env.CHAT_STATE.idFromName(userId);
    const stub = env.CHAT_STATE.get(id);
    
    // Use the specific /reset path, handled by the DO's POST logic
    await stub.fetch(new Request(new URL('/reset', request.url), { method: 'POST' }));
    return new Response('Chat history has been reset.', { 
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
        }
    });
});

// Fallback
router.all('*', () => new Response('Not Found.', { status: 404 }));


// -------------------------------------------------
// EXPORT Worker Listener (Module Worker Handler)
// -------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Global CORS preflight handler for OPTIONS requests
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    // 2. Handle routing for all other methods
    const response = await router.handle(request, env, ctx as any);
    
    // 3. CRITICAL FIX: Ensure the final response object has CORS headers added
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, User-Agent'); 

    return response;
  },
};