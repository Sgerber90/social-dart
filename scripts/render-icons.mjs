// Rasterise PWA icons from public/board.svg with a local Chrome (puppeteer-core).
// Usage: CHROME=/usr/bin/google-chrome node scripts/render-icons.mjs
import { readFileSync } from 'node:fs'
const { default: puppeteer } = await import(process.env.PUPPETEER || 'puppeteer-core')
const board = readFileSync('public/board.svg', 'utf8')
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage()
const jobs = [
  { file: 'public/icons/icon-192.png', size: 192, pad: 0.06, radius: 0 },
  { file: 'public/icons/icon-512.png', size: 512, pad: 0.06, radius: 0 },
  { file: 'public/icons/maskable-512.png', size: 512, pad: 0.17, radius: 0 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, pad: 0.08, radius: 0 },
]
for (const j of jobs) {
  await page.setViewport({ width: j.size, height: j.size })
  const inset = Math.round(j.size * j.pad)
  await page.setContent(`<html><body style="margin:0;background:radial-gradient(circle at 50% 30%,#2a2219,#0c0b0a 70%);width:${j.size}px;height:${j.size}px;display:flex;align-items:center;justify-content:center">
    <div style="width:${j.size - inset * 2}px;height:${j.size - inset * 2}px;filter:drop-shadow(0 ${j.size / 40}px ${j.size / 20}px rgba(0,0,0,.6))">${board.replace('<svg', '<svg width="100%" height="100%"')}</div></body></html>`)
  await page.screenshot({ path: j.file })
  console.log('wrote', j.file)
}
await browser.close()
