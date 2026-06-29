WallView — static web build (ready to upload)
=============================================

WHAT TO UPLOAD
--------------
Upload the CONTENTS of this dist/ folder into the document root of the
wallview.standscale.com subdomain (e.g. public_html/wallview.standscale.com/):

    index.html          <- must sit AT the root (loads at the bare domain)
    app.js
    styles.css
    wallview-icon.svg   <- favicon + header mark

That's it. The app is 100% client-side (no build step, no Node, no database).
State is saved in the browser via localStorage.

DO NOT upload the dist folder itself as a subfolder — put the 4 files directly
at the root, or the app will live at /dist/ instead of /.

WHAT WORKS
----------
Everything client-side: 2D/3D parametric design, live cut list, sheet nesting,
edge banding + priced BOM, Job > Module > Room (whole-wall) view, CSV/PDF export.

AI DESIGN COPILOT (intentionally disabled in this build)
--------------------------------------------------------
The assistant needs the Node proxy (server/server.js) to keep the OpenAI key
server-side. Plain static hosting can't run Node, so the AI button is removed here.

To enable AI later:
  1. Host server/server.js on a Node-capable host with OPENAI_API_KEY set.
  2. In index.html: restore the assistant button in .top-actions, the #ai-panel
     section, and <script src="ai.js"></script>; upload ai.js too.
  3. Point ai.js's fetch('/api/chat') at your proxy URL (add CORS if cross-origin).

NOTE ON HTTPS
-------------
If wallview.standscale.com serves over HTTPS, make sure its TLS certificate
covers that hostname (the existing kerf.* host uses a shared cert that does not
match). Otherwise serve over http:// for now.
