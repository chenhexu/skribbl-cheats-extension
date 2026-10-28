"""Loopback-only inference and shared local Drawing Studio. Run: python app.py."""
import argparse
import base64
import hashlib
import io
import os
from pathlib import Path
import threading
from collections import OrderedDict

from flask import Flask, jsonify, request, send_file, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from subject import SubjectInference, DEFAULT_SUBJECT_CHECKPOINT
from word_search import WordSearch

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CHECKPOINT = ROOT / 'ai-service' / 'checkpoints' / 'model.pth'


class Inference:
    def __init__(self, checkpoint):
        self.model = None
        self.device = 'cpu'
        self.error = None
        self.lock = threading.Lock()
        self.cache = OrderedDict()
        try:
            if not Path(checkpoint).is_file():
                raise FileNotFoundError('Checkpoint missing. Run python ai-service/download_model.py, then restart the service.')
            import torch
            from generator import Generator
            self.torch = torch
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
            model = Generator()
            state = torch.load(checkpoint, map_location='cpu', weights_only=True)
            model.load_state_dict(state, strict=True)
            self.model = model.to(self.device).eval()
        except Exception as error:
            self.error = str(error)

    def predict(self, image):
        image = ImageOps.exif_transpose(image).convert('RGBA')
        background = Image.new('RGBA', image.size, 'white')
        background.alpha_composite(image)
        image = background.convert('RGB')
        # One transform for model input and inverse output: no crop/stretch drift.
        scale = min(256 / image.width, 256 / image.height)
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        small = image.resize(size, Image.Resampling.BICUBIC)
        left, top = (256-size[0])//2, (256-size[1])//2
        padded = Image.new('RGB', (256, 256), 'white')
        padded.paste(small, (left, top))
        tensor = self.torch.frombuffer(bytearray(padded.tobytes()), dtype=self.torch.uint8).reshape(256,256,3).permute(2,0,1).float().div(255).unsqueeze(0).to(self.device)
        with self.torch.inference_mode():
            result = self.model(tensor)[0,0].clamp(0,1).mul(255).byte().cpu()
        output = Image.frombytes('L', (256,256), bytes(result.flatten().tolist()))
        output = output.crop((left,top,left+size[0],top+size[1])).resize(image.size, Image.Resampling.BICUBIC)
        stream = io.BytesIO()
        output.save(stream, format='PNG')
        return stream.getvalue()


def create_app(checkpoint=DEFAULT_CHECKPOINT, subject_checkpoint=DEFAULT_SUBJECT_CHECKPOINT, *, warm_search=True):
    app = Flask(__name__, static_folder=None)
    app.config['MAX_CONTENT_LENGTH'] = 6 * 1024 * 1024
    inference = Inference(checkpoint)
    app.extensions['inference'] = inference
    subject = SubjectInference(subject_checkpoint)
    app.extensions['subject'] = subject
    word_search = WordSearch()
    app.extensions['word_search'] = word_search

    @app.before_request
    def local_only():
        # Block DNS rebinding and accidental non-loopback exposure.
        if request.host.split(':')[0] not in ('127.0.0.1', 'localhost'):
            return jsonify(error='Use http://127.0.0.1:8765'), 403
        origin = request.headers.get('Origin', '')
        if origin and not (origin == request.host_url.rstrip('/') or origin.startswith('chrome-extension://')):
            return jsonify(error='Origin not allowed'), 403

    @app.after_request
    def no_cache(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error='Request is larger than 6 MB'), 413

    @app.get('/health')
    def health():
        return jsonify(ready=inference.model is not None, device=inference.device, error=inference.error, model='informative-drawings', inputSize=256,
                       subject={'ready': subject.model is not None, 'device': subject.device, 'error': subject.error, 'model': 'u2netp', 'inputSize': 320},
                       wordSearch=word_search.health())

    @app.post('/api/word-search')
    def search_words():
        data = request.get_json(silent=True)
        if (not isinstance(data, dict) or not isinstance(data.get('query'), str)
                or not 1 <= len(data['query'].strip()) <= 128
                or not isinstance(data.get('candidates'), list) or len(data['candidates']) > 20000
                or any(not isinstance(word, str) or not 1 <= len(word) <= 128 for word in data['candidates'])):
            return jsonify(error='Expected query (1–128 characters) and up to 20000 candidate words (1–128 characters each)'), 400
        try:
            return jsonify(word_search.search(data['query'], data['candidates']))
        except (FileNotFoundError, RuntimeError, TimeoutError) as error:
            return jsonify(error=str(error)), 503
        except Exception as error:
            app.logger.exception('Word search failed')
            return jsonify(error='Word search failed: '+str(error)), 500

    @app.post('/api/lineart')
    @app.post('/api/subject')
    def lineart():
        selected = subject if request.path == '/api/subject' else inference
        if selected.model is None:
            return jsonify(error=selected.error or 'Model unavailable'), 503
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not isinstance(data.get('image'), str) or not data['image'].startswith('data:image/png;base64,'):
            return jsonify(error='Expected a PNG data URL in image'), 400
        try:
            binary = base64.b64decode(data['image'].split(',',1)[1], validate=True)
            image = Image.open(io.BytesIO(binary))
            if image.width < 1 or image.height < 1 or image.width*image.height > 1600*1200:
                return jsonify(error='Image dimensions exceed 1600x1200 pixels in area'), 400
            image.load()
        except (ValueError, UnidentifiedImageError, OSError, Image.DecompressionBombError):
            return jsonify(error='Invalid image data'), 400
        if not selected.lock.acquire(blocking=False):
            return jsonify(error='Local model is busy. Try again after the current image finishes.'), 503
        try:
            key = request.path + hashlib.sha256(binary).hexdigest()
            png = inference.cache.get(key)
            if png is None:
                png = selected.predict(image)
                inference.cache[key] = png
                if len(inference.cache) > 8:
                    inference.cache.popitem(last=False)
            else:
                inference.cache.move_to_end(key)
            return send_file(io.BytesIO(png), mimetype='image/png')
        except Exception as error:
            app.logger.exception('Inference failed')
            return jsonify(error='Inference failed: '+str(error)), 500
        finally:
            selected.lock.release()

    @app.get('/')
    def home():
        return send_from_directory(ROOT/'dev-line-art', 'studio.html')

    @app.get('/<path:name>')
    def assets(name):
        allowed = {'drawing-engine.js','drawer-studio.js','ai-setup.html','ai-setup.css','ai-setup.js','dev-line-art/studio.html','dev-line-art/studio.css','dev-line-art/studio-page.js','dev-line-art/index.html','dev-line-art/pipeline.js','dev-line-art/gcode.js','dev-line-art/legacy-viewer.js'}
        # Relative paths from / resolve here too.
        aliases = {name: 'dev-line-art/'+name for name in ('studio.css','studio-page.js','index.html','pipeline.js','gcode.js','legacy-viewer.js')}
        name = aliases.get(name,name)
        if name not in allowed:
            return jsonify(error='Not found'), 404
        return send_from_directory(ROOT, name)

    if warm_search:
        word_search.start_preload(notify=lambda message: print(message, flush=True))
    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--checkpoint', type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    application = create_app(args.checkpoint)
    print(f'Drawing Studio: http://127.0.0.1:{args.port}', flush=True)
    application.run(host='127.0.0.1', port=args.port, debug=False, threaded=True, use_reloader=False)
