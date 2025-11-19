// worker/src/index.ts
import { Router } from 'itty-router';
import { DurableChat } from './DurableChat';
// -------------------------------------------------
// EXPORT DurableChat for the DO namespace binding
// -------------------------------------------------
export { DurableChat };
// --- Main Worker Logic (Router implementation remains the same) ---
const router = Router();
// Endpoint to process a new chat message
router.post('/chat', async (request, env) => {
    try {
        const { userId, message } = await request.json();
        const id = env.CHAT_STATE.idFromName(userId);
        const stub = env.CHAT_STATE.get(id);
        // 1. Get History (GET request to stub)
        // Use the full request.url to ensure the stub fetch works properly
        let history = (await stub.fetch(new Request(request.url, { method: 'GET' })).then(r => r.json())) || [];
        // 2. LLM Call for Primary Response
        const initialPrompt = [...history, { role: 'user', content: message }];
        const initialResponse = await env.AI.run(env.LLM_MODEL, { messages: initialPrompt, stream: false });
        const initialAnswer = initialResponse.response;
        // 3. LLM Call for Hallucination Detection
        const critiquePrompt = [
            { role: 'system', content: 'You are a fact-checker. Review the following statement...' },
            { role: 'user', content: `Statement to check: "${initialAnswer}"` }
        ];
        const critiqueResponse = await env.AI.run(env.LLM_MODEL, { messages: critiquePrompt, stream: false });
        const critiqueResult = critiqueResponse.response;
        // 4. Update DO (POST request to stub) - Uses the full request.url now
        await stub.fetch(new Request(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, assistantAnswer: initialAnswer })
        }));
        // 5. Return Final Response (ADDED CORS HEADERS)
        return new Response(JSON.stringify({ response: initialAnswer, critique: critiqueResult }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }
    catch (err) {
        console.error(err);
        return new Response('Internal Server Error: ' + err.message, {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }
});
// Endpoint to reset the chat history
router.post('/reset', async (request, env) => {
    const { userId } = await request.json();
    if (!userId) {
        return new Response('Missing userId', { status: 400 });
    }
    const id = env.CHAT_STATE.idFromName(userId);
    const stub = env.CHAT_STATE.get(id);
    // Use a specific path for the reset command
    await stub.fetch(new Request(new URL('/reset', request.url), { method: 'POST' }));
    return new Response('Chat history has been reset.', {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
});
// Fallback
router.all('*', () => new Response('Not Found.', { status: 404 }));
// -------------------------------------------------
// EXPORT Worker Listener (Module Worker Handler)
// -------------------------------------------------
export default {
    async fetch(request, env, ctx) {
        const response = await router.handle(request, env, ctx);
        // Global CORS preflight handler for OPTIONS requests
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }
        return response;
    },
};
