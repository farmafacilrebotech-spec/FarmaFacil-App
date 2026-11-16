#!/usr/bin/env python3
"""Daemon detachado (double-fork) para mantener Next.js en :3070.

Causa tipica de caidas previas: el proceso next se lanzaba como hijo de un
shell de agente Cursor; al terminar el shell (SIGHUP / reap), next moria.
Este daemon se desacopla de la sesion y reinicia si el healthcheck falla.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "tmp"
LOG = LOG_DIR / "next-3070.log"
META = LOG_DIR / "next-3070.meta"
DAEMON_PID = LOG_DIR / "keepalive-daemon.pid"
PORT = 3070
HEALTH = f"http://127.0.0.1:{PORT}/login"
POLL = 20
# prod = next start (estable para E2E); dev = next dev
MODE = os.environ.get("FF_3070_MODE", "prod").strip().lower()


def log(msg: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    line = f"{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())} {msg}\n"
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line)


def write_meta(pid: int) -> None:
    branch = subprocess.getoutput(f"git -C {ROOT} branch --show-current")
    commit = subprocess.getoutput(f"git -C {ROOT} rev-parse HEAD")
    short = subprocess.getoutput(f"git -C {ROOT} rev-parse --short HEAD")
    META.write_text(
        "\n".join(
            [
                f"pid={pid}",
                f"cwd={ROOT}",
                f"branch={branch}",
                f"commit={commit}",
                f"short={short}",
                f"started_at={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
                f"daemon_pid={os.getpid()}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def listening_pids() -> list[int]:
    out = subprocess.getoutput(f"lsof -t -iTCP:{PORT} -sTCP:LISTEN")
    pids = []
    for part in out.split():
        try:
            pids.append(int(part))
        except ValueError:
            pass
    return pids


def health_ok() -> bool:
    try:
        r = subprocess.run(
            [
                "curl",
                "-s",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "--max-time",
                "5",
                HEALTH,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return r.stdout.strip() in {"200", "302", "307"}
    except Exception:
        return False


def kill_port() -> None:
    for pid in listening_pids():
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    time.sleep(1)
    for pid in listening_pids():
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def start_next() -> int:
    kill_port()
    log("starting next dev")
    env = os.environ.copy()
    env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:" + env.get("PATH", "")
    next_bin = str(ROOT / "node_modules/next/dist/bin/next")
    if MODE == "dev":
        cmd = [
            "node",
            "--env-file=.env.staging.local",
            next_bin,
            "dev",
            "-H",
            "0.0.0.0",
            "-p",
            str(PORT),
        ]
    else:
        # Producción local: evita ReadableStream closed / flakiness de server actions en dev
        if not (ROOT / ".next" / "BUILD_ID").exists():
            log("missing .next build — run npm run build first")
            return -1
        cmd = [
            "node",
            "--env-file=.env.staging.local",
            next_bin,
            "start",
            "-H",
            "0.0.0.0",
            "-p",
            str(PORT),
        ]
    log(f"mode={MODE} cmd={' '.join(cmd[-6:])}")
    with LOG.open("a", encoding="utf-8") as f:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT),
            env=env,
            stdout=f,
            stderr=f,
            start_new_session=True,  # new process group; ignore parent SIGHUP
        )
    write_meta(proc.pid)
    for _ in range(40):
        if listening_pids() and health_ok():
            log(f"next ready pid={proc.pid}")
            return proc.pid
        if proc.poll() is not None:
            log(f"next exited early code={proc.returncode}")
            break
        time.sleep(1)
    log("next start timeout/unhealthy")
    return proc.pid


def daemonize() -> None:
    if os.fork() > 0:
        sys.exit(0)
    os.setsid()
    if os.fork() > 0:
        sys.exit(0)
    sys.stdout.flush()
    sys.stderr.flush()
    with open("/dev/null", "rb", 0) as devnull:
        os.dup2(devnull.fileno(), sys.stdin.fileno())
    # keep logs on files only
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        os.dup2(f.fileno(), sys.stdout.fileno())
        os.dup2(f.fileno(), sys.stderr.fileno())


def already_running() -> bool:
    if not DAEMON_PID.exists():
        return False
    try:
        pid = int(DAEMON_PID.read_text().strip())
        os.kill(pid, 0)
        return True
    except Exception:
        return False


def main() -> None:
    if "--foreground" not in sys.argv:
        if already_running():
            print("daemon already running", file=sys.stderr)
            # still ensure server up
        else:
            daemonize()
            DAEMON_PID.write_text(str(os.getpid()) + "\n", encoding="utf-8")
            log(f"daemon started pid={os.getpid()}")

    # Ignore SIGHUP
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

    while True:
        if listening_pids() and health_ok():
            if not META.exists():
                pids = listening_pids()
                if pids:
                    write_meta(pids[0])
        else:
            log("unhealthy — restart")
            start_next()
        time.sleep(POLL)


if __name__ == "__main__":
    main()
