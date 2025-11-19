// Function to get a unique user ID, using localStorage for persistence
function getUserId() {
    let userId = localStorage.getItem('cf_ai_user_id');
    if (!userId) {
        // Simple UUID-like generator
        userId = 'user-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('cf_ai_user_id', userId);
    }
    return userId;
}
const WORKER_BASE_URL = 'http://localhost:8787';
const API_ENDPOINT = WORKER_BASE_URL +'/chat'; // The Worker's route
const RESET_ENDPOINT = WORKER_BASE_URL +'/reset'; // The Worker's reset route
const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const USER_ID = getUserId();

// Function to append a message to the chat window
function appendMessage(role, content, critique = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    
    // Add main content
    const contentParagraph = document.createElement('p');
    contentParagraph.innerHTML = content.replace(/\n/g, '<br>');
    messageDiv.appendChild(contentParagraph);

    // Add critique if it exists
    if (critique) {
        const critiqueBox = document.createElement('div');
        critiqueBox.classList.add('critique-box');
        critiqueBox.innerHTML = `**Critique:**<br>${critique.replace(/\n/g, '<br>')}`;
        messageDiv.appendChild(critiqueBox);
    }

    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to bottom
}

// Function to handle sending the message
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    appendMessage('user', message);
    userInput.value = '';
    sendButton.disabled = true;

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: USER_ID, message: message }),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Append the assistant's response and the critique
        appendMessage('assistant', data.response, data.critique);

    } catch (error) {
        console.error('Error sending message:', error);
        appendMessage('assistant', `**Error:** Could not connect to AI service. (${error.message})`);
    } finally {
        sendButton.disabled = false;
    }
}

// Function to handle resetting the history
async function resetHistory() {
    if (!confirm("Are you sure you want to reset your chat history?")) return;
    
    try {
        const response = await fetch(RESET_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: USER_ID }),
        });

        if (!response.ok) {
            throw new Error(`Reset Error: ${response.statusText}`);
        }
        
        // Clear UI and add a system message
        chatWindow.innerHTML = ''; 
        appendMessage('assistant', 'Chat history successfully reset.');

    } catch (error) {
        console.error('Error resetting history:', error);
        appendMessage('assistant', `**Error:** Could not reset history. (${error.message})`);
    }
}


// Event listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});
resetButton.addEventListener('click', resetHistory);