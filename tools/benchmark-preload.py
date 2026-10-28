"""Measure startup preloading and the first real search, without touching port 8765."""
import argparse
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'ai-service'))
from word_search import WordSearch, bundled_words

parser = argparse.ArgumentParser()
parser.add_argument('--label', default='startup')
args = parser.parse_args()
search = WordSearch()
started = time.perf_counter()
thread = search.start_preload(notify=print)
if thread is None:
    raise RuntimeError(search.health()['error'])
thread.join(timeout=90)
if thread.is_alive() or not search.health()['ready']:
    raise RuntimeError(search.health())
startup_ms = round((time.perf_counter()-started)*1000, 1)
bank = [word for word in bundled_words() if len(word) == 5]
started = time.perf_counter()
result = search.search('food', bank)
first_ms = round((time.perf_counter()-started)*1000, 1)
assert result['encodedWords'] == 0
assert sorted(m['word'] for m in result['matches']) == sorted(bank)
report = dict(startupMs=startup_ms, firstSearchMs=first_ms, firstSearchEncodedWords=result['encodedWords'],
              candidates=len(bank), health=search.health(), cacheBytes=search.cache_path.stat().st_size,
              top=sorted(result['matches'], key=lambda m:-m['score'])[:10])
target = ROOT / 'screenshots' / 'validation-2.2.25' / ('preload-'+args.label+'.json')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
