import unittest
from unittest.mock import Mock, MagicMock, patch
from neural.hardware import runtime_profile


class HardwareTests(unittest.TestCase):
    def torch(self, available=False, free_gb=24):
        torch = Mock()
        torch.cuda.is_available.return_value = available
        torch.cuda.mem_get_info.return_value = (free_gb * 1024**3, 32 * 1024**3)
        torch.cuda.get_device_name.return_value = "NVIDIA GeForce RTX 5090"
        torch.ones.return_value = MagicMock()
        return torch

    def test_cpu_build_uses_threads_and_reports_cuda_requirement(self):
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "auto", "BYTEMINUS_CPU_THREADS": "8"}), patch("os.cpu_count", return_value=16):
            profile = runtime_profile(self.torch())
        self.assertEqual(profile["device"], "cpu")
        self.assertEqual(profile["batchCharacters"], 300)
        self.assertIn("CUDA", profile["reason"])

    def test_usable_gpu_receives_larger_budget(self):
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "auto"}):
            profile = runtime_profile(self.torch(True))
        self.assertEqual(profile["device"], "cuda")
        self.assertEqual(profile["batchCharacters"], 1200)
        self.assertEqual(profile["maxScriptCharacters"], 12000)

    def test_smaller_gpu_has_a_smaller_budget(self):
        torch = self.torch(True, 7)
        torch.cuda.mem_get_info.return_value = (7 * 1024**3, 8 * 1024**3)
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "auto"}):
            profile = runtime_profile(torch)
        self.assertEqual(profile["maxScriptCharacters"], 6000)
        self.assertEqual(profile["batchCharacters"], 600)

    def test_low_vram_and_incompatible_kernels_do_not_claim_gpu_inference(self):
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "auto"}):
            self.assertEqual(runtime_profile(self.torch(True, 2))["device"], "cpu")
            torch = self.torch(True)
            torch.ones.side_effect = RuntimeError("kernel incompatible")
            self.assertEqual(runtime_profile(torch)["device"], "cpu")

    def test_explicit_cuda_fails_clearly_instead_of_silently_using_cpu(self):
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "cuda"}):
            with self.assertRaises(RuntimeError):
                runtime_profile(self.torch())


if __name__ == "__main__":
    unittest.main()
