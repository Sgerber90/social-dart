#!/usr/bin/env python3
"""Render Android icon/splash sources from public/board.svg into assets/, then run
@capacitor/assets to generate adaptive icons + splash for android/.
Usage: npm run android:assets  (needs google-chrome + Pillow)"""
import os, subprocess, tempfile
from PIL import Image
board = open('public/board.svg').read().replace('<svg', '<svg width="100%" height="100%" style="overflow:visible"', 1)
os.makedirs('assets', exist_ok=True)
BG = 'radial-gradient(circle at 50% 30%,#2a2219,#0c0b0a 70%)'
def render(size, inset, out, bg=BG, title=False, alpha=False):
    inner = size - 2 * (inset or 0)
    t = (f'<div style="position:absolute;bottom:{size*0.30}px;width:100%;text-align:center;font:900 {size*0.045}px Roboto,system-ui,sans-serif;color:#d4a640">Social Dart</div>' if title else '')
    board_html = f'<div style="width:{inner}px;height:{inner}px;filter:drop-shadow(0 {size/40}px {size/20}px rgba(0,0,0,.6))">{board}</div>' if inset is not None else ''
    html = f'''<html><body style="margin:0;width:{size}px;height:{size}px;position:relative;overflow:hidden;
      background:{bg};display:flex;align-items:center;justify-content:center">{board_html}{t}</body></html>'''
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f: f.write(html)
    png = f.name + '.png'
    args = ['google-chrome', '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
            f'--window-size={size},{size}', f'--screenshot={png}']
    if alpha: args.append('--default-background-color=00000000')
    subprocess.run(args + ['file://' + f.name], check=True, capture_output=True)
    Image.open(png).convert('RGBA' if alpha else 'RGB').crop((0, 0, size, size)).save(out, optimize=True)
    os.remove(png); os.remove(f.name); print('wrote', out)
render(1024, 90, 'assets/icon-only.png')
render(1024, 60, 'assets/icon-foreground.png', bg='transparent', alpha=True)  # capacitor-assets adds a 16.7% inset, keeping the board in the safe zone
render(1024, None, 'assets/icon-background.png')
render(2732, 1030, 'assets/splash.png', title=True)
render(2732, 1030, 'assets/splash-dark.png', title=True)
subprocess.run(['npx', 'capacitor-assets', 'generate', '--android',
                '--iconBackgroundColor', '#0c0b0a', '--iconBackgroundColorDark', '#0c0b0a',
                '--splashBackgroundColor', '#0c0b0a', '--splashBackgroundColorDark', '#0c0b0a'], check=True)
