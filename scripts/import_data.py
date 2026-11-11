"""Import only the two CSVs. Private text never enters the public tree."""
import csv
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:\Users\勝一郎\Documents\workspace\占い\易\易経大講座全巻')
POSITIONS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
TRIGRAMS = {'天': '111', '沢': '110', '火': '101', '雷': '100', '風': '011', '水': '010', '山': '001', '地': '000'}
def normalize(s):
    return s.translate(str.maketrans({'澤': '沢', '随': '隨', '豫': '予'}))

gua = list(csv.DictReader((SOURCE / '卦辞.csv').open(encoding='utf-8-sig', newline='')))
lines = list(csv.DictReader((SOURCE / '爻辞.csv').open(encoding='utf-8-sig', newline='')))
senko_text = (SOURCE.parent / '易学大講座_占考384爻.md').read_text(encoding='utf-8-sig')
senko = {}
for match in re.finditer(r'(?ms)^##\s+(\d{2})-([1-6])　[^\n]*\n.*?^### 占考\s*\n(.*?)(?=^##\s+|\Z)', senko_text):
    key = (int(match.group(1)), int(match.group(2)))
    assert key not in senko, f'duplicate senko: {key}'
    body = match.group(3).strip()
    source_match = re.search(r'(?m)^（出典：(.+?)）\s*$', body)
    source = source_match.group(1) if source_match else ''
    body = re.sub(r'(?m)\n（出典：.*?）\s*$', '', body).strip()
    assert body, f'empty senko: {key}'
    senko[key] = (body, source)
assert len(senko) == 384, f'expected 384 senko, got {len(senko)}'
unique = {}
for row in gua:
    name = row['卦名']
    assert name not in unique or unique[name] == row['卦辞'], f'Conflicting duplicate: {name}'
    unique[name] = row['卦辞']
assert len(unique) == 64 and len(lines) == 384
catalog = []
data = []
for index, (name, text) in enumerate(unique.items(), 1):
    if '為' in name:
        upper = lower = name[-1]
    else:
        upper, lower = name[:2]
    bits = TRIGRAMS[lower] + TRIGRAMS[upper] # Bottom to top
    catalog.append({'id': index, 'name': name, 'upper': upper, 'lower': lower, 'bits': bits})
    selected = [r for r in lines if r['卦名'] == name]
    assert len(selected) == 6 and {r['爻'] for r in selected} == set(POSITIONS)
    entries = []
    for position, label in enumerate(POSITIONS, 1):
        row = next(r for r in selected if r['爻'] == label)
        match = re.fullmatch(r'(.+?)(初|二|三|四|五|上)爻', row['伏卦'])
        assert match, row['伏卦']
        hidden_name = normalize(match[1])
        target = next((i for i, n in enumerate(unique, 1) if normalize(n) == hidden_name), None)
        assert target, hidden_name
        hidden_position = POSITIONS.index(match[2] + '爻') + 1
        body, source = senko[(index, position)]
        entries.append({'position': position, 'label': label, 'text': row['爻辞'], 'meaning': row['意味'], 'hiddenId': target, 'hiddenPosition': hidden_position, 'senko': body, 'source': source})
    data.append({'id': index, 'name': name, 'judgment': text, 'lines': entries})
(ROOT / 'public').mkdir(exist_ok=True)
(ROOT / '.private').mkdir(exist_ok=True)
(ROOT / 'public' / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / '.private' / 'data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Validated: {len(gua)} judgments -> {len(data)} unique hexagrams; {sum(len(g["lines"]) for g in data)} lines; all hidden references resolved.')
