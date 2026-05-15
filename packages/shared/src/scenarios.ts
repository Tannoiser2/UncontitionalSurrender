export type ScenarioId =
  | "poland1939"
  | "scandinavia1940"
  | "france1940"
  | "france1941"
  | "balkans1941"
  | "frenchNorthAfrica1942"
  | "italy1943"
  | "italy1943Include"
  | "france1944"
  | "franceItaly1944"
  | "barbarossa1941"
  | "russia19411944";

export type ScenarioMapId =
  | "poland"
  | "scandinavia"
  | "france"
  | "balkans"
  | "west"
  | "italy"
  | "france-italy"
  | "russia";

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  mapId: ScenarioMapId;
  startTurn: number;
  endTurn: number;
  turnCodes?: string[];
  turnRange: string;
  rulesTitle: string;
  specialRules?: string[];
  description: string;
  status: "implemented" | "planned";
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "poland1939",
    title: "Poland 1939",
    mapId: "poland",
    startTurn: 1,
    endTurn: 1,
    turnRange: "Sep 1939",
    rulesTitle: "Regole speciali Polonia 1939",
    description: "Invasione tedesca della Polonia. Non ci sono Fase Economia ne Fase Movimento Strategico.",
    status: "planned"
  },
  {
    id: "scandinavia1940",
    title: "Scandinavia 1940",
    mapId: "scandinavia",
    startTurn: 1,
    endTurn: 2,
    turnRange: "Apr 1940 - May 1940",
    rulesTitle: "Regole speciali Scandinavia 1940",
    description: "Invasione tedesca di Danimarca e Norvegia.",
    status: "planned"
  },
  {
    id: "france1940",
    title: "France 1940",
    mapId: "france",
    startTurn: 1,
    endTurn: 5,
    turnCodes: ["May-40", "Jun-40", "Jul-40", "Aug-40", "Sep-40"],
    turnRange: "May 1940 - Sep 1940",
    rulesTitle: "Regole speciali Francia 1940",
    specialRules: [
      "Le unita di terra francesi in stack con i forti Maginot iniziano lo scenario occupando quei forti.",
      "Alla fine delle Operazioni Asse di May-40, France 2 Air entra in una citta francese amica con 4 sortite.",
      "Un Air Rebase britannico deve terminare in Gran Bretagna o entro tre esagoni dalla Gran Bretagna.",
      "Le Invasioni Anfibie occidentali sono proibite in porti del Belgio o dei Paesi Bassi, o in esagoni adiacenti a quei porti.",
      "Solo una unita di terra nella Western Mediterranean Box puo invadere Marsiglia o un esagono adiacente; una unita a Marsiglia non puo effettuare Invasione Anfibia.",
      "Le unita belghe possono muovere o ritirarsi solo in Belgio o Germania.",
      "Le unita olandesi possono muovere o ritirarsi solo nei Paesi Bassi o in Germania."
    ],
    description: "Scenario attuale sulla mappa Western Europe: setup Asse/Alleati, eventi, economia e vittoria France 1940.",
    status: "implemented"
  },
  {
    id: "france1941",
    title: "France 1941",
    mapId: "france",
    startTurn: 1,
    endTurn: 5,
    turnCodes: ["May-41", "Jun-41", "Jul-41", "Aug-41", "Sep-41"],
    turnRange: "May 1941 - Sep 1941",
    rulesTitle: "Regole speciali Francia 1941",
    specialRules: [
      "Durante la Fase Operazioni Asse del primo turno, l'Asse deve attaccare oppure muovere in Belgio, Paesi Bassi o Francia.",
      "L'Asse non puo effettuare Invasioni Anfibie e non puo piazzare Airdrop in Gran Bretagna.",
      "Gli esagoni 3521 e 3620 in Italia sono USS tedesca e italiana; la citta tedesca e considerata anche USS italiana.",
      "Le unita di terra francesi in stack con i forti Maginot iniziano lo scenario occupando quei forti.",
      "Alla fine delle Operazioni Asse di May-41, France 2 Air entra in una citta francese amica con 4 sortite.",
      "Un Air Rebase britannico deve terminare in Gran Bretagna o entro tre esagoni dalla Gran Bretagna.",
      "Le Invasioni Anfibie occidentali sono proibite in porti belgi o olandesi, o in esagoni adiacenti a quei porti.",
      "Solo una unita di terra nella Western Mediterranean Box puo invadere Marsiglia o un esagono adiacente; una unita a Marsiglia non puo effettuare Invasione Anfibia."
    ],
    description: "Invasione tedesca ipotetica e ritardata di Belgio, Francia e Paesi Bassi.",
    status: "implemented"
  },
  {
    id: "balkans1941",
    title: "Balkans 1941",
    mapId: "balkans",
    startTurn: 1,
    endTurn: 2,
    turnCodes: ["Apr-41", "May-41"],
    turnRange: "Apr 1941 - May 1941",
    rulesTitle: "Regole speciali Balcani 1941",
    specialRules: [
      "Non c'e Fase Movimento Strategico.",
      "Per determinare il meteo di Aprile, tira sulla riga Apr (Mar Severe) della tabella meteo Balcani/FNA/Italia.",
      "L'Asse vince se Grecia e Yugoslavia sono conquistate entro la fine dell'ultimo turno; altrimenti vincono gli Occidentali.",
      "Una unita occidentale non puo muovere in un paese dell'Asse, ma esercita ZOC al suo interno."
    ],
    description: "Invasione dell'Asse di Yugoslavia e Grecia.",
    status: "implemented"
  },
  {
    id: "frenchNorthAfrica1942",
    title: "French North Africa 1942-1943",
    mapId: "west",
    startTurn: 1,
    endTurn: 8,
    turnCodes: ["Nov-42", "Dec-42", "Jan-43", "Feb-43", "Mar-43", "Apr-43", "May-43", "Jun-43"],
    turnRange: "Nov 1942 - Jun 1943",
    rulesTitle: "Regole speciali Nord Africa Francese 1942-1943",
    specialRules: [
      "Mappa West/FNA doppia: 31 esagoni per riga, da 4002 a 5332. Usa il lato meteo Balkans/FNA/Italy; per Nov tira sulla riga Nov (Oct Poor).",
      "La fazione Asse vince in una Victory Phase se non c'e alcuna unita terrestre occidentale in French North Africa. Altrimenti vince se gli Occidentali non controllano tutte le citta FNA entro Jun-43.",
      "Gli Occidentali vincono se tutte le citta di French North Africa sono sotto controllo occidentale entro la fine dell'ultimo turno.",
      "Le prime due azioni occidentali devono attivare UK 1 Canada e USA Task Force: ciascuna effettua una Invasione Anfibia automatica in Casablanca, Oran o Algiers, senza usare lo stesso porto due volte.",
      "L'Asse non puo usare Naval Transport. Germany 5 Pz non puo essere attivata nel primo turno.",
      "Italy 1 entra tramite attivazione durante Operazioni Asse in Gabes o Tunis amici; se non puo entrare, ritarda al turno successivo.",
      "Le unita ground tedesche o italiane eliminate sono rimosse dallo scenario.",
      "Il supporto aereo tedesco e rappresentato da due sortite fighter gratuite per turno con origine 4526.",
      "Tunis amica e LSS per massimo due unita tedesche e/o italiane; le unita tedesche/italiane possono tentare Full Supply da Gabes o Tunis con tiro 1-3."
    ],
    description: "Invasione alleata del Nord Africa Francese.",
    status: "implemented"
  },
  {
    id: "italy1943",
    title: "Italy 1943-44",
    mapId: "italy",
    startTurn: 1,
    endTurn: 14,
    turnCodes: ["Aug-43", "Sep-43", "Oct-43", "Nov-43", "Dec-43", "Jan-44", "Feb-44", "Mar-44", "Apr-44", "May-44", "Jun-44", "Jul-44", "Aug-44", "Sep-44"],
    turnRange: "Aug 1943 - Sep 1944 / Jul 1943 - Sep 1944",
    rulesTitle: "Regole speciali Italia 1943-44",
    specialRules: [
      "Setup base: variante Exclude-Italy. L'Italia e trattata come paese dell'Asse conquistato; le citta italiane iniziano sotto controllo Asse salvo marker di controllo occidentale.",
      "La mappa usa il lato meteo Balkans/FNA/Italy.",
      "La Western faction controlla inizialmente Tunisi 4622. Yugoslavia e Vichy France/Corsica sono paesi occidentali conquistati e le loro citta iniziano sotto controllo Asse se non marcate diversamente.",
      "La Germania ha produzione NA fino a May-44, poi 6 PP da Jun-44 a fine scenario. UK ha produzione NA fino a May-44, poi 6 PP da Jun-44.",
      "Central Mediterranean Box: solo unita occidentali, nessun limite di stacking, full supply, porto amico occidentale, solo movimento navale in entrata/uscita e nessun attacco in entrata/uscita.",
      "Dalla Central Mediterranean Box si puo effettuare una sola Invasione Anfibia occidentale per turno nelle zone consentite dallo scenario e solo usando Surprise Attack secondo regola.",
      "A partire da Sep-43 l'Asse vince se gli Occidentali non controllano alcuna citta fuori dalla French North Africa.",
      "Prima di Jun-44 gli Occidentali vincono se l'Asse controlla quattro o meno citta in Italia, Sardegna e Sicilia. Da Jun-44 il limite resta quattro, ma scende a tre se e stato usato Surprise Attack.",
      "La variante Include-Italy, con Italia attiva da Jul-43, resta separata: questo setup carica la versione Exclude-Italy del playbook."
    ],
    description: "Campagna alleata in Italia, con aperture Exclude-Italy e Include-Italy.",
    status: "implemented"
  },
  {
    id: "italy1943Include",
    title: "Italy 1943-44 Include Italy",
    mapId: "italy",
    startTurn: 1,
    endTurn: 15,
    turnCodes: ["Jul-43", "Aug-43", "Sep-43", "Oct-43", "Nov-43", "Dec-43", "Jan-44", "Feb-44", "Mar-44", "Apr-44", "May-44", "Jun-44", "Jul-44", "Aug-44", "Sep-44"],
    turnRange: "Jul 1943 - Sep 1944",
    rulesTitle: "Regole speciali Italia 1943-44 Include Italy",
    specialRules: [
      "Variante Include-Italy: l'Italia inizia come paese attivo dell'Asse con National Will 3 e produzione 2 per factory.",
      "Il primo turno e Jul-43. Dopo il setup Include-Italy si aggiungono i rimanenti counter del setup Exclude-Italy nelle loro posizioni.",
      "Durante la prima Fase Operazioni Asse, una unita dell'Asse schierata in un porto non puo muovere.",
      "La mappa usa il lato meteo Balkans/FNA/Italy.",
      "La Western faction controlla inizialmente Tunisi 4622; altri control marker occidentali sono quelli indicati dal setup Include-Italy.",
      "Central Mediterranean Box: solo unita occidentali, nessun limite di stacking, full supply, porto amico occidentale, solo movimento navale in entrata/uscita e nessun attacco in entrata/uscita.",
      "Dalla Central Mediterranean Box si puo effettuare una sola Invasione Anfibia occidentale per turno nelle zone consentite dallo scenario e solo usando Surprise Attack secondo regola.",
      "A partire da Sep-43 l'Asse vince se gli Occidentali non controllano alcuna citta fuori dalla French North Africa.",
      "Prima di Jun-44 gli Occidentali vincono se l'Asse controlla quattro o meno citta in Italia, Sardegna e Sicilia. Da Jun-44 il limite scende a tre se e stato usato Surprise Attack."
    ],
    description: "Variante completa con Italia attiva e turno iniziale Jul-43.",
    status: "implemented"
  },
  {
    id: "france1944",
    title: "France 1944",
    mapId: "france",
    startTurn: 1,
    endTurn: 4,
    turnCodes: ["Jun-44", "Jul-44", "Aug-44", "Sep-44"],
    turnRange: "Jun 1944 - Sep 1944",
    rulesTitle: "Regole speciali Francia 1944",
    specialRules: [
      "Gli Occidentali vincono se l'Asse controlla sei o meno citta in Belgio, Paesi Bassi, Francia Occupata e Vichy; altrimenti vince l'Asse.",
      "Il controllo occidentale di una citta tedesca non modifica il conteggio delle citta per France 1944.",
      "Durante la Fase Operazioni Asse del primo turno, una unita tedesca schierata in un porto non puo muovere.",
      "Ogni turno, dopo aver calcolato i punti produzione iniziali della Germania, l'Asse tira 1d6 e li riduce del risultato.",
      "Un bomber che effettua Air Rebase non puo terminare fuori dalla Gran Bretagna.",
      "Una unita bomber non puo essere eliminata.",
      "Durante i Rimpiazzi, rimuovi al massimo una sortita da ciascuna unita bomber.",
      "Una Invasione Anfibia in Marsiglia o in un esagono adiacente puo essere effettuata solo da una unita di terra nella Western Mediterranean Box.",
      "Western Mediterranean Box: solo unita occidentali, nessun limite di stacking, full supply, porto amico occidentale, solo movimento navale in entrata/uscita, nessun attacco in entrata/uscita.",
      "Una unita aerea nella Western Mediterranean Box puo fornire Air Support in un combattimento terrestre negli esagoni costieri 3817-3620."
    ],
    description: "Campagna occidentale per liberare la Francia.",
    status: "implemented"
  },
  {
    id: "franceItaly1944",
    title: "France-Italy 1944",
    mapId: "france-italy",
    startTurn: 1,
    endTurn: 4,
    turnRange: "Jun 1944 - Sep 1944",
    rulesTitle: "Regole speciali Francia-Italia 1944",
    description: "Scenario combinato sulle mappe Francia e Italia.",
    status: "planned"
  },
  {
    id: "barbarossa1941",
    title: "Barbarossa 1941",
    mapId: "russia",
    startTurn: 1,
    endTurn: 7,
    turnCodes: ["Jun-41", "Jul-41", "Aug-41", "Sep-41", "Oct-41", "Nov-41", "Dec-41"],
    turnRange: "Jun 1941 - Dec 1941",
    rulesTitle: "Regole speciali Barbarossa 1941",
    specialRules: [
      "Mappa Eastern Front: 29 colonne x 29 righe, da 1235 a 4063. Usa la tabella meteo Baltic/Russia.",
      "L'Asse vince se la National Will sovietica scende sotto 45 alla Victory Check di Jan-42; altrimenti vince l'URSS.",
      "RIFORNIMENTO ASSE: qualsiasi esagono tedesco/romeno/ungherese/finlandese con ferrovia che esce sul bordo occidentale della mappa e USS illimitata. Citta alleate dell'Asse in territorio controllato Asse sono USS limitate.",
      "MOBILITAZIONE D'EMERGENZA SOVIETICA: alla fine delle Operazioni Asse di Jun-41, l'URSS riceve gratis 1 unita aerea e 5 armate dalla Mobilization Box (Air 3, Armate 7, 14, 16, 22, 23).",
      "BLITZKRIEG Jun-41: le unita corazzate tedesche possono muovere il doppio in terreno aperto dopo aver rotto il fronte; le armate sovietiche a contatto col nemico hanno movimento dimezzato.",
      "INVERNO RUSSO (Dec-41): meteo Snow/Severe — tutte le unita dimezzano il movimento; le unita tedesche hanno -1 al combattimento.",
      "FANGO (Oct-41 e Nov-41): meteo Mud — tutte le unita dimezzano il movimento.",
      "FINLANDIA: e alleata dell'Asse ma non viene attivata automaticamente. L'Asse puo attivarla dopo le Operazioni di Jun-41 se ha ottenuto un Political Success.",
      "RIMOZIONE LUFTFLOTTE 2 (Dec-41): durante la Fase Movimento Strategico di Dec-41, Luftflotte 2 deve essere rimossa dalla mappa (trasferita sul fronte occidentale).",
      "Le unita sovietiche eliminate sono rimpiazzabili con PP a partire da Aug-41. Le unita tedesche eliminate sono rimosse dallo scenario.",
      "Le unita tedesche non possono usare Naval Transport. La produzione sovietica e ridotta per ogni citta di produzione controllata dall'Asse."
    ],
    description: "L'invasione tedesca dell'Unione Sovietica, Jun-Dec 1941.",
    status: "implemented"
  },
  {
    id: "russia19411944",
    title: "Russia 1941-1944",
    mapId: "russia",
    startTurn: 1,
    endTurn: 43,
    turnCodes: [
      "Jun-41","Jul-41","Aug-41","Sep-41","Oct-41","Nov-41","Dec-41",
      "Jan-42","Feb-42","Mar-42","Apr-42","May-42","Jun-42","Jul-42","Aug-42","Sep-42","Oct-42","Nov-42","Dec-42",
      "Jan-43","Feb-43","Mar-43","Apr-43","May-43","Jun-43","Jul-43","Aug-43","Sep-43","Oct-43","Nov-43","Dec-43",
      "Jan-44","Feb-44","Mar-44","Apr-44","May-44","Jun-44","Jul-44","Aug-44","Sep-44","Oct-44","Nov-44","Dec-44"
    ],
    turnRange: "Jun 1941 - Dec 1944",
    rulesTitle: "Regole speciali Russia 1941-1944",
    specialRules: [
      "Mappa Eastern Front: 29 colonne x 29 righe, da 1235 a 4063. Usa la tabella meteo Baltic/Russia.",
      "L'Asse vince immediatamente se l'URSS collassa o se la fazione sovietica non vince. La fazione sovietica vince se ci sono meno di 4 unità terrestri tedesche nell'URSS.",
      "PRODUZIONE GERMANIA: 13 PP/turno nel 1941, 11 nel 1942, 9 nel 1943-44. Ridotta dal valore del marker Fac Lost.",
      "RIFORNIMENTO ASSE: qualsiasi esagono con ferrovia che esce sul bordo occidentale della mappa è USS illimitata per l'Asse. Un Transport Line hex sul bordo ovest è anche Mobilization Location solo per la Germania.",
      "BLITZKRIEG Jun-41: i Panzer tedeschi hanno movimento doppio in terreno aperto.",
      "MOBILITAZIONE D'EMERGENZA SOVIETICA: alla fine delle Operazioni Asse di Jun-41, se l'Asse ha attivato la Finlandia, l'URSS riceve gratis 1 unità aerea e 5 armate dalla Conditional box.",
      "FINLANDIA: l'Asse può attivarla dopo le Operazioni di Jun-41 (Political Success). Se attivata, scatta il Conditional Event Northern Border URSS.",
      "RIMOZIONE LUFTFLOTTE 2 (Dec-41): durante la Fase Movimento Strategico di Dec-41, l'Asse deve rimuovere uno Luftflotte dal fronte Est.",
      "INVERNO RUSSO (Dec-41 in poi): meteo Snow/Severe — movimento dimezzato; -1 al combattimento tedesco.",
      "UNGHERIA: mobilita nell'esagono 3234.",
      "ITALIA: entra Apr-42 in 2933. Se eliminata, torna 2 turni dopo in un Transport Line hex sul bordo ovest. Rimossa dallo scenario a Jul-43.",
      "SHOCK ARMIES: Armate Shock 1-4 entrano in Mobilizzazione Oct-Nov 41 (disponibili Sep-41 come uscita).",
      "LEND LEASE: 2 unità Lend Lease entrano nel Turn Track a Dec-41.",
      "URALS FACTORIES: 2 unità entrano nel Turn Track a Jul-41."
    ],
    description: "La campagna completa sul fronte orientale dall'invasione tedesca del 1941 alla fine del 1944.",
    status: "implemented"
  }
];

export const DEFAULT_SCENARIO_ID: ScenarioId = "france1940";

export const scenarioById = (id: string | undefined): ScenarioDefinition =>
  SCENARIOS.find((scenario) => scenario.id === id) ||
  SCENARIOS.find((scenario) => scenario.id === DEFAULT_SCENARIO_ID) ||
  SCENARIOS[0];
