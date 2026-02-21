Plan: Speed up E2E workflow -- timeouts, remove Docker, parallelize setup                                                                                                 
                                                                                                                                                                          
Context                                                                                                                                                                   
                                                                                                                                                                          
The E2E workflow (e2e-tests.yml on feat/e2e-foundation) has a history of extremely long failing runs. Analysis of all 30 historical runs shows:                           
                                                                                                                                                                          
- 6 runs were cancelled after hitting the 45-min job timeout, with the test step alone running 40+ minutes                                                                
- 9 runs failed in 6-17 minutes, dominated by the test step                                                                                                               
- Passing tests take ~5 seconds each (derived from runs with mixed pass/fail results)                                                                                     
- Setup phase takes ~5 min, with Docker Compose accounting for 2:11 of that                                                                                               
                                                                                                                                                                          
Two root causes:                                                                                                                                                          
1. Unbounded test execution: no globalTimeout, no --max-failures, retries: 1 doubles failure time                                                                         
2. Slow sequential setup: Docker builds auth/backend images from source (~1.5 min), frontend setup waits for backend to finish (~1.5 min), and the Backend-Service code is
 built twice (inside Docker AND natively for setup:e2e-users)                                                                                                             
                                                                                                                                                                          
Part 1: Playwright timeout tuning                                                                                                                                         
                                                                                                                                                                          
File: e2e/playwright.config.ts                                                                                                                                            
                                                                                                                                                                          
1.1 Add globalTimeout: 10 * 60 * 1000 (10 minutes)                                                                                                                        
                                                                                                                                                                          
Hard cap on the entire Playwright run. A passing suite completes in ~5.5 min. 10 min provides headroom while preventing runaway runs.                                     
                                                                                                                                                                          
1.2 Lower timeout from 30000 to 15000 (15s per test)                                                                                                                      
                                                                                                                                                                          
Current 30s is 6x the ~5s baseline. 15s (3x baseline) absorbs CI variability while halving per-failure burn time.                                                         
                                                                                                                                                                          
1.3 Lower expect.timeout from 15000 to 10000 (10s per assertion)                                                                                                          
                                                                                                                                                                          
Aligns with the existing actionTimeout: 10000. An assertion that hasn't become true in 10s won't in 15.                                                                   
                                                                                                                                                                          
1.4 Change retries from process.env.CI ? 1 : 0 to retries: 0                                                                                                              
                                                                                                                                                                          
During development (29/30 runs failed), retries just double the wall time. Re-enable once the suite is green and stable.                                                  
                                                                                                                                                                          
Part 2: Replace Docker Compose with native services                                                                                                                       
                                                                                                                                                                          
File: .github/workflows/e2e-tests.yml                                                                                                                                     
                                                                                                                                                                          
Currently, the workflow:                                                                                                                                                  
1. Builds Docker images for auth + backend from source (~1-1.5 min)                                                                                                       
2. Starts containers, waits for healthchecks (~30-60s)                                                                                                                    
3. ALSO runs npm ci + npm run build for Backend-Service natively (just for setup:e2e-users)                                                                               
                                                                                                                                                                          
This builds the backend code twice. Since the native build already exists, we can run auth and backend as native Node background processes and eliminate Docker entirely. 
                                                                                                                                                                          
2.1 Use GitHub Actions services: for PostgreSQL                                                                                                                           
                                                                                                                                                                          
services:                                                                                                                                                                 
  postgres:                                                                                                                                                               
    image: postgres:18.0-alpine                                                                                                                                           
    env:                                                                                                                                                                  
      POSTGRES_PASSWORD: 'RadioIsEpic$1100'                                                                                                                               
      POSTGRES_USER: wxyc_admin                                                                                                                                           
      POSTGRES_DB: wxyc_db                                                                                                                                                
    ports:                                                                                                                                                                
      - 5434:5432                                                                                                                                                         
    options: >-                                                                                                                                                           
      --health-cmd "pg_isready -U wxyc_admin -d wxyc_db"                                                                                                                  
      --health-interval 5s                                                                                                                                                
      --health-timeout 5s                                                                                                                                                 
      --health-retries 5                                                                                                                                                  
                                                                                                                                                                          
