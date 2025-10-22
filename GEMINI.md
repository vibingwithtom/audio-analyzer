# Gemini Code Assistant Context

## ⚠️ CRITICAL: Development Workflow Rules

**These rules must be followed to prevent production issues:**

1.  **Feature Branch Development:**
    *   Never push directly to `main` for features or significant changes.
    *   Always create a feature branch for any new work.
    *   CI tests are automatically run on every push to a feature branch.

2.  **Testing Requirements:**
    *   All 739+ tests must pass before any code reaches production.
    *   If tests fail on your feature branch, fix them before creating a pull request.

3.  **Pull Requests:**
    *   The `main` branch is protected and requires a pull request with passing CI checks to merge.

4.  **Standard Workflow:**
    ```bash
    # 1. Create a feature branch
    git checkout -b feature/descriptive-name

    # 2. Develop and test locally
    npm run dev
    npm test

    # 3. Commit and push (triggers CI)
    git add .
    git commit -m "feat: description"
    git push origin feature/descriptive-name

    # 4. Deploy to beta for manual testing
    cd packages/web
    npm run deploy:beta

    # 5. Create a Pull Request to main
    gh pr create --base main --head feature/descriptive-name

    # 6. Merge the PR after CI passes
    ```

## Project Overview

This project is a sophisticated audio analyzer application with multiple front-ends: a web app, a Chrome extension, and a desktop application. The core functionality is provided by a shared JavaScript library, `@audio-analyzer/core`.

The application is designed to analyze and validate audio files from various sources, including local files, Google Drive, and Box. It supports batch processing, filename validation against specific patterns, and a range of audio analysis metrics, from basic properties (sample rate, bit depth) to more experimental ones like reverb and noise floor.

## Monorepo Structure

-   **`packages/core`**: The shared audio analysis engine. Key modules include:
    -   `AudioAnalyzer`: Extracts basic file properties.
    -   `LevelAnalyzer`: Performs advanced analysis (peak levels, noise floor, reverb, etc.).
    -   `CriteriaValidator`: Validates audio properties against presets.
    -   `BatchProcessor`: Handles batch processing.
-   **`packages/web`**: The main web application, a PWA built with Svelte 5 and Vite.
-   **`packages/desktop`**: An Electron-based desktop application.
-   **`packages/extension`**: A Chrome extension for analyzing audio files from Google Drive.
-   **`cloud-functions`**: Google Cloud Functions for bilingual validation and a Box API proxy.

## Building and Running

The project is a monorepo managed with npm workspaces. The primary commands are executed from the root directory.

-   **Install Dependencies:**
    ```bash
    npm install
    ```

-   **Development:**
    ```bash
    # Run all packages in development mode
    npm run dev

    # Run a specific package (e.g., the web app)
    npm run dev --workspace=@audio-analyzer/web
    ```

-   **Building:**
    ```bash
    # Build all packages
    npm run build

    # Build a specific package (e.g., the desktop app)
    npm run build --workspace=@audio-analyzer/desktop
    ```

-   **Testing:**
    ```bash
    # Run all tests
    npm run test
    ```

## Deployment (Web App)

The web application has a sophisticated deployment process with two environments:

-   **Production:** `https://audio-analyzer.tinytech.site`
-   **Beta:** `https://audio-analyzer.tinytech.site/beta`

### Production Deployment

Production deployments are **fully automated** via GitHub Actions. Pushing to the `main` branch triggers a workflow that runs all tests and, if they pass, deploys the application.

### Beta Deployment

Beta deployments are done manually from the command line:

```bash
cd packages/web
npm run deploy:beta
```

## Key Documents

-   **`docs/ARCHITECTURE.md`**: A detailed overview of the application's architecture.
-   **`packages/web/DEPLOYMENT.md`**: A comprehensive guide to the web app's deployment process.
-   **`CLAUDE.md`**: A detailed guide for AI assistants working on this project, containing critical workflow rules and in-depth architectural information.

## MCP Availability
- You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
