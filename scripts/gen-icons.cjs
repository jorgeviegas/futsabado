// Gera os ícones PNG do PWA a partir de public/favicon.svg usando Playwright.
const { chromium } = require('playwright')
const { readFileSync } = require('node:fs')

const svg = readFileSync('public/favicon.svg', 'utf8');
(async () => {
const browser = await chromium.launch()
const page = await browser.newPage()

async function render(file, size, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size })
  const inner = maskable ? Math.round(size * 0.7) : size
  await page.setContent(
    `<body style="margin:0;background:${maskable ? '#7a1328' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`,
  )
  await page.screenshot({ path: `public/${file}`, omitBackground: !maskable })
}

await render('pwa-192.png', 192)
await render('pwa-512.png', 512)
await render('pwa-maskable-512.png', 512, { maskable: true })
await render('apple-touch-icon.png', 180)
await browser.close()
})()
