import sys
sys.path.insert(0, '.pixelpilot_runtime')
import numpy as np
import onnxruntime as ort
from PIL import Image
im = Image.open('test_images/01_original/TC1.jpg').convert('RGB')
x = np.asarray(im.resize((256,256), Image.Resampling.BILINEAR), np.float32)[None] / 255
s = ort.InferenceSession('.pixelpilot_runtime/selfie_multiclass.onnx', providers=['CPUExecutionProvider'])
y = s.run(None, {'input_29':x})[0]
print('shape', y.shape, 'input', s.get_inputs()[0].shape, 'output', s.get_outputs()[0].shape)
labels = y[0].argmax(-1)
print('argmax counts', np.unique(labels, return_counts=True))
from scipy import ndimage
skin_labels, component_count = ndimage.label(np.isin(labels, [2,3]))
regions = []
for i in range(1, component_count+1):
    coords = np.argwhere(skin_labels == i)
    if len(coords) > 4:
        regions.append((len(coords), tuple(coords.min(axis=0)), tuple(coords.max(axis=0))))
print('skin components', sorted(regions, reverse=True)[:10])
for name, point in [('background',(30,40)),('hair',(200,100)),('skin',(290,300)),('dress',(330,590))]:
    px = (round(point[0]/im.width*256), round(point[1]/im.height*256))
    print(name, point, 'label', labels[px[1],px[0]], 'logits', y[0,px[1],px[0]].round(2))
Image.fromarray((labels*40).astype(np.uint8)).resize(im.size).save('.tmp_recolor_labels.png')
