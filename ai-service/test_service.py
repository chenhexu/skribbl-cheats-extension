import base64
import io
from pathlib import Path
import unittest
from PIL import Image
from app import create_app, DEFAULT_CHECKPOINT


class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app(warm_search=False)
        cls.client = cls.app.test_client()

    def get(self, url):
        return self.client.get(url, base_url='http://127.0.0.1:8765')

    def post(self, data):
        return self.client.post('/api/lineart', json=data, base_url='http://127.0.0.1:8765')

    def test_health_and_static(self):
        self.assertEqual(self.get('/health').status_code, 200)
        for url in ['/', '/drawing-engine.js', '/dev-line-art/studio.html', '/studio-page.js']:
            with self.get(url) as response:
                self.assertEqual(response.status_code, 200, url)
        self.assertEqual(self.get('/ai-service/checkpoints/model.pth').status_code, 404)

    def test_origin_and_host(self):
        self.assertEqual(self.client.get('/health', base_url='http://attacker.example').status_code, 403)
        self.assertEqual(self.client.get('/health', base_url='http://127.0.0.1:8765', headers={'Origin':'https://example.com'}).status_code, 403)

    def test_missing_checkpoint(self):
        client = create_app(Path('does-not-exist.pth'), warm_search=False).test_client()
        self.assertFalse(client.get('/health', base_url='http://127.0.0.1:8765').json['ready'])
        self.assertEqual(client.post('/api/lineart',json={},base_url='http://127.0.0.1:8765').status_code,503)

    def test_subject_health_errors_and_alignment(self):
        health = self.get('/health').json['subject']
        if not health['ready']:
            self.skipTest('Install the optional subject checkpoint for inference test')
        image = Image.new('RGBA', (160, 120), (230, 230, 230, 255))
        from PIL import ImageDraw
        ImageDraw.Draw(image).ellipse((40, 30, 120, 100), fill='red')
        stream = io.BytesIO(); image.save(stream, format='PNG')
        data = {'image': 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()}
        response = self.client.post('/api/subject', json=data, base_url='http://127.0.0.1:8765')
        self.assertEqual(response.status_code, 200)
        output = Image.open(io.BytesIO(response.data))
        self.assertEqual(output.size, image.size)
        self.assertEqual(output.mode, 'L')
        self.assertGreater(output.getextrema()[1], 128)
        self.assertEqual(response.data, self.client.post('/api/subject', json=data, base_url='http://127.0.0.1:8765').data)
        self.assertEqual(self.client.post('/api/subject', json={'image': 42}, base_url='http://127.0.0.1:8765').status_code, 400)
        missing = create_app(subject_checkpoint=Path('no-subject.pth'), warm_search=False).test_client()
        self.assertFalse(missing.get('/health', base_url='http://127.0.0.1:8765').json['subject']['ready'])
        self.assertEqual(missing.post('/api/subject', json=data, base_url='http://127.0.0.1:8765').status_code, 503)

    def test_real_inference_and_errors(self):
        if not DEFAULT_CHECKPOINT.exists():
            self.skipTest('Install author checkpoint to run inference test')
        self.assertTrue(self.get('/health').json['ready'])
        self.assertEqual(self.post({'image':42}).status_code,400)
        self.assertEqual(self.post({'image':'data:image/png;base64,bad'}).status_code,400)
        image=Image.new('RGBA',(120,200),(230,30,30,255))
        stream=io.BytesIO();image.save(stream,format='PNG')
        data={'image':'data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode()}
        response=self.post(data)
        self.assertEqual(response.status_code,200)
        output=Image.open(io.BytesIO(response.data))
        self.assertEqual(output.size,image.size)
        self.assertEqual(output.mode,'L')
        self.assertEqual(response.data,self.post(data).data)


if __name__ == '__main__':
    unittest.main()
