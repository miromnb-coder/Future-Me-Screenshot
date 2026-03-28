# Future Me Screenshot

A polished Next.js app that generates a viral-style chat screenshot with your future self.

## Features
- Write one decision and turn it into a realistic chat
- Choose a tone: realistic, savage, supportive, or funny
- Export the conversation as a PNG screenshot
- Mobile-first layout that works well for TikTok-style content

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import the GitHub repo in Vercel.
3. Deploy.

## Notes
- The app currently works fully on the client side.
- Screenshot export uses `html2canvas`.


## API route
- `/api/generate` returns the conversation JSON used by the UI.
