"""Optional offline MiniLM inference. No model downloads during requests."""
from collections import OrderedDict
from pathlib import Path
import json
import os
import threading
import time
import unicodedata
import uuid
from zipfile import BadZipFile

MODEL_ID = 'sentence-transformers/all-MiniLM-L6-v2'
MODEL_REVISION = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41'
MODEL_PATH = Path(__file__).resolve().parent / 'checkpoints' / 'word-search'


def bundled_words():
    """Read only the public bundled bank; never execute content.js or read custom words."""
    source = (Path(__file__).resolve().parent.parent / 'content.js').read_text(encoding='utf-8')
    values = json.loads(source.split('const BUNDLED_WORDS = ', 1)[1].split('];', 1)[0]+']')
    if not isinstance(values, list) or len(values) > 20000 or any(not isinstance(w, str) or not 1 <= len(w) <= 128 for w in values):
        raise ValueError('Invalid bundled word bank')
    return list(dict.fromkeys(normalize(word) for word in values))


def normalize(value):
    return ' '.join(unicodedata.normalize('NFKC', value).lower().split())


class WordSearch:
    def __init__(self, path=MODEL_PATH, cache_path=None):
        self.path = Path(path)
        self.model = None
        self.error = None
        self.device = 'cpu'
        self.lock = threading.Lock()
        self.vectors = OrderedDict()
        self.queries = OrderedDict()
        self.cache_path = Path(cache_path) if cache_path is not None else self.path / 'bundled-embeddings.npz'
        self.preload_lock = threading.Lock()
        self.preload_thread = None
        self.preload_state = 'idle'
        self.preloaded_words = 0
        self.preload_total = 0
        self.preload_ms = None
        self.cache_hit = False
        self.cache_warning = None

    def health(self):
        installed = (self.path / 'model.safetensors').is_file()
        warming = self.preload_state in ('loading', 'encoding')
        return dict(ready=self.model is not None and not warming, installed=installed, lazy=self.preload_state == 'idle',
                    device=self.device, model=MODEL_ID, revision=MODEL_REVISION,
                    warming=warming, preloadState=self.preload_state, preloadedWords=self.preloaded_words,
                    totalWords=self.preload_total, preloadMs=self.preload_ms, cacheHit=self.cache_hit,
                    cacheWarning=self.cache_warning,
                    error=self.error or (None if installed else 'Word-search model missing. Run ai-service/start.ps1 -SearchSetup.'))

    def start_preload(self, words=None, notify=None):
        """One background warmup per service instance; the HTTP server remains responsive."""
        with self.preload_lock:
            if self.preload_thread is not None:
                return self.preload_thread
            if self.model is None and not (self.path / 'model.safetensors').is_file():
                self.preload_state = 'unavailable'
                return None
            self.preload_state = 'loading'
            self.preload_thread = threading.Thread(target=self._preload, args=(words, notify), name='word-search-preload', daemon=True)
            self.preload_thread.start()
            return self.preload_thread

    def _read_public_cache(self, words):
        import numpy as np
        try:
            with np.load(self.cache_path, allow_pickle=False) as cache:
                if (str(cache['revision']) != MODEL_REVISION or int(cache['sequenceLength']) != 64
                        or cache['words'].tolist() != words):
                    return None
                vectors = cache['vectors']
                if (vectors.shape != (len(words), 384) or vectors.dtype != np.float32
                        or not np.isfinite(vectors).all() or not np.allclose(np.linalg.norm(vectors, axis=1), 1, atol=.002)):
                    return None
                return vectors
        except (OSError, ValueError, KeyError, EOFError, BadZipFile):
            return None

    def _save_public_cache(self, words, vectors):
        import numpy as np
        temporary = self.cache_path.with_name('.'+self.cache_path.name+'.'+uuid.uuid4().hex+'.tmp')
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            with temporary.open('wb') as output:
                np.savez_compressed(output, revision=MODEL_REVISION, sequenceLength=64,
                                    words=np.asarray(words), vectors=np.asarray(vectors, dtype=np.float32))
            os.replace(temporary, self.cache_path)
        finally:
            temporary.unlink(missing_ok=True)

    def _preload(self, words, notify):
        started = time.perf_counter()
        try:
            words = list(dict.fromkeys(normalize(w) for w in (bundled_words() if words is None else words)))
            self.preload_total = len(words)
            if notify:
                notify('Word search: preloading the model and public dictionary in the background...')
            with self.lock:
                self._load()
            import numpy as np
            self.preload_state = 'encoding'
            vectors = self._read_public_cache(words)
            self.cache_hit = vectors is not None
            if vectors is not None:
                with self.lock:
                    for word, vector in zip(words, vectors):
                        self._remember(self.vectors, word, vector, 20000)
                self.preloaded_words = len(words)
            else:
                public_vectors = []
                for offset in range(0, len(words), 64):
                    batch = words[offset:offset+64]
                    with self.lock:
                        current, _missing = self._documents(batch)
                        public_vectors.extend(current[word] for word in batch)
                    self.preloaded_words = min(offset+64, len(words))
                    # Let an early interactive search acquire the model between small batches.
                    time.sleep(.001)
                vectors = np.stack(public_vectors) if public_vectors else np.empty((0, 384), dtype=np.float32)
            with self.lock:
                # Exercise the query path as well, before the first actual user query.
                self.model.encode_query('object', normalize_embeddings=True, show_progress_bar=False)
            if not self.cache_hit:
                try:
                    self._save_public_cache(words, vectors)
                except OSError as error:
                    self.cache_warning = 'Could not save public dictionary cache: '+str(error)
            self.preload_ms = round((time.perf_counter()-started)*1000, 1)
            self.preload_state = 'ready'
            self.error = None
            if notify:
                notify(f'Word search ready: {len(words)} public words preloaded in {self.preload_ms/1000:.1f}s; dictionary cache {"reused" if self.cache_hit else "built"}.')
        except Exception as error:
            self.error = str(error)
            self.preload_state = 'error'
            if notify:
                notify('Word search preload failed: '+str(error))

    def _load(self):
        if self.model is not None:
            return
        if not (self.path / 'model.safetensors').is_file():
            raise FileNotFoundError('Word-search model missing. Run ai-service/start.ps1 -SearchSetup, then retry.')
        try:
            import torch
            from sentence_transformers import SentenceTransformer
            torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            self.model = SentenceTransformer(str(self.path), device=self.device, local_files_only=True, trust_remote_code=False)
            self.model.max_seq_length = 64
            self.error = None
        except ImportError as error:
            raise RuntimeError('Word-search dependencies missing. Run ai-service/start.ps1 -SearchSetup.') from error

    @staticmethod
    def _remember(cache, key, value, limit):
        cache[key] = value
        cache.move_to_end(key)
        if len(cache) > limit:
            cache.popitem(last=False)

    def _documents(self, words):
        current = {word: self.vectors[word] for word in words if word in self.vectors}
        for word in current:
            self.vectors.move_to_end(word)
        missing = [word for word in words if word not in self.vectors]
        if missing:
            embeddings = self.model.encode_document(missing, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
            for word, vector in zip(missing, embeddings):
                current[word] = vector
                self._remember(self.vectors, word, vector, 20000)
        return current, len(missing)

    def search(self, query, candidates):
        started = time.perf_counter()
        # Separate lock from image models. Concurrent searches reuse embeddings and never grow an unbounded queue.
        if not self.lock.acquire(timeout=25):
            raise TimeoutError('Word-search model busy. Continue typing to retry.')
        try:
            self._load()
            import numpy as np
            q = normalize(query)
            words = list(dict.fromkeys(normalize(word) for word in candidates))
            current, encoded = self._documents(words)
            if q not in self.queries:
                vector = self.model.encode_query(q, normalize_embeddings=True, show_progress_bar=False)
                self._remember(self.queries, q, vector, 128)
            else:
                self.queries.move_to_end(q)
            values = np.stack([current[word] for word in words]) @ self.queries[q] if words else []
            scores = dict(zip(words, values))
            self.error = None
            return dict(matches=[dict(word=word, score=float(scores[normalize(word)])) for word in candidates],
                        model=MODEL_ID, processingMs=round((time.perf_counter()-started)*1000, 1), encodedWords=encoded)
        except Exception as error:
            self.error = str(error)
            raise
        finally:
            self.lock.release()
