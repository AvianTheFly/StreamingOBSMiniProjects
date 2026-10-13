"""Command-line client for the running Footage Desk's single analysis worker.

No catalogue/decoder ownership here; all work uses the app's public HTTP API.
"""
import argparse
import json
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener, ProxyHandler


class DeskClient:
    def __init__(self, port=8791):
        self.base = f'http://127.0.0.1:{port}'
        self.token = None
        self.opener = build_opener(ProxyHandler({}))

    def request(self, path, payload=None):
        headers = {}
        data = None
        if payload is not None:
            headers = {'Content-Type': 'application/json', 'X-Footage-Token': self.token or ''}
            data = json.dumps(payload).encode('utf-8')
        try:
            with self.opener.open(Request(self.base+path, data=data, headers=headers), timeout=30) as response:
                return json.load(response)
        except HTTPError as exc:
            try:
                message = json.load(exc).get('error', str(exc))
            except (ValueError, AttributeError):
                message = str(exc)
            raise RuntimeError(message) from exc
        except (URLError, TimeoutError) as exc:
            raise RuntimeError('Cannot reach Footage Desk. Open Run Footage Desk.bat first.') from exc

    def connect(self):
        health = self.request('/health')
        if health.get('app') != 'Footage Desk' or Path(health.get('source', '')).resolve() != Path(__file__).resolve().parent:
            raise RuntimeError('The port belongs to a different app or checkout. Open this checkout’s Footage Desk.')
        self.token = self.request('/api/library')['session']


def wait_for(client, ident, *, sleep=time.sleep, report=print):
    previous = None
    while True:
        job = next((j for j in client.request('/api/library')['jobs'] if j['id'] == ident), None)
        if job is None:
            raise RuntimeError('Job no longer available; check Footage Desk (the app may have restarted).')
        progress = (job['state'], job.get('progress', ''))
        if progress != previous:
            report(' · '.join(part for part in progress if part))
            previous = progress
        if job['state'] in ('error', 'cancelled'):
            raise RuntimeError(job.get('error') or job['state'])
        if job['state'] == 'done':
            result = job.get('result') or {}
            if result.get('errors'):
                raise RuntimeError('Some recordings failed: '+json.dumps(result['errors'], ensure_ascii=False))
            return result
        sleep(2)


def run(client, *, scan=False, ids=None, status=False, wait=False, report=print):
    client.connect()
    if scan and not status:
        report('Scanning saved recording folders…')
        wait_for(client, client.request('/api/scan', {})['job'], report=report)
    plan = client.request('/api/analysis-plan')
    eligible = set(plan['eligible_ids'])
    if ids and not set(ids).issubset(eligible):
        raise RuntimeError('Each --id must be an online, eligible recording at least 10 minutes long.')
    pending = [ident for ident in plan['pending_ids'] if not ids or ident in ids]
    report(f'{len(pending)} new / changed recordings to analyze. Files under 10 minutes are skipped.')
    if status or not pending:
        return None
    if plan['missing_dependencies']:
        raise RuntimeError('Install once: py -3.11 -m pip install -r footage_manager/requirements-analysis.txt')
    payload = {'ids': pending, 'only_new': True, 'sample_seconds': 60, 'audio': True, 'audio_track': 'auto'}
    ident = client.request('/api/analyze', payload)['job']
    report(f'Queued job {ident}. Review markers at {client.base}.')
    if wait:
        result = wait_for(client, ident, report=report)
        report(f"Finished {len(result.get('analyses', []))} recordings. Open a recording’s timeline to review.")
    return ident


def main(argv=None):
    parser = argparse.ArgumentParser(description='Find game boundaries and voice spikes locally in new footage. Open Footage Desk first.')
    parser.add_argument('--scan', action='store_true', help='Scan saved folders before queuing analysis')
    parser.add_argument('--wait', action='store_true', help='Show progress until finished')
    parser.add_argument('--status', action='store_true', help='Report pending count without scanning or starting work')
    parser.add_argument('--id', type=int, action='append', help='Limit to a library video ID (repeatable)')
    parser.add_argument('--port', type=int, default=8791)
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error('--port must be between 1 and 65535')
    try:
        run(DeskClient(args.port), scan=args.scan, ids=args.id, status=args.status, wait=args.wait)
        return 0
    except KeyboardInterrupt:
        print('Stopped waiting. Queued work continues in Footage Desk; use Cancel job there to stop it.', file=sys.stderr)
        return 130
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
