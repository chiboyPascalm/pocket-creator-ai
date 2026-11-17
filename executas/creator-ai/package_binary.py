import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
META = json.loads((ROOT / "executa.json").read_text(encoding="utf-8"))
TOOL_ID = META["tool_id"]
VERSION = META["version"]

system = platform.system().lower()
machine = platform.machine().lower()

if system == "darwin" and machine in ("arm64", "aarch64"):
    target = "darwin-arm64"
elif system == "darwin" and machine in ("x86_64", "amd64"):
    target = "darwin-x86_64"
elif system == "linux" and machine in ("x86_64", "amd64"):
    target = "linux-x86_64"
elif system == "windows" and machine in ("amd64", "x86_64"):
    target = "windows-x86_64"
else:
    raise SystemExit(f"Unsupported build host: {system}-{machine}")

is_windows = target == "windows-x86_64"
binary_name = TOOL_ID + (".exe" if is_windows else "")
entrypoint = f"bin/{binary_name}"
output_dir = ROOT / "dist-anna" / VERSION
output_dir.mkdir(parents=True, exist_ok=True)
archive_name = f"{TOOL_ID}-{VERSION}-{target}"
archive = output_dir / (archive_name + (".zip" if is_windows else ".tar.gz"))

with tempfile.TemporaryDirectory(prefix="creator-ai-build-") as temp:
    tempdir = Path(temp)
    pyinstaller_dist = tempdir / "dist"
    pyinstaller_work = tempdir / "work"
    spec_dir = tempdir / "spec"

    print(f"Building {TOOL_ID} for {target}", flush=True)
    subprocess.run([
        sys.executable, "-m", "PyInstaller",
        "--onefile", "--clean", "--noupx",
        "--name", TOOL_ID,
        "--distpath", str(pyinstaller_dist),
        "--workpath", str(pyinstaller_work),
        "--specpath", str(spec_dir),
        str(ROOT / "creator_ai_plugin.py")
    ], cwd=ROOT, check=True)

    binary = pyinstaller_dist / binary_name
    if not binary.is_file():
        raise SystemExit(f"PyInstaller did not create {binary}")

    # Test multiple JSON-RPC requests in one process and clean EOF.
    requests = [
        {"jsonrpc": "2.0", "id": 101, "method": "describe", "params": {}},
        {"jsonrpc": "2.0", "id": 102, "method": "describe", "params": {}},
        {"jsonrpc": "2.0", "id": 103, "method": "health", "params": {}},
    ]
    request_text = "".join(json.dumps(item) + "\n" for item in requests)
    result = subprocess.run(
        [str(binary)], input=request_text, text=True,
        capture_output=True, timeout=30
    )
    if result.returncode != 0:
        raise SystemExit(
            "Packaged executable exited unsuccessfully.\n"
            f"Exit: {result.returncode}\n"
            f"stdout: {result.stdout[-2000:]}\n"
            f"stderr: {result.stderr[-2000:]}"
        )

    lines = result.stdout.splitlines()
    if len(lines) != len(requests):
        raise SystemExit(
            f"Expected 3 response lines, got {len(lines)}: "
            f"{result.stdout[-2000:]}"
        )

    responses = []
    for index, line in enumerate(lines):
        try:
            response = json.loads(line)
        except Exception as exc:
            raise SystemExit(
                f"Response {index + 1} is invalid JSON: {line!r}"
            ) from exc

        if response.get("jsonrpc") != "2.0":
            raise SystemExit(f"Response {index + 1}: invalid JSON-RPC version.")
        if response.get("id") != requests[index]["id"]:
            raise SystemExit(f"Response {index + 1}: request ID mismatch.")
        if "error" in response or "result" not in response:
            raise SystemExit(f"Response {index + 1}: invalid RPC result.")
        responses.append(response["result"])

    for index in (0, 1):
        manifest = responses[index]
        if not isinstance(manifest, dict):
            raise SystemExit("describe did not return a manifest object.")
        if manifest.get("name") != TOOL_ID:
            raise SystemExit("describe returned an incorrect tool ID.")
        if manifest.get("version") != VERSION:
            raise SystemExit(
                f"describe version {manifest.get('version')!r} "
                f"does not match {VERSION!r}."
            )
        if not isinstance(manifest.get("tools"), list):
            raise SystemExit("describe manifest has no tools list.")
        tool_names = {item.get("name") for item in manifest["tools"]}
        if not {"generate", "ping"}.issubset(tool_names):
            raise SystemExit("describe manifest is missing generate or ping.")

    if responses[0] != responses[1]:
        raise SystemExit("Repeated describe responses differ.")
    if responses[2] != {"status": "ready"}:
        raise SystemExit("health returned an unexpected response.")

    print("Packaged executable JSON-RPC lifecycle test passed.", flush=True)

    stage = tempdir / "package"
    (stage / "bin").mkdir(parents=True)
    shutil.copy2(binary, stage / entrypoint)
    manifest = {
        "name": TOOL_ID,
        "display_name": json.loads((ROOT / "manifest.json").read_text(encoding="utf-8")).get("display_name", META.get("name", "Pocket Creator AI")),
        "version": VERSION,
        "description": META.get("description", ""),
        "runtime": {
            "binary": {
                "entrypoint": {"default": entrypoint},
                "permissions": {entrypoint: "0o755"}
            }
        }
    }
    (stage / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    if is_windows:
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(stage / entrypoint, entrypoint)
            z.write(stage / "manifest.json", "manifest.json")
    else:
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(stage / entrypoint, arcname=entrypoint)
            tar.add(stage / "manifest.json", arcname="manifest.json")

print(f"Created: {archive}")
print(f"Bytes: {archive.stat().st_size}")
