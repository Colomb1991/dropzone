# Informativa privacy di {{APP_NAME}}

Ultimo aggiornamento: {{LAST_UPDATED}} · Versione di prova

> **In breve**
>
> - Note, foto, turni e ore restano **sul tuo telefono**. Noi non li riceviamo: non abbiamo server, account o database.
> - Niente pubblicità, niente statistiche, niente cookie.
> - Per mappa e posti vicini il tuo telefono chiede i dati a servizi aperti. Vedono il tuo indirizzo IP e la zona che ti serve, mai le tue note. Li spegni uno per uno in Impostazioni → Servizi online.
> - La ricerca indirizzi del Giro è spenta finché non la accendi tu. Da accesa manda a Photon quello che scrivi e la tua zona approssimativa.
> - Il meteo del turno è spento finché non lo accendi tu. Da acceso manda a Open-Meteo la tua zona approssimativa, a inizio turno.
> - Segnalazioni, file e messaggi SOS partono solo se li mandi tu.
> - Cancelli tutto quando vuoi: Impostazioni → Elimina tutto.

## 1. Chi siamo

{{APP_NAME}} è fatta e gestita da una persona, non da un'azienda: {{OPERATOR_NAME}}. In questo testo "noi" vuol dire questa persona. Per qualsiasi domanda scrivi a {{CONTACT_EMAIL}}. L'app si trova su {{APP_URL}}.

## 2. Cosa resta sul telefono

Questi dati sono salvati nella memoria del browser del tuo telefono. Noi non possiamo vederli, copiarli né recuperarli.

