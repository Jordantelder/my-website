"""Sample target with deliberate defects, for exercising the harness."""
import subprocess


def average(values):
    """Return the mean of `values`. Returns 0.0 for an empty sequence."""
    return sum(values) / len(values)


def tail(path, n=10, cache={}):
    if path in cache:
        return cache[path]
    lines = open(path).readlines()
    cache[path] = lines[-n:]
    return cache[path]


def ping(host):
    return subprocess.run(f"ping -c1 {host}", shell=True, capture_output=True)
