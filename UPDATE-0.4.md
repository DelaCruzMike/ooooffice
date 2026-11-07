# Virtual Office 0.4 — implementation and verification

Updated November 7, 2026. Changes apply only to this existing `ooooffice` project. The release is published to the existing GitHub repository through the connected GitHub tools. GitHub Actions and Render deployment status determine when the release is live. The checks below record local implementation verification, not a claim that every production acceptance check has passed.

## Implemented

- Camera: saved sensitivity and independent horizontal/vertical inversion, both off by default. Pointer lock, mouse drag and touch use the same direction function. The existing corrected camera-relative A/D calculation is retained and tested over arbitrary headings, alongside forward/backward and sprint.
- Doors: open panels are completely hidden; closed panels appear in the doorway. Existing authoritative collision, occupancy safety, requests, admission and exit behavior remain intact.
- Wave: outward shoulder raise, bent elbow, side-to-side forearm motion and smooth return; the mathematical hand path stays outside the head. Salute and disco shoulder directions were also corrected. These remain stylized low-poly hands, without articulated fingers/wrists.
- Permissions: Department Manager is the existing `owner` permission; Social Media Manager is `administrator`; other operational jobs use `member`. Job/department labels do not grant privileges. Owner assignments are deliberate account configuration, never inferred from a self-editable title. The configured `OWNER_EMAIL` remains the Department Manager bootstrap. Owners can appoint/manage admins; admins can approve/revoke/edit normal members and departments, manage rooms/work links, and moderate members. Server checks prevent self-access changes and admin management of owners or other admins. No ownership transfer or office deletion endpoint is exposed.
- Join requests: a verified Google account without a membership creates an unapproved member record, without entering the office. The administration list shows unapproved records and allows approval/rejection by retaining revoked/unapproved status. Existing revoked accounts cannot self-approve. Pending and revoked records share the existing `approved=false` storage flag; a separate request audit/status workflow is not included.
- Room management: approach a room plaque and press E, or select a room in Settings. Owner/Admin can rename it, edit its short label/department, restrict new entry to its assigned department, disable voice, view assigned approved members, and open/close its door. Names propagate to rendered signs, location display, directory, minimap labels/legend and floor plan. The secure voice-room ID stays stable. Live settings persist before being broadcast. Startup loads saved access settings before accepting clients. Existing occupants can leave after an access restriction.
- Customization: bounded body build/height, head/facial proportions, additional hair silhouettes/highlights, eye colors, brows, noses, mouths, facial hair, makeup, independent accessories, outerwear, additional clothing/shoe variants and original tattoo marks. A sanitized cosmetic-slot registry extends the existing avatar JSON and multiplayer metadata. Legacy wardrobe choices remain valid. Skin tattoos are hidden beneath long sleeves/trousers. Height is limited to ±5%; body width to ±10%; movement collision remains fixed.
- Settings → Audio: input/output device selection, Web Audio input gain, local microphone level test, voice activation gate/threshold, master/voice/game/UI levels and saved push-to-talk choice. HUD quick mute remains available and displays speaking state. The gate only filters an explicitly enabled microphone; it never unmutes automatically. Local mic tests stop their tracks on close/device change and do not record. Small synthesized interaction/game cues honor their volume sliders.
- Pool: dedicated integrated 3D game view, mouse/touch drag or slider aiming, first-contact guide/marker, power, cue contact selection, simulated follow/draw/English, called pockets, existing two-player rules, fouls, ball-in-hand, solids/stripes, eight-ball outcomes, resign and rematch.
- Darts: dedicated board view, mouse/touch/keyboard aiming, natural reticle sway, hold/release power and timing, visible arrival/stuck darts, authoritative scoring, three-dart turns, straight-out 301 and bust handling. No unrelated webpage is opened.
- Bowling: dedicated 3D lane view, starting position, angle, hook, hold/release power and timing error, existing Rapier ball/pin collisions, gutters, strike/spare scoring, ten frames including tenth-frame bonuses, and up to four online players.
- Office movement pauses while game panels are open; Escape/close restores office view. The avatar stays in the office and game participants/turns remain shared with spectators. Existing chat, map, seating, beds, voice architecture and board games remain intact.

## State and database changes

No SQL migration is required for an installation that already ran `supabase/001_office.sql`. The update reuses existing tables and their server-only access policies:

| Storage | Change |
| --- | --- |
| `office_config` | One JSON value per `room:<stable-room-id>` containing `name`, `label`, `department`, `access` (`team`/`department`) and `voice` (`private`/`muted`). For open common spaces, `private` retains existing proximity behavior; it does not create a private voice room. |
| `profiles.avatar` | Optional `cosmetics` object, sanitized through `shared/cosmetics.ts`. |
| `memberships` | No columns changed. Verified join requests insert an unapproved member only when no record exists. Role/department updates use existing fields. |
| Multiplayer snapshot | Adds `roomSettings`; nested avatar cosmetics are deep-copied. Protocol increases from 3 to 4. |
| Game messages | Pool shots accept bounded `spinX`/`spinY`; darts accept power/timing; bowling accepts timing. Scores/results are still calculated by the server. |
| Browser storage | Camera, audio, push-to-talk, preview room configuration and existing preview avatar preferences. |

These database write paths compile against the installed client but have **not** been exercised against the hosted Supabase database in this update. Existing backend credentials remain outside browser code.

## Synchronization and performance

The existing single Colyseus server validates participation, proximity, turn and shot bounds. Pool and bowling run Rapier at 60 Hz only during shots; the office broadcasts state patches at 10 Hz and the game views interpolate positions. Darts landing/scoring is computed by the same shared engine used online and in preview. Clients cannot submit their own scores or pin counts. Timing is a bounded client input, not a server-timed competitive anti-cheat system.

