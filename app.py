import os
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from datetime import datetime
import json

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent'

# === Helper Functions ===

def get_chat_system_prompt():
    """Returns the main system prompt for the chat AI."""
    return """
        You are "Chloé," a friendly, patient, and engaging native French speaker. Your goal is to help a user learn French through an immersive, natural conversation.
        - ALWAYS respond ONLY in French.
        - NEVER use English in your main "reply".
        - Your output MUST be a valid JSON object.
        - The JSON object must have two properties:
            1. "reply" (string): Your natural, immersive French response to the user's last message. This is your "Chloé" persona.
            2. "correctionTip" (string | null): A brief, helpful, and friendly correction tip *in English* for the user's *last* message.
        - If the user's message is grammatically correct or has no obvious mistakes, set "correctionTip" to null.
        - Only correct one small, significant error at a time. Don't overwhelm the user.
        - Example of a good tip: "Small correction: 'Je suis 30 ans' is a common mistake! In French, we say 'J'ai 30 ans' (I *have* 30 years)."
        - The "reply" property MUST adapt to the difficulty level:
        - **Beginner:** Use simple, common vocabulary, short sentences, and primarily the present tense. Stick to basic topics.
        - **Intermediate:** Use a wider vocabulary, more complex sentences (e.g., passé composé, imparfait, futur simple), and discuss broader topics like hobbies, travel, or opinions.
        - **Advanced:** Use idiomatic expressions, nuanced vocabulary, and complex grammar (e.g., subjonctif, conditionnel). Feel free to discuss abstract or complex topics.
        - Keep the conversation flowing. Ask questions back to the user.
        - If the user asks for the current time or date, set the "reply" property to the exact string "[CURRENT_TIME]" and nothing else.
    """

def get_translate_system_prompt():
    """Returns the system prompt for the translation tool."""
    return """
        You are a simple translation tool.
        Your output MUST be a valid JSON object.
        The JSON must have two properties: "reply" (string: the translation) and "correctionTip" (null).
    """

def get_current_time_in_french():
    """Gets the current date and time formatted in French."""
    now = datetime.now()
    # Create a dummy strftime to get around locale issues, then replace
    date_str = now.strftime('%A %d %B %Y').replace(
        'Monday', 'lundi').replace('Tuesday', 'mardi').replace('Wednesday', 'mercredi') \
        .replace('Thursday', 'jeudi').replace('Friday', 'vendredi').replace('Saturday', 'samedi') \
        .replace('Sunday', 'dimanche') \
        .replace('January', 'janvier').replace('February', 'février').replace('March', 'mars') \
        .replace('April', 'avril').replace('May', 'mai').replace('June', 'juin') \
        .replace('July', 'juillet').replace('August', 'août').replace('September', 'septembre') \
        .replace('October', 'octobre').replace('November', 'novembre').replace('December', 'décembre')

    time_str = now.strftime('%Hh%M')
    return f"Bien sûr ! Nous sommes le {date_str}, et il est {time_str}. 😊"

def call_gemini_api(contents, system_instruction_text):
    """Internal function to call the Gemini API."""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not set on server.")

    url_with_key = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"

    payload = {
        'contents': contents,
        'systemInstruction': {
            'parts': [{'text': system_instruction_text}]
        },
        'generationConfig': {
            'temperature': 0.7,
            'responseMimeType': "application/json",
        },
        'safetySettings': [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }

    try:
        response = requests.post(url_with_key, json=payload, headers={'Content-Type': 'application/json'})
        response.raise_for_status()  # Raises an HTTPError for bad responses

        result = response.json()

        if not result.get('candidates'):
            if result.get('promptFeedback', {}).get('blockReason'):
                raise Exception(f"Request blocked by Gemini: {result['promptFeedback']['blockReason']}")
            raise Exception('Invalid response structure from Gemini API.')

        # Parse the JSON string *inside* the response
        json_text = result['candidates'][0]['content']['parts'][0]['text']
        return json.loads(json_text)

    except requests.exceptions.RequestException as e:
        print(f"HTTP Request failed: {e}")
        raise
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON response: {e}")
        print(f"Raw text from Gemini: {json_text}")
        raise Exception("Invalid JSON response from AI.")
    except Exception as e:
        print(f"Error in call_gemini_api: {e}")
        raise

# === Flask Routes ===

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Handles chat messages from the client."""
    try:
        data = request.json
        conversation_history = data.get('conversationHistory')
        difficulty = data.get('difficulty')

        # Convert to Gemini format
        contents = [{'role': 'model' if msg['role'] == 'assistant' else 'user',
                     'parts': [{'text': msg['content']}]}
                    for msg in conversation_history]

        # Add difficulty to the last user message
        contents[-1]['parts'][0]['text'] = f"(User is speaking at {difficulty} level) {contents[-1]['parts'][0]['text']}"

        system_prompt = get_chat_system_prompt()
        ai_response = call_gemini_api(contents, system_prompt)

        # Handle special time request
        if "[CURRENT_TIME]" in ai_response.get('reply', ''):
            ai_response['reply'] = get_current_time_in_french()

        return jsonify(ai_response)

    except Exception as e:
        print(f"Error in /api/chat: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def handle_translate():
    """Handles translation requests from the client."""
    try:
        data = request.json
        text_to_translate = data.get('textToTranslate')
        target_lang = data.get('targetLang') # 'English' or 'auto'

        if target_lang == 'English':
            prompt = f"Translate the following French text to English. Provide only the translation. French text: \"{text_to_translate}\""
        else: # auto
            prompt = f"Translate the following text. If it's English, translate to French. If it's French, translate to English. Provide only the translation. Text: \"{text_to_translate}\""

        contents = [{'role': 'user', 'parts': [{'text': prompt}]}]
        system_prompt = get_translate_system_prompt()

        ai_response = call_gemini_api(contents, system_prompt)

        return jsonify(ai_response)

    except Exception as e:
        print(f"Error in /api/translate: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)