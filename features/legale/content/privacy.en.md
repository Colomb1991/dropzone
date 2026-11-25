# {{APP_NAME}} privacy notice

Last updated: {{LAST_UPDATED}} · Test version

> **In short**
>
> - Notes, photos, shifts and hours stay **on your phone**. We do not receive them: we have no server, no accounts, no database.
> - No ads, no analytics, no cookies.
> - For the map and nearby places, your phone asks open services for data. They see your IP address and the area you need, never your notes. You can switch each one off in Settings → Online services.
> - The route planner's address search is off until you turn it on. When on, it sends Photon what you type and your rough area.
> - The shift weather is off until you turn it on. When on, it sends Open-Meteo your rough area, at shift start.
> - Alerts, files and SOS messages leave the phone only when you send them.
> - Delete everything whenever you want: Settings → Delete everything.

## 1. Who we are

{{APP_NAME}} is made and run by one person, not a company: {{OPERATOR_NAME}}. In this text "we" means that person. For any question write to {{CONTACT_EMAIL}}. The app lives at {{APP_URL}}.

## 2. What stays on your phone

This data is saved in your phone's browser storage. We cannot see it, copy it or recover it.

- **Zone notes:** position, category, text, days and hours, photo, and the "Found closed" and "Found open" stamps (weekday, time and month of the visit).
- **Shifts:** start, end, breaks, hours. And your payslip hours, if you type them in to compare: ordinary hours and overtime for each month, never amounts of money. They stay until you remove them (36 months at most) and go into the backup.
- **Alerts already given:** for each note, the time of the last alert. Someone who reads this data can tell when you last passed there.
- **Van diary:** photos with date, time and position written on them; the van checks you tick, with the time; and your own list of checks, if you change it. They stay until you delete them and go into the backup. If you leave the van photos out of the backup, the checks saved with those photos stay out too.
- **Alerts** you created or received.
- **Route:** the stops you add (an address or a point, with a short label if you write one), their order, which ones you have done, the time of the last one done and today's town, if you set it. From a text you scan, dictate or paste the app keeps only the addresses it recognises in it (street, number, town) and shows them to you before adding them: the whole text is not saved. The route deletes itself 24 hours after its last change and is not in the backup.
- **Addresses the route planner learns:** when you tap "Done" in front of an address, its text and the point measured by your phone (never the coordinates of the search service), how many times and the date and time of the last one. Someone who reads this data can tell when you were last there.
- **Times the route planner learns:** the average time between one stop and the next: the duration only, never the path. For pairs of areas of about 5 km and time of day, with how many times and the date and time of the last one.
- Learned addresses and times stay until you use Delete everything and go into the backup.
- **Van is here:** the point where you left the van, with the time. It is deleted when you tap "Found it", or by itself after 24 hours, and is not in the backup.
- **Pace:** how many deliveries you have left, as you type it or count it with "+1" during the shift, with the time of each count. It is deleted when the shift ends and is not in the backup.
- **Settings:** language, theme, contract (hours and days per week), trusted SOS contact (name and number), SOS quick numbers (the names and numbers you type, five at most), notices already read. They go into the backup.
- **Technical data:** unfinished notes and the list of the last import, so that you can undo it.
- **Temporary copies:** nearby places (7 days), map pieces you already viewed, the last weather forecast (60 minutes, with the area rounded to about 10 km). They are not in the backup.

The app does **not** save: the GPS track of your movements, your speed, customer names, parcel data.

The app does not encrypt this data. Anyone who unlocks the phone or connects it to a computer can read it: always use your phone's screen lock.

## 3. What leaves your phone automatically

Only the requests below, to the app's site and to five addresses: tiles.openfreemap.org, overpass.private.coffee, overpass-api.de, photon.komoot.io and api.open-meteo.com. They go from your phone straight to the service: they do not pass through us. Each service contacted also sees your **IP address**, your browser type and language, and the fact that the request comes from the {{APP_NAME}} site.

**The app's site (GitHub Pages, by GitHub, Inc., USA)**

