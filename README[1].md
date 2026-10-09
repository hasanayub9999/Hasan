# SkyRL website + 3D portal

Upload all six files to the **root** of your GitHub repository:
- `index.html` — main landing page
- `style.css` — homepage styling and persistent light/dark toggle
- `script.js` — homepage interactions and demo login modal
- `portal.html` — separate portal page
- `portal.css` — portal UI and loading screen
- `portal.js` — Three.js 3D scene and interactive visual demo

Commit/push to GitHub Pages. The portal will be available at `/portal.html` on the same site.

The 3D portal loads Three.js from a CDN, so internet is required. The loading screen is a visual transition, and “Run visual demo” animates a placeholder drone. It is **not** a working reinforcement-learning/PPO agent. Sign-in is UI-only. Integrate Sakthi's actual simulator and a real authentication provider when ready.
