# Prototask - A Full-Stack Productivity Web App

Prototask is a clean, minimal, and mobile-friendly personal dashboard designed to help you manage your daily tasks, track habits, monitor nutrition, and organize notes all in one place. Inspired by Notion and modern habit trackers, it aims to provide a seamless and efficient productivity experience. This project was developed with a focus on modern web technologies, robust system design, and a user-centric approach.


Frontend deployed URL: personal-tracker-fawn.vercel.app
Backend deployed URL: https://prototask-backend.onrender.com

## Features

### Core Functionality
*   **Authentication**: Secure user registration, login, and logout with JWT cookie-based authentication.
*   **Dashboard**: An overview of today's tasks, habit summaries, protein intake progress, current streaks, and a weekly mini-chart.
*   **Tasks**: Create, read, update, and delete tasks. Organize tasks in a list view or a drag-and-drop Kanban board with priority, due dates, and status.
*   **Notes**: Organize notes into folders, add tags, search functionality, and a markdown-style editor.
*   **Habits**: Create, track, and manage daily habits with a toggle for completion, streak tracking, and a 140-day GitHub-style heatmap visualization.
*   **Nutrition**: Set a daily protein goal, log food entries with protein, carbs, fats, and calorie tracking. Includes a 14-day history chart.
*   **Gym**: Log gym sessions with exercises, sets, reps, and optional notes. Track muscle groups and save workout templates for quick reuse. Includes a field to track user's body weight per session.
*   **Shopping**: Manage shopping lists with items, quantities, categories, and purchased status. Filter by category and status, and clear purchased items.
*   **Expenses**: Track daily expenses by amount, category, description, and date. View total spent per month and a breakdown by category. Includes an integrated calculator.
*   **Hobbies**: Log hobby entries with name, date, duration, and notes. Filter by month and hobby name.
*   **AI Food Parser**: Utilize Claude Sonnet 4.5 via Emergent Universal LLM to intelligently parse natural language food descriptions into macro-nutrient data.
*   **Data Export**: Export tasks, notes, habits, and nutrition data to CSV format.
*   **Weekly Insights**: Get summaries of tasks completed, habit check-ins, average protein intake, and days protein goal was hit.

### Design Principles & User Experience
Prototask's design is guided by principles of minimalism, clarity, and responsiveness:
*   **Clean & Minimal UI**: A clutter-free interface inspired by Notion, focusing on essential information and actions.
*   **Mobile-Friendly**: Fully responsive design ensures a seamless experience across various devices, from desktops to smartphones, featuring a mobile sidebar and hamburger menu.
*   **Dark Mode Default**: Features a dark theme by default with a toggle for a light theme.
*   **Data-Testid Attributes**: All interactive elements include `data-testid` attributes for robust UI automation and testing.
*   **Consistent Layout**: Pages like Dashboard, Notes, Expenses, Gym, Shopping, and Hobbies follow a uniform grid layout with a dedicated sidebar for filters and key information, enhancing navigation and user familiarity.

## Technology Stack & Rationale

Prototask employs a modern full-stack architecture designed for scalability, performance, and developer efficiency.

### Frontend
*   **React 19**: Chosen for its component-based architecture, enabling reusable UI elements and a declarative approach to building user interfaces.
*   **Next.js**: A powerful React framework that provides server-side rendering (SSR), static site generation (SSG), and API routes, optimizing performance and SEO. It simplifies routing, code splitting, and asset optimization.
*   **Tailwind CSS**: A utility-first CSS framework that allows for rapid UI development directly in JSX. Its highly customizable nature and focus on responsive design make it ideal for creating a unique and adaptive user experience.
*   **shadcn/ui**: A collection of re-usable components built with Tailwind CSS and React. It provides accessible and customizable UI primitives, accelerating development while maintaining a consistent design language.
*   **lucide-react**: A lightweight and customizable icon library that integrates seamlessly with React projects, offering a wide range of vector icons.
*   **State Management**: Utilizes `AuthContext` and `ThemeContext` for global state management related to user authentication and theme preferences, ensuring a consistent experience across the application.
*   **API Communication**: `axios` is used for making HTTP requests to the backend, configured with cookie-based authentication and a bearer token fallback for secure and flexible API interactions.

