French Immersion Chat (Python + JS Project)

This project converts the single-file HTML chatbot into a full-stack web application with a Python (Flask) backend and a JavaScript frontend.

This architecture is more secure and robust because:

API Key is Secure: Your Gemini API key is stored on the server in a .env file and is never exposed to the user's browser.

Prompt Logic is Hidden: The core "system prompts" that define the AI's persona are on the server, preventing users from easily viewing or modifying them.

Project Structure

french-chat-project/
├── app.py             # The Python (Flask) backend server
├── requirements.txt   # Python dependencies
├── .gitignore         # Files to ignore (like .env)
├── README.md          # These instructions
│
├── static/
│   └── script.js      # All the client-side JavaScript
│
└── templates/
└── index.html     # The main HTML file


How to Run

Create Project Folder:
Create a new folder (e.g., french-chat-project) and place all the files from this project into their correct locations as shown in the structure above.

Set up Python Environment:
It's highly recommended to use a virtual environment.

# Navigate into your project folder
cd french-chat-project

# Create a virtual environment
python -m venv venv

# Activate it (on Windows: venv\Scripts\activate)
source venv/bin/activate


Install Dependencies:
Install the required Python libraries.

pip install -r requirements.txt


Create .env File:
Create a new file named .env in the main french-chat-project directory. Add your API key to it:

GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"


(The .gitignore file will prevent this file from ever being committed to git).

Run the Server:

python app.py


Your server will start, usually on http://127.0.0.1:5000.

Open the App:
Open your web browser and go to http://127.0.0.1:5000 to use the application.