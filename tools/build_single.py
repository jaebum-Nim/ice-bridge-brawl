#!/usr/bin/env python3
"""더블클릭으로 바로 열리는 단일 HTML(play.html)을 만듭니다.

브라우저는 file:// 로 연 페이지에서 다른 .js 모듈 파일을 불러오지 못하므로,
모든 모듈을 data: URL로 바꿔 import map에 넣고 상대 경로 import를 이름으로 바꿉니다.
사용법: python3 tools/build_single.py
"""
import base64, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

# 모듈 이름 → (파일 경로, {상대 import → 모듈 이름})
mods = {
    'three/core': ('vendor/three/three.core.js', {}),
    'three': ('vendor/three/three.module.js', {'./three.core.js': 'three/core'}),
}
for f in os.listdir(os.path.join(ROOT, 'js')):
    if f.endswith('.js'):
        mods['app/' + f] = ('js/' + f, {})

IMPORT_RE = re.compile(r"""(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}/[^'"]+)\2""")

def resolve(name, rel):
    base = name.rsplit('/', 1)[0] if '/' in name else ''
    parts = (base.split('/') if base else []) + rel.split('/')
    out = []
    for p in parts:
        if p == '.':
            continue
        if p == '..':
            out.pop()
        else:
            out.append(p)
    return '/'.join(out)

imap = {}
for name, (path, fixed) in mods.items():
    src = read(path)
    def sub(m):
        rel = m.group(3)
        target = fixed.get(rel) or resolve(name, rel)
        if target not in mods:
            raise SystemExit(f'{path}: 알 수 없는 import {rel} -> {target}')
        return f"{m.group(1)}'{target}'"
    src = IMPORT_RE.sub(sub, src)
    imap[name] = 'data:text/javascript;base64,' + base64.b64encode(src.encode('utf-8')).decode()

import json
css = read('css/style.css')
html = read('index.html')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
html = re.sub(r'<script type="importmap">.*?</script>', lambda m: '<script type="importmap">' + json.dumps({'imports': imap}) + '</script>', html, flags=re.S)
# file:// 안내 문구 제거 (이 파일은 더블클릭용)
html = re.sub(r"<script>\s*// 파일을 더블클릭.*?</script>\n", '', html, flags=re.S)
html = html.replace("import './js/main.js';", "import 'app/main.js';")
html = html.replace('<title>얼음 다리 난투</title>', '<title>얼음 다리 난투</title>\n<!-- 자동 생성 파일: tools/build_single.py 로 만듦. 직접 고치지 마세요. -->')
out = os.path.join(ROOT, 'play.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'play.html 생성 완료 ({os.path.getsize(out) / 1024 / 1024:.1f} MB, 모듈 {len(mods)}개)')
