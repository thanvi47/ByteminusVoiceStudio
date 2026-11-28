import json
from pathlib import Path
import sys
import tempfile
import unittest
from neural.isolated_runtime import PersistentWorker


FIXTURE = '''import sys,json,os,time
for line in sys.stdin.buffer:
    request=json.loads(line)
    if request['input'].get('slow'): time.sleep(10)
    size=999999999 if request['input'].get('oversize') else 4
    header=dict(ok=True,size=size,runtime=dict(pid=os.getpid(),voice=request['input'].get('voice')))
    sys.stdout.buffer.write(json.dumps(header).encode()+b'\\n'+b'1234')
    sys.stdout.buffer.flush()
'''


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.script = Path(self.folder.name) / "worker.py"
        self.script.write_text(FIXTURE, encoding="utf-8")
        self.worker = PersistentWorker(sys.executable, self.script, cwd=self.folder.name)

    def tearDown(self):
        self.worker.close()
        self.folder.cleanup()

    def test_two_requests_reuse_process_and_preserve_selected_voice(self):
        audio, first = self.worker.request({"voice": "first"})
        other, second = self.worker.request({"voice": "second"})
        self.assertEqual(audio, b"1234")
        self.assertEqual(other, audio)
        self.assertEqual(first["pid"], second["pid"])
        self.assertEqual(second["voice"], "second")

    def test_oversized_frame_is_rejected_before_allocation(self):
        with self.assertRaisesRegex(RuntimeError, "response size"):
            self.worker.request({"oversize": True})
        self.assertIsNone(self.worker.process)

    def test_deadline_stops_worker_and_next_request_can_restart(self):
        import subprocess
        with self.assertRaises(subprocess.TimeoutExpired):
            self.worker.request({"slow": True}, timeout=0.1)
        self.assertIsNone(self.worker.process)
        self.assertEqual(self.worker.request({})[0], b"1234")


if __name__ == "__main__": unittest.main()
