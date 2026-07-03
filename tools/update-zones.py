# Magyarorszagi parkolasi zonak frissitese a Nemzeti Mobilfizetes terkeperol.
# Hasznalat:  python tools/update-zones.py
# Kimenet:    data/zones.geojson (felulirja) + data/config.json dataVersion
#
# Az adat a https://nemzetimobilfizetes.hu/parking_purchases/zonainfo oldal
# mogotti lekerdezesbol szarmazik. Tajekoztato jellegu — a kihelyezett
# tablak az iranyadok!

import json
import re
import urllib.request
import http.cookiejar
from datetime import date
from pathlib import Path

BASE = 'https://nemzetimobilfizetes.hu'
ROOT = Path(__file__).resolve().parent.parent

def fetch_zones():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    opener.addheaders = [
        ('User-Agent', 'Mozilla/5.0 (ParkEasy zone updater)'),
        ('Accept', 'application/json'),
    ]
    # session suti a fooldaltol
    opener.open(f'{BASE}/parking_purchases/zonainfo', timeout=60).read()
    ts = date.today().isoformat() + '%2010:00'
    req = urllib.request.Request(
        f'{BASE}/parking_purchases/search_parking_zones?search=Budapest&time={ts}',
        headers={'X-Requested-With': 'XMLHttpRequest', 'Referer': f'{BASE}/parking_purchases/zonainfo'},
    )
    with opener.open(req, timeout=120) as res:
        return json.load(res)

def to_geojson(raw):
    features = []
    for z in raw:
        coords = [[float(p['long']), float(p['lat'])] for p in z['geometry']]
        if coords and coords[0] != coords[-1]:
            coords.append(coords[0])
        tt = z.get('timetable', '')
        m = re.search(r'(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})', tt)
        features.append({
            'type': 'Feature',
            'properties': {
                'zone': z['zoneid'],
                'district': z['telepules'],
                'price': z.get('fee'),
                'paidFrom': m.group(1) if m else None,
                'paidTo': m.group(2) if m else None,
            },
            'geometry': {'type': 'Polygon', 'coordinates': [coords]},
        })
    return {
        'type': 'FeatureCollection',
        'name': 'Magyarorszagi parkolasi zonak',
        'source': f'Nemzeti Mobilfizetesi Zrt. (nemzetimobilfizetes.hu), lekerdezve: {date.today().isoformat()}',
        'features': features,
    }

def main():
    raw = fetch_zones()
    gj = to_geojson(raw)
    if len(gj['features']) < 800:
        raise SystemExit(f'Gyanusan keves zona ({len(gj["features"])}) — nem irom felul az adatot.')
    out = ROOT / 'data' / 'zones.geojson'
    out.write_text(json.dumps(gj, ensure_ascii=False), encoding='utf-8')
    cfg_path = ROOT / 'data' / 'config.json'
    cfg = json.loads(cfg_path.read_text(encoding='utf-8'))
    cfg.pop('dataSource', None)
    cfg['dataVersion'] = date.today().isoformat()
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    zones = len({f['properties']['zone'] for f in gj['features']})
    print(f'OK: {len(gj["features"])} poligon, {zones} zonakod -> {out}')
    print('Ne felejtsd el megemelni a CACHE_NAME verziot a service-worker.js-ben!')

if __name__ == '__main__':
    main()