Service containers start before any steps run and are health-checked automatically. Zero wait time for DB readiness.                                                      
                                                                                                                                                                          
2.2 Run init-db.mjs natively                                                                                                                                              
                                                                                                                                                                          
After npm ci + npm run build, run the DB init script directly:                                                                                                            
                                                                                                                                                                          
- name: Initialize database                                                                                                                                               
  working-directory: Backend-Service                                                                                                                                      
  env:                                                                                                                                                                    
    DB_HOST: localhost                                                                                                                                                    
    DB_PORT: 5434                                                                                                                                                         
    DB_NAME: wxyc_db                                                                                                                                                      
    DB_USERNAME: wxyc_admin                                                                                                                                               
    DB_PASSWORD: 'RadioIsEpic$1100'                                                                                                                                       
  run: node dev_env/init-db.mjs                                                                                                                                           
                                                                                                                                                                          
This runs migrations + seeds the DB, replacing the e2e-db-init Docker container.                                                                                          
                                                                                                                                                                          
2.3 Start auth + backend as native background processes                                                                                                                   
                                                                                                                                                                          
Auth (apps/auth/app.ts:10) reads AUTH_PORT env var and calls dotenv.config(), so it picks up the .env file created in step "Create Backend .env file". Backend            
(apps/backend/app.ts:18) reads PORT but does NOT load dotenv, so env vars must be passed explicitly via the step's env: block.                                            
                                                                                                                                                                          
PIDs are captured to files for cleanup.                                                                                                                                   
                                                                                                                                                                          
- name: Start auth service                                                                                                                                                
  working-directory: Backend-Service                                                                                                                                      
  run: |                                                                                                                                                                  
    AUTH_PORT=8084 node apps/auth/dist/app.js > /tmp/auth.log 2>&1 &                                                                                                      
    echo $! > /tmp/auth.pid                                                                                                                                               
    echo "Waiting for auth service..."                                                                                                                                    
    timeout 60 bash -c 'until curl -sf http://localhost:8084/healthcheck; do sleep 1; done'                                                                               
                                                                                                                                                                          
- name: Start backend service                                                                                                                                             
  working-directory: Backend-Service                                                                                                                                      
  env:                                                                                                                                                                    
    PORT: 8085                                                                                                                                                            
    DB_HOST: localhost                                                                                                                                                    
    DB_PORT: 5434                                                                                                                                                         
    DB_NAME: wxyc_db                                                                                                                                                      
    DB_USERNAME: wxyc_admin                                                                                                                                               
    DB_PASSWORD: 'RadioIsEpic$1100'                                                                                                                                       
    BETTER_AUTH_URL: http://localhost:8084/auth                                                                                                                           
    BETTER_AUTH_JWKS_URL: http://localhost:8084/auth/.well-known/jwks.json                                                                                                
    BETTER_AUTH_ISSUER: http://localhost:8084                                                                                                                             
    BETTER_AUTH_AUDIENCE: http://localhost:8084                                                                                                                           
  run: |                                                                                                                                                                  
    node apps/backend/dist/app.js > /tmp/backend.log 2>&1 &                                                                                                               
    echo $! > /tmp/backend.pid                                                                                                                                            
    echo "Waiting for backend service..."                                                                                                                                 
    timeout 60 bash -c 'until curl -sf http://localhost:8085/healthcheck; do sleep 1; done'                                                                               
                                                                                                                                                                          
2.4 Remove Docker steps, add process cleanup                                                                                                                              
                                                                                                                                                                          
Remove: "Set up Docker Buildx", "Start backend services with Docker Compose", and "Cleanup" (docker compose down).                                                        
                                                                                                                                                                          
