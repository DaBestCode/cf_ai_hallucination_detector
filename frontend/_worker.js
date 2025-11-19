// frontend/_worker.js

// Define the exact URL of your deployed Worker API
// Use the URL confirmed in your deployment logs:
const WORKER_API_URL = "https://cf-ai-hallucination-detector.pjanga.workers.dev";
    
// Pages Functions export a single onRequest handler
export async function onRequest({ request, next }) {
    const url = new URL(request.url);

    // Check if the request path is for the API
    if (url.pathname === '/chat' || url.pathname === '/reset') {
        
        // Construct the new URL pointing to the deployed Worker
        const targetUrl = WORKER_API_URL + url.pathname;
        
        // Create a new request object to send to the Worker
        // IMPORTANT: We must clone the body if we are going to read it or pass it on.
        // We use request.clone() to safely create a new request for the fetch call.
        const newRequest = new Request(targetUrl, {
            method: request.method,
            headers: request.headers,
            body: request.method === 'POST' || request.method === 'PUT' ? request.body : null
        });

        try {
            // Fetch the response from the Worker API
            const workerResponse = await fetch(newRequest);
            return workerResponse;
        } catch (error) {
            // Handle any connection/fetch errors gracefully
            console.error("Worker proxy fetch failed:", error);
            return new Response("API Gateway Error (1019): Failed to connect to backend Worker.", { status: 500 });
        }
    }

    // If the path is anything else (like / or /index.html), let Pages handle the static file
    return next();
}