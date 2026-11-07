# Ooooffice

A standalone, low-poly virtual team office. A high-rise floor with 46 department workstations, a 50-seat tiered auditorium, an 8-seat meeting room, 20 usable beds, an outdoor veranda, a furnished canteen, customizable faceted human characters, and playable darts, chess, Connect Four, eight-ball billiards, and ten-pin bowling.

**Current delivery:** [Ooooffice](https://delacruzmike.github.io/ooooffice/) is hosted on GitHub Pages. Version 0.3 adds mouse free-look, three camera views, sprinting, a centered Q emote wheel, expanded wardrobe, usable privacy doors, and authoritative pool/bowling physics. Supabase and the free Render server are provisioned; Google is enabled and service credentials are configured in the providers' dashboards. The release has 47 automated behavior/security/physics tests. Real-account, real-device, and voice pilot acceptance must be verified separately from simulated traffic. See the verification section below for the recorded capacity result.

## Try the local preview

Requires Node 22 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No accounts, microphone access, or paid services are needed for this preview. Demo characters are labeled and do not represent connected people. Appearance is saved on this browser only. Preview chat has no remote recipients.

Controls: WASD or arrows move relative to the camera. Hold **Left Shift** to sprint (6 m/s; walking is 3.8 m/s). Click the office for mouse free-look; Escape releases the pointer. Browsers that cannot capture it support click-and-drag look. **C** cycles first person, front-facing second person, and third person; the selector saves the chosen view. Third person retains the 3.5-meter distance and obstruction handling. Space jumps, E interacts, and V is optional push-to-talk. Hold **Q**, point at an emote, and release to perform it; release over the center or Escape to cancel. The toolbar supports direct emote selection. Phones have camera drag, a camera selector, joystick, sprint toggle, Jump, and Interact. The minimap is at bottom left with abbreviations, an expandable room legend, and destination guidance. Open panels pause office movement.

Your Look opens a live rotatable character preview: six hairstyles, skin/hair/clothing colors, T-shirt/polo/button-down/hoodie, trousers/jeans/shorts, sneakers/office shoes, and glasses/cap/headset. Existing saved appearances receive compatible defaults; live profiles save in Supabase's existing avatar JSON.

## Project structure

- `src`: React interface, Babylon scene, voice client, local preview, multiplayer client.
- `shared`: authoritative movement, jumps, seats/beds, independent room locks, all game rules, floor geometry, and delta synchronization. Preview and server use the same engine.
- `src/render`: reusable furniture builders, city skyline, facade, and faceted articulated characters.
- `server`: one authoritative Colyseus room; authenticated HTTP APIs; account and voice adapters.
- `supabase/001_office.sql`: persistent storage migration with no direct browser table access.
- `.github/workflows/pages.yml` and `render.yaml`: website and server deployment.
- `tests` and `scripts/loadtest.ts`: behavioral/security tests and an isolated 50-client soak runner.

The room dimensions and initial seat allocations live in `shared/world.ts`. The model uses meters. Protocol version 3 is required for the camera-relative input, sprint, doors, wardrobe, and sports game state; redeploy the browser and server together. Old clients receive a reload message before authentication. Configuring this layout changes shared collision and rendering together; rebuild both frontend and server after a layout change. Do not introduce a second server instance or a second office room without shared presence/session coordination.

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

1. The configured server is https://ooooffice-server.onrender.com (Singapore, free plan). A separate installation can use `render.yaml`. Keep one running instance and select the free plan only.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`, the three LiveKit variables, and `FRONTEND_ORIGINS`.
3. `FRONTEND_ORIGINS` must contain exact **origins**, such as `https://delacruzmike.github.io` (no `/ooooffice/` path). Multiple local/pilot origins can be comma-separated.
4. The health route is `/health`. The server must support HTTPS and secure WebSockets through Render's public URL. Set the browser's `VITE_SERVER_URL` to that **HTTPS** URL.

Free Render instances sleep after inactivity; the joining interface wakes the server and shows a startup message. Server restarts clear positions, seat/bed claims, messages, room locks, and all game sessions. Saved profiles, memberships, and work links remain in Supabase. A restart ends the office visit; use the rejoin control to reconnect. The app does not silently turn the microphone back on after a disconnected visit.

### 4. GitHub Pages

The existing public repository is https://github.com/DelaCruzMike/ooooffice. Keep this project separate from other applications.

GitHub Actions publishes Pages. The browser defaults to the public identifiers in `src/service-config.ts`; for another installation, override these optional build variables in Settings → Secrets and variables → Actions → Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SERVER_URL`

These are intentionally browser-visible identifiers. Do not put service-role keys, Google secrets, or LiveKit secrets here. The workflow tests, builds with the correct repository subpath, and publishes `dist`. Only public identifiers belong in `service-config.ts`. Private keys remain on the server. Independent preview remains available before sign-in.

Published preview: [https://delacruzmike.github.io/ooooffice/](https://delacruzmike.github.io/ooooffice/). GitHub Pages is enabled and the deployment was verified in the browser. Visitors start in independent preview and choose Join your team for Google sign-in and the approved shared office. No purchased domain is required.

## Use the office

The first approved owner signs in with Google, then opens administration from the shield button. Approve teammates by Google email; set departments; optionally appoint administrators; and add HTTPS work links. Work links appear when someone sits at a workstation and open in a separate tab.

Department rooms start open. Occupants and administrators can close doors. Outside members request entry; occupants/admins can admit or dismiss the request. Admission opens the door for five seconds, with threshold safety. Requests are private, expire after 30 seconds, and have a ten-second retry cooldown. Empty rooms open automatically. Occupants can always exit; a closed door swings open on exit. Room audio is isolated even with the door open. Closing a door is visual/access privacy, not an audio-routing switch. Open-door admission is not exclusive to the named visitor. The auditorium and small meeting room have independent host/admin locks in Settings. The first member to lock their meeting room becomes its host; leaving or disconnecting releases that room’s host lock. Administrators can unlock either remotely. People already inside may leave at any time.

Workstation allocation: Department Manager 1; Social Media 5; Creator Support 6; Editors 6 (dual monitors); CDT 7; QA 7; Posters 14. The auditorium has five ascending tiers with central ramp access. All 20 sleeping-quarter beds have exclusive temporary claims; lying down never changes availability or creates attendance records.

The sole darts board in the commons uses 301 scoring (three darts per turn, straight-out, turn-start reset on bust). The preview supports solo practice; the live office requires two players. Click/tap the board, or use its arrow-key aiming and Enter to throw. Chess supports local pass-and-play or two live players, with legal moves, castling, en passant, promotion, checkmate and draws validated by chess.js. Connect Four also supports local pass-and-play. Leaving the activity area releases participation. Pool and bowling are playable as described below. The PS5 and TV remain decorative.

Eight-ball has a dedicated 3D view, angle/power aiming, called ball/pocket, solids/stripes, legal breaks, contact/rail fouls, scratches, ball-in-hand placement, and legal/early eight-ball outcomes. The eight is respotted on the break. Two live players confirm each rematch; preview supports local pass-and-play. Spin, jump shots, and masse are excluded. Leaving/disconnecting forfeits an active online rack.

Bowling supports solo practice or one to four live players over ten frames, with starting position, aim, power, and hook controls. Rapier simulates ball/pin collisions and gutters; standing pins persist for the second roll. Scoring includes strikes, spares, tenth-frame bonuses and ties. Leaving skips that bowler; an empty session resets. Spectators can open the game panels nearby. Neither game stores rankings or awards.

Preview and server use the same Rapier physics/rules at fixed 60 Hz, loaded on demand and run only during shots. Online clients submit bounded shot inputs; the server computes all collisions and results and broadcasts snapshots. Games, doors, and room requests are temporary. Generic Colyseus creation/joinOrCreate routes are blocked; admission authenticates before reserving a seat. Server test fixtures are registered only under the existing three-part localhost load-test guard.

Connect listening or enable the microphone explicitly. Shared areas use distance-based volume; enclosed rooms use separate server-assigned LiveKit rooms. Settings includes desktop push-to-talk; connect listening first, then hold V to speak; Space is reserved for jumping. Deafen silences incoming audio. Individual volume controls are in People. Disconnect voice separately to stop using its connection. Force mute disconnects the target voice session; only that person can enable their microphone again.

Revocation removes office membership and current access. Removing a participant ends the current visit, while leaving their approved membership intact. Opening the same Google account in another tab/device replaces the first office session. Direct database approval changes are rechecked within 15 seconds; admin-panel revocation also removes active sessions immediately.

## Verification

```sh
npm test
npm run build
# Default: full 60-minute, 50-client soak against an isolated local server.
caffeinate -i npm run loadtest # macOS; prevents idle sleep only during this command
# Shorter development check:
LOAD_TEST_SECONDS=180 npm run loadtest
```

The load runner generates a temporary test-only credential in memory, binds its own server to localhost, disables external services, connects 50 separate Colyseus clients, rejects a 51st client and anonymous access, keeps pool and bowling active, exercises door requests/admission, sends walking/sprinting and periodic jumps, checks position validity, jump bounds and snapshot freshness, and verifies final player and office/game state convergence, writes `loadtest-report.json`, and stops its server. Its authentication bypass requires all three of `NODE_ENV=test`, `ENABLE_LOAD_TEST=true`, and a matching random key. **Never set those flags on a hosted server.** It does not test Google or voice.

Before opening a wider pilot, also complete:

- Real owner and unapproved Google sign-in; approval, revocation, and session replacement across devices.
- Avatar persistence after signing in on another device.
- Two-person voice through shared areas, enclosed rooms, locked meetings, denied permissions, host loss, network loss, force mute, and quota failure.
- Real phone joystick/camera/microphone checks on iOS Safari and Android Chrome, plus laptop Chrome/Edge/Safari.
- A 60-minute 50-client soak on the chosen server and a real group session; verify FPS on named pilot devices rather than claiming universal mobile performance.
- A restart with active voice participants; confirm all clients disconnect voice when their office connection is lost.
- Review free-tier usage and projected cost from the real pilot before considering paid hosting.

Capacity run status: the first continuous run was interrupted by host idle sleep after about 31 minutes and is inconclusive. The final one-hour local run is in progress under a temporary keep-awake guard; the final report is written to the ignored `loadtest-report.json`. This does not test hosted voice or replace a real-device pilot.

## Security boundaries and operational limits

No server credentials belong in GitHub, the frontend, logs, screenshots, or chat. Membership and role checks run on the server. Room IDs, client-supplied names, and UI visibility are not authorization. Positions are simulated from bounded input, and seats require proximity and matching room membership; clients cannot teleport by claiming a chair through a wall. Client messages are bounded and rate limited; work URLs permit HTTPS only. Text is rendered as text, not HTML.

Voice privacy depends on the LiveKit service acknowledging removals. The server holds a room transition at the boundary if it cannot retire old voice access, and retries cleanup on failures. Enclosed-room isolation is real service-level separation; proximity attenuation in common areas is a listening behavior, not a confidentiality boundary. The server and voice service do not constitute end-to-end encrypted meetings.

The 50-person cap is enforced in one office. Free infrastructure availability, full-day costs, real-device FPS, and 50-person audio quality must be verified in the pilot. Authentication email settings, billing controls, provider quotas, and provider retention policies remain project-owner configuration.

## Local visual QA routes

Development builds only accept `?preview-room=operations` (or another room ID) for a quick in-room start and `?preview-crowd=50` for a local 50-character rendering check. These parameters are compiled out of the production entrypoint. They do not bypass live authentication or create multiplayer participants. Actual mobile-device performance and hosted voice remain pilot checks.
