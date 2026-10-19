"""Return a full-resolution semantic mask as PNG on stdout.

Input image bytes arrive on stdin. Runtime dependencies and model live in
.pixelpilot_runtime at the extension root; this script never downloads files.
"""
import io
import sys
from pathlib import Path

runtime_dir = Path(__file__).resolve().parent.parent / ".pixelpilot_runtime"
sys.path.insert(0, str(runtime_dir))

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

CLASS_INDEX = {"hair": 1, "clothes": 4, "background": 0, "object": 5}


def main() -> None:
    subject = sys.argv[1]
    if subject not in CLASS_INDEX:
        raise ValueError(f"Unsupported subject: {subject}")
    model_path = runtime_dir / "selfie_multiclass.onnx"
    if not model_path.is_file():
        raise FileNotFoundError(f"Recolor model missing: {model_path}")

    image = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB")
    sample = np.asarray(image.resize((256, 256), Image.Resampling.BILINEAR), dtype=np.float32)[None] / 255.0
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    logits = session.run(None, {"input_29": sample})[0][0]
    labels = logits.argmax(axis=-1)
    mask = (labels == CLASS_INDEX[subject]).astype(np.uint8) * 255
    target = Image.fromarray(mask, mode="L").resize(image.size, Image.Resampling.BILINEAR)
    target = target.filter(ImageFilter.GaussianBlur(radius=1.2))
    skin = np.isin(labels, [2, 3]).astype(np.uint8) * 255
    skin_protection = Image.fromarray(skin, mode="L").filter(ImageFilter.MaxFilter(9))
    skin_protection = skin_protection.resize(image.size, Image.Resampling.BILINEAR)
    skin_protection = skin_protection.filter(ImageFilter.GaussianBlur(radius=5))
    output = Image.merge("RGB", (target, skin_protection, Image.new("L", image.size, 0)))
    output.save(sys.stdout.buffer, format="PNG")


if __name__ == "__main__":
    main()