Replace "Show service logs on failure":                                                                                                                                   
- name: Show service logs on failure                                                                                                                                      
  if: failure()                                                                                                                                                           
  run: |                                                                                                                                                                  
    echo "=== Auth Service Logs ==="                                                                                                                                      
    cat /tmp/auth.log 2>/dev/null || echo "No auth log"                                                                                                                   
    echo ""                                                                                                                                                               
    echo "=== Backend Service Logs ==="                                                                                                                                   
    cat /tmp/backend.log 2>/dev/null || echo "No backend log"                                                                                                             
                                                                                                                                                                          
Replace "Cleanup":                                                                                                                                                        
- name: Cleanup                                                                                                                                                           
  if: always()                                                                                                                                                            
  run: |                                                                                                                                                                  
    kill $(cat /tmp/auth.pid 2>/dev/null) 2>/dev/null || true                                                                                                             
    kill $(cat /tmp/backend.pid 2>/dev/null) 2>/dev/null || true                                                                                                          
                                                                                                                                                                          
Part 3: Parallelize frontend and backend setup                                                                                                                            
                                                                                                                                                                          
The backend track and frontend track are independent until the test step. The frontend track (~93s) is the critical path; the backend track (~47s) fits entirely within   
it.                                                                                                                                                                       
                                                                                                                                                                          
3.1 Step ordering (critical path in bold)                                                                                                                                 
                                                                                                                                                                          
PostgreSQL service container ─── ready before step 1 ───────────────────────────                                                                                          
                                                                                                                                                                          
1. Checkout repos + Node.js setup                                          ~5s                                                                                            
2. Create .env                                                             ~0s                                                                                            
3. **npm ci (both repos, parallel)**                                      ~30s                                                                                            
4. Backend build            ┐                                              ~9s                                                                                            
5. Init DB (migrations+seed)│  Backend      ┐                             ~10s                                                                                            
6. Start auth + healthcheck │  track        │                              ~5s                                                                                            
7. Start backend + hcheck   │  (~47s)       │                              ~5s                                                                                            
8. Set up E2E test users    ┘               │ Run concurrently             ~7s                                                                                            
   ─────────────────────────────────────────│                                                                                                                             
9. **Playwright install**   ┐               │                             ~27s                                                                                            
10. **Build dj-site**       │ Frontend      │                             ~29s                                                                                            
                            │ track (~93s)  ┘                                                                                                                             
11. **Start dj-site**       ┘                                              ~8s                                                                                            
12. Run E2E tests                                                          ~9s                                                                                            
                                                                                                                                                                          
                                                                                                                                                                          
Wall time: ~93s (frontend critical path) + ~9s (tests) = ~1:42                                                                                                            
                                                                                                                                                                          
The key insight: since npm ci runs in parallel and the backend track finishes before the frontend track, all backend services are ready by the time dj-site finishes      
building. No idle time.                                                                                                                                                   
                                                                                                                                                                          
3.2 Parallel npm ci                                                                                                                                                       
                                                                                                                                                                          
- name: Install dependencies                                                                                                                                              
  run: |                                                                                                                                                                  
    (cd Backend-Service && npm ci) &                                                                                                                                      
    (cd dj-site && npm ci) &                                                                                                                                              
    wait                                                                                                                                                                  
                                                                                                                                                                          
3.3 Backend track (runs while frontend builds)                                                                                                                            
                                                                                                                                                                          
After parallel npm ci, the backend steps run sequentially: build → init-db → start auth → start backend → seed users. These complete in ~47s.                             
                                                                                                                                                                          
Meanwhile, the frontend track runs concurrently (see 3.4).                                                                                                                
                                                                                                                                                                          
3.4 Frontend track (concurrent with backend)                                                                                                                              
                                                                                                                                                                          
Playwright install and dj-site build run in parallel with each other and with the backend track:                                                                          
                                                                                                                                                                          
