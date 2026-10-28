"""Install the optional author's small U2NETP salient-object checkpoint."""
import hashlib
from pathlib import Path
import urllib.request

URL = 'https://drive.google.com/uc?export=download&id=1rbSTGKAE-MTxBYHd-51l2hMOQPT_7EPy'
SHA256 = 'e7567cde013fb64813973ce6e1ecc25a80c05c3ca7adbc5a54f3c3d90991b854'


def download():
    target = Path(__file__).resolve().parent / 'checkpoints' / 'u2netp.pth'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == SHA256:
        print('Subject checkpoint already installed and verified:', target)
        return
    temporary = target.with_suffix('.download')
    with urllib.request.urlopen(URL, timeout=60) as response, temporary.open('wb') as output:
        while block := response.read(1024 * 1024):
            output.write(block)
    digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
    if temporary.stat().st_size < 4_000_000 or digest != SHA256:
        raise RuntimeError('Subject checkpoint checksum/size mismatch; not installed.')
    temporary.replace(target)
    print('SHA256:', digest)
    print('Installed:', target)


if __name__ == '__main__':
    download()
