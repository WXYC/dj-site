# Experience Architecture

## Overview

This application uses a modular "experience" architecture that allows for multiple complete UI implementations to coexist and be switched between at runtime. Currently, two experiences are supported:

- **Classic**: Legacy interface with traditional styling
- **Modern**: Contemporary interface with enhanced features

## Architecture Components

### 1. Experience Registry (`lib/features/experiences/`)

The experience registry is the central configuration system for all experiences.

#### Key Files:
- `types.ts` - TypeScript definitions for experiences
- `registry.ts` - Central registry of all available experiences
- `hooks.ts` - React hooks for accessing experience state
- `api.ts` - RTK Query API for experience management

#### Experience Configuration:
```typescript
interface ExperienceConfig {
  id: ExperienceId;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  cssIdentifier: string;
  features: {
    hasRightbar: boolean;
    hasLeftbar: boolean;
    hasMobileHeader: boolean;
    supportsThemeToggle: boolean;
  };
}
```

### 2. Component Organization

Components are organized by experience with shared components in a common location:

```
src/components/
  ├── experiences/
  │   ├── classic/     # Classic experience components
  │   └── modern/      # Modern experience components
  ├── shared/          # Experience-agnostic components
  │   ├── layouts/     # Shared layout primitives
  │   ├── Theme/       # Theme components
  │   └── ...
```

### 3. Theme System (`lib/features/experiences/[experienceId]/theme.ts`)

Each experience can have its own theme configuration:
- `classic/theme.ts` - Classic experience theme
- `modern/theme.ts` - Modern experience theme
- `shared/base-theme.ts` - Base theme shared across experiences

The `ThemeRegistry` component automatically loads the correct theme based on the active experience.

### 4. CSS Organization (`lib/features/experiences/[experienceId]/globals.css`)

Experience-specific CSS is scoped using data attributes:
- Classic: `html[data-experience="classic"]`
- Modern: `html[data-experience="modern"]`

### 5. State Management

#### Application State (`lib/features/application/types.ts`):
```typescript
interface ApplicationState {
  experience: ExperienceId;
  rightBarMini: boolean;
}
```

#### Experience API (`lib/features/experiences/api.ts`):
- `useGetActiveExperienceQuery` - Get current experience
- `useSwitchExperienceMutation` - Switch to a different experience

#### Experience Hooks (`lib/features/experiences/hooks.ts`):
- `useActiveExperience()` - Get current experience ID
- `useExperienceConfig()` - Get current experience configuration
- `useIsExperience(id)` - Check if a specific experience is active
- `useExperienceFeatures()` - Get experience-specific feature flags

### 6. API Routes

#### New Experience Routes:
- `GET /api/experiences/active` - Get active experience
- `POST /api/experiences/switch` - Switch experience

#### Legacy Routes (Deprecated):
- `POST /api/view/classic` - Toggle between classic/modern (backwards compatible)

### 7. Server-Side Configuration (`lib/features/session.ts`)

The `createServerSideProps()` function:
- Reads experience preference from cookies
- Migrates old `classic: boolean` to new `experience: ExperienceId`
- Provides backwards compatibility

## Experience Switching Flow

1. User clicks experience switcher component (`ThemeSwitcher.tsx`)
2. Component calls `useSwitchExperienceMutation(newExperience)`
3. API route updates cookie with new experience
4. Router refreshes to apply changes
5. Server reads new experience from cookie
6. Appropriate experience is rendered via parallel routes

## Parallel Routes

Next.js parallel routes are used to implement experience switching:

```
app/
  ├── dashboard/
  │   ├── @classic/    # Classic dashboard routes
  │   ├── @modern/     # Modern dashboard routes
  │   └── layout.tsx   # Switches based on experience
  └── login/
      ├── @classic/    # Classic login routes
      ├── @modern/     # Modern login routes
      └── layout.tsx   # Switches based on experience
```

## Environment Configuration

Configure experiences via environment variables:

```env
# Default experience (fallback if no preference set)
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern

# Enabled experiences (comma-separated)
NEXT_PUBLIC_ENABLED_EXPERIENCES=classic,modern

# Allow runtime switching
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

## Best Practices

### 1. Keep Experiences Independent
- Each experience should be self-contained
- Avoid cross-experience imports
- Use shared components for common functionality

### 2. Use Experience Hooks
```typescript
// Good: Uses experience hooks
const experience = useActiveExperience();
const config = useExperienceConfig();

// Bad: Direct state access
const state = useAppSelector((state) => state.application);
```

### 3. Feature Flags
Use experience-specific feature flags:
```typescript
const features = useExperienceFeatures();
if (features.hasRightbar) {
  // Render rightbar
}
```

### 4. CSS Scoping
Always scope experience-specific CSS:
```css
/* Good */
html[data-experience="classic"] .my-component {
  /* styles */
}

/* Bad */
.my-component {
  /* applies to all experiences */
}
```

### 5. Shared Components
Place truly shared components in `src/components/shared/`:
- Layout primitives
- Utility components
- Theme components

## Migration Guide

### From Old `classic: boolean` to New `experience: ExperienceId`:

The system automatically migrates old state, but for new code:

```typescript
// Old
const isClassic = serverSideProps.application.classic;

// New
const experience = serverSideProps.application.experience;
const isClassic = experience === "classic";
```

### Updating Components:

```typescript
// Old import
import Component from "@/src/components/modern/Component";

// New import
import Component from "@/src/components/experiences/modern/Component";
```

## Adding New Experiences

See `docs/ADDING_NEW_EXPERIENCE.md` for detailed instructions.

## Troubleshooting

### Experience Not Switching
1. Check cookie is being set: `app_state` in browser DevTools
2. Verify environment variables are set correctly
3. Ensure `isExperienceSwitchingAllowed()` returns `true`

### Theme Not Loading
1. Check `ThemeRegistry.tsx` is using `useActiveExperience()`
2. Verify theme file exists in `lib/features/experiences/[id]/theme.ts`
3. Check for CSS import errors

### Component Not Found
1. Verify component was moved to correct experience folder
2. Update all imports to new path
3. Check for typos in import paths

## Performance Considerations

- Only the active experience's components are loaded
- Experience CSS is loaded globally but scoped
- Theme switching causes a full page refresh (intentional for clean state)

## Security Notes

- Experience preference is stored in HTTP-only cookies
- Experience switching requires valid session
- Environment variables control available experiences

