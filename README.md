# cf_ai_hallucination_detector 🕵️

An AI-powered persistent chat application built entirely on Cloudflare's serverless infrastructure, featuring **Hallucination Detection** and state management via **Durable Objects**.

This project fulfills the optional Cloudflare AI App Assignment requirements.

## ✨ Features

- **LLM:** Uses Llama 3.1 (or Llama 3) via **Workers AI**.
- **Workflow/Coordination:** Handled by a **Cloudflare Worker** that orchestrates the chat, LLM calls, and state management.
- **Memory/State:** Persistent per-user chat history stored in a **Durable Object (DO)**.
- **Frontend:** Simple chat UI hosted on **Cloudflare Pages** (static HTML/JS).
- **Hallucination Detection:** A two-step LLM process: the initial answer is immediately followed by a secondary LLM call to critique and fact-check the first answer.

## 🚀 Setup and Deployment

### 1. Prerequisites

- A Cloudflare account with a Workers AI binding (ensure you've accepted the terms for AI features).
- The `wrangler` CLI installed (`npm install -g wrangler`).
- Node.js and npm/yarn.

### 2. Local Setup

1.  **Clone the repository:**

    ```bash
    git clone [your-repo-url] cf_ai_hallucination_detector
    cd cf_ai_hallucination_detector
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    npm install --workspace worker
    ```

3.  **Run the Worker locally:**
    This command compiles the TypeScript and starts the local Worker, binding the Durable Object and AI services.

    ```bash
    npx wrangler dev
    ```

    _Wrangler will output a local URL (e.g., `http://127.0.0.1:8787`)._

4.  **Test Locally:**
    - Open `http://localhost:8787/frontend/index.html` (or the URL output by Wrangler).
    - The frontend uses relative paths, so you might need to manually serve the `frontend` folder to test the UI if your `wrangler.toml` doesn't serve the static assets. For the assignment submission, the primary goal is deployment.

### 3. Cloudflare Deployment

1.  **Worker Deployment:**
    Use `wrangler` to deploy the Worker. This will automatically create the Worker, the Durable Object namespace, and the AI binding defined in `wrangler.toml`.

    ```bash
    npx wrangler deploy
    ```

    _The output will provide your deployed Worker URL._

2.  **Pages Deployment (Frontend):**
    The `frontend` directory contains the static assets. You can deploy this via the Cloudflare Pages dashboard (Connect Git > Build command: `npm run build --workspace worker` | Build directory: `frontend`) or use `wrangler pages deploy`.

    ```bash
    npx wrangler pages deploy frontend --project-name cf-ai-hallucination-detector-ui
    ```

    _The deployed URL for the Pages project is your final application URL._

## 📖 Usage

1.  Navigate to the deployed Cloudflare Pages URL.
2.  Type a question into the chat box and hit "Send."
3.  The application will display:
    - The **User's message**.
    - The **Assistant's initial response**.
    - A **Critique Box** showing the result of the secondary LLM's hallucination check.
4.  Ask a follow-up question. The previous messages (stored in the Durable Object) will be included in the context to the LLM, ensuring conversation continuity.
5.  Click the **"Reset"** button to clear the persistent history for your session.

## 📁 Repository Structure
