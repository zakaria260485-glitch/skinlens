# RoutineGentile

RoutineGentile è una guida cosmetica prudente costruita esclusivamente sulle risposte
dell'utente. Non valuta fotografie, non produce punteggi e non prova a
riconoscere condizioni della pelle.

La beta pubblica italiana usa il marchio provvisorio **RoutineGentile**. Prima
di acquistare un dominio o investire in pubblicità è necessaria una verifica
formale del marchio.

## Cosa offre

- routine disponibile anche senza fotografia;
- personalizzazione deterministica per tipo di pelle dichiarato, sensibilità,
  preferenza cosmetica, uso attuale di attivi o terapie e reazioni note;
- base universale con detergente delicato, idratante e protezione solare;
- cautele più rigorose e meno passaggi quando l'utente dichiara sensibilità,
  trattamenti già in uso o reazioni note;
- nessuna proposta di retinoidi, acidi, esfolianti o terapie;
- photo coach separato e facoltativo per esercitarsi con un solo scatto
  frontale, controllando soltanto risoluzione, luce generale e nitidezza.

## Privacy per costruzione

Il flusso dell'interfaccia viene eseguito interamente nel browser:

- non invia in rete risposte, routine o fotografie;
- non usa `localStorage`, `sessionStorage`, cookie o database del browser;
- non crea account e non conserva risposte;
- mantiene l'eventuale fotografia solo in memoria nella pagina aperta;
- revoca le anteprime e ferma la fotocamera quando la foto viene rimossa o la
  pagina viene lasciata.

Vercel Web Analytics raccoglie esclusivamente visualizzazioni anonime e
aggregate, senza cookie. La generazione della routine viene misurata come
navigazione alla rotta tecnica `/routine-creata`: nessuna risposta viene
inserita nell'URL o nell'evento. I parametri e il frammento dell'URL vengono
rimossi prima dell'invio delle statistiche.

La cartella `api/` è conservata come confine di compatibilità e rimane bloccata
per impostazione predefinita. L'interfaccia RoutineGentile non chiama alcun
endpoint.

## Pagine pubbliche

- `/` — routine builder e photo coach locale facoltativo;
- `/routine-creata` — rotta virtuale anonima usata per contare i completamenti;
- `/privacy.html` — trattamento dei dati spiegato in modo trasparente;
- `/terms.html` — limiti e condizioni d'uso della beta;
- `/contact.html` — referente e canale di feedback.

## Regole del motore

Il motore puro si trova in `lib/routine-builder.js`. Ogni campo obbligatorio è
validato e usato:

- `skinType` sceglie la consistenza di detergente e idratante;
- `sensitivity` riduce i passaggi e aggiunge cautele specifiche;
- `goal` cambia soltanto la nota di orientamento cosmetico, senza promettere un
  risultato;
- `activeUse` impedisce di aggiungere altri attivi e protegge le terapie già
  prescritte;
- `knownReactions` evita suggerimenti di ingredienti e rafforza il controllo
  dell'elenco ingredienti;
- `adultConsent` è un requisito esplicito per generare la guida.

## Sviluppo e controlli

Non sono necessarie dipendenze esterne.

```bash
npm test
npm run build
```

La suite controlla la matrice completa dei profili, le regole di prudenza, il
contratto dei campi obbligatori, l'assenza di richieste dal browser, la copia
pubblica e le protezioni server già presenti.

## Pubblicazione

Il progetto è statico e compatibile con Vercel. Prima di ogni pubblicazione:

1. eseguire `npm test`;
2. verificare il percorso completo senza foto;
3. verificare su mobile apertura, chiusura e rilascio della fotocamera;
4. pubblicare soltanto dopo approvazione esplicita del proprietario.

RoutineGentile offre informazioni cosmetiche generali. In presenza di allergie,
irritazione persistente, terapie prescritte o dubbi su un prodotto, l'utente
deve rivolgersi al professionista che lo segue.
