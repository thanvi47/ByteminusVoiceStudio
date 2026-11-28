import unittest
from fastapi.testclient import TestClient
from neural.server import app, script_parts


class ProtocolTests(unittest.TestCase):
    def test_cpu_threads_use_multiple_cores_and_bound_overrides(self):
        from neural.cpu_runtime import cpu_threads
        from unittest.mock import patch
        with patch("neural.cpu_runtime.os.cpu_count", return_value=16):
            with patch.dict("os.environ", {}, clear=True):
                self.assertEqual(cpu_threads(), 8)
            with patch.dict("os.environ", {"BYTEMINUS_CPU_THREADS": "4"}):
                self.assertEqual(cpu_threads(), 4)
            with patch.dict("os.environ", {"BYTEMINUS_CPU_THREADS": "32"}):
                self.assertEqual(cpu_threads(), 16)
            with patch.dict("os.environ", {"BYTEMINUS_CPU_THREADS": "0"}):
                with self.assertRaises(ValueError):
                    cpu_threads()

    def test_zero_intensity_ignores_conflicting_emotional_direction(self):
        from neural.parler_worker import description
        prompt = description(dict(voice="indic:Aditi", emotion="Scared", intensity=0,
                                  style="Scream in terror with extreme fear"))
        self.assertIn("neutral", prompt)
        self.assertNotIn("terror", prompt)

    def test_low_intensity_restrains_excited_and_scared_vibes(self):
        from neural.parler_worker import description
        for emotion in ["Excited", "Scared"]:
            prompt = description(dict(voice="indic:Aditi", emotion=emotion, intensity=25,
                                      style="energetic performance"))
            self.assertIn("very subtle and restrained", prompt)
            self.assertIn("normal pitch range", prompt)
            self.assertNotIn("fast pacing", prompt)

    def test_targeted_english_emotions_have_distinct_unprocessed_directions(self):
        from neural.parler_worker import description, apply_controls
        import numpy as np
        base = {"voice": "parler:Jon", "intensity": 70, "style": ""}
        excited = description({**base, "emotion": "Excited"})
        scared = description({**base, "emotion": "Scared"})
        self.assertIn("speaking quickly", excited)
        self.assertIn("wide pitch range", excited)
        self.assertIn("frightened", scared)
        self.assertIn("hesitantly", scared)
        for prompt in [excited, scared]:
            self.assertNotIn("natural speaking rate", prompt)
            self.assertIn("no reverberation", prompt)
        audio = np.arange(20, dtype=np.float32)
        self.assertIs(apply_controls(audio, 1, 1), audio)

    def test_bengali_emotions_use_model_training_labels(self):
        from neural.parler_worker import description
        base = {"voice": "indic:Arjun", "intensity": 70, "style": ""}
        happy = description({**base, "emotion": "Excited"})
        fear = description({**base, "emotion": "Scared"})
        self.assertIn("happy and surprised", happy)
        self.assertIn("fearful", fear)
        self.assertNotIn("natural speaking rate", happy + fear)

    def test_numeric_expressive_speed_and_pitch_change_the_signal(self):
        import numpy as np
        from neural.parler_worker import apply_controls

        audio = np.sin(2 * np.pi * 120 * np.arange(24000) / 24000).astype(np.float32)
        self.assertEqual(len(apply_controls(audio, 0.8, 1)), 30000)
        raised = apply_controls(audio, 1, 1.25)
        self.assertEqual(len(raised), len(audio))
        frequency = np.fft.rfftfreq(len(raised), 1 / 24000)[
            np.argmax(np.abs(np.fft.rfft(raised)))
        ]
        self.assertAlmostEqual(frequency, 150, delta=3)

    def test_indic_prompt_and_description_tokenizers_are_separate(self):
        from types import SimpleNamespace
        from unittest.mock import Mock
        import torch
        from neural.parler_worker import synthesize

        encoded = SimpleNamespace(
            input_ids=torch.tensor([[1]]), attention_mask=torch.tensor([[1]])
        )
        prompt, description = Mock(return_value=encoded), Mock(return_value=encoded)
        model = SimpleNamespace(
            generate=Mock(return_value=torch.ones(1, 2400) * 0.1),
            config=SimpleNamespace(sampling_rate=24000),
            audio_encoder=SimpleNamespace(config=SimpleNamespace(frame_rate=50)),
        )
        data = {
            "voice": "indic:Arjun",
            "text": "আমি বাংলা বলি।",
            "emotion": "Happy",
            "intensity": 80,
            "rate": 1,
            "pitch": 1,
            "style": "",
        }
        self.assertEqual(len(synthesize(data, model, (prompt, description))), 4800)
        self.assertEqual(prompt.call_args.args[0], data["text"])
        self.assertIn("Arjun", description.call_args.args[0])
        self.assertIn("happy", description.call_args.args[0])

    def test_clone_stdin_preserves_bengali_on_windows(self):
        import json
        from neural.clone_worker import decode_request

        text = "আজ একটি নতুন দিন।"
        self.assertEqual(
            decode_request(
                json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
            )["text"],
            text,
        )

    def test_funny_style_direction(self):
        from neural.parler_worker import description

        text = description(
            {
                "voice": "parler:Jon",
                "emotion": "Funny",
                "intensity": 80,
                "rate": 1,
                "pitch": 1,
                "style": "",
            }
        )
        self.assertIn("playful", text)
        self.assertIn("comic delivery", text)

    def setUp(self):
        self.client = TestClient(app)

    def test_breaks_are_not_spoken(self):
        self.assertEqual(
            script_parts("Hello [pause 500ms] world [break 1.5s]"),
            ["Hello ", 0.5, " world ", 1.5, ""],
        )

    def test_invalid_breaks(self):
        for text in [
            "Hello [pause nope]",
            "Hello [break 11s]",
            "Hello [pause bad",
            "[pause 1s]",
        ]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                script_parts(text)

    def test_reject_browser_requests(self):
        self.assertEqual(
            self.client.get(
                "/health", headers={"Origin": "http://evil.example"}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                "/health", headers={"Sec-Fetch-Site": "cross-site"}
            ).status_code,
            403,
        )

    def test_reject_unknown_host(self):
        self.assertEqual(
            self.client.get("/health", headers={"Host": "evil.example"}).status_code,
            403,
        )

    def test_release_rejects_busy_generation_and_closes_idle_workers(self):
        from neural import server
        from unittest.mock import patch
        server.lock.acquire()
        try:
            self.assertEqual(self.client.post("/release").status_code, 409)
        finally:
            server.lock.release()
        with patch.object(server.DIRECTML_WORKER, "close") as directml, patch.object(server.EXPRESSIVE_WORKER, "close") as expressive:
            self.assertEqual(self.client.post("/release").json(), {"released": True})
            directml.assert_called_once()
            expressive.assert_called_once()

    def test_body_limits(self):
        self.assertEqual(
            self.client.post("/synthesize", content="x" * 20001).status_code, 413
        )

    def test_validate_neural_input(self):
        self.assertEqual(
            self.client.post(
                "/synthesize", json={"voice": "not-a-voice", "text": "Hello"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/synthesize",
                json={"voice": "mithi:charvi", "text": "Hello [break 99s]"},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/synthesize",
                json={"voice": "mithi:charvi", "text": "Hello", "rate": 0},
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                "/synthesize", json={"voice": "kokoro:af_heart", "text": "আমি বাংলা বলি।"}
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
