# Station Signup Rollout Runbook

Ordered launch steps for the station self-signup feature. The feature spans two services — the auth service (in Backend-Service) and dj-site — each with its own flags. The order matters: an administrator must be able to mint the first passcode **before** any DJ can sign up (mint-before-flip). Follow the steps in sequence.

Every `NEXT_PUBLIC_*` variable is a **build-time** flag: dj-site inlines it at build, so a change requires a rebuild and redeploy of dj-site, not just a restart. The auth-service variables (`STATION_PASSCODE_KEY`, `STATION_SIGNUP_ENABLED`) are read at process start, so a change there requires a restart of the auth service.

## Flags at a glance

| Flag | Service | Gates |
| --- | --- | --- |
| `STATION_PASSCODE_KEY` | auth service | The 32-byte (64 hex char) key that reveal/rotate mint and decrypt the passcode with. Unset, rotate returns 503. |
| `NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED` | dj-site (build-time) | The manager-facing "Signup Passcode" tab in the admin roster view switcher and its passcode panel (reveal/rotate/revoke). |
| `STATION_SIGNUP_ENABLED` | auth service | Mounts the public `POST /auth/wxyc/station-signup` route. Off, it 404s. |
| `NEXT_PUBLIC_STATION_SIGNUP_ENABLED` | dj-site (build-time) | The DJ-facing signup form and its "Sign up here" entry link on the login form. |
| `STATION_SIGNUP_DOWNGRADE_ENABLED` | auth service | The nightly auto-downgrade cron. Separate, later opt-in — see below. |

## Ordered launch steps

1. **Set `STATION_PASSCODE_KEY` on the auth service** (Backend-Service host) and restart it. In production: generate 64 hex chars (`openssl rand -hex 32`), store it as a GH secret on WXYC/Backend-Service, then push it to the EC2 host's `.env` and restart the auth container with the `set-ec2-env-var.yml` workflow (`gh workflow run set-ec2-env-var.yml --repo WXYC/Backend-Service --ref main -f key=STATION_PASSCODE_KEY -f restart_target=auth`). This is the key reveal/rotate use to mint and decrypt the passcode; without it rotate returns 503. Optionally set `STATION_SIGNUP_IP_HMAC_KEY` (same format, same workflow) at the same time — it keys the audit-only `ip_hash` column on signup attempts; leaving it unset never blocks signup, it only records NULL hashes.

2. **Set `NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED=true` and redeploy dj-site.** In production this is a GitHub repository **variable** on WXYC/dj-site (`gh variable set NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED --repo WXYC/dj-site --body true`) — the `deploy-production` job in `ci.yml` passes it into the build from `vars.*`, so after setting the variable, re-run the deploy (`gh workflow run ci.yml --repo WXYC/dj-site --ref main`, or push any commit to main). The manager-facing "Signup Passcode" tab and passcode panel now appear in the admin roster page. (Build-time flag — a rebuild/redeploy is required; setting the variable alone changes nothing until the next deploy.)

3. **A station manager rotates/mints the first passcode** from the Signup Passcode panel, and shares it through the station's usual channel.

4. **Open the DJ-facing signup flow:** set `STATION_SIGNUP_ENABLED=true` on the auth service (in production: a GH secret on WXYC/Backend-Service pushed to the EC2 host via the `set-ec2-env-var.yml` workflow with `restart_target=auth`) and `NEXT_PUBLIC_STATION_SIGNUP_ENABLED=true` on dj-site (repo variable + redeploy, same mechanism as step 2). DJs can now reach the "Sign up here" link and submit the passcode plus their account details.

Steps 1–3 are the mint-before-flip sequence: the passcode exists before the public signup route is reachable, so the first DJ to arrive never hits an empty or un-mintable passcode.

## Later, separately: nightly auto-downgrade

`STATION_SIGNUP_DOWNGRADE_ENABLED` (auth service) gates the nightly auto-downgrade cron and is a **separate, later opt-in**. It is not part of the launch sequence above — leave it off until the auto-downgrade behavior is deliberately turned on.
