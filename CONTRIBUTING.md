# Contributing Guide

Thank you for your interest in contributing to Figma → Markdown Generator!

## Getting Started

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/figma-markdown-app.git
cd figma-markdown-app

# Install dependencies
npm install

# Create local env file
cp .env.example .env.local

# Start development server
npm run dev
```

### Code Style & Standards

This project follows:
- **TypeScript** for type safety
- **Next.js 14** best practices
- **ESLint** for code quality
- **Prettier** for formatting (optional)

### Before Submitting a PR

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Test locally
npm run dev
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Keep commits atomic and descriptive
- Reference issues in commit messages: `Fix #123`
- Test thoroughly in development

### 3. Update Tests & Documentation

- Update `README.md` for user-facing changes
- Add JSDoc comments to new functions
- Update type definitions

### 4. Commit & Push

```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

- Link related issue
- Describe what changed and why
- Include before/after screenshots for UI changes

---

## Project Structure

```
figma-markdown-app/
├── app/
│   ├── page.tsx           # Main UI component
│   ├── layout.tsx         # Next.js layout
│   └── globals.css        # Global styles
├── lib/
│   ├── types.ts           # TypeScript interfaces
│   ├── figma.ts           # Figma API utilities
│   └── markdown.ts        # Markdown generation
├── .github/
│   └── workflows/
│       └── ci-cd.yml      # GitHub Actions CI/CD
├── public/                # Static assets
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

---

## Common Tasks

### Adding a New Feature

1. **Create a new utility** in `lib/`:
   ```typescript
   // lib/newFeature.ts
   export function myNewFunction(input: string): string {
     return input;
   }
   ```

2. **Use it in the component**:
   ```typescript
   import { myNewFunction } from "@/lib/newFeature";
   
   // In component
   myNewFunction(someInput);
   ```

3. **Test it**:
   ```bash
   npm run dev
   # Test in browser
   ```

### Modifying the Figma API Integration

Files to update:
- `lib/types.ts` - Add new interfaces
- `lib/figma.ts` - Add new functions
- `app/page.tsx` - Use new utilities

### Updating Markdown Generation

1. Edit `lib/markdown.ts`
2. Update the `generateMarkdown()` function
3. Test with a real Figma file
4. Update `README.md` with new spec format

### Styling Changes

Current approach: CSS-in-JS inline styles in `app/page.tsx`

To add Tailwind CSS:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## Testing

### Manual Testing

1. Get a Figma test file URL
2. Create a Personal Access Token
3. Test with the app locally:
   ```bash
   npm run dev
   # Open http://localhost:3000
   # Fill in token and file URL
   # Test the workflow
   ```

### Edge Cases to Test

- [ ] Empty Figma file
- [ ] File with 50+ screens
- [ ] Very deep nesting (5+ levels)
- [ ] Many colours (100+)
- [ ] Unicode/emoji in layer names
- [ ] Very long project names

### Error Cases

- [ ] Invalid token
- [ ] File not found
- [ ] Network timeout
- [ ] CORS errors

---

## Debugging

### Enable Debug Mode

```typescript
// In lib/figma.ts
console.log("Debug:", data);  // Add logs

// In browser DevTools
// Console tab to see logs
// Network tab to see API calls
```

### Common Issues

**TypeScript errors:**
```bash
npm run type-check    # Find all errors
```

**Module not found:**
```bash
# Check import path matches file location
# Verify export statement in file
```

**Styling looks broken:**
- Check CSS is using hex colors (#XXXXXX)
- Verify CSS grid/flex is properly set
- Test in Chrome DevTools (different viewport sizes)

---

## Code Review Process

PRs will be reviewed for:

- ✅ TypeScript type safety (no `any`)
- ✅ Code follows project conventions
- ✅ No console.log left in production code
- ✅ Functions are documented with JSDoc
- ✅ No breaking changes to public API
- ✅ Tests pass locally

---

## Release Process

Releases are semantic versioning: `MAJOR.MINOR.PATCH`

### Prepare Release

1. Update version in `package.json`
2. Update `CHANGELOG.md` (create if needed)
3. Commit: `chore: bump version to X.Y.Z`
4. Create git tag: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`

### Automatic Deployment

- Tags trigger Vercel deployment
- Production URL updates automatically
- Previous version archived in Vercel dashboard

---

## Documentation

### Adding JSDoc Comments

```typescript
/**
 * Extract colour palette from Figma node tree
 * @param node - The root Figma node to traverse
 * @param depth - Current traversal depth (0-4)
 * @returns Collection of unique colours with usage counts
 * @example
 * const colors = collectColors(figmaNode);
 */
export function collectColors(
  node: FigmaNode,
  depth: number = 0
): Map<string, ExtractedColor> {
  // Implementation
}
```

### README Conventions

- Use emoji for visual hierarchy
- Keep sections brief and scannable
- Include code examples
- Link to external references

---

## Commit Message Format

Follow conventional commits:

```
feat: add new feature
fix: fix specific bug
docs: update documentation
style: format code (no logic change)
refactor: restructure without changing behavior
perf: improve performance
chore: update dependencies
test: add/update tests
```

Example:
```
feat: extract shadow properties from Figma

- Add getShadows() utility function
- Store shadow data in CollectionResults
- Include shadows in markdown output

Fixes #123
```

---

## Community

- 💬 **Discussions**: GitHub Issues for questions
- 🐛 **Bug Reports**: Use issue template
- 🎯 **Feature Requests**: Describe the use case
- 🤝 **Pull Requests**: All welcome!

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment.

- Be respectful and inclusive
- Assume good intentions
- Focus on ideas, not individuals
- Help others learn and grow

Violations should be reported to the project maintainers.

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Figma API Reference](https://www.figma.com/developers/api)
- [React Best Practices](https://react.dev)

---

**Questions?** Open an issue or start a discussion. We're here to help! 🚀