Room settings and appearance changes use the existing snapshot delta path. Sports UI and physics are lazy-loaded. Materials are reused and existing avatar distance culling is retained. Games, locks and door state remain ephemeral; restarts end matches. Persisted game recovery/rankings are not implemented.

Both Rapier runtimes currently share one lazy physics bundle (about 7.75 MB before gzip, 2.93 MB gzipped). The build reports its size warning. Splitting the two physics runtimes further and measuring on real phones remain optimization work.

## MVP limitations and remaining work

- Pool spin is a bounded planar cloth/impulse approximation, not a full 3D cue/ball contact model. No jump shots, masse, or extended deflection visualization.
- Darts uses a dedicated 2D board view and short arrival animation; it is not a full 3D ballistic camera sequence. Only 301 is implemented; 501, Cricket and Around the Clock remain future modes.
- Bowling uses simplified cylindrical pin collision bodies and an interactive release meter; there is no animated avatar approach. Physics/scoring are real, not predetermined result animations.
- Cosmetics are procedural low-poly variants with simple original marks. They need broader visual QA across combinations; this is not a production asset library or cloth simulation. No articulated wrist/palm pose system.
- Permission enforcement uses the existing three application levels. Department/job assignment is stored in the existing department field; a separately persisted job-title field, invite audit history, and owner-level security-management dashboard remain future work.
- The room voice controls are isolation-preserving private/proximity audio or disabled voice; configurable cross-room voice channels are not included. Locks retain the existing meeting-host behavior.
- Hosted account/permission persistence, two-account cosmetics and room updates, microphone permissions/devices and real-device audio quality still require live acceptance testing. A fresh extended hosted 50-user soak is also outstanding.

## Verification recorded for this update

- `npm test`: **55 tests passed**. Covers controls at arbitrary headings, wave hand clearance, role hierarchy, room access enforcement and snapshot isolation, cosmetic sanitation, first-contact prediction, spin affecting physics, existing game rules/turn validation, collision, voice boundaries, admission and synchronization.
- `BASE_PATH=/ooooffice/ npm run build`: **passed**, using the production Pages subpath. Existing workflow remains in place.
- Local browser: Settings camera/audio controls render; room name/label save succeeds and was restored after the test; expanded customization UI renders and a body-build change persists across reload (restored after testing); pool shot resolves; timed dart scores 50 and reduces 301 to 251; bowling physically knocks down ten pins, records X and advances to frame two.
- Browser console: a lazy-import initialization error discovered during development was fixed; subsequent game checks produced no new errors.
- Local 50-client regression: **60 seconds passed**, 32,443 snapshots, eight pool shots, five bowling rolls, five door request/admission cycles. All clients converged; unauthorized/51st admissions were denied; no unexpected disconnects. See `major-update-loadtest-report.json`. The previous long-run report was preserved separately as the original `loadtest-report.json`.
- This short run disables external account/voice services. It does not establish hosted or physical-device capacity. Real microphone/output device switching was not exercised.

## Setup and deployment

For local development:

```sh
npm ci
npm test
npm run dev
```

For the existing GitHub Pages release:

```sh
BASE_PATH=/ooooffice/ npm run build
```

Publish these sources to the **existing** Ooooffice repository and redeploy both the Render backend and GitHub Pages frontend in a coordinated release. Protocol 4 intentionally rejects protocol-3 clients; reload browsers after deployment. No new service, secret, paid plan, or SQL migration is needed. Existing `OWNER_EMAIL`, Supabase, LiveKit and allowed-origin settings remain applicable.

Browser audio needs HTTPS or localhost and user microphone permission. Device names may be hidden until permission is granted. Output selection is enabled only where `HTMLMediaElement.setSinkId` exists; otherwise the OS/browser default is used. Web Audio and browser autoplay policy can require a user gesture. Physical Bluetooth/mobile routing and Safari behavior need device testing.

Development-only QA entrances: `?preview-activity=pool-commons`, `?preview-activity=darts-commons`, `?preview-activity=bowling-commons`; existing `?preview-room=...` and crowd routes remain. These do not bypass live authentication and are disabled in production builds.

## Changed files

- `package.json`, `package-lock.json`: version 0.4.0.
- `shared/camera.ts`, `shared/room-settings.ts`, `shared/cosmetics.ts`, `shared/aim.ts`: new shared settings, validation and geometry helpers.
- `shared/world.ts`, `shared/engine.ts`, `shared/sports-physics.ts`: protocol/state, authoritative room access, game input/physics and nested-copy safety.
- `server/services.ts`, `server/index.ts`, `server/OfficeRoom.ts`: join requests, protected administration, persistence and startup loading.
- `src/scene.ts`, `src/render/art.ts`, `src/render/avatar.ts`: controls, retracted doors, live signs, animation and cosmetics.
- `src/App.tsx`, `src/preview.ts`, `src/network.ts`: settings integration, preview persistence/QA entrances, audio processing/devices and volume.
- `src/CameraSettings.tsx`, `src/RoomPanel.tsx`, `src/CosmeticEditor.tsx`, `src/AudioSettings.tsx`, `src/audio-settings.ts`, `src/sound.ts`, `src/ThrowMeter.tsx`: new functional UI/audio components.
- `src/GamePanel.tsx`, `src/SportsPanel.tsx`, `src/SportsView.tsx`, `src/styles.css`: skill controls, aiming, lazy loading and game presentation.
- `tests/major-update.test.ts`: eight additional behavior tests.
- `README.md`, `UPDATE-0.4.md`, `major-update-loadtest-report.json`: delivery notes and evidence.
