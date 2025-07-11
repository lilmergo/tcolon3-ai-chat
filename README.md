# AI Chat Cloneathon

A web-based AI chat application built for the Cloneathon competition, featuring multi-LLM support, user authentication, chat history sync, and more.

## Features
- Chat with various LLMs via OpenRouter (BYOK supported)
- User authentication with Firebase (Google, Email/Password)
- Chat history synchronization with Firestore
- Browser-friendly interface with loading states and error handling
- **Advanced Reasoning Mode** with LangGraph step-by-step thinking visualization
- **Knowledge Base** with document upload and intelligent search (PDF, DOCX, TXT, MD)
- **Enhanced Memory Management** with LangChain conversation memory
- **Real-time Streaming** for both regular chat and thinking steps
- File uploads, syntax highlighting, chat sharing, web search

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
3. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in your configuration values
4. Set up Firebase:
   - Create a Firebase project and enable Authentication (Google, Email/Password), Firestore, and Storage
   - Download the Firebase Admin SDK service account key
   - Add your Firebase config to `.env.local`
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`
5. Set up OpenRouter:
   - Get an API key from [OpenRouter](https://openrouter.ai/)
   - Add it to `.env.local` as `OPENROUTER_API_KEY`
6. (Optional) Set up web search:
   - Get a Serper API key from [Serper](https://serper.dev/)
   - Add it to `.env.local` as `SERPER_API_KEY`
7. Run the development server:
   ```bash
   npm run dev
   ```
8. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables
See `.env.example` for all required environment variables. Key variables include:

- `NEXT_PUBLIC_FIREBASE_*`: Firebase client configuration
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK credentials (JSON string)
- `OPENROUTER_API_KEY`: OpenRouter API key for LLM access
- `SERPER_API_KEY`: Serper API key for web search (optional)

## Firebase Setup
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Google, Email/Password)
3. Enable Firestore Database
4. Enable Storage
5. Generate a service account key for Admin SDK
6. Deploy security rules: `firebase deploy --only firestore:rules,storage`

## Advanced Features
- **Advanced Reasoning**: Step-by-step AI thinking with LangGraph (limited to 1 request per account during development)
- **Knowledge Base**: Upload documents for context-aware responses (indexing takes 2-5 minutes)
- **Memory Management**: Intelligent conversation context with LangChain
- **Real-time Updates**: Live streaming of responses and thinking steps

## Demo
Try the app at [https://ai-chat-cloneathon.vercel.app](https://ai-chat-cloneathon.vercel.app).

## License
MIT License. See [LICENSE](LICENSE) for details.