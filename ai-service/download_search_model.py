"""Explicitly install a pinned MiniLM snapshot; requests never download files."""
import json
from pathlib import Path
import urllib.request
from word_search import MODEL_ID, MODEL_REVISION, MODEL_PATH

FILES = ['config.json', 'config_sentence_transformers.json', 'sentence_bert_config.json',
         'modules.json', '1_Pooling/config.json', 'tokenizer.json', 'tokenizer_config.json',
         'special_tokens_map.json', 'vocab.txt', 'model.safetensors', 'README.md']


def download():
    from huggingface_hub import snapshot_download
    MODEL_PATH.mkdir(parents=True, exist_ok=True)
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, local_dir=MODEL_PATH, allow_patterns=FILES)
    # The model card declares Apache-2.0; retain it and the full license alongside the weights.
    license_path = MODEL_PATH / 'LICENSE'
    if not license_path.exists():
        with urllib.request.urlopen('https://www.apache.org/licenses/LICENSE-2.0.txt', timeout=30) as response:
            license_path.write_bytes(response.read())
    (MODEL_PATH / 'installation.json').write_text(json.dumps(dict(model=MODEL_ID, revision=MODEL_REVISION), indent=2), encoding='utf-8')
    print('Installed local semantic search:', MODEL_PATH)
    print('Model revision:', MODEL_REVISION)


if __name__ == '__main__':
    download()
