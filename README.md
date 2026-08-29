# RoutineGentile Skin Check

RoutineGentile è una beta di lettura cosmetica fotografica per maggiorenni.
Una foto frontale viene elaborata tramite DermIQ e restituisce indicatori
sull'aspetto di imperfezioni, linee, pori, rossore, oleosità, texture,
occhiaie e compattezza. Il risultato non è una diagnosi.

## Flusso

1. selfie guidato con ovale: avanti, sinistra e destra;
2. controllo locale di risoluzione, luce, nitidezza e centratura;
3. età reale e profilo cosmetico obbligatori;
4. invio della sola foto frontale compressa al backend;
5. polling protetto dei risultati DermIQ;
6. indicatori, massimo tre segnali da osservare e routine prudente;
7. mappe mostrate solo quando la stessa priorità è confermata da almeno due
   scansioni coerenti.

Le foto laterali non vengono inviate. Se l'utente dichiara barba o baffi,
gli indicatori che possono confondere i peli con la pelle sono esclusi dalle
priorità e dalle mappe.

## Affidabilità e limiti

- la prima scansione è sempre indicata come provvisoria;
- l'età visiva è presentata come fascia orientativa, non come età misurata;
- i risultati recenti possono essere stabilizzati con la mediana di massimo
  tre osservazioni;
- luce, posa, trucco, fotocamera e variazioni del modello possono cambiare il
  risultato;
- nessun output deve essere interpretato come acne diagnosticata, patologia,
  lesione, prescrizione o promessa di risultato.

## Privacy

Il profilo e l'eventuale analisi in corso possono essere conservati
temporaneamente nel browser. Lo storico locale contiene numeri e profilo, mai
fotografie, e può essere cancellato dall'utente.

La foto frontale compressa e l'età dichiarata vengono trasmesse a DermIQ
tramite le funzioni server protette. La chiave `DERMIQ_API_KEY` non viene mai
inviata al browser. `DERMIQ_ANALYSIS_ENABLED=false` funge da interruttore di
emergenza.

## Sviluppo

Non sono necessarie dipendenze esterne.

```bash
npm test
npm run build
```

## Pubblicazione

Il progetto è collegato a GitHub e Vercel: ogni commit su `main` avvia ora un
deploy automatico. Prima della produzione:

1. eseguire tutti i test;
2. verificare localmente interfaccia e API health;
3. pubblicare una preview;
4. provare il flusso browser → API → DermIQ → risultati;
5. promuovere in produzione soltanto dopo la verifica.

RoutineGentile offre osservazioni cosmetiche informative. Per sintomi
persistenti, lesioni, terapie o dubbi clinici, rivolgersi a un professionista.
