# Aetherveil handoff

## Inputs found (session 1)
- Repo was EMPTY (no commits). **Master requirements TXT: NOT accessible. Key art/reference images: NOT accessible.**
- Nothing from the 1.24M-char spec has been read. The ledger below is derived only from the directive prompt.
- Action needed: add the TXT and key art to the repo (e.g. /workspace/aetherveil/reference/), then build the real requirements ledger.

## Build/test
`npm i && npm run dev` | `npm run typecheck` | `npm test` | `npm run build`

## Architecture
- src/engine: collision, input (keyboard/mouse/touch), save (versioned, v1->v2 migration), settings.
- src/game/main.ts: benchmark slice. Currently monolithic, so split it into ECS/scene modules next.
- Renderer: Three.js WebGLRenderer (WebGL2) + bloom + ACES. WebGPU is NOT implemented.

## Ledger (directive-derived; status honest)
| Area | Status | Evidence |
|---|---|---|
| WebGL2 render, PBR, IBL (PMREM), bloom, tone map, fog, day/night | Implemented | tsc+build only; not run in a browser |
| Shadows, quality tiers, res scale, adaptive res | Implemented | not browser-verified |
| Player move/jump/3rd-person cam w/ wall pull-in, AABB collision | Implemented | collision unit tests |
| Touch joystick/look/buttons | Implemented | not device-tested |
| Interaction: 5 shards -> terminal -> gate -> vault | Implemented | not browser-verified |
| Save/load versioned, export | Implemented (export only; no import UI) | unit tests |
| Settings UI + persistence | Implemented | unit tests |
| Loading screen / error screen | Implemented | not browser-verified |
| WebGPU, ECS, physics engine, skeletal anim/IK, glTF pipeline, streaming, audio, combat, vehicles, aviation, NPC AI, quests, dialogue, inventory, weather, plugins, profiler | NOT STARTED | n/a |

## Known defects / limits
- Never run in a real browser (no browser available this session): visuals and perf are unverified.
- The player and buildings are procedural primitives, not production assets, so this does NOT meet the directive's quality bar. glTF character/city assets must be sourced.
- Env map is rebuilt every 15s on the main thread (possible hitch).
- Bundle >500kB (three.js); needs code-splitting.

## Next steps
1. Supply spec + key art; build the ledger. 2. Headless-browser smoke test (Playwright). 3. glTF loader + asset manifest. 4. ECS refactor. 5. Combat, then vehicles.

## Session 2
- Re-checked: requirements TXT and key art are STILL absent from the repo and the filesystem.
- Added tools/smoke.mjs (Playwright: boots the game, walks, checks the HUD, screenshots, fails on page errors) and `npm run smoke`.
- **Blocked:** Chromium downloads but will not launch (libglib-2.0.so.0 missing). There is no root or sudo, and `playwright install-deps` fails. The smoke test has NEVER run, so runtime verification is still outstanding.
- Next action: run `npm run smoke` on a machine with browser libraries (or install them), then fix whatever it finds. Provide the spec and art.
