import unittest
from unittest.mock import Mock, MagicMock, patch
from neural.hardware import runtime_profile
from neural.accelerated import execute


class HardwareTests(unittest.TestCase):
    def torch(self, available=False, free_gb=24):
        torch = Mock()
        torch.cuda.is_available.return_value = available
        torch.cuda.mem_get_info.return_value = (free_gb * 1024**3, 32 * 1024**3)
        torch.cuda.get_device_name.return_value = "NVIDIA GeForce RTX 5090"
        torch.version.hip = None
        torch.xpu.is_available.return_value = False
        torch.backends.mps.is_available.return_value = False
        torch.ones.return_value = MagicMock()
        torch.ones.return_value.__matmul__.return_value.sum.return_value.cpu.return_value.item.return_value = 64.0
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

    def test_rocm_uses_cuda_tensor_api_but_reports_amd_backend(self):
        torch = self.torch(True)
        torch.version.hip = "6.4"
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "rocm"}):
            profile = runtime_profile(torch)
        self.assertEqual((profile["backend"], profile["device"]), ("rocm", "cuda"))

    def test_intel_xpu_and_apple_mps_probe_the_actual_device(self):
        torch = self.torch()
        torch.xpu.is_available.return_value = True
        torch.xpu.get_device_properties.return_value.total_memory = 16 * 1024**3
        torch.xpu.mem_get_info.return_value = (12 * 1024**3, 16 * 1024**3)
        self.assertEqual(runtime_profile(torch, requested="xpu")["device"], "xpu")
        torch.backends.mps.is_available.return_value = True
        torch.mps.recommended_max_memory.return_value = 12 * 1024**3
        torch.mps.driver_allocated_memory.return_value = 0
        with patch("neural.hardware.sys.platform", "darwin"):
            self.assertEqual(runtime_profile(torch, requested="mps")["device"], "mps")

    def test_directml_is_probed_without_inventing_vram(self):
        dml = Mock()
        dml.device_count.return_value = 1
        dml.device.return_value = "privateuseone:0"
        dml.device_name.return_value = "Intel UHD\x00"
        with patch("neural.hardware.sys.platform", "win32"), patch("neural.hardware.importlib.import_module", return_value=dml):
            profile = runtime_profile(self.torch(), requested="directml")
        self.assertEqual(profile["backend"], "directml")
        self.assertEqual(profile["vramGB"], 0)
        self.assertEqual(profile["name"], "Intel UHD")

    def test_failed_speech_retries_same_operation_once_on_cpu(self):
        operation = Mock(side_effect=[RuntimeError("unsupported speech operator"), b"audio"])
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "auto"}):
            result, profile = execute(self.torch(), {"device": "xpu", "backend": "xpu"}, operation, engine="kokoro")
        self.assertEqual(result, b"audio")
        self.assertEqual(operation.call_count, 2)
        self.assertEqual(operation.call_args.args[0]["device"], "cpu")
        self.assertEqual(profile["attemptedBackend"], "xpu")
        self.assertIn("unsupported speech operator", profile["reason"])

    def test_forced_accelerator_does_not_hide_speech_failure(self):
        operation = Mock(side_effect=RuntimeError("unsupported"))
        with patch.dict("os.environ", {"BYTEMINUS_DEVICE": "xpu"}):
            with self.assertRaises(RuntimeError):
                execute(self.torch(), {"device": "xpu", "backend": "xpu"}, operation, engine="kokoro")
        self.assertEqual(operation.call_count, 1)


if __name__ == "__main__":
    unittest.main()
