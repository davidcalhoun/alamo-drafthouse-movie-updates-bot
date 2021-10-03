import {createReadStream, createWriteStream, writeFile, readFile} from 'fs';
import {promisify} from 'util';
import fetch from 'node-fetch';
import {difference, differenceWith, uniqBy, uniq} from 'ramda';
import dateFnsTz from 'date-fns-tz';
const { utcToZonedTime, format } = dateFnsTz;

const readFilePromisified = promisify(readFile);
const writeFilePromisified = promisify(writeFile);

export const fetchJSON = async (url) => {
    const response = await fetch(url);
    return await response.json();
}

export const read = async (path) => {
    let output;
    try {
        output = await readFilePromisified(path, 'utf8');
    } catch(e) {
        console.error(e);
        return '';
    }

    return output;
}

export const readJSON = async (path) => {
    let data;
    try {
        data = await read(path);
    } catch(e) {
        console.error(e);
        return {};
    }

    return JSON.parse(data);
}

export const write = async (path, data) => {
    await writeFilePromisified(path, data);
}

const markets = [
    {
        name: 'raleigh',
        timeZone: 'America/New_York'
    },
    {
        name: 'los-angeles',
        timeZone: 'America/Los_Angeles'
    }
];
const defaultTimeZone = 'America/New_York';
export const getTimeZone = (market) => {
    const {timeZone} = markets.find(({ name: curMarket }) => curMarket === market) || {};

    return timeZone || defaultTimeZone;
}


const getTitle = ({presentationSlug}) => presentationSlug;
const isHidden = ({isHidden}) => isHidden;

const capitalizeFirstLetter = (str = '') => {
    const letters = str.split('');
    letters[0] = letters[0].toUpperCase();
    return letters.join('');
}
  
export const kebabToPrettyPrint = (str = '') => {
    return str.split('-').map(capitalizeFirstLetter).join(' ');
}

const isOnSale = ({ status }) => status === 'ONSALE';

const getPresentationTitle = ({ show }) => show.title;

export const formatDate = (utcdatetime, timeZone) => {
    const datetime = typeof utcdatetime === 'number' ? new Date(utcdatetime) : new Date(`${utcdatetime}Z`);
    const zonedTime = utcToZonedTime(datetime, timeZone);
    return format(zonedTime, "eee L/d", { timeZone });
}

export const formatTime = (utcdatetime, timeZone) => {
    const datetime = typeof utcdatetime === 'number' ? new Date(utcdatetime) : new Date(`${utcdatetime}Z`);
    const zonedTime = utcToZonedTime(datetime, timeZone);
    return format(zonedTime, "h:mmaaa", { timeZone });
}

const isSameShowing = ({sessionId: sessionIdA}, {sessionId: sessionIdB}) => sessionIdA === sessionIdB;

const isSamePresentation = ({slug: slugA}, {slug: slugB}) => slugA === slugB;


const mergeShowingsPerMovie = (showings, timeZone) => {
    const combined = showings.reduce((all, { presentationSlug, showTimeUtc }) => {
        const timesPerDay = all.get(presentationSlug) || new Map();
        const day = formatDate(showTimeUtc, timeZone);
        const times = timesPerDay.get(day) || [];
        timesPerDay.set(day, [...times, showTimeUtc]);
        return all.set(presentationSlug, timesPerDay);
    }, new Map());

    const result = Array.from(combined).map(([presentationSlug, showingsPerDayMap]) => {
        return {
            presentationSlug,
            showings: Array.from(showingsPerDayMap).reduce((allDays, [day, showings]) => {
                allDays.push(`${ day } (${ showings.sort().map(showing => formatTime(showing, timeZone)).join(', ') })`);
                return allDays;
            }, [])
        }
    });

    return result;
}

export const getMoviesDiff = async (marketName) => {
    const timeZone = getTimeZone(marketName);

    const errorMsgRunFetch = `Can't read temp JSON for market.  Need to run this first: node fetch-movies.js ${marketName}`;

    let newMovies;
    try {
        newMovies = await readJSON(new URL(`../data/${marketName}-raw-temp.json`, import.meta.url));
    } catch(e) {
        console.error(errorMsgRunFetch, e);
        return {};
    }

    if (!newMovies.data) {
        console.error(errorMsgRunFetch);
        return {};
    }

    let oldMovies;
    try {
        oldMovies = await readJSON(new URL(`../data/${marketName}-raw.json`, import.meta.url));
    } catch(e) {
        // Cache doesn't exist yet, so create it
        oldMovies = {};
    }

    // Check for new presentations (new movies).
    let oldPresentations = oldMovies.data?.presentations;
    const newPresentations = newMovies.data?.presentations;
    if (!oldPresentations) {
        oldPresentations = [];
    };

    const newFoundTitles = differenceWith(isSamePresentation, newPresentations, oldPresentations);

    let oldShowings = oldMovies.data?.sessions;
    if (!oldShowings?.length) {
        oldShowings = [];
    };
    const newShowings = newMovies.data?.sessions;
    const oldShowingsFiltered = oldShowings.filter(isOnSale);
    const newShowingsFiltered = newShowings.filter(isOnSale);
    const newFoundShowings = differenceWith(isSameShowing, newShowingsFiltered, oldShowingsFiltered);

    const hiddenShowings = oldMovies.data?.sessions?.filter(isHidden);

    const now = new Date().getTime();

//     console.log(`
// ${ formatDate(now, timeZone) } ${ formatTime(now, timeZone) }
// ${ marketName }
// ${ newPresentations.length } movies with ${ newShowings.length } total showings found.
// ${ newFoundTitles.length } new movies found.
// ${ newFoundShowings.length } new showings found.
// ${ hiddenShowings?.length } hidden showings found.`);

//     if (newFoundTitles.length > 0) {
//         console.log('New titles found: ', uniq(newFoundTitles.map(getPresentationTitle)));
//     }

    return {
        allMovies: uniq(newPresentations.map(getPresentationTitle).sort((a, b) => a.localeCompare(b))),
        newMovies: newFoundTitles.map(getPresentationTitle),
        newScreenings: mergeShowingsPerMovie(newFoundShowings, timeZone)
    }
}

export const formatScreeningsMarkdown = (screenings, marketName) => {
    return screenings.map(({ presentationSlug, showings }) => `\n    * [${ kebabToPrettyPrint(presentationSlug) }](https://drafthouse.com/${ marketName }/show/${ presentationSlug }): ${ showings.join(', ') }`).join('\n');
}