import {createReadStream, createWriteStream, writeFile, readFile} from 'fs';
import {pipeline} from 'stream';
import {promisify} from 'util';
import fetch from 'node-fetch';
import {difference, differenceWith, uniqBy, uniq} from 'ramda';
//import { format } from 'date-fns'
//import { utcToZonedTime, format } from 'date-fns-tz';
import dateFnsTz from 'date-fns-tz';
const { utcToZonedTime, format } = dateFnsTz;

const getTitle = ({presentationSlug}) => presentationSlug;
const isHidden = ({isHidden}) => isHidden;

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
const moviesBaseUrl = 'https://drafthouse.com/s/mother/v2/schedule/market';

const capitalizeFirstLetter = (str = '') => {
    const letters = str.split('');
    letters[0] = letters[0].toUpperCase();
    return letters.join('');
}
  
const kebabToPrettyPrint = (str = '') => {
    return str.split('-').map(capitalizeFirstLetter).join(' ');
}

const fetchJSON = async (url) => {
    const response = await fetch(url);
    return await response.json();
}

const read = async (path) => {
    const readFilePromisified = promisify(readFile);
    return await readFilePromisified(path, 'utf8');
}

const readJSON = async (path) => {
    let data;
    try {
        data = await read(path);
    } catch(e) {
        console.error(e);
        return {};
    }

    return JSON.parse(data);
}

const write = async (path, data) => {
    const writeFilePromisified = promisify(writeFile);
    await writeFilePromisified(path, data);
}

const isOnSale = ({ status }) => status === 'ONSALE';

const getPresentationTitle = ({ show }) => show.title;

const formatDate = (datetime, timeZone) => {
    return format(new Date(`${datetime}Z`), "eee L/d", { timeZone });
}

const formatTime = (datetime, timeZone) => {
    const zonedTime = utcToZonedTime(new Date(`${datetime}Z`), timeZone)
    return format(zonedTime, "K:mmaaa", { timeZone });
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

const getDiff = async (marketName, timeZone, oldMovies, newMovies) => {
    // Check for new presentations (new movies).
    let oldPresentations = oldMovies.data?.presentations;
    const newPresentations = newMovies.data?.presentations;
    if (!oldPresentations) {
        console.warn('No old presentations found');
        oldPresentations = [];
    };

    const newFoundTitles = differenceWith(isSamePresentation, newPresentations, oldPresentations);

    let oldShowings = oldMovies.data?.sessions;
    if (!oldShowings?.length) {
        console.warn('No old showings found', oldShowings, oldMovies.data?.sessions);
        oldShowings = [];
    };
    const newShowings = newMovies.data?.sessions;
    const oldShowingsFiltered = oldShowings.filter(isOnSale);
    const newShowingsFiltered = newShowings.filter(isOnSale);
    const newFoundShowings = differenceWith(isSameShowing, newShowingsFiltered, oldShowingsFiltered);

    const hiddenShowings = oldMovies.data?.sessions?.filter(isHidden);

    console.log(`
${ marketName }
${ newPresentations.length } movies with ${ newShowings.length } total showings found.
${ newFoundTitles.length } new movies found.
${ newFoundShowings.length } new showings found.
${ hiddenShowings?.length } hidden showings found.`);

if (newFoundTitles.length > 0) {
    console.log('New titles found: ', uniq(newFoundTitles.map(getPresentationTitle)));
}

    return {
        allMovies: uniq(newPresentations.map(getPresentationTitle).sort((a, b) => a.localeCompare(b))),
        newMovies: newFoundTitles.map(getPresentationTitle),
        newScreenings: mergeShowingsPerMovie(newFoundShowings, timeZone)
    }
}

const updateReadme = async (market, timeZone, newMovies, newScreenings) => {
    const readmePath = new URL(`../markets/${market}.md`, import.meta.url);
    let oldReadme;
    try {
        oldReadme = await read(readmePath);
    } catch(e) {
        // init
        oldReadme = `# ${market}\n## Movie updates`;
    }
    const movieUpdatesTitle = '## Movie updates';
    const [prefix, suffix] = oldReadme.split(movieUpdatesTitle)

    const now = new Date();

    const newReadme = `${ prefix }${ movieUpdatesTitle }
### ${ formatDate(now, timeZone) } ${ formatTime(now, timeZone) }
${ newMovies.length > 0 ? `* New movies: ${ newMovies.join(', ')}\n` : '' }${ newScreenings.length > 0 ? `* New screenings: ${ newScreenings.map(({ presentationSlug, showings }) => `\n    * [${ kebabToPrettyPrint(presentationSlug) }](https://drafthouse.com/${ market }/show/${ presentationSlug }): ${ showings.join(', ') }`).join('')}` : '' }
${ suffix }`;

    write(readmePath, newReadme);
}

const update = async(marketName, timeZone) => {
    let rawLatestMovies;
    try {
        rawLatestMovies = await fetchJSON(`${moviesBaseUrl}/${marketName}`);
    } catch(e) {
        console.error('Error fetching latest movies:', e);
        return;
    }

    let cachedMovies;
    try {
        cachedMovies = await readJSON(new URL(`../data/${marketName}-raw.json`, import.meta.url));
    } catch(e) {
        console.log('Creating new cache due to error: ', e);
        // file doesn't exist yet, so create it
        cachedMovies = {};
    }

    const { allMovies, newMovies, newScreenings } = await getDiff(marketName, timeZone, cachedMovies, rawLatestMovies);

    // Updates cache
    const cachePath = new URL(`../data/${marketName}-raw.json`, import.meta.url);
    await write(cachePath, JSON.stringify(rawLatestMovies));

    // Updates human readable movie list.
    const humanCachePath = new URL(`../data/${marketName}.json`, import.meta.url);
    await write(humanCachePath, JSON.stringify(allMovies, null, 2));

    // Updates README.md
    if (newScreenings.length > 0 || newMovies.length > 0) {
        await updateReadme(marketName, timeZone, newMovies, newScreenings);
    }
}

markets.forEach(({ name, timeZone }) => {
    update(name, timeZone);
});

