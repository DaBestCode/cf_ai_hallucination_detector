// frontend/functions/_middleware.js

const WORKER_API_URL = "https://cf-ai-hallucination-detector.pjanga.workers.dev";

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (url.pathname === '/chat' || url.pathname === '/reset') {
    // Read the body if present on POST/PUT
    let body = null;
    if (request.method === 'POST' || request.method === 'PUT') {
      body = await request.text();
    }

    // Forward request to Worker API
    const targetUrl = WORKER_API_URL + url.pathname;
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body,
    });

    try {
      const workerResponse = await fetch(proxyRequest);
      return workerResponse;
    } catch (error) {
      console.error("Worker proxy fetch failed:", error);
      return new Response("API Gateway Error (1019): Failed to connect to backend Worker.", { status: 500 });
    }
  }

  // Allow static file handling
  return next();
}
