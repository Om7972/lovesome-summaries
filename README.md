# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5ad746ee-2774-4bd1-9593-3d923eebc020

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5ad746ee-2774-4bd1-9593-3d923eebc020) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Full Implementation Features

### PDF Summarization
- **Upload PDF files** (up to 20MB).
- **Automatic text extraction** from PDFs using stream objects and block extraction.
- **AI-powered summarization** using OpenAI GPT-4 Turbo.
- **Interactive Q&A** feature based on PDF structure and content.

### Video & YouTube Summarization
- **Upload video files** (MP4, WebM, OGG, MOV, AVI) up to 25MB (Whisper API limit).
- **YouTube Support:** Automatic transcript extraction for YouTube videos with captions.
- **Automatic transcription** with precise timestamps using OpenAI Whisper API.
- **AI-powered summarization** of video transcriptions using OpenAI GPT-4 Turbo.

## Frontend Architecture

The user interface and state management are built using a modern React stack:
- **Vite** for fast module bundling and development.
- **TypeScript** for reliable type safety across the frontend.
- **React (React Hooks)** for scalable component logic.
- **shadcn-ui** and **Tailwind CSS** for sleek, responsive styling and UI elements.
- **Supabase Client** designed for seamless integration with the deployed edge functions.

## Backend & API Endpoints

The backend securely manages API calls without exposing keys on the frontend. It operates on **Supabase Edge Functions** for low-latency compute. 

### Deployed Edge Functions (Endpoints):
- `POST /summarize-pdf`: Accepts base64 encoded PDF files, extracts the text using multi-method block extraction, and communicates with GPT-4 for a structured markdown format.
- `POST /summarize-video`: Processes uploaded video files using the GPT-4 Turbo API to provide detailed, timestamped summaries.
- `POST /transcribe-video`: Dedicated ingestion point that takes video uploads or YouTube URLs, processes them through OpenAI Whisper API, and returns accurate speaker transcriptions.
- `POST /answer-question`: An interactive Q&A endpoint that consumes `document` or `video` scope context and answers queries dynamically through GPT-4 Turbo.

## Database & Setup

The database, edge compute, and environmental secrets are managed entirely through **Supabase**. 

### 1. Configuration & Secrets Setup
To enable AI features, an OpenAI API key needs to be loaded into your Supabase project:
- Navigate to your **Supabase Dashboard**.
- Go to **Settings** -> **Edge Functions** -> **Secrets**.
- Create a new secret named `OPENAI_API_KEY` and insert your API Key. (You can also use the included `setup-openai-key.sh` or `.ps1` scripts using the Supabase CLI).

### 2. Deploying the Backend
Make sure your Edge Functions are live on your Supabase instance:
```sh
supabase functions deploy summarize-pdf
supabase functions deploy summarize-video
supabase functions deploy transcribe-video
supabase functions deploy answer-question
```

### 3. Running the Project Locally
Ensure Node.js is installed on your system.

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install frontend dependencies
npm install

# Start the Vite development server
npm run dev
```

## Deployment

Deploying the frontend can be done seamlessly. Just open [Lovable](https://lovable.dev/projects/5ad746ee-2774-4bd1-9593-3d923eebc020) and click on **Share -> Publish**. 

*(To connect a personalized domain, navigate to **Project > Settings > Domains** inside the Lovable portal and click **Connect Domain**.)*
