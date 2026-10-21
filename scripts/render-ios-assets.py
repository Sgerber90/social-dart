#!/usr/bin/env python3
"""Render the iOS app icon (1024, no alpha) and splash (2732) from public/board.svg.
Usage: python3 scripts/render-ios-assets.py  (needs google-chrome + Pillow)"""
import os, subprocess, tempfile
from PIL import Image
board = open('public/board.svg').read().replace('<svg', '<svg width="100%" height="100%" style="overflow:visible"', 1)
A = 'ios/App/App/Assets.xcassets'
def render(size, inset, out, title=False):
    inner = size - 2 * inset
    t = (f'<div style="position:absolute;bottom:{size*0.30}px;width:100%;text-align:center;font:900 {size*0.045}px -apple-system,system-ui,sans-serif;color:#d4a640">Social Dart</div>' if title else '')
    html = f'''<html><body style="margin:0;width:{size}px;height:{size}px;position:relative;overflow:hidden;
      background:radial-gradient(circle at 50% 30%,#2a2219,#0c0b0a 70%);display:flex;align-items:center;justify-content:center">
      <div style="width:{inner}px;height:{inner}px;filter:drop-shadow(0 {size/40}px {size/20}px rgba(0,0,0,.6))">{board}</div>{t}</body></html>'''
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f: f.write(html)
    png = f.name + '.png'
    subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
                    f'--window-size={size},{size}', f'--screenshot={png}', 'file://' + f.name], check=True, capture_output=True)
    Image.open(png).convert('RGB').crop((0, 0, size, size)).save(out, optimize=True)
    os.remove(png); os.remove(f.name); print('wrote', out)
render(1024, 90, f'{A}/AppIcon.appiconset/AppIcon-512@2x.png')
render(2732, 1030, f'{A}/Splash.imageset/splash-2732x2732.png', title=True)
for n in ('1', '2'):
    Image.open(f'{A}/Splash.imageset/splash-2732x2732.png').save(f'{A}/Splash.imageset/splash-2732x2732-{n}.png', optimize=True)
