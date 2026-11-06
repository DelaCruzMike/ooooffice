# Ooooffice

A standalone, low-poly virtual team office. One floor, eleven rooms/areas plus a central commons, 50 department workstations, a 50-seat meeting room, customizable human characters, temporary chat, optional voice, and Connect Four.

**Current delivery:** the local preview is playable. Multiplayer server, Google approval flow, profile persistence, admin tools, and LiveKit integration are implemented, with deployment configuration ready. Public hosting and real Google/voice verification require the external projects below. A short local 50-client test is not certification for full-day 50-person use.

## Try the local preview

Requires Node 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No accounts, microphone access, or paid services are needed for this preview. Demo characters are labeled and do not represent connected people. Appearance is saved on this browser only. Preview chat has no remote recipients.

Controls: WASD/arrows to move; drag to rotate; wheel/pinch to zoom; E to sit, stand, or interact with the game table; 1 to wave and 2 to dance. Small screens have a movement joystick and interaction button. Choose a room in the directory to set a walking destination, or open the map to see the whole floor.

## Project structure

- `src`: React interface, Babylon scene, voice client, local preview, multiplayer client.
- `shared`: floor layout, geometry/collision, character types, Connect Four rules, delta synchronization.
- `server`: one authoritative Colyseus room; authenticated HTTP APIs; account and voice adapters.
- `supabase/001_office.sql`: persistent storage migration with no direct browser table access.
- `.github/workflows/pages.yml` and `render.yaml`: website and server deployment.
- `tests` and `scripts/loadtest.ts`: behavioral/security tests and an isolated 50-client soak runner.

The room dimensions and initial seat allocations live in `shared/world.ts`. The model uses meters. Configuring this layout changes shared collision and rendering together; rebuild both frontend and server after a layout change. Do not introduce a second server instance or a second office room without shared presence/session coordination.

## Connect the live office

### 1. Supabase and Google

1. Create a dedicated Supabase project and run `supabase/001_office.sql` in its SQL editor.
2. Enable Google sign-in. Create a Google OAuth web client in the Google Cloud console. Set its authorized callback to the exact Supabase callback shown in the provider setup (`https://<project>.supabase.co/auth/v1/callback`). Save the Google client ID/secret in Supabase, not in this repository.
3. Set Supabase's Site URL and allowed redirect URL to the exact GitHub Pages address, including `/ooooffice/`. Add `http://127.0.0.1:5173/` for local development only. Google consent testing may also require adding pilot users to its test-user list.
4. Set `OWNER_EMAIL` on the server to the owner's verified Google email. The owner is bootstrapped on successful Google login; other emails remain denied until approved through the admin panel.
5. Obtain the project URL, browser anon/publishable key compatible with the installed client, and server service-role key. Only the URL and browser key go into frontend variables.

Do not disable row-level security or create public table policies. All application data flows through the office server. A successful Google login alone does not grant membership. The server requires a confirmed email with a matching Google identity, then checks the approval list.

### 2. LiveKit Cloud

Create a dedicated free Build project. Configure `LIVEKIT_URL` (the WSS project URL), `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` on Render. Never use those server credentials as frontend build variables.

After a server restart, voice admission waits 20 seconds and cleans up old Ooooffice voice participants before issuing new credentials; text and movement remain available during voice preparation. Cleanup failures keep voice admission disabled and retry.

The integration assumes LiveKit **Cloud**, where participant removal revokes that participant's access credentials. Tokens permit microphone publishing only, are restricted to the server-selected room, and expire after 15 seconds for initial admission. Already connected sessions are ended explicitly. If a token has not yet been redeemed, a room transition waits for its expiry plus a small clock-skew allowance rather than letting an unused old token remain usable. Normal connected room changes need only the disconnection acknowledgement.

The app never records or starts an egress job. Free voice allowances are finite: verify the current account limits and usage before the pilot. Listening consumes voice resources even when the microphone is muted. Disconnect voice when it is not needed. No paid plan is selected by this project.

### 3. Render server

1. Connect the new `ooooffice` GitHub repository to Render and use its `render.yaml` blueprint. Select the free plan only.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, the three LiveKit variables, and `FRONTEND_ORIGINS`.
3. `FRONTEND_ORIGINS` must contain exact **origins**, such as `https://delacruzmike.github.io` (no `/ooooffice/` path). Multiple local/pilot origins can be comma-separated.
4. The health route is `/health`. The server must support HTTPS and secure WebSockets through Render's public URL. Set the browser's `VITE_SERVER_URL` to that **HTTPS** URL.

