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

// Global CORS Headers (Used for cloning responses)
const baseCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
    'Access-Control-Max-Age': '86400',
};

// -------------------------------------------------
// EXPORT DurableChat for the DO namespace binding
// -------------------------------------------------
export { DurableChat };

// --- Main Worker Logic ---
const router = Router<IRequest, [Env]>(); 

// Endpoint to process a new chat message
router.post('/chat', async (request, env) => {
  console.log("--- START /chat ---");
  try {
    // 1. Consume the request body ONCE
    const { userId, message } = await request.json() as { userId: string, message: string };
    console.log(`[Chat] Received message from user: ${userId}`);

    const id = env.CHAT_STATE.idFromName(userId);
    const stub = env.CHAT_STATE.get(id);

    // 2. Get History (GET request to stub)
    console.log("[Chat] Awaiting history from DO...");
    // Use the full request.url to ensure the stub fetch works properly
    const historyResponse = await stub.fetch(new Request(new URL('/chat', request.url), { method: 'GET' }));
    let history: ChatMessage[] = (await historyResponse.json()) || [];
    console.log(`[Chat] History loaded. Count: ${history.length}`);
    
    // 3. LLM Call for Primary Response
    console.log("[Chat] Awaiting initial AI response...");
    const initialResponse = await env.AI.run(env.LLM_MODEL, { 
        messages: [...history, { role: 'user', content: message }], 
        stream: false 
    });
    const initialAnswer = initialResponse.response;
    console.log("[Chat] Initial AI response received.");

    // 4. LLM Call for Hallucination Detection
    console.log("[Chat] Awaiting critique AI response...");
    const critiquePrompt: ChatMessage[] = [
        { role: 'system', content: 'You are a fact-checker. Review the following statement and critically assess its factual accuracy and plausibility. If it contains plausible but incorrect information (hallucination), explicitly state the inaccuracy and provide a correction. If it appears correct, just respond with "Fact Check: The statement appears accurate."' },
        { role: 'user', content: `Statement to check: "${initialAnswer}"` }
    ];
    const critiqueResponse = await env.AI.run(env.LLM_MODEL, { messages: critiquePrompt, stream: false });
    const critiqueResult = critiqueResponse.response;
    console.log("[Chat] Critique response received.");
    
    // 5. Update DO (POST request to stub)
    console.log("[Chat] Awaiting DO state update...");
    await stub.fetch(new Request(new URL('/chat', request.url), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, assistantAnswer: initialAnswer })
    }));
    console.log("[Chat] DO state update complete.");

    // 6. Return Final Response
    const finalBody = JSON.stringify({ response: initialAnswer, critique: critiqueResult });
    
    // FIX 1: Create a new Response object with status/headers merged
    return new Response(finalBody, {
      headers: { 
        'Content-Type': 'application/json',
        ...baseCorsHeaders
      },
    });

  } catch (err) {
    console.error("--- CATCH ERROR in /chat ---", err);
    return new Response('Internal Server Error: ' + (err as Error).message, { 
        status: 500,
        headers: { ...baseCorsHeaders }
    });
  } finally {
      console.log("--- END /chat ---");
  }
});

// Endpoint to reset the chat history
router.post('/reset', async (request, env) => {
    console.log("--- START /reset ---");
    try {
        // Consume the request body
        const { userId } = await request.json() as { userId: string };
        if (!userId) {
            return new Response('Missing userId', { status: 400, headers: baseCorsHeaders });
        }
        const id = env.CHAT_STATE.idFromName(userId);
        const stub = env.CHAT_STATE.get(id);
        
        console.log("[Reset] Awaiting DO reset...");
        await stub.fetch(new Request(new URL('/reset', request.url), { method: 'POST' }));
        console.log("[Reset] DO reset complete.");

        return new Response('Chat history has been reset.', { 
            status: 200,
            headers: { ...baseCorsHeaders }
        });

    } catch (err) {
        console.error("--- CATCH ERROR in /reset ---", err);
        return new Response('Internal Server Error: ' + (err as Error).message, { 
            status: 500,
            headers: { ...baseCorsHeaders }
        });
    } finally {
        console.log("--- END /reset ---");
    }
});

// Fallback
router.all('*', () => new Response('Not Found.', { status: 404, headers: baseCorsHeaders }));


// -------------------------------------------------
// EXPORT Worker Listener (Module Worker Handler)
// -------------------------------------------------
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Global CORS preflight handler for OPTIONS requests
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: baseCorsHeaders });
    }

    // 2. Handle routing for all other methods
    const response = await router.handle(request, env, ctx as any);
    
    // FIX 1: Ensure the response is always a copy for mutability safety.
    // NOTE: itty-router handles this complexity well, but to be 100% safe against 
    // Response immutability, we ensure the headers are set on a new object/Response 
    // (which is implicitly done above by merging headers during creation). 
    // We just ensure the response object returned by router is passed through correctly.
    
    return response;
  },
};