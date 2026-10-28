"""Fetch the author's public demo checkpoint; verify before installing locally."""
import hashlib
from pathlib import Path
import urllib.request

URL = 'https://huggingface.co/spaces/carolineec/informativedrawings/resolve/main/model.pth'
SHA256 = 'c686ced2a666b4850b4bb6ccf0748031c3eda9f822de73a34b8979970d90f0c6'


def download():
    target = Path(__file__).resolve().parent / 'checkpoints' / 'model.pth'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == SHA256:
        print('Checkpoint already installed and verified:', target)
        return
    print('Downloading the author\'s 17.2 MB checkpoint:', URL, flush=True)
    temporary = target.with_suffix('.download')
    with urllib.request.urlopen(URL, timeout=60) as response, temporary.open('wb') as output:
        while block := response.read(1024*1024):
            output.write(block)
    if hashlib.sha256(temporary.read_bytes()).hexdigest() != SHA256:
        raise RuntimeError('Checkpoint checksum mismatch; not installed. Remove model.download and retry.')
    temporary.replace(target)
    print('Verified SHA256:', SHA256)
    print('Installed:', target)


if __name__ == '__main__':
    download()