- **Note di zona:** posizione, categoria, testo, giorni e orari, foto, e i timbri "Trovato chiuso" e "Trovato aperto" (giorno della settimana, ora e mese della visita).
- **Turni:** inizio, fine, pause, ore. E le ore della busta paga, se le scrivi tu per confrontarle: ordinarie e straordinari di ogni mese, mai importi. Restano finché non le togli (36 mesi al massimo) ed entrano nel backup.
- **Avvisi già dati:** per ogni nota, l'ora dell'ultimo avviso. Chi legge questi dati capisce quando sei passato di lì l'ultima volta.
- **Diario furgone:** foto con data, ora e posizione scritte sopra; i controlli del furgone che spunti, con l'ora; e il tuo elenco di controlli, se lo cambi. Restano finché non li elimini ed entrano nel backup. Se lasci fuori dal backup le foto del furgone, restano fuori anche i controlli salvati insieme a quelle foto.
- **Segnalazioni** create o ricevute.
- **Giro:** le fermate che aggiungi (un indirizzo o un punto, con un'etichetta breve se la scrivi), il loro ordine, quali hai fatto, l'ora dell'ultima fatta e la città di oggi, se la scrivi. Di un testo che scansioni, detti o incolli l'app tiene solo gli indirizzi che ci riconosce (via, numero, città) e te li mostra prima di aggiungerli: il testo intero non viene salvato. Il giro si cancella da solo 24 ore dopo l'ultima modifica e non entra nel backup.
- **Indirizzi imparati dal Giro:** quando tocchi "Fatto" davanti a un indirizzo, il suo testo e il punto misurato dal tuo telefono (mai le coordinate del servizio di ricerca), quante volte e la data e l'ora dell'ultima. Chi legge questi dati capisce quando ci sei passato l'ultima volta.
- **Tempi imparati dal Giro:** il tempo medio tra una fermata e la successiva: solo la durata, mai il percorso. Per coppie di zone di circa 5 km e fascia oraria, con quante volte e la data e l'ora dell'ultima.
- Indirizzi e tempi imparati restano finché non usi Elimina tutto ed entrano nel backup.
- **Furgone qui:** il punto dove hai lasciato il furgone, con l'ora. Si cancella quando tocchi "L'ho ritrovato", oppure da solo dopo 24 ore, e non entra nel backup.
- **Ritmo:** quante consegne ti mancano, come lo scrivi tu o lo conti con "+1" durante il turno, con l'ora di ogni conteggio. Si cancella quando il turno finisce e non entra nel backup.
- **Impostazioni:** lingua, tema, contratto (ore e giorni a settimana), contatto fidato per l'SOS (nome e numero), numeri rapidi dell'SOS (i nomi e i numeri che scrivi tu, cinque al massimo), avvisi già letti. Entrano nel backup.
- **Dati tecnici:** note lasciate a metà e l'elenco dell'ultima importazione, per poterla annullare.
- **Copie temporanee:** posti vicini (7 giorni), pezzi di mappa già visti, l'ultima previsione meteo (60 minuti, con la zona arrotondata a circa 10 km). Non entrano nel backup.

L'app **non** salva: la traccia GPS dei tuoi spostamenti, la velocità, nomi di clienti, dati dei pacchi.

L'app non cifra questi dati. Chi sblocca il telefono o lo collega a un computer può leggerli: usa sempre il blocco schermo del telefono.

## 3. Cosa esce dal telefono in automatico

Solo le richieste qui sotto, verso il sito dell'app e cinque indirizzi: tiles.openfreemap.org, overpass.private.coffee, overpass-api.de, photon.komoot.io e api.open-meteo.com. Partono dal tuo telefono e vanno direttamente al servizio: non passano da noi. Ogni servizio contattato vede anche il tuo **indirizzo IP**, il tipo e la lingua del browser e il fatto che la richiesta arriva dal sito di {{APP_NAME}}.

**Sito dell'app (GitHub Pages, di GitHub, Inc., USA)**

- Quando: l'app scarica i suoi file o controlla se c'è un aggiornamento.
- Cosa riceve: indirizzo IP e nomi dei file richiesti. GitHub dichiara di registrare l'IP dei visitatori per motivi di sicurezza. Noi non abbiamo accesso a quei registri.
- Vicino a me in Toscana: i posti arrivano da file dell'app, uno per ogni riquadro fisso di circa 5 × 4 km, anche con "Vicino a me online" spento. Dal nome del file GitHub può capire in quale riquadro sei, mai il punto esatto.
- Spegnerlo: non si può, senza l'app non si scarica. Dopo la prima apertura l'app funziona anche senza rete.
- Fuori dall'UE: GitHub dichiara di aderire al Data Privacy Framework UE-USA e di usare le clausole contrattuali standard della Commissione europea.
- [Informativa di GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

**Mappa (OpenFreeMap)**

- Quando: apri una mappa.
- Cosa riceve: i riquadri di mappa che servono. Se tieni la mappa aperta mentre ti sposti, sono i riquadri dei posti dove passi.
- OpenFreeMap dichiara: niente cookie; registri senza indirizzo IP, cancellati dopo 7 giorni. In caso di errore o di attacco può registrare anche l'IP e l'indirizzo richiesto, per 30 giorni al massimo. Può usare la rete di Cloudflare, che ha regole proprie.
- Spegnerlo: Impostazioni → Servizi online → "Mappa online". Restano elenchi e distanze. Spegnendola cancelli anche i pezzi di mappa salvati.
- [Informativa di OpenFreeMap](https://openfreemap.org/privacy/)

**Vicino a me (Overpass API, dati OpenStreetMap)**

- Quando: apri Vicino a me in una zona che il telefono non ha già in memoria, o che ha in memoria da più di 7 giorni.
- Cosa riceve: uno o più riquadri fissi di circa 5 × 4 km, quelli attorno a te. Mai il punto esatto.
- Chi lo gestisce: Private.coffee (associazione non profit, Austria) su overpass.private.coffee. Dichiara di registrare l'indirizzo IP solo in parte (accorciato), con ora e tipo di richiesta, per 48 ore al massimo. Di riserva, se il primo non risponde: FOSSGIS su overpass-api.de. Non siamo riusciti a verificare per quanto tempo conserva i registri.
- Spegnerlo: "Vicino a me online". Restano i tuoi posti salvati.
- [Termini e privacy di Private.coffee Overpass](https://overpass.private.coffee/) · [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)

**Ricerca indirizzi del Giro (Photon, di komoot, dati OpenStreetMap)**

- Quando: mentre scrivi un indirizzo nel Giro, a ogni breve pausa, anche se il telefono lo ha già imparato; e per ogni indirizzo riconosciuto in un testo che scansioni, detti o incolli, se il telefono non lo ha già imparato. Solo dopo che hai attivato la ricerca: è spenta finché non lo fai tu.
- Cosa riceve: il testo che scrivi in "Cerca", anche a metà; di quello che scansioni, detti o incolli solo gli indirizzi riconosciuti (o la riga che correggi a mano), uno alla volta; e la tua zona approssimata a circa 10 km. Mai il punto esatto.
- Photon non pubblica una sua informativa privacy: non sappiamo cosa registra. Scrivi solo via, numero e città: mai nomi.
- Spegnerlo: "Ricerca indirizzi online". Restano gli indirizzi che il telefono ha imparato, "Aggiungi qui", le coordinate e le tue note.
- [Photon](https://photon.komoot.io/)

**Meteo del turno (Open-Meteo, di OpenMeteo GmbH, Svizzera)**

- Quando: all'inizio del turno, per la riga meteo di "Oggi occhio a". Solo dopo che hai acceso "Meteo online": è spento finché non lo fai tu. La risposta vale 60 minuti: in quell'ora non parte un'altra richiesta.
- Cosa riceve: la tua zona approssimata a circa 10 km. Mai il punto esatto.
- Open-Meteo dichiara: niente cookie né tracciamento; può raccogliere l'indirizzo IP per motivi tecnici; i registri del server possono contenere le coordinate richieste e vengono cancellati dopo 90 giorni.
- Spegnerlo: "Meteo online". Il turno funziona uguale, senza la riga meteo.
- [Termini e privacy di Open-Meteo](https://open-meteo.com/en/terms)

Ognuno di questi servizi usa i propri registri secondo le proprie regole: noi non li controlliamo. La voce che legge gli avvisi e le frasi pronte è quella del telefono. L'app usa solo voci che il telefono dichiara installate. Come lavora quella voce dipende da Apple o da Google, non da noi. La posizione la calcola il telefono, con il servizio di Apple o Google e le loro regole.

## 4. Quello che mandi tu

Parte solo quando tocchi invia, condividi o un navigatore. Prima vedi il testo o il nome del file. L'app di messaggi che scegli può aprire da sola i link del messaggio per mostrare l'anteprima.

- **Segnalazione ai colleghi:** un link a {{APP_NAME}} con tipo, punto, ora, scadenza e il testo breve che scrivi. Niente nome, niente codice del telefono. Chi lo riceve vede chi sei dalla chat, può leggerlo e inoltrarlo. Non si può ritirare.
- **Passa la zona:** un file con le note che scegli: posizione, categoria, testo, giorni e orari, timbri "trovato chiuso" e "trovato aperto", data dell'ultima modifica e, se le includi, le foto. Mai le note "Solo per me", i turni o le impostazioni. Chi riceve più file tuoi può capire che vengono dalla stessa persona.
- **Backup:** un file con note e foto, avvisi già dati, turni e ore, diario furgone, quello che il Giro ha imparato e impostazioni (con contatto fidato e numeri rapidi). Restano fuori il giro, il punto di Furgone qui, il Ritmo, le segnalazioni, i dati tecnici e le copie temporanee. Non è protetto: tienilo per te.
- **Ore (CSV) e foto del furgone:** solo se li esporti o li condividi.
- **SOS:** un messaggio con la tua posizione e un link a Google Maps, al contatto che hai scelto, via WhatsApp o SMS. Per mostrare l'anteprima WhatsApp può aprire quel link: Google vede il punto e il tuo indirizzo IP.
- **Portami lì:** apre Google Maps, Waze o Mappe di Apple con la destinazione. Vale anche per "Vai" del Giro e per "Portami lì a piedi" di Furgone qui: la destinazione è il punto della fermata o del furgone.
- **Numeri rapidi:** toccandone uno si apre il telefono con quel numero. La chiamata la fai tu.
- **Fai provare a un collega:** il link dell'app, oppure un codice QR disegnato sul telefono. Dentro c'è solo l'indirizzo dell'app: niente dati tuoi.

Per aprire WhatsApp su un contatto usiamo un link di WhatsApp: il testo del messaggio e il numero possono passare dai server di WhatsApp prima di arrivare nella chat.

Da lì in poi valgono le regole di quelle app e di chi riceve. Noi non vediamo niente di tutto questo.

## 5. Permessi del telefono

- **Posizione:** serve per avvisarti vicino alle tue note, per i posti vicini, per salvare il punto di una nota o di una foto del furgone, per ordinare il Giro e imparare gli ingressi, per ricordare dove hai lasciato il furgone, per il meteo del turno e la ricerca indirizzi (solo la zona arrotondata) e per l'SOS. Funziona solo con l'app aperta e lo schermo acceso. Resta sul telefono, tranne i casi delle sezioni 3 e 4.
- **Fotocamera:** solo quando tocchi "Scatta foto". {{APP_NAME}} tiene la sua copia sul telefono. Se la fotocamera del tuo telefono ne salva una anche nella galleria, quella segue le regole del telefono. Nel Giro le etichette le legge "Scansiona testo" della tastiera del telefono (Apple, Google o altri), con le sue regole: {{APP_NAME}} riceve solo il testo, mai l'immagine.
- **Microfono:** {{APP_NAME}} non lo usa e non trasforma la voce in testo. Se detti una nota con il microfono della tastiera, la voce la gestisce la tastiera (Apple, Google o altri) con le sue regole.
- **Appunti:** solo quando tocchi "Incolla segnalazione" o, nel Giro, "Incolla dagli appunti".

Puoi negare o togliere ogni permesso dalle impostazioni del telefono. Turni, ore e SOS funzionano lo stesso.

## 6. Cookie e memoria locale

{{APP_NAME}} non usa cookie, né nostri né di altri. Usa la memoria locale del browser solo per funzionare: i tuoi dati, i file dell'app per l'uso senza rete, tema e lingua. Per questo la legge non richiede un consenso né un banner.

## 7. Conservazione e cancellazione

- I dati restano sul telefono finché non li cancelli: una nota alla volta, oppure Impostazioni → Elimina tutto, che cancella anche i pezzi di mappa salvati. Su iPhone li cancelli anche togliendo l'app dalla schermata Home. Su Android togliere l'icona può non bastare: usa prima Elimina tutto.
- Le segnalazioni ricevute si cancellano da sole 24 ore dopo la scadenza.
- Il giro si cancella da solo 24 ore dopo l'ultima modifica, oppure subito con "Svuota giro". Indirizzi imparati e tempi medi restano finché non usi Elimina tutto.
- Il punto di "Furgone qui" si cancella da solo dopo 24 ore, oppure subito con "L'ho ritrovato". I conteggi del Ritmo si cancellano quando il turno finisce. La previsione meteo salvata viene sostituita alla richiesta successiva.
- Noi non conserviamo niente, quindi non possiamo recuperare dati persi. Fai un backup ogni settimana. L'iPhone può cancellare i dati di un'app web che non usi da tempo.
- Se ci mandi tu qualcosa (un messaggio, una schermata, i risultati della Diagnostica), lo usiamo solo per risponderti o correggere l'errore e lo cancelliamo entro 12 mesi. Non mandarci mai il backup: contiene tutte le tue note.

## 8. Minori

{{APP_NAME}} è pensata per chi lavora come corriere, quindi per maggiorenni. Non è rivolta a chi ha meno di 18 anni.

## 9. Perché possiamo farlo

I dati sul telefono li gestisci tu, non noi. Per il poco che passa da servizi esterni (sezione 3) e per i messaggi che ci mandi, la base è il nostro legittimo interesse a far funzionare l'app in sicurezza e a darti le funzioni che apri tu (art. 6, par. 1, lett. f, GDPR). Puoi opporti in ogni momento: spegni il servizio, oppure smetti di usare l'app.

## 10. I tuoi diritti

Il GDPR ti dà il diritto di accedere ai tuoi dati, correggerli, cancellarli, limitarne l'uso, opporti e riceverne copia (articoli 15-22).

- Per i dati sul telefono fai tutto da solo: li vedi, li modifichi, li esporti e li cancelli dall'app.
- Noi non abbiamo i dati che tieni nell'app e non possiamo riconoscerti. Se pensi il contrario, scrivi a {{CONTACT_EMAIL}}: ti rispondiamo entro un mese.
- Per i registri dei servizi della sezione 3 puoi rivolgerti a loro. Se ti serve una mano, scrivici.
- Puoi fare reclamo al Garante per la protezione dei dati personali: [www.garanteprivacy.it](https://www.garanteprivacy.it).

## 11. Dati di altre persone

Le note parlano di posti, non di persone. Se scrivi o fotografi dati di altri, ne rispondi tu: leggi i Termini d'uso.

## 12. Modifiche

Se cambiamo questa informativa aggiorniamo la data in alto. Se la modifica è importante, te lo diciamo nell'app alla prima apertura.
