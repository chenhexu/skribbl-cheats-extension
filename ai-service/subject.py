"""Optional CPU/CUDA U2NETP salient foreground inference, without training deps.

Architecture: xuebinqin/U-2-Net, Apache-2.0, see LICENSE.u2net.
Preprocessing follows the author's ImageNet normalization and 320px input.
"""
import io
import os
from pathlib import Path
import threading
from PIL import Image, ImageOps, ImageChops

DEFAULT_SUBJECT_CHECKPOINT = Path(__file__).resolve().parent / 'checkpoints' / 'u2netp.pth'


class SubjectInference:
    def __init__(self, checkpoint=DEFAULT_SUBJECT_CHECKPOINT):
        self.model = None
        self.error = None
        self.device = 'cpu'
        self.lock = threading.Lock()
        try:
            if not Path(checkpoint).is_file():
                raise FileNotFoundError('Subject checkpoint missing. Run python ai-service/download_subject_model.py, then restart the local service. Mark subject works without AI.')
            import torch
            from u2net import U2NETP
            self.torch = torch
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
            model = U2NETP(3, 1)
            model.load_state_dict(torch.load(checkpoint, map_location='cpu', weights_only=True), strict=True)
            self.model = model.to(self.device).eval()
        except Exception as error:
            self.error = str(error)

    def predict(self, image):
        torch = self.torch
        image = ImageOps.exif_transpose(image).convert('RGBA')
        canvas = Image.new('RGBA', image.size, 'white')
        canvas.alpha_composite(image)
        # Author-trained input is 320x320. Invert this transform once on output.
        small = canvas.convert('RGB').resize((320, 320), Image.Resampling.BILINEAR)
        tensor = torch.frombuffer(bytearray(small.tobytes()), dtype=torch.uint8).reshape(320, 320, 3).permute(2, 0, 1).float()
        tensor /= tensor.max().clamp(min=1)
        tensor = (tensor - torch.tensor([.485, .456, .406])[:, None, None]) / torch.tensor([.229, .224, .225])[:, None, None]
        with torch.inference_mode():
            mask = self.model(tensor.unsqueeze(0).to(self.device))[0][0, 0]
            mask = ((mask-mask.min())/(mask.max()-mask.min()).clamp(min=1e-6)).mul(255).byte().cpu()
        output = Image.frombytes('L', (320, 320), bytes(mask.flatten().tolist())).resize(image.size, Image.Resampling.BILINEAR)
        output = ImageChops.multiply(output, image.getchannel('A'))
        stream = io.BytesIO()
        output.save(stream, format='PNG')
        return stream.getvalue()
