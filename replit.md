# Cleo & Leo Telegram Bot

## Overview
A serverless Telegram bot for selling digital content (photos, audio, videos) using Telegram Stars payment system. Built with Next.js and designed for deployment on Vercel.

## Features
- **Content Sales**: Photos (50 stars), Audio (30 stars), Videos (150 stars)
- **Multi-language Support**: Italian, Spanish, English based on user's Telegram language
- **Channel Verification**: Users must be subscribed to the official channel
- **Admin Features**: Broadcast messages, send advertisements, free content access
- **Statistics Dashboard**: Real-time analytics with charts and user tracking
- **Auto-delete**: Unpaid content is automatically deleted after 60 minutes

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── webhook/route.ts    # Telegram webhook handler
│   │   └── stats/route.ts      # Statistics API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Dashboard page
├── data/
│   ├── photo.json              # Photo file IDs
│   ├── video.json              # Video file IDs
│   ├── audioEn.json            # English audio file IDs
│   ├── audioEs.json            # Spanish audio file IDs
│   ├── audioIt.json            # Italian audio file IDs
│   ├── captionEn.json          # English captions
│   ├── captionEs.json          # Spanish captions
│   ├── captionIt.json          # Italian captions
│   ├── prices.json             # Content prices
│   ├── start.json              # Welcome messages
│   ├── adv.json                # Advertisement content
│   └── adminUserId.json        # Admin user ID
└── lib/
    ├── redis.ts                # Upstash Redis service
    └── telegram.ts             # Telegram API utilities
```

## Environment Variables
Required environment variables for Vercel deployment:
- `TELEGRAM_BOT_TOKEN` - Telegram Bot Token from @BotFather
- `ADMIN_USER_ID` - Telegram user ID of the admin (default: 6227453725)
- `KV_REST_API_READ_ONLY_TOKEN` - Upstash Redis read-only token
- `KV_REST_API_TOKEN` - Upstash Redis token
- `KV_REST_API_URL` - Upstash Redis REST API URL
- `KV_URL` - Upstash Redis URL
- `REDIS_URL` - Redis connection URL

## Deployment
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Set webhook URL: `https://your-domain.vercel.app/api/webhook`

## Admin Commands
- `!toEveryone! message` - Broadcast to all users
- `!toEveryIt! message` - Broadcast to Italian users
- `!toEveryEs! message` - Broadcast to Spanish users
- `!toEveryEn! message` - Broadcast to other users
- `/sendadv` - Send advertisement to all users
- `/testadv` - Test advertisement (admin only)

## Recent Changes
- December 5, 2025: Initial project setup with all features implemented