- name: Install Playwright browsers and build dj-site                                                                                                                     
  run: |                                                                                                                                                                  
    (cd dj-site && npx playwright install --with-deps chromium) &                                                                                                         
    (cd dj-site && npm run build) &                                                                                                                                       
    wait                                                                                                                                                                  
                                                                                                                                                                          
3.5 Cache Playwright browsers                                                                                                                                             
                                                                                                                                                                          
- name: Cache Playwright browsers                                                                                                                                         
  uses: actions/cache@v4                                                                                                                                                  
  with:                                                                                                                                                                   
    path: ~/.cache/ms-playwright                                                                                                                                          
    key: playwright-${{ hashFiles('dj-site/package-lock.json') }}                                                                                                         
                                                                                                                                                                          
On cache hit, the 27s download becomes ~5s. npx playwright install is a no-op when the cache is fresh; --with-deps still installs OS packages (~5s).                      
                                                                                                                                                                          
Part 4: Workflow-level settings                                                                                                                                           
                                                                                                                                                                          
4.1 Add --max-failures=10 to test invocation                                                                                                                              
                                                                                                                                                                          
run: npm run test:e2e -- --max-failures=10 --reporter=html --reporter=github                                                                                              
                                                                                                                                                                          
--max-failures stops execution entirely after 10 failures -- remaining tests are not run. This intentionally trades coverage for speed: during development, if 10 tests   
have failed, the remaining failures won't provide additional signal. Once the suite is stable, this can be raised or removed.                                             
                                                                                                                                                                          
4.2 Lower timeout-minutes from 45 to 15                                                                                                                                   
                                                                                                                                                                          
With native services, setup drops to ~1.5 min. With globalTimeout, tests cap at 10 min. Theoretical max is ~12 min. 15 min provides headroom.                             
                                                                                                                                                                          
Expected impact                                                                                                                                                           
                                                                                                                                                                          
┌─────────────────────────┬────────────────────┬─────────────────────────┐                                                                                                
│        Scenario         │       Before       │          After          │                                                                                                
├─────────────────────────┼────────────────────┼─────────────────────────┤                                                                                                
│ Setup phase             │ ~5 min             │ ~1.5 min                │                                                                                                
├─────────────────────────┼────────────────────┼─────────────────────────┤                                                                                                
│ All tests pass          │ ~5 min             │ ~2 min                  │                                                                                                
├─────────────────────────┼────────────────────┼─────────────────────────┤                                                                                                
│ 5 tests fail, rest pass │ ~6-7 min           │ ~2-3 min                │                                                                                                
├─────────────────────────┼────────────────────┼─────────────────────────┤                                                                                                
│ Most tests failing      │ 15-40+ min         │ ~3-5 min                │                                                                                                
├─────────────────────────┼────────────────────┼─────────────────────────┤                                                                                                
│ Entire suite broken     │ 45 min (cancelled) │ ~2-3 min (max-failures) │                                                                                                
└─────────────────────────┴────────────────────┴─────────────────────────┘                                                                                                
                                                                                                                                                                          
Files to modify                                                                                                                                                           
                                                                                                                                                                          
1. e2e/playwright.config.ts -- globalTimeout, timeout, expect.timeout, retries                                                                                            
2. .github/workflows/e2e-tests.yml -- replace Docker with services: + native processes, parallelize steps, --max-failures, timeout-minutes                                
                                                                                                                                                                          
Both on the feat/e2e-foundation branch. Zero changes to Backend-Service.                                                                                                  
                                                                                                                                                                          
Verification                                                                                                                                                              
                                                                                                                                                                          
1. Review the diff to confirm no behavioral change for passing tests                                                                                                      
2. Push to feat/e2e-foundation and trigger the workflow                                                                                                                   
3. Run gh run watch --exit-status to confirm CI passes                                                                                                                    
4. Verify auth/backend healthchecks respond correctly in the logs                                                                                                         
5. Verify DB migrations run successfully via init-db.mjs output                                                                                                           