document.addEventListener('DOMContentLoaded', () => {

    // === DOM Elements ===
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const newChatBtn = document.getElementById('new-chat-btn');
    const difficultySelect = document.getElementById('difficulty-select');

    const sidebar = document.getElementById('sidebar');
    const translationList = document.getElementById('translation-list');
    const translationPlaceholder = document.getElementById('translation-placeholder');
    const translateForm = document.getElementById('translate-form');
    const translateInput = document.getElementById('translate-input');
    const translateOutput = document.getElementById('translate-output');

    // === State ===
    let conversationHistory = [];
    let translatedMessages = [];
    let difficulty = 'Beginner';

    // === Initialization ===
    startNewConversation(); // Call this to set up the initial state
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // === Event Listeners ===

    // Chat
    chatForm.addEventListener('submit', handleSendMessage);
    newChatBtn.addEventListener('click', startNewConversation);
    difficultySelect.addEventListener('change', (e) => {
        difficulty = e.target.value;
    });

    // Translation
    translateForm.addEventListener('submit', handleTranslatePhrase);


    // === Core Chat Logic ===
    async function handleSendMessage(e) {
        e.preventDefault();
        const userMessage = messageInput.value.trim();
        if (!userMessage) return;

        // Add user message to state and render
        conversationHistory.push({ role: 'user', content: userMessage });
        renderConversation();
        messageInput.value = '';
        showLoading(true);

        try {
            // Send history and difficulty to our backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationHistory: conversationHistory.slice(-10), // Send last 10
                    difficulty: difficulty
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Server error: ${response.status}`);
            }

            const aiResponseObject = await response.json();

            // Add correction tip to the user's last message
            const correctionTip = aiResponseObject.correctionTip;
            const lastUserMessage = conversationHistory.findLast(m => m.role === 'user');
            if (lastUserMessage && correctionTip) {
                lastUserMessage.tip = correctionTip;
            }

            // Add AI message to state
            conversationHistory.push({ role: 'assistant', content: aiResponseObject.reply });

            // Trigger translation for sidebar
            translateAiMessage(aiResponseObject.reply);

        } catch (error) {
            console.error('Error getting AI response:', error);
            conversationHistory.push({ role: 'assistant', content: "Désolé, une erreur s'est produite. (Error: " + error.message + ")" });
        } finally {
            showLoading(false);
            renderConversation();
        }
    }

    // === Translation Logic ===
    async function translateAiMessage(aiText) {
        try {
            // Call our backend for translation
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    textToTranslate: aiText,
                    targetLang: 'English'
                })
            });

            if (!response.ok) throw new Error('Translation server error');

            const translation = await response.json();

            translatedMessages.push({
                french: aiText,
                english: translation.reply
            });
            renderTranslatedMessages();

        } catch (error) {
            console.error('Error translating message:', error);
            translatedMessages.push({
                french: aiText,
                english: "(Translation failed)"
            });
            renderTranslatedMessages(); // Render even if failed
        }
    }

    async function handleTranslatePhrase(e) {
        e.preventDefault();
        const textToTranslate = translateInput.value.trim();
        if (!textToTranslate) return;

        translateOutput.textContent = 'Translating...';

        try {
            // Call our backend for translation
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    textToTranslate: textToTranslate,
                    targetLang: 'auto' // 'auto' will detect lang
                })
            });
            if (!response.ok) throw new Error('Translation server error');

            const translation = await response.json();
            translateOutput.textContent = translation.reply;
        } catch (error) {
            console.error('Error in phrase translator:', error);
            translateOutput.textContent = 'Translation failed.';
        } finally {
            translateInput.value = '';
        }
    }

    // === Conversation Management ===
    function startNewConversation() {
        conversationHistory = [];
        translatedMessages = [];
        renderTranslatedMessages();

        // Send initial greeting from AI
        const greeting = "Bonjour ! 👋 Je m'appelle Chloé. Prêt(e) à pratiquer ton français ? De quoi aimerais-tu parler aujourd'hui ?";
        conversationHistory.push({ role: 'assistant', content: greeting });

        renderConversation(); // Call this AFTER adding the greeting

        // Asynchronously translate the greeting
        translateAiMessage(greeting);
    }

    // === UI Rendering ===
    function renderConversation() {
        chatMessages.innerHTML = '';

        conversationHistory.forEach(msg => {
            const isAI = msg.role === 'assistant';
            const bubble = document.createElement('div');
            bubble.className = `max-w-xl p-4 rounded-2xl ${isAI ? 'chat-bubble-ai self-start' : 'chat-bubble-user self-end'}`;

            // Basic markdown-like formatting for newlines
            bubble.innerHTML = msg.content.replace(/\n/g, '<br>');

            chatMessages.appendChild(bubble);

            // If this is a user message AND it has a correction tip, render it
            if (msg.role === 'user' && msg.tip) {
                const tipBubble = document.createElement('div');
                tipBubble.className = 'max-w-xl p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 self-end ml-10 -mt-2 mb-4 text-sm flex items-center gap-2';
                tipBubble.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb flex-shrink-0"><path d="M15 14c.2-1 .7-1.7 1.5-2.5C17.8 10 18 8.2 18 7c0-3.3-2.7-6-6-6S6 3.7 6 7c0 1.2.2 2.4 1.5 3.5.7.7 1.2 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                    <span><strong>Helpful Tip:</strong> ${msg.tip}</span>
                `;
                chatMessages.appendChild(tipBubble);
            }
        });
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
    }

    function renderTranslatedMessages() {
        if (translatedMessages.length > 0) {
            translationPlaceholder.classList.add('hidden');
            translationList.innerHTML = '';

            // Show in reverse order (newest first)
            translatedMessages.slice().reverse().forEach(msg => {
                const item = document.createElement('div');
                item.className = 'p-3 bg-white border border-slate-200 rounded-lg shadow-sm';

                item.innerHTML = `
                    <p class="text-sm text-blue-800 font-medium">${msg.french}</p>
                    <p class="text-sm text-slate-600 mt-1">${msg.english}</p>
                `;
                translationList.appendChild(item);
            });
        } else {
            translationPlaceholder.classList.remove('hidden');
            translationList.innerHTML = ''; // Clear list
        }
    }

    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
            sendBtn.disabled = true;
        } else {
            loadingIndicator.classList.add('hidden');
            sendBtn.disabled = false;
        }
    }
});