- When: the app downloads its files or checks for an update.
- What it receives: IP address and the names of the files requested. GitHub states that it logs visitors' IP addresses for security purposes. We have no access to those logs.
- Nearby in Tuscany: the places come from files of the app, one for each fixed box of about 5 × 4 km, also with "Nearby online" switched off. From the file name GitHub can tell which box you are in, never the exact point.
- Switching it off: not possible, the app could not download. After the first visit the app also works offline.
- Outside the EU: GitHub states that it complies with the EU-US Data Privacy Framework and uses the European Commission's standard contractual clauses.
- [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

**Map (OpenFreeMap)**

- When: you open a map.
- What it receives: the map tiles that are needed. If you keep the map open while you move, these are the tiles of the places you pass.
- OpenFreeMap states: no cookies; logs without IP addresses, deleted after 7 days. After an error or during an attack it may also log the IP address and the requested URL, for 30 days at most. It may use Cloudflare's network, which has its own rules.
- Switching it off: Settings → Online services → "Online map". Lists and distances still work. Switching it off also deletes the saved map pieces.
- [OpenFreeMap privacy policy](https://openfreemap.org/privacy/)

**Nearby (Overpass API, OpenStreetMap data)**

- When: you open Nearby in an area your phone has not stored yet, or stored more than 7 days ago.
- What it receives: one or more fixed boxes of about 5 × 4 km, those around you. Never the exact point.
- Who runs it: Private.coffee (non-profit association, Austria) at overpass.private.coffee. It states that it logs only part of the IP address (shortened), with the time and type of request, for 48 hours at most. As a fallback, if the first does not answer: FOSSGIS at overpass-api.de. We could not verify how long it keeps its logs.
- Switching it off: "Nearby online". Your own saved places still work.
- [Private.coffee Overpass terms and privacy](https://overpass.private.coffee/) · [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)

**Route planner address search (Photon, by komoot, OpenStreetMap data)**

- When: while you type an address in the route planner, at every short pause, even if the phone has already learned it; and for each address recognised in a text you scan, dictate or paste, when the phone has not already learned it. Only after you have turned the search on: it is off until you do.
- What it receives: the text you type in "Search", even half-written; of what you scan, dictate or paste only the addresses recognised (or the line you fix by hand), one at a time; and your area approximated to about 10 km. Never the exact point.
- Photon publishes no privacy notice of its own: we do not know what it logs. Type street, number and town only: never names.
- Switching it off: "Online address search". The addresses the phone has learned, "Add here", coordinates and your notes still work.
- [Photon](https://photon.komoot.io/)

**Shift weather (Open-Meteo, by OpenMeteo GmbH, Switzerland)**

- When: at shift start, for the weather line of the briefing. Only after you have turned "Online weather" on: it is off until you do. The answer is good for 60 minutes: no other request leaves in that hour.
- What it receives: your area approximated to about 10 km. Never the exact point.
- Open-Meteo states: no cookies or tracking; it may collect the IP address for technical reasons; its server logs may contain the coordinates requested and are deleted after 90 days.
- Switching it off: "Online weather". The shift works the same, without the weather line.
- [Open-Meteo terms and privacy](https://open-meteo.com/en/terms)

Each of these services uses its own logs under its own rules: we do not control them. The voice that reads alerts and the ready phrases is the phone's own. The app uses only voices that the phone reports as installed. How that voice works depends on Apple or Google, not on us. Your position is worked out by the phone, using Apple's or Google's location service and their rules.

## 4. What you send yourself

It leaves only when you tap send, share or a navigation app. You see the text or the file name first. The messaging app you pick may open the links in the message by itself to show a preview.

- **Alert to colleagues:** a link to {{APP_NAME}} with type, point, time, expiry and the short text you write. No name, no phone identifier. Whoever receives it sees who you are from the chat, can read it and forward it. It cannot be taken back.
- **Pass the zone:** a file with the notes you pick: position, category, text, days and hours, "found closed" and "found open" stamps, date of the last change and, if you include them, the photos. Never notes marked "Only for me", shifts or settings. Someone who receives several of your files can tell that they come from the same person.
- **Backup:** a file with notes and photos, alerts already given, shifts and hours, van diary, what the route planner has learned and settings (with trusted contact and quick numbers). Left out: the route, the point of Van is here, Pace, the alerts you created or received, technical data and temporary copies. It is not protected: keep it to yourself.
- **Hours (CSV) and van photos:** only if you export or share them.
- **SOS:** a message with your position and a Google Maps link, to the contact you chose, by WhatsApp or SMS. To show the preview WhatsApp may open that link: Google sees the point and your IP address.
- **Take me there:** opens Google Maps, Waze or Apple Maps with the destination. The same goes for "Go" in the route planner and for "Walk me there" in Van is here: the destination is the point of the stop or of the van.
- **Map mistake:** opens OpenStreetMap in the browser at the point where you are. OpenStreetMap sees that point and your IP address. You write and send the note there, not from {{APP_NAME}}: it is public and it stays.
- **Quick numbers:** tapping one opens the phone app with that number. You make the call.
- **Let a colleague try it:** the app link, or a QR code drawn on the phone. It holds the app address only: none of your data.

To open WhatsApp on one contact we use a WhatsApp link: the message text and the number may pass through WhatsApp's servers before they reach the chat.

From there on, the rules of those apps and of the recipient apply. We see none of this.

## 5. Phone permissions

- **Location:** used to warn you near your notes, to find nearby places, to save the point of a note or van photo, to sort the route and learn entrances, to remember where you left the van, for the shift weather and the address search (the rounded area only), and for SOS. It works only with the app open and the screen on. It stays on the phone, except as described in sections 3 and 4.
- **Camera:** only when you tap "Take photo". {{APP_NAME}} keeps its copy on the phone. If your phone's camera also saves one to the gallery, that copy follows the phone's rules. In the route planner labels are read by the "Scan text" of the phone's keyboard (Apple, Google or others), under its own rules: {{APP_NAME}} receives the text only, never the image.
- **Microphone:** {{APP_NAME}} does not use it and does not turn voice into text. If you dictate a note with the keyboard's microphone, the keyboard (Apple, Google or others) handles your voice under its own rules.
- **Clipboard:** only when you tap "Paste alert" or, in the route planner, "Paste from clipboard".

You can refuse or remove any permission in your phone settings. Shifts, hours and SOS still work.

## 6. Cookies and local storage

{{APP_NAME}} uses no cookies, neither ours nor anyone else's. It uses the browser's local storage only so that it works: your data, the app's files for offline use, theme and language. That is why the law requires neither consent nor a banner.

## 7. Retention and deletion

- Data stays on the phone until you delete it: one note at a time, or Settings → Delete everything, which also deletes the saved map pieces. On iPhone, removing the app from the Home Screen deletes it too. On Android removing the icon may not be enough: use Delete everything first.
- Received alerts delete themselves 24 hours after they expire.
- The route deletes itself 24 hours after its last change, or at once with "Empty the route". Learned addresses and average times stay until you use Delete everything.
- The point of "Van is here" deletes itself after 24 hours, or at once with "Found it". The Pace counts are deleted when the shift ends. The saved weather forecast is replaced at the next request.
- We keep nothing, so we cannot recover lost data. Back up every week. An iPhone may delete the data of a web app you have not used for a while.
- If you send us something yourself (a message, a screenshot, the Diagnostics results), we use it only to reply or to fix the bug and delete it within 12 months. Never send us your backup: it contains all your notes.

## 8. Children

{{APP_NAME}} is made for people who work as couriers, so for adults. It is not intended for anyone under 18.

## 9. Why we are allowed to do this

The data on your phone is managed by you, not by us. For the little that goes through outside services (section 3) and for messages you send us, the legal basis is our legitimate interest in running the app securely and giving you the features you open (Article 6(1)(f) GDPR). You can object at any time: switch the service off, or stop using the app.

## 10. Your rights

The GDPR gives you the right to access your data, correct it, delete it, restrict its use, object and get a copy (Articles 15 to 22).

- For data on your phone you can do it all yourself: view, edit, export and delete it in the app.
- We do not hold the data you keep in the app and cannot recognise you. If you think otherwise, write to {{CONTACT_EMAIL}}: we reply within one month.
- For the logs of the services in section 3 you can contact them directly. If you need a hand, write to us.
- You can lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali: [www.garanteprivacy.it](https://www.garanteprivacy.it), or with the authority of the country where you live.

## 11. Other people's data

Notes are about places, not people. If you write or photograph other people's data, you are responsible for it: read the Terms of use.

## 12. Changes

If we change this notice we update the date at the top. If the change matters, we tell you in the app the next time you open it.
