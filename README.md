# T:3

A web-based AI chat application built for the T3 Cloneathon, featuring multi-LLM support, user authentication, chat history sync, and more.

## Features
- Chat with various LLMs via OpenRouter (BYOK supported)
- User authentication with Firebase (Google, Email/Password)
- Chat history synchronization with Firestore
- Browser-friendly interface with loading states and error handling
- Reasoning models, web search
- (WIP) File uploads, chat sharing

## Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-chat-cloneathon.git
   cd ai-chat-cloneathon
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up Firebase:
   - Create a Firebase project and enable Authentication (Google, Email/Password) and Firestore.
   - Add your Firebase config to `.env.local`.
4. Set up OpenRouter:
   - Get an API key from [OpenRouter](https://openrouter.ai/) and [SerperDev](https://serper.dev/)
   - Add it to `.env.local` as `OPENROUTER_API_KEY` (optional for demo; users can provide their own key).
5. Run the development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo
Try the app at [https://tcolon3.vercel.app/](https://tcolon3.vercel.app/).

## License
MIT License. See [LICENSE](LICENSE) for details.
