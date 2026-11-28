"""Numerical regression checks for the unsupported-operator CPU boundaries."""
import copy
import unittest
import torch
from neural.directml_ops import decoder_to_directml, cpu_tensor_function


class TorchSTFT(torch.nn.Module):
    def transform(self, x):
        spectrum = torch.fft.rfft(x)
        return spectrum.abs(), spectrum.angle()

    def inverse(self, magnitude, phase):
        return torch.fft.irfft(torch.polar(magnitude, phase))


class Decoder(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.pool = torch.nn.ConvTranspose1d(4, 4, 3, stride=2, padding=1, output_padding=1, groups=4)
        self.stft = TorchSTFT()

    def forward(self, x):
        return self.stft.inverse(*self.stft.transform(self.pool(x)))


class BoundaryTests(unittest.TestCase):
    def test_mask_boundary_preserves_dtype_and_nested_tensor_values(self):
        def mask(x, *, value): return {"value": (x * value, None)}
        adapted = cpu_tensor_function(torch, mask, "cpu")
        output = adapted(torch.tensor([True, False]), value=torch.tensor(1025))
        self.assertEqual(output["value"][0].dtype, torch.int64)
        self.assertEqual(output["value"][0].tolist(), [1025, 0])
        self.assertIsNone(output["value"][1])

    def test_cpu_boundaries_preserve_real_fft_and_depthwise_audio_math(self):
        torch.manual_seed(42)
        original = Decoder().eval()
        adapted = copy.deepcopy(original)
        operators = decoder_to_directml(torch, adapted, "cpu")
        x = torch.randn(1, 4, 20)
        with torch.no_grad():
            torch.testing.assert_close(adapted(x), original(x), rtol=0, atol=0)
        self.assertEqual(operators, ["pool:depthwise-conv-transpose", "stft:fft"])


if __name__ == "__main__": unittest.main()
