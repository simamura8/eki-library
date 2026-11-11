"""Convert the upstream MIT-licensed classical text into a simple keyed dataset."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
raw = (root / '.private' / 'xiangzhuan.js').read_text(encoding='utf-8-sig')
rows = re.findall(r"'([1-8]-[1-8])':\{[^\n]*?xx:\[(.*?)\],xxt:\[", raw)
result = {}
for key, contents in rows:
    values = re.findall(r"'([^']*)'", contents)
    assert key not in result and len(values) == 6, (key, len(values))
    result[key] = values
assert len(result) == 64, len(result)
(root / 'data').mkdir(exist_ok=True)
(root / 'data' / 'xiaoxiang.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Validated 64 hexagrams and 384 small-image passages.')
