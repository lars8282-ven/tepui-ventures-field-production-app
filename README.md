# Tepui Ventures Field Production App

Web-based application for Oil and Gas field personnel to track meter readings and tank gauging by well, with summary statistics compared against baselines.

## Tech Stack

- Next.js 14+ with TypeScript
- InstantDB for backend and real-time database
- Tailwind CSS for styling
- Vercel for deployment

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file with your InstantDB app ID:
```
NEXT_PUBLIC_INSTANT_APP_ID=your-app-id
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- Authentication restricted to @tepuiv.com email addresses
- Well management
- Meter reading tracking
- Tank gauging tracking
- Summary statistics and baseline comparisons
- Mobile-optimized interface
