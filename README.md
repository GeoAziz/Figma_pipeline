# 🎨 Figma → Markdown | AI Build Spec Generator

**Convert your entire Figma design into a structured markdown specification ready for AI to build the full product.**

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourname%2Ffigma-markdown-app)

## ✨ Features

- **🔗 Direct Figma API Integration** — No server, no data storage. Browser connects directly to Figma REST API
- **📱 Complete Design Extraction** — Pulls all screens, components, colours, typography, dimensions
- **📊 Design System Analysis** — Extracts colour palette with usage counts, typography data, font weights & sizes
- **🤖 AI-Ready Output** — Generate markdown specifications optimized for Claude, GPT-4, Cursor
- **🎯 Pixel-Perfect Specs** — Includes screen dimensions, bounding boxes, layer hierarchies, thumbnails
- **⚡ Production-Ready** — Built with Next.js 14, TypeScript, deployed on Vercel
- **🎨 Beautiful UI** — Dark mode interface with progress tracking, live preview, syntax highlighting

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ / npm / pnpm / yarn
- Figma account with Personal Access Token
- (Optional) Vercel account for deployment

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/figma-markdown-app.git
cd figma-markdown-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Get Your Figma Personal Access Token

1. Go to [Figma Settings → Personal Access Tokens](https://www.figma.com/settings/tokens)
2. Click **Create a new token**
3. Copy the token (format: `figd_xxxxxxxxxxxxxxxxxxxx`)
4. Paste into the app input field

## 📋 How It Works

### Step 1: Connect
Provide your Figma Personal Access Token and file URL/key.
- Token is **never stored** — only sent directly to Figma API
- All processing happens in your browser

### Step 2: Extract
The app traverses your Figma file (depth 3) and collects:
- All frames and components
- Fill colours and opacity values
- Typography (families, weights, sizes)
- Layer hierarchies and bounding boxes
- Screen thumbnails

### Step 3: Generate
Produces a structured markdown file with:
- Project overview table
- Complete design system (colours, typography)
- Screen inventory with dimensions & layer info
- Component hints
- AI build instructions with tech stack recommendations
- Asset export checklist

### Step 4: Export
Download the `.md` file and paste into your favourite AI:
```
"Build the full application described in this spec."
```

Claude, GPT-4, and Cursor will generate production-ready code based on your specifications.

## 📦 Project Structure

```
figma-markdown-app/
├── app/
│   ├── page.tsx              # Main React component (TSX)
│   ├── layout.tsx            # Next.js app layout
│   └── globals.css           # Global styles
├── lib/
│   ├── types.ts              # TypeScript type definitions
│   ├── figma.ts              # Figma API utilities
│   └── markdown.ts           # Markdown generation logic
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── next.config.js            # Next.js configuration
├── vercel.json              # Vercel deployment config
├── .env.example             # Environment variables template
└── README.md                # This file
```

## 🛠️ Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) — React with App Router
- **Language:** [TypeScript](https://www.typescriptlang.org/) — Full type safety
- **Styling:** CSS-in-JS (inline styles) — No external dependencies
- **API:** [Figma REST API v1](https://www.figma.com/developers/api)
- **Deployment:** [Vercel](https://vercel.com/) — Serverless hosting
- **Package Manager:** npm / pnpm / yarn

## 🔐 Privacy & Security

- ✅ **No Backend Server** — All processing in the browser
- ✅ **No Data Storage** — Nothing is persisted anywhere
- ✅ **No Tracking** — No analytics or telemetry
- ✅ **Direct API Calls** — Browser → Figma API (TLS encrypted)
- ✅ **Token Handling** — Tokens are memory-only, never logged or transmitted elsewhere
- ✅ **CORS Safe** — Figma API allows direct browser requests with valid token

## 📚 API Reference

### Figma Node Types Extracted

- `FRAME` — Top-level design screens
- `COMPONENT` — Reusable components with instances
- `COMPONENT_SET` — Component variants
- `SECTION` — Organized groups (also treated as frames)

### Extracted Data

```typescript
interface ExtractionResult {
  fileData: {
    name: string;
    version: string;
    lastModified: string;
    document: { children: FigmaPage[] };
    components?: Record<string, { name: string }>;
    styles?: Record<string, { name: string }>;
  };
  frames: Array<{
    id: string;
    name: string;
    type: string;
    node: FigmaNode;
  }>;
  thumbnails: Record<string, string>; // URL map
  colors: Map<string, { hex: string; alpha: number; usages: number }>;
  fonts: Map<string, { family: string; weights: Set<number>; sizes: Set<number> }>;
}
```

## 🚀 Deploy to Vercel

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourname%2Ffigma-markdown-app)

### Option 2: CLI Deploy

```bash
npm i -g vercel
vercel
```

### Option 3: Git Integration

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Vercel auto-detects Next.js and deploys

**Build Settings:**
- Framework: Next.js
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`

## 📖 Usage Examples

### Extract a Design System

```
🎨 Input: Figma file with all brand colours used in components
📤 Output: Markdown section:

## Colour Palette
| Hex | RGB | Usage Count | Opacity |
| #7c3aed | rgb(124, 58, 237) | 23× | 100% |
| #a78bfa | rgb(167, 139, 250) | 18× | 100% |
```

### Build with AI

```bash
# Download the markdown spec
# Open Claude / GPT-4 / Cursor

# Paste the spec and ask:
"Build the full application described in this spec. 
Use TypeScript, React, Next.js, and Tailwind CSS. 
Match the exact dimensions, colours, and layout."
```

## 🐛 Troubleshooting

### "Figma API error 401"
- ❌ Token is invalid or expired
- ✅ Get a new token from [Figma Settings](https://www.figma.com/settings/tokens)

### "Thumbnails not loading"
- ❌ Figma API thumbnail endpoint might be temporarily unavailable
- ✅ The spec still generates without thumbnails — download and use it anyway

### "No frames extracted"
- ❌ Your frames might be below depth-3 in the hierarchy
- ✅ Move frames closer to the top level (within 2 levels of pages)

### "Running slow on large files"
- ❌ 100+ frames requires multiple API calls
- ✅ This is expected — wait 30-60 seconds for all thumbnails

## 📝 Build Instructions Generation

The markdown includes tailored build advice:

```markdown
### Tech Stack Recommendations
- Framework: React (with TypeScript preferred) or Next.js
- Styling: Tailwind CSS — map the colour palette above
- Icons: Lucide React or Heroicons
- Animations: Framer Motion for transitions
- State: Zustand or React Context

### General Principles
- Pixel-perfect implementation: match dimensions exactly
- Use `rem` units for spacing (1rem = 16px base)
- Mobile-first responsive approach
- Proper loading states, error boundaries, empty states
```

## 🔄 Limitations & Future Features

### Current Limitations
- Extracts up to 60 screens (configurable)
- Depth-3 traversal (nested components)
- Does not extract images/videos
- Does not extract interactions/prototypes
- Does not extract constraints/layout grids (yet)

### Future Enhancements
- [ ] Export shadow properties and blur effects
- [ ] Extract interaction flows and prototypes
- [ ] Support for component instances with overrides
- [ ] Batch processing multiple Figma files
- [ ] Custom markdown templates
- [ ] Export to JSON, YAML formats
- [ ] Integration with design system tools

## 📄 License

MIT License — See LICENSE file for details

## 👤 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙋 Support

- 📖 [Figma API Docs](https://www.figma.com/developers/api)
- 🤖 [OpenAI Models](https://platform.openai.com/docs/models)
- 🔗 [Next.js Documentation](https://nextjs.org/docs)
- 💬 Discord / Twitter for questions

## 🎯 Related Tools

- [Figma to HTML](https://www.figma.com/community/plugins/738603556462029200/HTML-to-Design)
- [Figma to Code](https://www.figma.com/community/plugins/842550836512542197/Figma-to-Code)
- [Design Tokens](https://www.figma.com/community/plugins/843461159747178978/Design-Tokens)

---

**Built with ❤️ for designers and developers.**

_Figma → Markdown Generator v1.0 · [MIT License](LICENSE)_
