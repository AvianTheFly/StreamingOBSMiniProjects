const COMPONENTS = [
  ['#header-slot',      'components/header.html'],
  ['#profile-slot',     'components/profile-bar.html'],
  ['#library-slot',     'components/library-panel.html'],
  ['#resizer-slot',     'components/resizer.html'],
  ['#assignments-slot', 'components/assignments-panel.html'],
  ['#footer-slot',      'components/footer.html'],
];

async function injectComponent(selector, path) {
  const slot = document.querySelector(selector);
  if (!slot) throw new Error(`Missing slot: ${selector}`);
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  slot.outerHTML = await response.text();
}

async function bootstrap() {
  try {
    for (const [selector, path] of COMPONENTS) {
      await injectComponent(selector, path);
    }

    const appScript  = document.createElement('script');
    appScript.type   = 'module';
    appScript.src    = 'assets/js/app.js';
    document.body.appendChild(appScript);
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <div style="padding:2rem;font-family:system-ui,sans-serif;color:#d8dff0;background:#090b10;min-height:100vh;">
        <h1 style="font-size:1.1rem;margin-bottom:0.5rem;">Failed to load editor</h1>
        <p style="opacity:0.8;">${error.message}</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
