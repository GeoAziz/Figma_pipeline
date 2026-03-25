# 🎯 Quick Start Guide

Welcome! This guide will get you from zero to deployed in **<10 minutes**.

## ⚡ 5-Minute Local Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd figma-markdown-app
npm install
```

### 2. Get Figma Token

1. Visit [Figma Settings → Personal Access Tokens](https://www.figma.com/settings/tokens)
2. Click "Create a new token"
3. Copy the token (looks like: `figd_xxxxxxxxxxxxxxxxxxxx`)

### 3. Run Locally

```bash
npm run dev
# Opens http://localhost:3000
```

### 4. Use the App

1. Paste your Figma token
2. Paste a Figma file URL (or just the key)
3. Click "Extract & Generate"
4. Download the `.md` spec

**Done!** You now have a structured spec to drop into Claude/GPT/Cursor.

---

## 🚀 Deploy to Vercel (2 minutes)

### Option A: One-Click Deploy

[Click to deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourname%2Ffigma-markdown-app)

### Option B: Git Integration (Recommended)

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Click "Deploy"
5. Get a live URL instantly ✨

### Option C: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

---

## 📖 What's Next?

- 📖 Read [README.md](README.md) — Full feature overview
- 🚀 Read [DEPLOYMENT.md](DEPLOYMENT.md) — Production setup guide
- 🤝 Read [CONTRIBUTING.md](CONTRIBUTING.md) — Dev guide

---

## 🎯 Key Features

| Feature | What It Does |
|---------|-----------|
| **Direct API** | Browser talks directly to Figma API (no server) |
| **Extract Everything** | Frames, components, colors, fonts, dimensions |
| **AI-Ready** | Generates markdown optimized for Claude/GPT |
| **No Storage** | Everything happens in your browser |
| **One-Click Deploy** | Vercel + GitHub = auto-deploys on push |

---

## ❓ Common Questions

### Q: Where are my credentials stored?
**A:** Nowhere! Your token is only kept in your browser memory during extraction.

### Q: Does this upload my design to a server?
**A:** No. Everything stays in your browser. API calls go directly to Figma.

### Q: Can I self-host this?
**A:** Yes! It's a standard Next.js app. Deploy anywhere (Netlify, Railway, Docker, etc.)

### Q: What if I have 100+ screens?
**A:** The extraction is batched. It takes 30-60 seconds for large files.

### Q: Can I use this commercially?
**A:** Yes! MIT License — open source, do what you want.

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "API error 401" | Get a fresh token from [Figma Settings](https://www.figma.com/settings/tokens) |
| "Port 3000 already in use" | `npm run dev -- -p 3001` |
| "No frames extracted" | Move frames closer to top level (depth 1-2) |
| "Build fails locally" | `rm -rf node_modules .next && npm install && npm run build` |

---

## 📚 File Structure

```
figma-markdown-app/
├── 📄 README.md              ← Start here for overview
├── 🚀 DEPLOYMENT.md          ← Deploy to Vercel guide
├── 🤝 CONTRIBUTING.md        ← Development guide
├── ⚡ QUICKSTART.md          ← This file!
│
├── app/
│   ├── page.tsx             ← Main UI component
│   ├── layout.tsx           ← Next.js app layout
│   └── globals.css          ← Global styles
│
├── lib/
│   ├── types.ts             ← TypeScript types
│   ├── figma.ts             ← Figma API utilities
│   └── markdown.ts          ← Markdown generation
│
├── package.json             ← Dependencies
├── tsconfig.json            ← TypeScript config
├── next.config.js           ← Next.js config
├── vercel.json              ← Vercel deployment config
└── .env.example             ← Environment template
```

---

## 🔗 Useful Links

- 🎨 [Figma API Docs](https://www.figma.com/developers/api)
- 📖 [Next.js Documentation](https://nextjs.org/docs)
- 🤖 [OpenAI Models](https://platform.openai.com/docs/models)
- ☁️ [Vercel Docs](https://vercel.com/docs)
- 💻 [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 🎯 Next Steps

### For Users:
1. ✅ Run locally: `npm run dev`
2. ✅ Deploy: Push to GitHub, deploy on Vercel
3. ✅ Use: Download spec, paste into Claude/GPT

### For Developers:
1. ✅ Understand structure: Check file layout above
2. ✅ Read the code: Start with `app/page.tsx`
3. ✅ Modify: Update `lib/markdown.ts` to customize output
4. ✅ Deploy: Follow [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 💡 Pro Tips

- 🎯 **Best AI performance**: Use Claude or GPT-4
- ⚡ **Fastest setup**: Deploy on Vercel
- 🔐 **Most secure**: Use your own Figma token
- 📈 **Scale easily**: Vercel auto-scales for free
- 🎨 **Customize output**: Edit `lib/markdown.ts`

---

## 🆘 Need Help?

- 📖 Check [README.md](README.md#-troubleshooting)
- 💬 Open a [GitHub Issue](https://github.com/yourusername/figma-markdown-app/issues)
- 🔗 Check [Figma API Docs](https://www.figma.com/developers/api)
- 📞 Reach out on Discord / Twitter

---

## 🎉 You're Ready!

```bash
# Start building
npm run dev

# Then deploy
git push origin main
# ...Vercel auto-deploys!
```

**Happy designing! 🚀**

---

_Last updated: 2026-03-19_
