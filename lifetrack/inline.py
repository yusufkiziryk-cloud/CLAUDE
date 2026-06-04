#!/usr/bin/env python3
"""Inline all CSS and JS assets into index.html to produce a single-file app."""
import re
from pathlib import Path

dist = Path('dist')
src = dist / 'index.html'
html = src.read_text()

def inline_css(html):
    def replace_link(m):
        full_tag = m.group(0)
        href_m = re.search(r'href="([^"]+\.css)"', full_tag)
        if not href_m:
            return full_tag
        href = href_m.group(1).lstrip('./')
        p = dist / href
        if not p.exists():
            return full_tag
        css = p.read_text()
        return f'<style>{css}</style>'
    return re.sub(r'<link[^>]+\.css[^>]*>', replace_link, html)

def inline_js(html):
    def replace_script(m):
        full_tag = m.group(0)
        src_m = re.search(r'src="([^"]+\.js)"', full_tag)
        if not src_m:
            return full_tag
        src_path = src_m.group(1).lstrip('./')
        p = dist / src_path
        if not p.exists():
            return full_tag
        js = p.read_text()
        # Preserve any type="module" attribute
        type_attr = ' type="module"' if 'type="module"' in full_tag else ''
        return f'<script{type_attr}>{js}</script>'
    return re.sub(r'<script[^>]+\.js[^>]*></script>', replace_script, html)

html = inline_css(html)
html = inline_js(html)

out = dist / 'lifetrack.html'
out.write_text(html)
print(f'Written: {out} ({out.stat().st_size // 1024} KB)')
