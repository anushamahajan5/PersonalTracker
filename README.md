# Prototask - A Full-Stack Productivity Web App

Prototask is a clean, minimal, and mobile-friendly personal dashboard designed to help you manage your daily tasks, track habits, monitor nutrition, and organize notes all in one place. Inspired by Notion and modern habit trackers, it aims to provide a seamless and efficient productivity experience.

## Features

### Core Functionality
*   **Authentication**: Secure user registration, login, and logout with JWT cookie-based authentication.
*   **Dashboard**: An overview of today's tasks, habit summaries, protein intake progress, current streaks, and a weekly mini-chart.
*   **Tasks**: Create, read, update, and delete tasks. Organize tasks in a list view or a drag-and-drop Kanban board with priority, due dates, and status.
*   **Notes**: Organize notes into folders, add tags, search functionality, and a markdown-style editor.
*   **Habits**: Create, track, and manage daily habits with a toggle for completion, streak tracking, and a 140-day GitHub-style heatmap visualization.
*   **Nutrition**: Set a daily protein goal, log food entries with protein, carbs, fats, and calorie tracking. Includes a 14-day history chart.
*   **AI Food Parser**: Utilize Claude Sonnet 4.5 via Emergent Universal LLM to intelligently parse natural language food descriptions into macro-nutrient data.
*   **Data Export**: Export tasks, notes, habits, and nutrition data to CSV format.
*   **Weekly Insights**: Get summaries of tasks completed, habit check-ins, average protein intake, and days protein goal was hit.

### Technical Highlights
*   **Dark Mode Default**: Features a dark theme by default with a toggle for a light theme.
*   **Mobile-Friendly**: Responsive design with a mobile sidebar and hamburger menu.
*   **Data-Testid Attributes**: All interactive elements include `data-testid` attributes for robust UI automation and testing.

## Architecture

*   **Frontend**: Built with React 19, Next.js, Tailwind CSS, shadcn/ui, and lucide-react. Manages routes under `/app/*` and uses `AuthContext` and `ThemeContext` for state management. `axios` is used for API communication with cookies and a bearer token fallback.
*   **Backend**: Developed with FastAPI and Motor (for MongoDB interaction). Implements JWT cookie authentication (with bearer token fallback), bcrypt for password hashing, and integrates `emergentintegrations` for AI capabilities. CORS is configured to allow requests from the frontend URL.
*   **Database**: MongoDB, with collections for users, tasks, notes, folders, habits, habit_logs, and food_entries.

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

Before you begin, ensure you have the following installed:
*   **Git**: For cloning the repository.
*   **Node.js**: LTS version (e.g., 18.x or 20.x) for the frontend.
*   **Python**: Version 3.8+ for the backend.
*   **MongoDB**: A running MongoDB instance (local or cloud-hosted).

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "vibe-coded app" # Navigate into the project directory
```

### 2. Backend Setup

1.  **Navigate to the backend directory**:
    ```bash
    cd backend
    ```

2.  **Create and activate a Python virtual environment**:
    *   **Linux/macOS**:
        ```bash
        python3 -m venv .venv
        source .venv/bin/activate
        ```
    *   **Windows (Command Prompt)**:
        ```bash
        python -m venv .venv
        .venv\Scripts\activate
        ```
    *   **Windows (PowerShell)**:
        ```powershell
        python -m venv .venv
        .\.venv\Scripts\Activate.ps1
        ```

3.  **Install Python dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Create a `.env` file**:
    In the `backend` directory, create a file named `.env` and add the following environment variables. Replace placeholder values with your actual configuration.
    ```env
    MONGO_URL="mongodb://localhost:27017/" # Your MongoDB connection string
    DB_NAME="prototask_db" # Name of your MongoDB database
    JWT_SECRET="your_super_secret_jwt_key" # **CRITICAL: Change this to a strong, random key**
    EMERGENT_LLM_KEY="your_emergent_llm_api_key" # Required for AI food parsing. Obtain from Emergent Universal LLM.
    FRONTEND_URL="http://localhost:3000" # The URL where your frontend will be running
    ADMIN_EMAIL="admin@example.com" # Optional: Default admin user email for seeding
    ADMIN_PASSWORD="admin123" # Optional: Default admin user password for seeding
    ```

5.  **Run the backend server**:
    ```bash
    uvicorn server:app --reload
    ```
    The backend API will be available at `http://localhost:8000`.

### 3. Frontend Setup

1.  **Navigate to the frontend directory**:
    ```bash
    cd ../frontend # From the backend directory, or directly if you're at the project root
    ```

2.  **Install Node.js dependencies**:
    ```bash
    npm install # Or yarn install, pnpm install, bun install
    ```

3.  **Create a `.env.local` file**:
    In the `frontend` directory, create a file named `.env.local` and add the following environment variable:
    ```env
    NEXT_PUBLIC_BACKEND_URL="http://localhost:8000" # The URL where your backend API is running
    ```

4.  **Run the frontend development server**:
    ```bash
    npm run dev # Or yarn dev, pnpm dev, bun dev
    ```
    The frontend application will be available at `http://localhost:3000`.

## Test Credentials

The backend automatically seeds an admin and a test user on startup if they don't already exist.

### Admin User
*   **Email**: `admin@example.com`
*   **Password**: `admin123`

### Test User
*   **Email**: `user@example.com`
*   **Password**: `user123`

## Contributing

Contributions are welcome! Please ensure your code adheres to the existing style and includes appropriate tests.

## License

This project is licensed under the MIT License.