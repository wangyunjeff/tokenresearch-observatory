#!/usr/bin/env python3
"""Import only public test artifacts; never publish prompts/system logs, tokens, or SSE.
Usage: python3 scripts/import_archive.py /path/to/test-results.zip
The compressed bundle retains each original HTML/answer byte-for-byte after UTF-8 decode.
"""
import argparse
import base64
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import zipfile


def read_json(z, name):
    return json.loads(z.read(name).decode('utf-8'))


def import_archive(path: Path, output: Path) -> None:
    with zipfile.ZipFile(path) as z:
        if any(i.file_size > 5_000_000 for i in z.infolist() if not i.is_dir()):
            raise ValueError('An input file exceeds the 5 MB import limit')
        grading = {int(x['trial']): x for x in read_json(z, 'grading.json')}
        candy, pelicans = [], []
        latest = 0.0
        for trial in sorted(grading):
            p = f'{trial:02d}'
            cr = read_json(z, f'candy/{p}/result.json')
            events = read_json(z, f'candy/{p}/events.json')
            # Read a timestamp only. Do not retain or publish model/system instructions.
            timestamp = next(x['response']['created_at'] for x in events if x.get('type') == 'response.created')
            latest = max(latest, timestamp + float(cr['elapsed_seconds']))
            candy.append({
                'id': f'candy-{p}', 'timestamp': datetime.fromtimestamp(timestamp, timezone.utc).isoformat(),
                'status': 'completed' if cr.get('status') == 'completed' else 'error',
                'final_answer': grading[trial]['final_answer'],
                'answer': z.read(f'candy/{p}/answer.txt').decode('utf-8'),
                'model': cr['model'], 'reasoning_effort': cr['reasoning_effort'],
                'elapsed_seconds': cr['elapsed_seconds'], 'http_status': cr.get('http_status')
            })
            dr = read_json(z, f'drawing/{p}/result.json')
            original = z.read(f'drawing/{p}/index.html')
            pelicans.append({
                'id': f'pelican-{p}', 'trial': trial, 'date': '2026-09-14',
                'timestamp': None, 'account_label': '', 'model': dr['model'],
                'reasoning_effort': dr['reasoning_effort'], 'elapsed_seconds': dr['elapsed_seconds'],
                'review_status': 'unreviewed', 'retried': trial == 1,
                'html': original.decode('utf-8'), 'sha256': hashlib.sha256(original).hexdigest()
            })
        # Gallery layouts with copied images and "removed account" labels are NOT imported.
        data = {'schema_version': 1, 'mode': 'archive', 'archive_date': '2026-09-14',
                'as_of': datetime.fromtimestamp(latest, timezone.utc).isoformat(),
                'next_probe_at': None, 'candy': candy, 'pelicans': pelicans}
        payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        encoded = base64.b64encode(gzip.compress(payload, compresslevel=9, mtime=0)).decode('ascii')
        output.parent.mkdir(parents=True, exist_ok=True)
        # Split the compressed base64 into eight static same-origin parts.
        chunks = [encoded[i:i+7805] for i in range(0, len(encoded), 7805)]
        if len(chunks) != 8:
            raise ValueError("Archive size changed; update the fixed eight-part loader layout")
        for i, chunk in enumerate(chunks, 1):
            (output.parent / f'archive-{i:02d}.part').write_text(chunk, encoding='ascii')
        for loader in range(1, 5):
            first = (loader - 1) * 2 + 1
            dest = output if loader == 1 else output.with_name(f'archive-{loader}.js')
            init = "window.OBS_ARCHIVE_B64 = '';\n" if loader == 1 else ''
            dest.write_text(
                f'// Archive loader {loader}/4. Same-origin static hosting required.\n' + init +
                '(() => {\n' +
                f'  for (const n of [{first}, {first + 1}]) {{\n' +
                "    const xhr = new XMLHttpRequest();\n" +
                "    xhr.open('GET', `data/archive-${String(n).padStart(2, '0')}.part`, false);\n" +
                "    xhr.send(null);\n" +
                "    if (xhr.status !== 200 && xhr.status !== 0) throw new Error(`Archive part ${n} failed: ${xhr.status}`);\n" +
                "    window.OBS_ARCHIVE_B64 += xhr.responseText.trim();\n" +
                "  }\n})();\n",
                encoding='utf-8'
            )
        print(f'Imported {len(candy)} candy records and {len(pelicans)} original HTML files -> {output}')
        print(f'JSON SHA-256: {hashlib.sha256(payload).hexdigest()}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'data/archive.js')
    args = parser.parse_args()
    import_archive(args.archive, args.output)
