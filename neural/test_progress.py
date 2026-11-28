import unittest
from types import SimpleNamespace
import torch
from neural.parler_worker import synthesize

class Tokenizer:
    def __call__(self, *args, **kwargs):
        return SimpleNamespace(input_ids=torch.ones((1, 2), dtype=torch.long), attention_mask=torch.ones((1, 2), dtype=torch.long))

class TinyModel(torch.nn.Module):
    def __init__(self, fail=False):
        super().__init__()
        self.decoder = torch.nn.Linear(1, 1)
        self.config = SimpleNamespace(sampling_rate=24000)
        self.audio_encoder = SimpleNamespace(config=SimpleNamespace(frame_rate=50))
        self.fail = fail
    def generate(self, **kwargs):
        for _ in range(32): self.decoder(torch.ones(1, 1))
        if self.fail: raise RuntimeError("test failure")
        return torch.zeros(1, 2400)

class ProgressTests(unittest.TestCase):
    def test_live_steps_preserve_pcm_and_remove_hook(self):
        data = dict(text="Hello world.", voice="parler:Jon", emotion="Neutral", intensity=0, rate=1, pitch=1)
        model = TinyModel()
        events = []
        actual = synthesize(data, model, Tokenizer(), on_progress=events.append)
        self.assertEqual(actual, synthesize(data, model, Tokenizer()))
        self.assertEqual([e["steps"] for e in events if e.get("steps", 0)], [1, 16, 32])
        self.assertEqual(events[-1]["completed"], 1)
        self.assertEqual(len(model.decoder._forward_hooks), 0)
        failing = TinyModel(fail=True)
        with self.assertRaisesRegex(RuntimeError, "test failure"):
            synthesize(data, failing, Tokenizer(), on_progress=events.append)
        self.assertEqual(len(failing.decoder._forward_hooks), 0)

if __name__ == "__main__": unittest.main()
