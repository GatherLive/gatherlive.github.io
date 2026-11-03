# PDF export assets

pdfmake 0.2.20, with its bundled Roboto virtual font files. Loaded on demand only
when a host downloads a PDF; quiz answers are rendered locally in the browser.

Sources:
- https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/pdfmake.min.js
- https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/vfs_fonts.js

pdfmake is MIT licensed; see LICENSE. Roboto is Apache-2.0 licensed; see
FONT-LICENSE.txt. Preserve these notices when updating the vendored assets.

The embedded base64 font strings are split into concatenated 120-character
literals so source privacy scanning stays fast. Font bytes are unchanged.
