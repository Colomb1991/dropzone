// @ts-check
// Town names the address reader knows by heart: every municipality of Tuscany (273, the launch
// region), the places around Livorno that labels write as a town, and the larger towns of the rest of
// Italy. A hint, not a filter: it tells the reader where a town ends when a label has no postal code
// and no province, so that a name printed after it is never taken for a piece of the town.

/** Livorno, Pisa, Lucca, Massa-Carrara, Pistoia, Prato, Firenze, Arezzo, Siena, Grosseto. */
const TUSCANY = [
  // LI
  'Bibbona', 'Campiglia Marittima', "Campo nell'Elba", 'Capoliveri', 'Capraia Isola', 'Castagneto Carducci',
  'Cecina', 'Collesalvetti', 'Livorno', 'Marciana', 'Marciana Marina', 'Piombino', 'Porto Azzurro', 'Portoferraio',
  'Rio', 'Rosignano Marittimo', 'San Vincenzo', 'Sassetta', 'Suvereto',
  // PI
  'Bientina', 'Buti', 'Calci', 'Calcinaia', 'Capannoli', 'Casale Marittimo', 'Casciana Terme Lari', 'Cascina',
  'Castelfranco di Sotto', 'Castellina Marittima', 'Castelnuovo di Val di Cecina', 'Chianni', 'Crespina Lorenzana',
  'Fauglia', 'Guardistallo', 'Lajatico', 'Montecatini Val di Cecina', 'Montescudaio', 'Monteverdi Marittimo',
  "Montopoli in Val d'Arno", 'Orciano Pisano', 'Palaia', 'Peccioli', 'Pisa', 'Pomarance', 'Ponsacco', 'Pontedera',
  'Riparbella', 'San Giuliano Terme', 'San Miniato', "Santa Croce sull'Arno", 'Santa Luce', 'Santa Maria a Monte',
  'Terricciola', 'Vecchiano', 'Vicopisano', 'Volterra',
  // LU
  'Altopascio', 'Bagni di Lucca', 'Barga', 'Borgo a Mozzano', 'Camaiore', 'Camporgiano', 'Capannori', 'Careggine',
  'Castelnuovo di Garfagnana', 'Castiglione di Garfagnana', 'Coreglia Antelminelli', 'Fabbriche di Vergemoli',
  'Forte dei Marmi', 'Fosciandora', 'Gallicano', 'Lucca', 'Massarosa', 'Minucciano', 'Molazzana', 'Montecarlo',
  'Pescaglia', 'Piazza al Serchio', 'Pietrasanta', 'Pieve Fosciana', 'Porcari', 'San Romano in Garfagnana',
  'Seravezza', 'Sillano Giuncugnano', 'Stazzema', 'Vagli Sotto', 'Viareggio', 'Villa Basilica', 'Villa Collemandina',
  // MS
  'Aulla', 'Bagnone', 'Carrara', 'Casola in Lunigiana', 'Comano', 'Filattiera', 'Fivizzano', 'Fosdinovo',
  'Licciana Nardi', 'Massa', 'Montignoso', 'Mulazzo', 'Podenzana', 'Pontremoli', 'Tresana',
  'Villafranca in Lunigiana', 'Zeri',
  // PT
  'Abetone Cutigliano', 'Agliana', 'Buggiano', 'Chiesina Uzzanese', 'Lamporecchio', 'Larciano', 'Marliana',
  'Massa e Cozzile', 'Monsummano Terme', 'Montale', 'Montecatini Terme', 'Pescia', 'Pieve a Nievole', 'Pistoia',
  'Ponte Buggianese', 'Quarrata', 'Sambuca Pistoiese', 'San Marcello Piteglio', 'Serravalle Pistoiese', 'Uzzano',
  // PO
  'Cantagallo', 'Carmignano', 'Montemurlo', 'Poggio a Caiano', 'Prato', 'Vaiano', 'Vernio',
  // FI
  'Bagno a Ripoli', 'Barberino di Mugello', 'Barberino Tavarnelle', 'Borgo San Lorenzo', 'Calenzano',
  'Campi Bisenzio', 'Capraia e Limite', 'Castelfiorentino', 'Cerreto Guidi', 'Certaldo', 'Dicomano', 'Empoli',
  'Fiesole', 'Figline e Incisa Valdarno', 'Firenze', 'Firenzuola', 'Fucecchio', 'Gambassi Terme', 'Greve in Chianti',
  'Impruneta', 'Lastra a Signa', 'Londa', 'Marradi', 'Montaione', 'Montelupo Fiorentino', 'Montespertoli',
  'Palazzuolo sul Senio', 'Pelago', 'Pontassieve', 'Reggello', "Rignano sull'Arno", 'Rufina',
  'San Casciano in Val di Pesa', 'San Godenzo', 'Scandicci', 'Scarperia e San Piero', 'Sesto Fiorentino', 'Signa',
  'Vaglia', 'Vicchio', 'Vinci',
  // AR
  'Anghiari', 'Arezzo', 'Badia Tedalda', 'Bibbiena', 'Bucine', 'Capolona', 'Caprese Michelangelo',
  'Castel Focognano', 'Castel San Niccolò', 'Castelfranco Piandiscò', 'Castiglion Fibocchi', 'Castiglion Fiorentino',
  'Cavriglia', 'Chitignano', 'Chiusi della Verna', 'Civitella in Val di Chiana', 'Cortona', 'Foiano della Chiana',
  'Laterina Pergine Valdarno', 'Loro Ciuffenna', 'Lucignano', 'Marciano della Chiana', 'Monte San Savino',
  'Montemignaio', 'Monterchi', 'Montevarchi', 'Ortignano Raggiolo', 'Pieve Santo Stefano', 'Poppi',
  'Pratovecchio Stia', 'San Giovanni Valdarno', 'Sansepolcro', 'Sestino', 'Subbiano', 'Talla',
  'Terranuova Bracciolini',
  // SI
  'Abbadia San Salvatore', 'Asciano', 'Buonconvento', "Casole d'Elsa", 'Castellina in Chianti',
  'Castelnuovo Berardenga', "Castiglione d'Orcia", 'Cetona', 'Chianciano Terme', 'Chiusdino', 'Chiusi',
  "Colle di Val d'Elsa", 'Gaiole in Chianti', 'Montalcino', 'Montepulciano', 'Monteriggioni', "Monteroni d'Arbia",
  'Monticiano', 'Murlo', 'Piancastagnaio', 'Pienza', 'Poggibonsi', 'Radda in Chianti', 'Radicofani', 'Radicondoli',
  'Rapolano Terme', 'San Casciano dei Bagni', 'San Gimignano', "San Quirico d'Orcia", 'Sarteano', 'Siena',
  'Sinalunga', 'Sovicille', 'Torrita di Siena', 'Trequanda',
  // GR
  'Arcidosso', 'Campagnatico', 'Capalbio', 'Castel del Piano', "Castell'Azzara", 'Castiglione della Pescaia',
  'Cinigiano', 'Civitella Paganico', 'Follonica', 'Gavorrano', 'Grosseto', 'Isola del Giglio',
  'Magliano in Toscana', 'Manciano', 'Massa Marittima', 'Monte Argentario', 'Monterotondo Marittimo', 'Montieri',
  'Orbetello', 'Pitigliano', 'Roccalbegna', 'Roccastrada', 'Santa Fiora', 'Scansano', 'Scarlino', 'Seggiano',
  'Semproniano', 'Sorano',
];

