# WXYC Card Catalog, Revised

[See the site in action here!](https://dj.wxyc.org)


## Description
The WXYC Card Catalog, Revised is a React-based revision of the original WXYC card catalog and flowsheet. This repository showcases an improved version of the existing catalog and flowsheet, while maintaining the classic theme and preserving the original look. Notably, the revised version is optimized for performance, resulting in faster loading times.

## Features
- Retains the classic theme: The revised version of the WXYC Card Catalog doesn't modify the old look in any way. Users will still experience the familiar aesthetics they are accustomed to.
- Classic theme views: All views within the application that utilize the classic theme are prepended with `CLASSIC_`. This helps users distinguish between the classic and updated versions of the application.
- New theme: With updated components and views, a faster and more seamless workflow between the flowsheet and card catalog is possible.
- Mail Bin: a digital mail bin is available on every account, so DJs can add to the flowsheet directly from their bin without having to type during their sets.

## Deployment
Is handled by github actions.

## API Integration
The revised catalog leverages services defined in `api-service.js`, which utilizes the popular Axios library to communicate with an AWS API Gateway. This integration allows seamless communication between the front-end application and the API endpoints, enabling data retrieval and manipulation.

## Technologies Used
- React: The front-end framework used for building the revised WXYC Card Catalog.
- MUI Joy UI: A library of pre-built UI components for React that allows fast and beautiful feature development.
- Github Pages: For hosting the frontend and automating publication.
- Axios: A JavaScript library used for making HTTP requests to the AWS API Gateway.

## Local Development Prerequisites

The frontend requires the WXYC Backend-Service to be running locally for full functionality. Without the backend:
- Authentication will not work
- API calls (flowsheet, library, etc.) will fail
- Most features will be unavailable

**Option 1: Manual Setup**
1. Clone and start [Backend-Service](https://github.com/WXYC/Backend-Service) following its Quick Start guide
2. Ensure both backend (:8080) and auth (:8082) services are running
3. Continue with frontend setup below

**Option 2: Automated Setup**
Use the setup script from [wxyc-shared](https://github.com/WXYC/wxyc-shared) to automatically configure the entire stack.

## Installation and Setup
1. Clone the repository: `git clone https://github.com/WXYC/dj-site.git`
2. Navigate to the project directory: `cd dj-site`
3. Install dependencies: `npm install`
4. Create `.env.local` with required environment variables (see below)
5. Run the application: `npm run dev`
6. Access the application locally: Open your web browser and visit `http://localhost:3000`

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Backend API URL (required)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Better Auth service URL (required for authentication)
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8082/auth

# Default page after login
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet

# UI Experience settings
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Backend API base URL |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Yes | Auth service URL (must end with `/auth`) |
| `NEXT_PUBLIC_DASHBOARD_HOME_PAGE` | No | Redirect path after login |
| `NEXT_PUBLIC_DEFAULT_EXPERIENCE` | No | Default UI theme (`modern` or `classic`) |
| `NEXT_PUBLIC_ENABLED_EXPERIENCES` | No | Comma-separated list of available themes |
| `NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING` | No | Enable theme switching in UI |

## Authentication Flow

The application uses [Better Auth](https://www.better-auth.com/) for authentication, running as a separate service within Backend-Service.

**How it works:**
1. User submits credentials on the login page
2. Frontend sends request to Better Auth service (`NEXT_PUBLIC_BETTER_AUTH_URL`)
3. Better Auth validates credentials against the PostgreSQL database
4. On success, Better Auth returns a JWT token stored in an HTTP-only cookie
5. Subsequent API requests include the token automatically
6. Backend validates tokens via JWKS endpoint

**Test credentials** (local development):
- Username: `test_member`, `test_dj1`, `test_dj2`, `test_music_director`, or `test_station_manager`
- Password: `testpassword123`

## Testing

The project uses [Vitest](https://vitest.dev/) for testing with React Testing Library and MSW for API mocking.

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `lib/__tests__/` - Feature tests (Redux slices, RTK Query APIs)
- `**/*.test.tsx` - Component tests (co-located with components)
- `lib/test-utils/` - Shared test utilities

### Writing Tests

#### Redux Slice Tests

```typescript
import { describe, it, expect } from "vitest";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";

describe("flowsheetSlice", () => {
  it("should set autoplay", () => {
    const nextState = flowsheetSlice.reducer(
      initialState,
      flowsheetSlice.actions.setAutoplay(true)
    );
    expect(nextState.autoplay).toBe(true);
  });
});
```

#### RTK Query Tests with MSW

```typescript
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL } from "@/lib/test-utils";

describe("catalogApi", () => {
  it("should fetch albums", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        return HttpResponse.json([{ id: 1, title: "Test Album" }]);
      })
    );
    // ... test implementation
  });
});
```

#### Component Tests

```typescript
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import MyComponent from "./MyComponent";

describe("MyComponent", () => {
  it("should render", () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Test Utilities

Import test utilities from `@/lib/test-utils`:

- `renderWithProviders` - Render with Redux and MUI providers
- `createTestAlbum`, `createTestArtist`, etc. - Factory functions for test data
- `server` - MSW server instance for API mocking
- `TEST_BACKEND_URL` - Backend URL constant for MSW handlers

## Contributing
Contributions to the WXYC Card Catalog, Revised are welcome! If you would like to contribute, please follow these steps:
1. Create a new branch: `git checkout -b my-feature-branch`
2. Make your changes and commit them: `git commit -m "Add some feature"`
3. Test your build: `npm run build`
4. Push to the branch: `git push origin my-feature-branch`
5. Submit a pull request detailing your changes.
6. When your pull request is approved, Github Actions will auto-deploy your changes to the site. Be sure to give 5-10 minutes after the build completes for the changes to propagate.

## License
The WXYC Card Catalog, Revised is released under the [MIT License](LICENSE). Feel free to use, modify, and distribute the code as per the terms of this license.

## Acknowledgments
We would like to express our gratitude to the contributors and maintainers of the original WXYC Card Catalog for their valuable work, which served as the foundation for this revised version. In particular, Tim Ross/Tubafrenzy, who developed the original flowsheet site and maintained the database for years during decades when it was much more difficult to maintain and develop a site like this one.
