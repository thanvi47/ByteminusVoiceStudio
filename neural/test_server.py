import unittest
from fastapi.testclient import TestClient
from neural.server import app, script_parts


class ProtocolTests(unittest.TestCase):
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
