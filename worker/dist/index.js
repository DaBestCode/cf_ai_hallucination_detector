import { Router } from 'itty-router';
import { DurableChat } from './DurableChat';
// -------------------------------------------------
// EXPORT DurableChat for the DO namespace binding
// -------------------------------------------------
export { DurableChat };
// --- Main Worker Logic (Router implementation remains the same) ---
const router = Router(); // Type the router to accept Env as extra args
// Endpoint to process a new chat message
// Note: Handlers are now async (request: IRequest, env: Env) => Response
router.post('/chat', async (request, env) => {
    try {
        const { userId, message } = await request.json();
        // ... (All LLM and DO communication logic from Step 2 of the previous response remains here)
        // ... (The code block is identical to the FINALIZED index.ts content from the previous answer, 
        //      but ensure it uses the DO stub.fetch pattern.)
        // The core logic is lengthy, but assuming it was correct in the previous step:
        const id = env.CHAT_STATE.idFromName(userId);
        const stub = env.CHAT_STATE.get(id);
        // 1. Get History (GET request to stub)
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
        // 4. Update DO (POST request to stub)
        await stub.fetch(new Request(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, assistantAnswer: initialAnswer })
        }));
        // 5. Return Final Response
        return new Response(JSON.stringify({ response: initialAnswer, critique: critiqueResult }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (err) {
        console.error(err);
        return new Response('Internal Server Error: ' + err.message, { status: 500 });
    }
});
// Endpoint to reset the chat history
router.post('/reset', async (request, env) => {
    // ... (Reset logic remains the same, using stub.fetch)
    const { userId } = await request.json();
    if (!userId) {
        return new Response('Missing userId', { status: 400 });
    }
    const id = env.CHAT_STATE.idFromName(userId);
    const stub = env.CHAT_STATE.get(id);
    await stub.fetch(new Request(new URL('/reset', request.url), { method: 'POST' }));
    return new Response('Chat history has been reset.', { status: 200 });
});
// Fallback
router.all('*', () => new Response('Not Found.', { status: 404 }));
// -------------------------------------------------
// EXPORT Worker Listener (Module Worker Handler)
// -------------------------------------------------
export default {
    async fetch(request, env, ctx) {
        // Use the itty-router to handle requests
        return router.handle(request, env, ctx); // Use `as any` or ensure itty-router types are matched
    },
};
