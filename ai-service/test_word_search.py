import unittest
from pathlib import Path
import tempfile
import threading
from unittest.mock import patch
import numpy as np
from app import create_app
from word_search import WordSearch, MODEL_PATH


class FakeModel:
    def __init__(self):
        self.documents = []
        self.queries = []

    def encode_document(self, words, **_kwargs):
        self.documents.extend(words)
        return np.stack([np.full(384, 1/np.sqrt(384), dtype=np.float32) for _word in words])

    def encode_query(self, word, **_kwargs):
        self.queries.append(word)
        return np.full(384, 1/np.sqrt(384), dtype=np.float32)


class PreloadTests(unittest.TestCase):
    def fake_search(self, path):
        search = WordSearch(path)
        search.model = FakeModel()
        return search

    def warm(self, search, words):
        thread = search.start_preload(words)
        thread.join(timeout=5)
        self.assertFalse(thread.is_alive())
        self.assertEqual(search.preload_state, 'ready', search.error)

    def test_cache_reused_on_restart_and_private_data_is_not_persisted(self):
        with tempfile.TemporaryDirectory() as directory:
            search = self.fake_search(directory)
            self.warm(search, ['fish', 'dolphin'])
            self.assertFalse(search.cache_hit)
            self.assertEqual(search.search('private query', ['private custom word'])['encodedWords'], 1)
            with np.load(search.cache_path, allow_pickle=False) as cache:
                self.assertEqual(cache['words'].tolist(), ['fish', 'dolphin'])
                self.assertEqual(set(cache.files), {'revision', 'sequenceLength', 'words', 'vectors'})
            restarted = self.fake_search(directory)
            self.warm(restarted, ['fish', 'dolphin'])
            self.assertTrue(restarted.cache_hit)
            self.assertEqual(restarted.model.documents, [])
            result = restarted.search('ocean', ['dolphin'])
            self.assertEqual(result['encodedWords'], 0)
            self.assertEqual([m['word'] for m in result['matches']], ['dolphin'])
            self.assertEqual(restarted.model.queries, ['object', 'ocean'])

    def test_changed_dictionary_corrupt_and_incompatible_caches_rebuild(self):
        with tempfile.TemporaryDirectory() as directory:
            first = self.fake_search(directory)
            self.warm(first, ['fish'])
            changed = self.fake_search(directory)
            self.warm(changed, ['fish', 'bread'])
            self.assertFalse(changed.cache_hit)
            self.assertEqual(changed.model.documents, ['fish', 'bread'])
            changed.cache_path.write_bytes(b'broken cache')
            corrupt = self.fake_search(directory)
            self.warm(corrupt, ['fish'])
            self.assertEqual(corrupt.model.documents, ['fish'])
            with np.load(corrupt.cache_path, allow_pickle=False) as cache:
                saved = {key: cache[key] for key in cache.files}
            saved['revision'] = 'old-model-version'
            np.savez_compressed(corrupt.cache_path, **saved)
            incompatible = self.fake_search(directory)
            self.warm(incompatible, ['fish'])
            self.assertFalse(incompatible.cache_hit)
            self.assertEqual(incompatible.model.documents, ['fish'])

    def test_preloading_is_nonblocking_starts_once_and_yields_between_batches(self):
        with tempfile.TemporaryDirectory() as directory:
            search = self.fake_search(directory)
            entered, release = threading.Event(), threading.Event()
            def blocked_load():
                entered.set()
                self.assertTrue(release.wait(timeout=5))
            search._load = blocked_load
            thread = search.start_preload(['fish'])
            try:
                self.assertTrue(entered.wait(timeout=3))
                self.assertTrue(thread.is_alive())
                self.assertTrue(search.health()['warming'])
                self.assertFalse(search.health()['ready'])
                self.assertIs(search.start_preload(['fish']), thread)
            finally:
                release.set()
                thread.join(timeout=5)
            self.assertTrue(search.health()['ready'])
            early = self.fake_search(Path(directory)/'early')
            searches = []
            def between_batches(_seconds):
                searches.append(early.search('early query', ['private custom word']))
            with patch('word_search.time.sleep', side_effect=between_batches):
                self.warm(early, ['public word '+str(i) for i in range(130)])
            self.assertEqual(len(searches), 3)
            with np.load(early.cache_path, allow_pickle=False) as cache:
                self.assertNotIn('private custom word', cache['words'].tolist())

    def test_cache_write_failure_does_not_disable_ready_search_and_model_errors_are_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            search = self.fake_search(directory)
            with patch.object(search, '_save_public_cache', side_effect=PermissionError('Read only')):
                self.warm(search, ['fish'])
            self.assertTrue(search.health()['ready'])
            self.assertIn('Read only', search.cache_warning)
            self.assertEqual(search.search('ocean', ['fish'])['encodedWords'], 0)
            failed = self.fake_search(Path(directory)/'failed')
            failed._load = lambda: (_ for _ in ()).throw(RuntimeError('Dependencies missing'))
            thread = failed.start_preload(['fish']);thread.join(timeout=5)
            self.assertEqual(failed.health()['preloadState'], 'error')
            self.assertIn('Dependencies missing', failed.health()['error'])
            missing = WordSearch(Path(directory)/'missing')
            self.assertIsNone(missing.start_preload())
            self.assertEqual(missing.health()['preloadState'], 'unavailable')

    def test_service_starts_preload_without_blocking_health_or_requiring_image_models(self):
        with patch('app.WordSearch') as cls:
            cls.return_value.health.return_value = {'ready': False, 'warming': True}
            app = create_app(checkpoint=Path('missing-lines.pth'), subject_checkpoint=Path('missing-subject.pth'))
            cls.return_value.start_preload.assert_called_once()
            response = app.test_client().get('/health', base_url='http://127.0.0.1:8765')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json['wordSearch']['warming'])
            self.assertFalse(response.json['ready'])


class WordSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app(warm_search=False)
        cls.client = cls.app.test_client()

    def post(self, data):
        return self.client.post('/api/word-search', json=data, base_url='http://127.0.0.1:8765')

    def test_validation_and_missing_model(self):
        for data in [{}, {'query': '', 'candidates': []}, {'query': 'food', 'candidates': 'bread'},
                     {'query': 'food', 'candidates': [42]}, {'query': 'x'*129, 'candidates': []}]:
            self.assertEqual(self.post(data).status_code, 400)
        search = self.app.extensions['word_search']
        saved_model = search.model
        search.model = None
        search.path = Path('missing-search-model')
        try:
            self.assertEqual(self.post({'query': 'food', 'candidates': ['bread']}).status_code, 503)
            health = self.client.get('/health', base_url='http://127.0.0.1:8765').json
            self.assertFalse(health['wordSearch']['installed'])
            self.assertIn('subject', health)
        finally:
            search.path = MODEL_PATH
            search.model = saved_model

    def test_actual_model_and_cached_candidates(self):
        if not (MODEL_PATH / 'model.safetensors').exists():
            self.skipTest('Install optional word-search model first')
        s = self.app.extensions['word_search']
        first = s.search('fish', ['dolphin', 'shark', 'chair', 'fishes'])
        scores = {m['word']: m['score'] for m in first['matches']}
        self.assertGreater(scores['dolphin'], scores['chair'])
        self.assertGreater(scores['shark'], scores['chair'])
        second = s.search('food', ['bread', 'pizza', 'plane'])
        scores = {m['word']: m['score'] for m in second['matches']}
        self.assertGreater(scores['bread'], scores['plane'])
        self.assertGreater(scores['pizza'], scores['plane'])
        cached = s.search('food', ['bread', 'pizza'])
        self.assertEqual(cached['encodedWords'], 0)
        self.assertEqual([m['word'] for m in cached['matches']], ['bread', 'pizza'])
        self.assertTrue(s.health()['ready'])

    def test_timeout_does_not_poison_other_models(self):
        search = self.app.extensions['word_search']
        class Busy:
            def acquire(self, **_kwargs): return False
        saved = search.lock
        search.lock = Busy()
        try:
            response = self.post({'query': 'food', 'candidates': ['bread']})
            self.assertEqual(response.status_code, 503)
            self.assertIn('busy', response.json['error'])
        finally:
            search.lock = saved


if __name__ == '__main__':
    unittest.main()
