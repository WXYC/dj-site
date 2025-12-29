# Adding a New Experience

This guide walks through creating a new experience (e.g., "minimal", "premium", etc.) for the application.

### 1. Define the Experience Type

Update `lib/features/experiences/types.ts`:

```typescript
export type ExperienceId = "classic" | "modern" | "minimal"; // Add your experience
```

### 2. Register the Experience

Add your experience to `lib/features/experiences/registry.ts`:

```typescript
export const EXPERIENCE_REGISTRY: Record<ExperienceId, ExperienceConfig> = {
  // ... existing experiences
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Streamlined interface with essential features only",
    icon: "minimal",
    enabled: true,
    cssIdentifier: "minimal",
    features: {
      hasRightbar: false,
      hasLeftbar: false,
      hasMobileHeader: true,
      supportsThemeToggle: true,
    },
  },
};
```

### 3. Create Theme Configuration

Create `lib/features/experiences/minimal/theme.ts`:

```typescript
import { extendTheme } from "@mui/joy/styles";

export const minimalTheme = extendTheme({
  cssVarPrefix: "wxyc",
  // Your theme configuration
});

export default minimalTheme;
```

### 4. Create Experience CSS

Create `lib/features/experiences/minimal/globals.css`:

```css
/**
 * Minimal Experience Styles
 */

html[data-experience="minimal"] {
  /* Your experience-specific styles */
}
```

### 5. Update Theme Registry

Update `src/styles/ThemeRegistry.tsx` to include your theme:

```typescript
import minimalTheme from "@/lib/features/experiences/minimal/theme";

// In the component:
const experience = useActiveExperience();
const theme = 
  experience === "classic" ? classicTheme :
  experience === "minimal" ? minimalTheme :
  modernTheme;
```

### 6. Create Component Structure

Create the directory structure:

```bash
mkdir -p src/components/experiences/minimal/login
mkdir -p src/components/experiences/minimal/catalog
mkdir -p src/components/experiences/minimal/flowsheet
mkdir -p src/components/experiences/minimal/layout
```

### 7. Create Parallel Routes

Create the parallel route structure in your app:

#### Dashboard Routes:
```bash
mkdir -p app/dashboard/@minimal/catalog
mkdir -p app/dashboard/@minimal/flowsheet
```

Create `app/dashboard/@minimal/catalog/page.tsx`:
```typescript
export default function MinimalCatalogPage() {
  return (
    <div>
      {/* Your minimal catalog implementation */}
    </div>
  );
}
```

#### Login Routes:
```bash
mkdir -p app/login/@minimal/@normal
mkdir -p app/login/@minimal/@newuser
```

### 8. Update ThemedLayout

Update `src/ThemedLayout.tsx` to support your experience:

```typescript
export type ThemedLayoutProps = {
  classic: ReactNode;
  modern: ReactNode;
  minimal: ReactNode; // Add your experience
  information: ReactNode;
};

export default async function ThemedLayout({
  classic,
  modern,
  minimal,
  information,
}: ThemedLayoutProps) {
  const serverSideProps = await createServerSideProps();
  const experience = serverSideProps.application.experience;

  return (
    <Suspense fallback={<LoadingPage />}>
      {information}
      {experience === "classic" && classic && (
        <div id="classic-container">{classic}</div>
      )}
      {experience === "minimal" && minimal}
      {experience === "modern" && modern}
    </Suspense>
  );
}
```

Or use the new `ExperienceSwitch` component:

```typescript
import ExperienceSwitch from "@/src/components/shared/ExperienceSwitch";

// ...
return (
  <Suspense fallback={<LoadingPage />}>
    {information}
    <ExperienceSwitch
      experience={serverSideProps.application.experience}
      classic={<div id="classic-container">{classic}</div>}
      modern={modern}
      minimal={minimal}
    />
  </Suspense>
);
```

### 9. Create Layout Components

Create `src/components/experiences/minimal/layout/Layout.tsx`:

```typescript
import { ReactNode } from "react";

interface MinimalLayoutProps {
  children: ReactNode;
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  return (
    <div className="minimal-layout">
      <header>{/* Your header */}</header>
      <main>{children}</main>
      <footer>{/* Your footer */}</footer>
    </div>
  );
}
```

### 10. Update Dashboard Layouts

Update `app/dashboard/layout.tsx` to pass your experience slot:

```typescript
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> =>
  ThemedLayout(props);

export default Layout;
```

Ensure your layout receives the `@minimal` slot from parallel routes.

### 11. Implement Core Features

For each major feature area, create components:

#### Login
- `src/components/experiences/minimal/login/LoginForm.tsx`
- `src/components/experiences/minimal/login/Layout.tsx`

#### Catalog
- `src/components/experiences/minimal/catalog/SearchBar.tsx`
- `src/components/experiences/minimal/catalog/Results.tsx`

#### Flowsheet
- `src/components/experiences/minimal/flowsheet/EntryForm.tsx`
- `src/components/experiences/minimal/flowsheet/EntryList.tsx`

### 12. Update Experience Switcher

If you want your experience to appear in the switcher UI, update `src/components/shared/Theme/ThemeSwitcher.tsx`:

```typescript
const experiences: ExperienceId[] = ["classic", "modern", "minimal"];

// Add UI to cycle through all experiences
```

### 13. Test Your Experience

1. Set the default experience:
```env
NEXT_PUBLIC_DEFAULT_EXPERIENCE=minimal
```

2. Enable your experience:
```env
NEXT_PUBLIC_ENABLED_EXPERIENCES=classic,modern,minimal
```

3. Test switching between experiences
4. Test all major features (login, catalog, flowsheet)
5. Test responsive design
6. Test theme switching (if applicable)

### 14. Add Default Slot

Create `app/dashboard/@minimal/default.tsx`:
```typescript
export default function Default() {
  return null;
}
```

And `app/login/@minimal/default.tsx`:
```typescript
export default function Default() {
  return null;
}
```

## Common Patterns

### Reusing Shared Components

```typescript
// Good: Reuse shared layouts
import PageContainer from "@/src/components/shared/layouts/PageContainer";

export default function MinimalCatalog() {
  return (
    <PageContainer>
      {/* Your content */}
    </PageContainer>
  );
}
```

### Adapting Modern Components

```typescript
// Create an adapter
import ModernResults from "@/src/components/experiences/modern/catalog/Results";

export default function MinimalResults() {
  // Wrap modern component with minimal-specific styling
  return (
    <div className="minimal-wrapper">
      <ModernResults />
    </div>
  );
}
```

### Feature Flags

Use experience features to conditionally render:

```typescript
const features = useExperienceFeatures();

if (!features.hasRightbar) {
  // Don't render rightbar for minimal experience
  return null;
}
```