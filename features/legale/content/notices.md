# Servizi e licenze · Services and licences

{{APP_NAME}} · {{LAST_UPDATED}}

> **In breve / In short**
>
> - IT: {{APP_NAME}} usa dati aperti e software libero. Qui trovi a chi vanno i ringraziamenti e con quali licenze. I dati di mappa possono contenere errori.
> - EN: {{APP_NAME}} uses open data and free software. This page says who deserves the credit and under which licences. Map data may contain errors.

## 1. Dati aperti · Open data

**OpenStreetMap**

- IT: mappe, posti vicini e ricerca indirizzi usano dati © OpenStreetMap contributors, con licenza Open Database License (ODbL) 1.0.
- EN: maps, nearby places and the address search use data © OpenStreetMap contributors, under the Open Database License (ODbL) 1.0.
- [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/)
- IT: hai trovato un errore sulla mappa? Puoi correggerlo tu su [openstreetmap.org](https://www.openstreetmap.org).
- EN: found a mistake on the map? You can fix it yourself at [openstreetmap.org](https://www.openstreetmap.org).

**OpenFreeMap e OpenMapTiles** (mappa · map tiles)

- Testo sulla mappa · Text on the map: `OpenFreeMap © OpenMapTiles Dati © OpenStreetMap`
- [openfreemap.org](https://openfreemap.org) · [openmaptiles.org](https://openmaptiles.org)
- OpenMapTiles: codice · code BSD 3-Clause, design CC BY 4.0.
- IT: gli stili di mappa di {{APP_NAME}} derivano dallo stile "Liberty" di OpenFreeMap (MIT, Copyright (c) 2023 Zsolt Ero), a sua volta derivato da OSM Liberty e OSM Bright (codice BSD 3-Clause, design CC BY 4.0), derivati da Mapbox Open Styles.
- EN: the map styles of {{APP_NAME}} are derived from the OpenFreeMap "Liberty" style (MIT, Copyright (c) 2023 Zsolt Ero), itself derived from OSM Liberty and OSM Bright (code BSD 3-Clause, design CC BY 4.0), which derive from Mapbox Open Styles.
- IT: caratteri della mappa Noto Sans (SIL Open Font License 1.1) e icone Maki (CC0 1.0), serviti da OpenFreeMap.
- EN: map fonts Noto Sans (SIL Open Font License 1.1) and Maki icons (CC0 1.0), served by OpenFreeMap.
- [Licenze degli stili · Style licences](https://github.com/hyperknot/openfreemap-styles/blob/main/LICENSE.md) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

**Overpass API** (Vicino a me · Nearby)

- IT: i posti vicini sono dati OpenStreetMap chiesti ai server pubblici Overpass di Private.coffee e, di riserva, di FOSSGIS (overpass-api.de).
- EN: nearby places are OpenStreetMap data requested from the public Overpass servers of Private.coffee and, as a fallback, FOSSGIS (overpass-api.de).
- IT: per la Toscana una copia di questi posti è già dentro l'app: estratta da OpenStreetMap il 25 novembre 2026, stessa licenza ODbL.
- EN: for Tuscany a copy of these places is already inside the app: extracted from OpenStreetMap on 25 November 2026, same ODbL licence.
- [overpass.private.coffee](https://overpass.private.coffee/) · [wiki.openstreetmap.org/wiki/Overpass_API](https://wiki.openstreetmap.org/wiki/Overpass_API)

**Photon** (ricerca indirizzi del Giro · route planner address search)

- IT: gli indirizzi cercati nel Giro sono dati OpenStreetMap chiesti al servizio pubblico Photon di komoot, solo dopo che hai attivato la ricerca. Photon è software libero (Apache License 2.0).
- EN: the addresses searched in the route planner are OpenStreetMap data requested from komoot's public Photon service, only after you have turned the search on. Photon is free software (Apache License 2.0).
- IT: gli ingressi che {{APP_NAME}} impara sono misurati dal tuo telefono: le coordinate date da Photon restano solo nel giro di oggi, che si cancella da solo dopo 24 ore.
- EN: the entrances {{APP_NAME}} learns are measured by your own phone: the coordinates given by Photon stay only in today's route, which deletes itself after 24 hours.
- [photon.komoot.io](https://photon.komoot.io/) · [github.com/komoot/photon](https://github.com/komoot/photon)

**Open-Meteo** (meteo del turno · shift weather)

- IT: la riga meteo usa dati meteo di Open-Meteo.com, con licenza CC BY 4.0, chiesti solo dopo che hai acceso "Meteo online".
- EN: the weather line uses weather data by Open-Meteo.com, under the CC BY 4.0 licence, requested only after you have turned "Online weather" on.
- IT: l'API gratuita di Open-Meteo è riservata all'uso non commerciale. {{APP_NAME}} è gratuita e in prova.
- EN: Open-Meteo's free API is for non-commercial use only. {{APP_NAME}} is free and in testing.
- [open-meteo.com](https://open-meteo.com/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## 2. Software incluso · Software included

IT: queste librerie e questi caratteri sono copiati dentro l'app (niente viene scaricato da altri siti). Il testo completo di ogni licenza è nel file indicato, pubblicato insieme all'app.

EN: these libraries and fonts are copied inside the app (nothing is downloaded from other sites). The full text of each licence is in the file named, published with the app.

- **MapLibre GL JS 6.19.0** · licenza · licence BSD 3-Clause · Copyright (c) 2023, MapLibre contributors. Include codice di · Includes code from Mapbox GL JS (BSD 3-Clause, Copyright (c) 2020, Mapbox), glfx.js (MIT), d3-color (BSD 3-Clause) · file `vendor/maplibre-gl/LICENSE.txt` · [maplibre.org](https://maplibre.org)
- **Preact 11.2.0** · MIT · Copyright (c) 2015-present Jason Miller · file `vendor/preact/LICENSE` · [preactjs.com](https://preactjs.com)
- **htm 3.1.1** · Apache License 2.0 · Copyright 2018 Google Inc. · file `vendor/htm/LICENSE` · [github.com/developit/htm](https://github.com/developit/htm)
- **Lucide icons** · ISC · Copyright (c) Lucide Icons and Contributors. Alcune icone derivano da Feather · Some icons derive from Feather: MIT, Copyright (c) 2013-present Cole Bemis · file `assets/icons/LICENSE-lucide.txt` · [lucide.dev/license](https://lucide.dev/license)
- **Outfit** (carattere dei titoli · headings font; pacchetto · package `@fontsource-variable/outfit` 5.3.0) · SIL Open Font License 1.1 · Copyright 2021 The Outfit Project Authors (https://github.com/Outfitio/Outfit-Fonts) · file `vendor/fonts/OFL-outfit.txt` · [github.com/Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts)
- **Manrope** (carattere del testo · text font; pacchetto · package `@fontsource-variable/manrope` 5.3.0) · SIL Open Font License 1.1 · Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope) · file `vendor/fonts/OFL-manrope.txt` · [github.com/sharanda/manrope](https://github.com/sharanda/manrope)

## 3. Contenuti di {{APP_NAME}} · {{APP_NAME}} content

- IT: nome, icona, illustrazioni, suoni, testi e codice dell'app: © {{OPERATOR_NAME}}. Tutti i diritti riservati, salvo dove un file di licenza dica altro. I suoni sono generati dall'app: non ci sono file audio.
- EN: app name, icon, illustrations, sounds, texts and code: © {{OPERATOR_NAME}}. All rights reserved, unless a licence file says otherwise. Sounds are generated by the app: there are no audio files.
- IT: la città della demo, Borgofinto, è inventata. Ogni somiglianza con posti reali è casuale.
- EN: the demo town, Borgofinto, is made up. Any likeness to real places is accidental.

## 4. App che apri da {{APP_NAME}} · Apps you open from {{APP_NAME}}

- IT: Google Maps, Waze, Mappe di Apple, WhatsApp e SMS non fanno parte di {{APP_NAME}} e hanno termini e informative proprie. {{APP_NAME}} li apre solo quando tocchi tu.
- EN: Google Maps, Waze, Apple Maps, WhatsApp and SMS are not part of {{APP_NAME}} and have their own terms and privacy notices. {{APP_NAME}} opens them only when you tap.

## 5. Marchi · Trademarks

- IT: i nomi e i marchi citati appartengono ai rispettivi titolari e sono usati solo per indicare il servizio. {{APP_NAME}} non è collegata, autorizzata o sponsorizzata da nessuno di loro, né da alcuna azienda di consegne.
- EN: names and trademarks mentioned belong to their owners and are used only to identify the service. {{APP_NAME}} is not connected to, authorised by or sponsored by any of them, or by any delivery company.

## 6. Nessuna garanzia sui dati · No warranty on data

- IT: i dati aperti sono forniti dai loro autori senza garanzie. Controlla sempre di persona.
- EN: open data is provided by its authors without warranty. Always check for yourself.
