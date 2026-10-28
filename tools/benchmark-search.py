"""Measure real CPU/CUDA model search, including cold load and a warmed dictionary."""
import json
from pathlib import Path
import statistics
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'ai-service'))
from word_search import WordSearch

text = (ROOT / 'content.js').read_text(encoding='utf-8')
words = json.loads(text.split('const BUNDLED_WORDS = ', 1)[1].split('];', 1)[0]+']')
search = WordSearch()
rows = []
for query, length in [('fish', 7), ('food', 5), ('music', 6), ('food', None), ('fo', None), ('foo', None), ('food', None)]:
    bank = [word for word in words if length is None or len(word) == length]
    started = time.perf_counter()
    result = search.search(query, bank)
    rows.append(dict(query=query, length=length, candidates=len(bank), wallMs=round((time.perf_counter()-started)*1000, 1),
                     encodedWords=result['encodedWords'], top=sorted(result['matches'], key=lambda m:-m['score'])[:10]))
warm = []
for _ in range(20):
    started = time.perf_counter();search.search('food', words);warm.append((time.perf_counter()-started)*1000)
report = dict(model=search.health(), dictionaryWords=len(words), runs=rows,
              warmFullBankMedianMs=round(statistics.median(warm),1), warmFullBankMaxMs=round(max(warm),1))
target = ROOT / 'screenshots' / 'validation-2.2.24' / 'search-model-benchmark.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='runs'}, indent=2))
for row in rows:
    print(row['query'], row['length'], row['candidates'], row['wallMs'], 'ms;', row['encodedWords'], 'new vectors')
print(target)
