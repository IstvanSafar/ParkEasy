# 🅿️ ParkEasy

**GPS-alapú parkolási zóna felismerés és SMS-parkolás Magyarországon — telepíthető, offline-képes webalkalmazás (PWA).**

Megállsz az autóval, megnyitod az appot, és az megmondja, melyik fizetős zónában vagy, mennyibe kerül, majd egy gombnyomásra előkészíti a parkolást indító SMS-t. A lejárat előtt figyelmeztet, a leállító SMS-t is összeállítja. Nincs szerver, nincs fiók, nincs adatgyűjtés — minden a telefonodon fut és tárolódik.

## Funkciók

- 📍 **Zónafelismerés GPS alapján** — ~1300 zóna-poligon országszerte (Budapest + vidéki városok), point-in-polygon kereséssel; ha nem vagy zónában, a legközelebbit ajánlja fel a távolsággal
- 💬 **SMS előkészítés egy gombbal** — az indító és leállító SMS kész címzettel és szöveggel nyílik meg a telefon SMS-alkalmazásában
- 💳 **Négy fizetési mód** — Nemzeti Mobilfizetés (központi szám, `ZÓNA RENDSZÁM`) vagy Telekom / Yettel / One mobilvásárlás (`+36xx763` + zónakód, csak a rendszám)
- ⏱️ **Visszaszámláló és becsült költség** — az aktív parkolás túléli az app bezárását is
- 🔔 **Értesítés a lejárat előtt** (5/10/15/30 perccel, amíg az app nyitva van)
- 🗺️ **Térkép** — zónahatárok, díjak, saját pozíció (Leaflet + OpenStreetMap)
- 🚗 **Két mentett rendszám** gyorsválasztóval + kézi beírás
- 🌙 Sötét mód, 📴 offline működés (Service Worker), 📜 parkolási előzmények

## Kipróbálás / használat

Az app GitHub Pages-ről fut, telepíteni a böngésző „Hozzáadás a kezdőképernyőhöz" opciójával lehet.

**Fontos:** az SMS-parkoláshoz egyszeri regisztráció kell — vagy a [Nemzeti Mobilfizetésnél](https://www.nemzetimobilfizetes.hu) (egyenlegfeltöltéssel), vagy a mobilszolgáltatód „mobilvásárlás" szolgáltatásának aktiválásával (a parkolás a havi számlára kerül). A beállításokban (⚙️) add meg, melyiket használod, mert más számra és formátumban megy az SMS!

### Tesztmód (asztali gépen, GPS nélkül)

```
index.html?test=1          → a térképen kattintva választasz pozíciót,
                             az SMS-app nem nyílik meg
index.html?pos=47.47,19.05 → fix koordinátával indul
```

## Fejlesztés

Nincs build lépés, nincs függőség — vanilla JavaScript (ES modulok), a Bootstrap és a Leaflet a repóban van (`/vendor`). Helyi futtatáshoz csak egy statikus webszerver kell (a `file://` nem jó, mert a böngésző blokkolja a modulokat):

```bash
python -m http.server 8347
# → http://localhost:8347/?test=1
```

Módosítás után emeld meg a `CACHE_NAME` verziót a `service-worker.js`-ben, különben a böngészők a régi fájlokat szolgálják ki a cache-ből.

### Felépítés

```
index.html            egyoldalas app: fő / aktív parkolás / beállítások / térkép nézet
js/app.js             vezérlés, nézetváltás, indítási folyamat
js/geo.js             GPS + point-in-polygon + legközelebbi zóna
js/sms.js             SMS URI összeállítás (platform- és fizetésimód-függő)
js/parking.js         parkolás életciklus, visszaszámláló, költségbecslés
js/storage.js         LocalStorage (rendszámok, beállítások, aktív parkolás, előzmények)
js/notifications.js   lejárat előtti értesítés (Notification API + fallback)
js/map.js             Leaflet térkép a zóna-poligonokkal
js/zones.js           zónaadat betöltés
data/zones.geojson    magyarországi zóna-poligonok (nincs a repóban — a deploy generálja)
service-worker.js     offline cache (statikus: cache-first, zónaadat: network-first)
tools/update-zones.py zónaadat-frissítő script
```

## Zónaadatok

A zónaadatok a Nemzeti Mobilfizetési Zrt. nyilvános zóna-információi alapján készülnek, tájékoztató jellegűek. Az alkalmazás nem hivatalos; parkolás előtt a helyszíni jelzések az irányadók. Az adatállomány nem része a repónak — a deploy tölti le publikáláskor, és hetente frissül. Helyi fejlesztéshez: `python tools/update-zones.py`

## Adatkezelés

Semmilyen adat nem hagyja el a készüléket. A rendszámok, beállítások és előzmények a böngésző LocalStorage-ában tárolódnak; a GPS-pozíció csak a zónakereséshez kell, sehova nem kerül elküldésre. Az app szervere (GitHub Pages) csak statikus fájlokat szolgál ki.

## ⚠️ Felelősség

Az alkalmazásban megjelenített parkolási zónaadatok, díjak és fizetési időszakok tájékoztató jellegűek, és változhatnak. Parkolás előtt mindig a helyszíni közúti jelzések és a hatályos parkolási szabályok az irányadók.

Az alkalmazás nem hivatalos, nem áll kapcsolatban a Nemzeti Mobilfizetési Zrt.-vel, a fővárosi vagy kerületi önkormányzatokkal, illetve a mobilszolgáltatókkal. A fejlesztő nem vállal felelősséget a zónaadatok pontatlanságából vagy elavulásából eredő károkért vagy pótdíjakért.
