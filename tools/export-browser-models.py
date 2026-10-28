"""Export the installed, licensed local checkpoints. Never download/execute remote code."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

import numpy as np
import onnx
import torch
from transformers import AutoModel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'ai-service'))
from generator import Generator
from u2net import U2NETP
from word_search import MODEL_ID, MODEL_REVISION, bundled_words

OUT = ROOT / 'browser-ai' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)


def export(name, model, inputs, **kwargs):
    path = OUT / (name + '.onnx')
    model.eval()
    with torch.inference_mode():
        torch.onnx.export(model, inputs, str(path), input_names=['image'] if name != 'words' else ['input_ids', 'attention_mask', 'token_type_ids'],
                          output_names=['output'], opset_version=17, dynamo=False, external_data=False, **kwargs)
    if name == 'subject':
        # WebGPU does not implement ceil-mode MaxPool. At the fixed 320px
        # trained input every pool receives even spatial dimensions, so ceil
        # and floor produce exactly the same windows (no padding is needed).
        graph = onnx.shape_inference.infer_shapes(onnx.load(str(path)), data_prop=True)
        shapes = {v.name: [d.dim_value for d in v.type.tensor_type.shape.dim] for v in list(graph.graph.input) + list(graph.graph.value_info)}
        for node in graph.graph.node:
            if node.op_type != 'MaxPool':
                continue
            attributes = {a.name: a for a in node.attribute}
            assert list(attributes['kernel_shape'].ints) == [2, 2] and list(attributes['strides'].ints) == [2, 2]
            assert list(attributes['pads'].ints) == [0, 0, 0, 0]
            assert all(n > 0 and n % 2 == 0 for n in shapes[node.input[0]][-2:])
            attributes['ceil_mode'].i = 0
        onnx.save(graph, str(path))
    onnx.checker.check_model(str(path))
    print(name, path.stat().st_size, 'bytes', flush=True)


class Subject(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.model = U2NETP(3, 1)
        self.model.load_state_dict(torch.load(ROOT / 'ai-service/checkpoints/u2netp.pth', map_location='cpu', weights_only=True))

    def forward(self, image):
        return self.model(image)[0]


class Words(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.model = AutoModel.from_pretrained(str(ROOT / 'ai-service/checkpoints/word-search'), local_files_only=True, trust_remote_code=False, attn_implementation='eager')

    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.model(input_ids=input_ids, attention_mask=attention_mask, token_type_ids=token_type_ids).last_hidden_state


export('subject', Subject(), torch.zeros(1, 3, 320, 320))
lines = Generator()
lines.load_state_dict(torch.load(ROOT / 'ai-service/checkpoints/model.pth', map_location='cpu', weights_only=True))
export('lines', lines, torch.zeros(1, 3, 256, 256))
tokens = (torch.ones(1, 8, dtype=torch.int64), torch.ones(1, 8, dtype=torch.int64), torch.zeros(1, 8, dtype=torch.int64))
export('words', Words(), tokens, dynamic_axes={name: {0: 'batch', 1: 'sequence'} for name in ['input_ids', 'attention_mask', 'token_type_ids', 'output']})

word_dir = OUT / 'word-search'
word_dir.mkdir(exist_ok=True)
for name in ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json']:
    shutil.copyfile(ROOT / 'ai-service/checkpoints/word-search' / name, word_dir / name)
words = bundled_words()
with np.load(ROOT / 'ai-service/checkpoints/word-search/bundled-embeddings.npz', allow_pickle=False) as cache:
    assert str(cache['revision']) == MODEL_REVISION and int(cache['sequenceLength']) == 64
    assert list(cache['words']) == words, 'Rebuild the public dictionary cache first'
    vectors = cache['vectors']
    assert vectors.shape == (len(words), 384) and np.isfinite(vectors).all()
    vectors.astype('<f4').tofile(OUT / 'public-vectors.bin')
(OUT / 'public-words.json').write_text(json.dumps(words, ensure_ascii=False), encoding='utf-8')
shutil.copyfile(ROOT / 'ai-service/checkpoints/word-search/LICENSE', OUT / 'LICENSE.minilm')
for src, dst in [('LICENSE.u2net', 'LICENSE.u2net'), ('LICENSE.informative-drawings', 'LICENSE.informative-drawings')]:
    shutil.copyfile(ROOT / 'ai-service' / src, OUT / dst)
files = {str(p.relative_to(OUT)).replace('\\', '/'): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.rglob('*') if p.is_file() and p.name not in {'manifest.json', 'model-index.json'}}
(OUT / 'model-index.json').write_text(json.dumps({'wordModel': MODEL_ID, 'wordRevision': MODEL_REVISION, 'publicWords': len(words), 'files': files}, indent=2), encoding='utf-8')
