// Renders the in-app <Dartboard> to static SVGs used for the favicon and PWA icons.
// Run: npm run icons  (then scripts/render-icons.mjs rasterises them with headless Chrome)
import { renderToStaticMarkup } from 'react-dom/server'
import Dartboard from '../src/components/Dartboard'
import { writeFileSync } from 'node:fs'

const svg = (numbers: boolean) =>
  renderToStaticMarkup(<Dartboard art numbers={numbers} />)
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/ class="[^"]*"/, '')
    .replace(/font-family:inherit/g, 'font-family:Arial,Helvetica,sans-serif')

writeFileSync('public/board.svg', svg(true))
writeFileSync('public/favicon.svg', svg(false))