/** Places that are not a municipality but stand where the town goes on a label. */
const PLACES = [
  'Stagno', 'Guasticce', 'Vicarello', 'Nugola', 'Quercianella', 'Antignano', 'Ardenza', 'Montenero',
  'Castiglioncello', 'Vada', 'Rosignano Solvay', 'Gabbro', 'Nibbiaia', 'San Pietro in Palazzi', 'Marina di Cecina',
  'Donoratico', 'Marina di Castagneto Carducci', 'Bolgheri', 'Venturina Terme', 'Marina di Bibbona',
  'La California', 'Riotorto', 'Tirrenia', 'Marina di Pisa', 'Calambrone', 'Marina di Massa', 'Marina di Carrara',
  'Lido di Camaiore', 'Torre del Lago Puccini', 'Marina di Pietrasanta', 'Marina di Grosseto', 'Porto Santo Stefano',
  'Porto Ercole', 'Navacchio', 'Fornacette', 'Perignano', 'Lari', 'Saline di Volterra', 'Ponte a Egola',
  'Rio Marina', "Rio nell'Elba", 'Marina di Campo', 'Procchio',
];

/** Provincial capitals and the larger towns of the other regions. */
const ITALY = [
  'Agrigento', 'Alessandria', 'Ancona', 'Andria', 'Aosta', 'Ascoli Piceno', 'Asti', 'Avellino', 'Bari', 'Barletta',
  'Belluno', 'Benevento', 'Bergamo', 'Biella', 'Bologna', 'Bolzano', 'Brescia', 'Brindisi', 'Cagliari',
  'Caltanissetta', 'Campobasso', 'Carbonia', 'Caserta', 'Catania', 'Catanzaro', 'Cesena', 'Chieti', 'Como',
  'Cosenza', 'Cremona', 'Crotone', 'Cuneo', 'Enna', 'Fermo', 'Ferrara', 'Foggia', 'Forlì', 'Frosinone', 'Genova',
  'Gorizia', 'Iglesias', 'Imperia', 'Isernia', "L'Aquila", 'La Spezia', 'Latina', 'Lecce', 'Lecco', 'Lodi',
  'Macerata', 'Mantova', 'Matera', 'Messina', 'Milano', 'Modena', 'Monza', 'Napoli', 'Novara', 'Nuoro', 'Olbia',
  'Oristano', 'Padova', 'Palermo', 'Parma', 'Pavia', 'Perugia', 'Pesaro', 'Pescara', 'Piacenza', 'Pordenone',
  'Potenza', 'Ragusa', 'Ravenna', 'Reggio Calabria', 'Reggio di Calabria', 'Reggio Emilia', "Reggio nell'Emilia",
  'Rieti', 'Rimini', 'Roma', 'Rovigo', 'Salerno', 'Sassari', 'Savona', 'Siracusa', 'Sondrio', 'Taranto', 'Teramo',
  'Terni', 'Torino', 'Trani', 'Trapani', 'Trento', 'Treviso', 'Trieste', 'Udine', 'Urbino', 'Varese', 'Venezia',
  'Verbania', 'Vercelli', 'Verona', 'Vibo Valentia', 'Vicenza', 'Viterbo',
  'Sesto San Giovanni', 'Cinisello Balsamo', 'Busto Arsizio', 'Legnano', 'Rho', 'Gallarate', 'Vigevano',
  'Giugliano in Campania', 'Torre del Greco', 'Pozzuoli', 'Casoria', 'Afragola', 'Castellammare di Stabia',
  'Portici', 'Ercolano', 'Aversa', 'Cava de\' Tirreni', 'Battipaglia', 'Guidonia Montecelio', 'Fiumicino', 'Aprilia',
  'Pomezia', 'Civitavecchia', 'Velletri', 'Tivoli', 'Anzio', 'Carpi', 'Imola', 'Faenza', 'Sassuolo', 'San Severo',
  'Cerignola', 'Manfredonia', 'Altamura', 'Molfetta', 'Bitonto', 'Marsala', 'Gela', 'Vittoria', 'Bagheria',
  'Acireale', "Quartu Sant'Elena", 'Lamezia Terme', 'Sanremo', 'Chioggia', 'San Donà di Piave',
  'Bassano del Grappa', 'Moncalieri', 'Collegno', 'Rivoli', 'Nichelino', 'Settimo Torinese', 'Foligno',
  'Città di Castello', 'Fano', 'Senigallia', 'San Benedetto del Tronto', 'Montesilvano', 'Sarzana',
];

export const TOWNS = [...TUSCANY, ...PLACES, ...ITALY];

/** The two-letter codes of the Italian provinces, the retired ones of Sardinia included. */
export const PROVINCES = new Set(('AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CI CL CN CO '
  + 'CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OG OR OT '
  + 'PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV '
  + 'UD VA VB VC VE VI VR VS VT VV').split(' '));
