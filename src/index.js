const axios = require("axios");
const { mergeMap, map, tap, takeUntil } = require("rxjs/operators");
const { forkJoin, of, interval, Subject } = require("rxjs");
const notifier = require("node-notifier");
const loading = require("loading-cli");

const load = loading("Checking for free slots").start();

const stillAliveMessages = [
  "Still checking for free slots",
  "Still alive and checking",
  "No free slots found yet, still checking",
  "Checking for free slots",
];

function* stillAliveMessage() {
  let i = 0;
  while (true) {
    yield stillAliveMessages[i];
    i++;

    i = i === 3 ? 0 : i;
  }
}

const locations = [
  {
    id: 31659,
    name: "Strängnäs",
  },
  { id: 31656, name: "Trosa" },
  { id: 31657, name: "Gnesta" },
];

const BASE_URL =
  "https://apibk.cliento.com/api/v2/partner/cliento/6YoV801j3oiq2bf5pSb92o";

const toResult = ({ name, response: { nextAvailable } }) => {
  return {
    name,
    nextAvailable,
  };
};

const done$ = new Subject();

const notify = ({ name, nextAvailable }) => {
  if (nextAvailable) {
    const message = `${name} has new available time at ${nextAvailable}`;
    load.succeed([message]);
    notifier.notify(
      {
        title: message,
        message,
        open: "https://www.vaccina.se/covidvaccin/sormland/tidsbokning/#/calendar",
      },
      function (err) {
        if (err) console.error("Could not display notification", err);
      }
    );
    done$.next();
  }
};

const getStillAliveMessage = stillAliveMessage();

const getSlots = (location) =>
  axios
    .get(`${BASE_URL}/resources/slots`, {
      params: {
        srvIds: location.id,
        fromDate: "2021-06-01",
        toDate: "2021-10-30",
      },
    })
    .then(({ data }) => ({
      ...location,
      response: data,
    }));

interval(10000)
  .pipe(
    takeUntil(done$),
    tap(() => (load.text = getStillAliveMessage.next().value)),
    mergeMap(() =>
      forkJoin(
        locations.map((location) =>
          of(location).pipe(mergeMap(getSlots), map(toResult), tap(notify))
        )
      )
    )
  )
  .subscribe();
