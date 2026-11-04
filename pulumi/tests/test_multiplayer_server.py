import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from multiplayer_server import MAX_USER_DATA_BYTES, build_user_data, server_files

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
ORIGIN = "https://escape-from-floripa.negoci.online"


class UserDataTest(unittest.TestCase):
    def setUp(self):
        self.script = build_user_data(SERVER_DIR, ORIGIN)

    def test_cabe_no_limite_da_aws_e_tem_sintaxe_valida(self):
        self.assertLess(len(self.script.encode()), MAX_USER_DATA_BYTES)
        subprocess.run(["bash", "-n"], input=self.script.encode(), check=True)

    def test_limita_a_origem_ao_site(self):
        self.assertIn(f"Environment=ALLOWED_ORIGIN={ORIGIN}\n", self.script)

    def test_grava_cada_arquivo_do_servidor_sem_alterar_o_conteudo(self):
        start = self.script.index("cd /opt/escape-server\n") + len("cd /opt/escape-server\n")
        writes = self.script[start:self.script.index("PATH=/opt/node/bin")]
        with tempfile.TemporaryDirectory() as target:
            subprocess.run(["bash", "-e"], input=writes.encode(), cwd=target, check=True)
            for file in server_files(SERVER_DIR):
                written = Path(target, file.relative_to(SERVER_DIR)).read_text(encoding="utf-8")
                self.assertEqual(written, file.read_text(encoding="utf-8") + "\n")


if __name__ == "__main__":
    unittest.main()
