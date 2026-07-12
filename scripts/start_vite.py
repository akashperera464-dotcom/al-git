"""
Start the Verda ERP Vite dev server as a fully-detached daemon.
Uses start_new_session=True so the child survives parent-shell exit.
"""
import subprocess, os, time, sys

LOG = '/home/z/my-project/logs/vite-dev.log'
CWD = '/home/z/my-project/verda-erp'

log = open(LOG, 'ab', buffering=0)
devnull = open('/dev/null', 'rb')

p = subprocess.Popen(
    ['npm', 'run', 'dev', '--', '--host', '0.0.0.0', '--port', '3000', '--strictPort'],
    cwd=CWD,
    stdin=devnull,
    stdout=log,
    stderr=log,
    start_new_session=True,   # detach from controlling terminal
    close_fds=True,
    env={**os.environ, 'NO_COLOR': '1'},
)
print(f"spawned pid={p.pid}", flush=True)
time.sleep(6)
rc = p.poll()
print(f"after 6s, poll={rc} (None means still running)", flush=True)
