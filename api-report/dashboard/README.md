# Pakana Node Dashboard

A modern, high-performance dashboard for monitoring the Pakana Private Ledger.

## tech Stack

- **Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Language**: TypeScript

## Design Philosophy

- **Vibrant & Modern**: Deep slate/emerald color palette with glassmorphism effects.
- **Real-time**: Polling implementation with micro-animations for live ledger streams.
- **Lean**: Minimal dependencies; optimized for embedding in Go binaries.

## Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Dev Server**:
   ```bash
   npm run dev
   ```

3. **Build**:
   ```bash
   npm run build
   ```

## Configuration

- **API URL**: The dashboard automatically detects and hits the local `/api/v1` endpoints when served by `api-report`.
- **API Key**: Uses `VITE_API_KEY` for development mode authentication.

## Project Structure

- `src/App.tsx`: Main application logic and UI components.
- `src/main.tsx`: React entry point.
- `src/index.css`: Tailwind configuration and global styles.
- `tsconfig.json`: Lean TypeScript configuration.
