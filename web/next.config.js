const path = require('path');

/**
 * The web app imports the SAME pure modules the Apps Script add-on uses (../shared).
 * externalDir lets Next compile files outside web/. On Vercel, set the project's Root Directory to `web`
 * and enable "Include source files outside of the Root Directory in the Build Step".
 */
const root = path.join(__dirname, '..');

/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { externalDir: true },
  outputFileTracingRoot: root,
  turbopack: { root }
};
