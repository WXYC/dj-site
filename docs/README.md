# WXYC DJ Site - Experience Architecture Documentation

Welcome to the documentation for the WXYC DJ Site's experience architecture.

## 📚 Documentation Index

### Core Documentation
- **[Experience Architecture](./EXPERIENCE_ARCHITECTURE.md)** - Complete overview of the experience system architecture, components, and best practices
- **[Adding a New Experience](./ADDING_NEW_EXPERIENCE.md)** - Step-by-step guide to creating new experiences

## 🎨 What are "Experiences"?

Experiences are complete UI implementations of the application that can coexist and be switched between at runtime. Think of them as different "skins" or "themes," but much more powerful - each experience can have:

- Completely different component implementations
- Unique layouts and navigation structures  
- Custom styling and theming
- Feature-specific functionality
- Independent routing structures

Currently supported experiences:
- **Classic** - Legacy interface preserving the original look and feel
- **Modern** - Contemporary interface with enhanced features and UX

## 🏗️ Architecture Highlights

### Key Features
1. **Registry-Based System** - Central configuration for all experiences
2. **Parallel Routes** - Next.js 13+ parallel routes for clean separation
3. **Theme System** - Per-experience theme configurations
4. **Shared Components** - Reusable primitives across experiences
5. **Type-Safe APIs** - Full TypeScript support with type guards
6. **Environment Config** - Deploy-time experience configuration
7. **Backwards Compatible** - Smooth migration from old `classic: boolean` system

### Directory Structure
```
lib/features/experiences/     # Experience system core
  ├── types.ts                # TypeScript definitions
  ├── registry.ts             # Experience configurations
  ├── hooks.ts                # React hooks
  ├── api.ts                  # RTK Query API
  ├── classic/                # Classic experience
  │   ├── theme.ts
  │   └── globals.css
  ├── modern/                 # Modern experience
  │   ├── theme.ts
  │   └── globals.css
  └── shared/                 # Shared theme utilities
      └── base-theme.ts

src/components/
  ├── experiences/            # Experience-specific components
  │   ├── classic/
  │   └── modern/
  └── shared/                 # Experience-agnostic components
      ├── layouts/            # Layout primitives
      ├── Theme/              # Theme components
      └── ...

app/                          # Next.js App Router
  ├── dashboard/
  │   ├── @classic/          # Classic dashboard routes
  │   ├── @modern/           # Modern dashboard routes
  │   └── layout.tsx         # Experience switcher
  └── login/
      ├── @classic/          # Classic login routes
      ├── @modern/           # Modern login routes
      └── layout.tsx         # Experience switcher
```

## 🚀 Quick Start

### Switching Experiences
Users can switch experiences via the theme switcher button in the UI, or by setting environment variables:

```env
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=classic,modern
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

### Using Experience Hooks
```typescript
import { useActiveExperience, useExperienceConfig } from '@/lib/features/experiences/hooks';

function MyComponent() {
  const experience = useActiveExperience(); // "classic" | "modern"
  const config = useExperienceConfig(); // Full experience configuration
  
  return <div>Current experience: {config.name}</div>;
}
```

### Switching Experiences Programmatically
```typescript
import { useSwitchExperienceMutation } from '@/lib/features/experiences/api';

function ExperienceSwitcher() {
  const [switchExperience] = useSwitchExperienceMutation();
  
  return (
    <button onClick={() => switchExperience('classic')}>
      Switch to Classic
    </button>
  );
}
```

## 🎯 Benefits

1. **Easy to Add New Experiences** - Follow a clear template and registration process
2. **Better Code Organization** - Parallel structure makes it easy to find equivalent components
3. **Type Safety** - Compiler-enforced boundaries between experiences
4. **Flexibility** - Enable/disable experiences per environment
5. **Performance** - Load only active experience's assets
6. **Maintainability** - Clear separation of concerns
7. **Testability** - Test experiences in isolation

## 📖 Common Tasks

### Adding a New Experience
See [Adding a New Experience](./ADDING_NEW_EXPERIENCE.md) for detailed instructions.

### Migrating Old Code
The system provides backwards compatibility, but new code should use:

```typescript
// Old
const isClassic = serverSideProps.application.classic;

// New
const experience = serverSideProps.application.experience;
const isClassic = experience === "classic";
```

### Creating Shared Components
Place truly shared components in `src/components/shared/`:
```typescript
// src/components/shared/MySharedComponent.tsx
export default function MySharedComponent() {
  return <div>Used by all experiences</div>;
}
```

### Experience-Specific Styling
```css
/* Classic experience styles */
html[data-experience="classic"] .my-component {
  /* Classic-specific styles */
}

/* Modern experience styles */
html[data-experience="modern"] .my-component {
  /* Modern-specific styles */
}
```

## 🔧 Development

### Environment Variables
```env
# Required
NEXT_PUBLIC_BACKEND_URL=your_backend_url
SESSION_SECRET=your_secret_key

# Experience Configuration (Optional)
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=classic,modern
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

### Running the App
```bash
npm install
npm run dev
```

### Building for Production
```bash
npm run build
npm start
```

## 🐛 Troubleshooting

See the [Experience Architecture](./EXPERIENCE_ARCHITECTURE.md#troubleshooting) documentation for common issues and solutions.

## 📝 Migration Notes

This architecture was implemented to replace the previous `classic: boolean` system. Key changes:

1. **ApplicationState** now uses `experience: ExperienceId` instead of `classic: boolean`
2. **Components** moved from `src/components/modern/` to `src/components/experiences/modern/`
3. **Themes** consolidated into experience-specific files
4. **CSS** organized by experience with data attributes
5. **New API routes** at `/api/experiences/*`

The system maintains backwards compatibility with the old routes and state structure.

## 🤝 Contributing

When adding new features:
1. Consider which experiences should support the feature
2. Add feature flags to experience configurations if needed
3. Create experience-specific implementations when appropriate
4. Use shared components when logic is truly experience-agnostic
5. Document experience-specific behavior

## 📚 Additional Resources

- [Next.js Parallel Routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes)
- [MUI Joy UI Documentation](https://mui.com/joy-ui/getting-started/)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## 📄 License

See the main project README for license information.

---

**Questions or Issues?** Please refer to the detailed documentation files or open an issue in the repository.