Free Render instances sleep after inactivity; the joining interface wakes the server and shows a startup message. Server restarts clear positions, seat claims, messages, meeting locks, and Connect Four. Saved profiles, memberships, and work links remain in Supabase. A restart ends the office visit; use the rejoin control to reconnect. The app does not silently turn the microphone back on after a disconnected visit.

### 4. GitHub Pages

Use a **new public repository named `ooooffice`**, separate from existing projects. Copy this directory's contents to the repository root (do not add another nested `ooooffice` directory).

In Settings → Pages, select **GitHub Actions** as the build source. In Settings → Secrets and variables → Actions → **Variables**, set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SERVER_URL`

These are intentionally browser-visible identifiers. Do not put service-role keys, Google secrets, or LiveKit secrets here. The workflow tests, builds with the correct repository subpath, and publishes `dist`. A preview-only build also works when these variables are absent; it explicitly reports that team sign-in is not yet connected.

Expected project address, once Pages is enabled and deployment succeeds: `https://delacruzmike.github.io/ooooffice/`. This is an expected address, not evidence of a completed deployment. No purchased domain is required.

## Use the office

The first approved owner signs in with Google, then opens administration from the shield button. Approve teammates by Google email; set departments; optionally appoint administrators; and add HTTPS work links. Work links appear when someone sits at a workstation and open in a separate tab.

Department rooms are open to the approved team. In the meeting room, use Settings → Lock the meeting room. The first member to lock becomes the host; the host leaving/disconnecting unlocks it. Administrators can unlock it remotely. People already inside may leave at any time.

Connect listening or enable the microphone explicitly. Shared areas use distance-based volume; enclosed rooms use separate server-assigned LiveKit rooms. Settings includes desktop push-to-talk; connect listening first, then hold Space to speak. Deafen silences incoming audio. Individual volume controls are in People. Disconnect voice separately to stop using its connection. Force mute disconnects the target voice session; only that person can enable their microphone again.

Revocation removes office membership and current access. Removing a participant ends the current visit, while leaving their approved membership intact. Opening the same Google account in another tab/device replaces the first office session. Direct database approval changes are rechecked within 15 seconds; admin-panel revocation also removes active sessions immediately.

## Verification

```sh
npm test
npm run build
# Default: full 60-minute, 50-client soak against an isolated local server.
npm run loadtest
# Shorter development check:
LOAD_TEST_SECONDS=180 npm run loadtest
```

The load runner generates a temporary test-only credential in memory, binds its own server to localhost, disables external services, connects 50 separate Colyseus clients, rejects a 51st client and anonymous access, sends movement continuously, checks position validity and snapshot freshness, verifies final state convergence, writes `loadtest-report.json`, and stops its server. Its authentication bypass requires all three of `NODE_ENV=test`, `ENABLE_LOAD_TEST=true`, and a matching random key. **Never set those flags on a hosted server.** It does not test Google or voice.

Before opening a wider pilot, also complete:

- Real owner and unapproved Google sign-in; approval, revocation, and session replacement across devices.
- Avatar persistence after signing in on another device.
- Two-person voice through shared areas, enclosed rooms, locked meetings, denied permissions, host loss, network loss, force mute, and quota failure.
- Real phone joystick/camera/microphone checks on iOS Safari and Android Chrome, plus laptop Chrome/Edge/Safari.
- A 60-minute 50-client soak on the chosen server and a real group session; verify FPS on named pilot devices rather than claiming universal mobile performance.
- A restart with active voice participants; confirm all clients disconnect voice when their office connection is lost.
- Review free-tier usage and projected cost from the real pilot before considering paid hosting.

## Security boundaries and operational limits

No server credentials belong in GitHub, the frontend, logs, screenshots, or chat. Membership and role checks run on the server. Room IDs, client-supplied names, and UI visibility are not authorization. Positions are simulated from bounded input, and seats require proximity and matching room membership; clients cannot teleport by claiming a chair through a wall. Client messages are bounded and rate limited; work URLs permit HTTPS only. Text is rendered as text, not HTML.

Voice privacy depends on the LiveKit service acknowledging removals. The server holds a room transition at the boundary if it cannot retire old voice access, and retries cleanup on failures. Enclosed-room isolation is real service-level separation; proximity attenuation in common areas is a listening behavior, not a confidentiality boundary. The server and voice service do not constitute end-to-end encrypted meetings.

The 50-person cap is enforced in one office. Free infrastructure availability, full-day costs, real-device FPS, and 50-person audio quality must be verified in the pilot. Authentication email settings, billing controls, provider quotas, and provider retention policies remain project-owner configuration.
