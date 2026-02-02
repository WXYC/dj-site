# E2E Authentication Tests

End-to-end tests for authentication flows between **dj-site** (Next.js frontend) and **Backend-Service** (Better Auth + Express backend).

## Prerequisites

Before running E2E tests, ensure the following services are running:

1. **PostgreSQL** on port 5432 with test seed data
2. **Backend-Service API** on port 8080
3. **Auth Service** on port 8082
4. **dj-site** on port 3000

## Setup

### 1. Install Dependencies

```bash
# In dj-site directory
npm install

# Install Playwright browsers
npx playwright install
```

### 2. Start Backend Services

```bash
# In Backend-Service directory
npm run db:start
npm run dev
```

### 3. Set Up Test Users

After the database is seeded, set up test user passwords:

```bash
# In Backend-Service directory
npm run setup:e2e-users
```

### 4. Start Frontend

```bash
# In dj-site directory
npm run dev
```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (for debugging)
npm run test:e2e:ui

# Run tests in headed mode (visible browser)
npm run test:e2e:headed

# Run tests in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/tests/auth/login.spec.ts

# Run tests matching a pattern
npx playwright test -g "login"
```

## Test Users

All test users use the password: `testpassword123`

| Username | Role | Purpose |
|----------|------|---------|
| `test_member` | member | Test no-role access scenarios |
| `test_dj1` | dj | Test DJ access |
| `test_dj2` | dj | Test concurrent sessions |
| `test_music_director` | musicDirector | Test MD access |
| `test_station_manager` | stationManager | Test full admin access |
| `test_incomplete` | dj | Missing realName/djName for onboarding |
| `test_deletable_user` | dj | User for deletion tests |
| `test_promotable_user` | member | User for role promotion tests |
| `test_demotable_sm` | stationManager | User for role demotion tests |

## Test Structure

```
e2e/
├── playwright.config.ts      # Playwright configuration
├── fixtures/
│   └── auth.fixture.ts       # Auth test fixtures & helpers
├── pages/
│   ├── login.page.ts         # Login page object model
│   ├── dashboard.page.ts     # Dashboard page object model
│   ├── roster.page.ts        # Admin roster page object model
│   └── onboarding.page.ts    # Onboarding page object model
└── tests/
    ├── auth/
    │   ├── login.spec.ts       # Login flow tests (7 tests)
    │   ├── logout.spec.ts      # Logout flow tests
    │   ├── password-reset.spec.ts  # Password reset tests (6 tests)
    │   └── session.spec.ts     # Session management tests (5 tests)
    ├── onboarding/
    │   └── new-user.spec.ts    # Onboarding tests (4 tests)
    ├── rbac/
    │   └── role-access.spec.ts # Role-based access tests (6 tests)
    └── admin/
        ├── user-creation.spec.ts       # User creation tests (8 tests)
        ├── user-deletion.spec.ts       # User deletion tests (5 tests)
        ├── role-modification.spec.ts   # Role modification tests (9 tests)
        └── admin-password-reset.spec.ts # Admin password reset (3 tests)
```

## Test Categories

### Authentication Core (14 tests)
- Login with valid/invalid credentials
- Logout flow
- Session persistence

### Password Reset (6 tests)
- Request reset flow
- Complete reset with valid/invalid/expired tokens

### Session Management (5 tests)
- Session persistence across page refresh
- Cookie security flags
- Concurrent sessions

### Onboarding (4 tests)
- Incomplete user redirect
- Form validation
- Profile completion

### Role-Based Access (6 tests)
- DJ, MD, SM access to different pages
- Redirect on insufficient permissions

### Admin Operations (25 tests)
- User creation with different roles
- User deletion with confirmation
- Role promotion/demotion
- Admin password reset

## Environment Variables

The tests use these environment variables (or defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:3000` | Frontend URL |

## Troubleshooting

### Tests fail to find elements
- Ensure the frontend is running and accessible
- Check that the page object selectors match the actual DOM

### Authentication errors
- Verify test users have been set up with `npm run setup:e2e-users`
- Check that the auth service is running on port 8082

### Session tests fail
- Ensure cookies are being set correctly
- Check CORS configuration in backend

### Admin tests fail
- Verify `test_station_manager` has admin role
- Check that organization membership is set up correctly

## Reports

Test reports are generated in `playwright-report/` after each run. Open `playwright-report/index.html` to view detailed results.

## CI/CD Integration

E2E tests are automatically run in GitHub Actions on:
- Push to `main` branch
- Pull requests to `main` branch
- Manual workflow dispatch

### GitHub Actions Workflows

**dj-site workflows:**
- `.github/workflows/ci.yml` - Runs lint, type check, unit tests, and build
- `.github/workflows/e2e-tests.yml` - Runs full E2E test suite

**Backend-Service workflows:**
- `.github/workflows/ci.yml` - Runs unit and integration tests

### Manual Trigger

You can manually trigger E2E tests from the GitHub Actions tab with an optional Backend-Service branch:

```
gh workflow run e2e-tests.yml -f backend_ref=feature-branch
```

### CI Environment

In CI, the E2E tests use Docker Compose with the `e2e` profile:

| Service | Port |
|---------|------|
| PostgreSQL | 5434 |
| Auth Service | 8084 |
| Backend API | 8085 |
| Frontend | 3000 |

### Local CI Simulation

To simulate the CI environment locally:

```bash
# In Backend-Service directory
npm run e2e:env

# Set up test users
npm run e2e:setup-users

# In dj-site directory
npm run build
npm run start &

# Run E2E tests
E2E_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_BACKEND_URL=http://localhost:8085 \
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8084/auth \
npm run test:e2e

# Cleanup
cd ../Backend-Service
npm run e2e:clean
```

### Artifacts

After each CI run, the following artifacts are available:
- `playwright-report` - HTML report with test results
- `test-results` - Screenshots, videos, and traces from failed tests

### Required Secrets

For cross-repository checkout, ensure `GITHUB_TOKEN` has appropriate permissions. If Backend-Service is in a different repository, you may need a Personal Access Token stored as a secret.
