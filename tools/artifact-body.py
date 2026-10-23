#!/usr/bin/env python3
"""Turn dist-single/index.html into the body-only page the Claude Artifact publisher expects.

Usage: python3 tools/artifact-body.py dist-single/index.html out.html
"""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
html = open(src, encoding='utf-8').read()
html = re.sub(r'<!DOCTYPE[^>]*>', '', html, flags=re.I)
html = re.sub(r'</?html[^>]*>', '', html)
html = re.sub(r'</?head>', '', html)
html = re.sub(r'</?body>', '', html)
html = re.sub(r'<meta charset[^>]*>', '', html)
html = re.sub(r'<meta name="viewport"[^>]*>', '', html)
# the publisher looks for <title> in the first 8 KB, so the big inline script goes last
m = re.search(r'<script type="module"[^>]*>.*?</script>', html, flags=re.S)
script = m.group(0); html = html[:m.start()] + html[m.end():]
html = re.sub(r'\n{3,}', '\n\n', html).strip() + '\n' + script + '\n'
open(dst, 'w', encoding='utf-8').write(html)
print(f'wrote {dst} ({len(html)} bytes)')