### Backend
*   **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python 3.8+. It leverages Python type hints with Pydantic for data validation and serialization, leading to robust and self-documenting APIs (with automatic Swagger UI/ReDoc generation).
*   **Motor**: An asynchronous Python driver for MongoDB. It integrates perfectly with FastAPI's `async`/`await` capabilities, allowing for non-blocking database operations and improved performance.
*   **MongoDB**: A flexible NoSQL document database. Its schema-less nature is well-suited for rapid development and evolving data models, making it a good choice for a feature-rich productivity application.
*   **Authentication**:
    *   **JWT (JSON Web Tokens)**: Used for stateless authentication, providing a secure and scalable method for verifying user identity across requests. Tokens are managed via secure, HTTP-only cookies with a bearer token fallback.
    *   **bcrypt**: A strong, adaptive password hashing function used to securely store user passwords, protecting against brute-force attacks.
*   **AI Integration**: Integrates with `emergentintegrations` to access advanced Large Language Models (LLMs) like Claude Sonnet 4.5. This powers features like the AI Food Parser, allowing natural language input for macro-nutrient estimation.
*   **CORS Configuration**: Carefully configured to allow requests only from the specified frontend URL, enhancing security by preventing unauthorized cross-origin access.

## System Design

Prototask follows a classic client-server architecture, separating the user interface from the backend logic and data storage.

### 1. Client-Side (Frontend)
The frontend, built with **React 19** and **Next.js**, provides the user interface. It handles:
*   **User Interaction**: Renders dynamic UI components using **Tailwind CSS** and **shadcn/ui**.
*   **Routing**: Next.js manages client-side routing, ensuring a smooth single-page application experience.
*   **State Management**: `AuthContext` and `ThemeContext` manage global application state for user authentication and theme preferences.
*   **API Communication**: All interactions with the backend are performed via `axios`, sending requests and processing responses. This includes handling JWTs stored in HTTP-only cookies for secure communication.

### 2. Server-Side (Backend)
The backend, powered by **FastAPI**, serves as the application's API layer. Its responsibilities include:
*   **API Endpoints**: Exposes RESTful APIs for all application features (Tasks, Notes, Habits, Nutrition, Gym, Shopping, Expenses, Hobbies).
*   **Authentication & Authorization**: Secures endpoints using JWTs, verifying user identity and permissions. Passwords are securely hashed with `bcrypt`.
*   **Business Logic**: Processes requests, applies application-specific rules, and orchestrates data operations.
*   **Database Interaction**: Communicates with MongoDB using `Motor` (an asynchronous driver) for efficient data storage and retrieval.
*   **AI Integration**: Acts as a proxy for AI services, forwarding user requests (e.g., for food parsing) to external LLMs via `emergentintegrations` and returning the processed results.
*   **CORS Management**: Configured to allow secure cross-origin requests from the frontend application.

### 3. Data Storage (Database)
**MongoDB** is the primary data store, chosen for its flexibility and scalability as a NoSQL document database. It stores various collections:
*   `users`: User profiles and authentication details.
*   `tasks`: User-specific tasks.
*   `notes`, `folders`: Structured storage for notes and their organization.
*   `habits`, `habit_logs`: Habit definitions and daily completion records.
*   `food_entries`: Detailed nutritional logs.
*   `gym_sessions`, `gym_templates`: Workout records and reusable templates.
*   `shopping_items`: Shopping list entries.
*   `expenses`: Financial expense records.
*   `hobby_entries`: Records of hobby activities.

### Interaction Flow
When a user performs an action (e.g., logging a gym session):
1.  The frontend captures the user input and constructs an API request.
2.  `axios` sends this request (e.g., `POST /api/gym/sessions`) to the FastAPI backend, including the user's JWT for authentication.
3.  FastAPI validates the request data using Pydantic models and authenticates the user.
4.  The backend's business logic processes the request and interacts with MongoDB via `Motor` to store or retrieve data.
5.  MongoDB performs the requested operation and returns the result to FastAPI.
6.  FastAPI sends an appropriate JSON response back to the frontend.
7.  The frontend updates its UI based on the response, providing immediate feedback to the user.

This modular design ensures clear separation of concerns, making the application easier to develop, maintain, and scale.

### Development Workflow
*   **Environment Variables**: Utilizes `.env` files for managing sensitive information and configuration settings for both frontend and backend.
*   **Seeded Data**: The backend automatically seeds an admin and a test user on startup if they don't already exist, facilitating quick setup and testing.

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