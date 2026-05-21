const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function generateIcon() {
  const repoRoot = path.join(__dirname, '..');
  const sourcePath = path.join(repoRoot, 'clyde_ghost.svg');
  const outputDir = path.join(repoRoot, 'build');
  const outputPath = path.join(outputDir, 'icon.png');
  const svg = fs.readFileSync(sourcePath, 'utf8');
  const svgBase64 = Buffer.from(svg).toString('base64');

  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: 1
    });

    await page.setContent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              width: 512px;
              height: 512px;
              margin: 0;
              background: transparent;
              overflow: hidden;
            }

            body {
              display: grid;
              place-items: center;
            }

            img {
              width: 512px;
              height: 512px;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <img alt="Clyde icon" src="data:image/svg+xml;base64,${svgBase64}" />
        </body>
      </html>
    `);

    await page.screenshot({ path: outputPath, omitBackground: true });
  } finally {
    await browser.close();
  }
}

generateIcon().catch((error) => {
  console.error(`Failed to generate icon: ${error.message}`);
  process.exit(1);
});
