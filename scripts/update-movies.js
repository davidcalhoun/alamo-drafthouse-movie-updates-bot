import {createReadStream, createWriteStream, writeFile, readFile} from 'fs';
import {pipeline} from 'stream';
import {promisify} from 'util';
import fetch from 'node-fetch';
import cachedMovies from '../data/movies.json';
import {difference, uniqBy, uniq} from 'ramda';
import stream from 'stream';


const moviesUrl = 'https://drafthouse.com/s/mother/v2/schedule/market/raleigh';
const cachePath = new URL('../data/movies.json', import.meta.url);
const humanCachePath = new URL('../data/movies-for-humans.json', import.meta.url);
const readmePath = new URL('../README.md', import.meta.url);


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

const write = async (path, data) => {
    const writeFilePromisified = promisify(writeFile);
    await writeFilePromisified(path, data);
}

const isOnSale = ({ status }) => status === 'ONSALE';

const getPresentationTitle = ({ show }) => show.title;

const getDayOfWeek = (datetime) => {
    const time = new Date(datetime);
    return new Intl.DateTimeFormat('en-US', {  weekday: 'long' }).format(time);
}


const getDiff = async (oldMovies, newMovies) => {
    // Check for new presentations (new movies).
    const oldPresentations = oldMovies.data?.presentations;
    const newPresentations = newMovies.data?.presentations;
    const newFoundTitles = difference(newPresentations, oldPresentations);

    if (newFoundTitles.length > 0) {
        console.log('New titles found: ', uniq(newFoundTitles.map(getPresentationTitle)));
    } else {
        console.log('No new titles found.');
    }

    const oldShowings = oldMovies.data?.sessions;
    const newShowings = newMovies.data?.sessions;
    const oldShowingsFiltered = oldShowings.filter(isOnSale);
    const newShowingsFiltered = newShowings.filter(isOnSale);
    const newFoundShowings = difference(newShowingsFiltered, oldShowingsFiltered);

    const hiddenShowings = oldMovies.data?.sessions.filter(isHidden);

    console.log(`${ newPresentations.length } movies with ${ newShowings.length } total showings found.
${ newFoundTitles.length } new movies found.
${ newFoundShowings.length } new showings found.
${ hiddenShowings.length } hidden showings found.`);

    return {
        allMovies: uniq(newPresentations.map(getPresentationTitle).sort((a, b) => a.localeCompare(b))),
        newMovies: newFoundTitles.map(getPresentationTitle),
        newScreenings: newFoundShowings.map(({ presentationSlug, showTimeUtc }) => `${ kebabToPrettyPrint(presentationSlug) } (${ getDayOfWeek(showTimeUtc) } ${ new Date(`${ showTimeUtc }Z`).toLocaleString() })`)
    }
}

const updateReadme = async (newMovies, newScreenings) => {
    const oldReadme = await read(readmePath);
    const movieUpdatesTitle = '## Movie updates';
    const [prefix, suffix] = oldReadme.split(movieUpdatesTitle)

    const newReadme = `${ prefix }${ movieUpdatesTitle }
### ${ new Date() }
${ newMovies.length > 0 ? `* New movies: ${ newMovies.join(', ')}\n` : '' }${ newScreenings.length > 0 ? `* New screenings: ${ newScreenings.join(', ')}` : '' }
${ suffix }`;

    write(readmePath, newReadme);
}

const update = async() => {
    const rawLatestMovies = await fetchJSON(moviesUrl);

    const { allMovies, newMovies, newScreenings } = await getDiff(cachedMovies, rawLatestMovies);

    // Updates cache
    await write(cachePath, JSON.stringify(rawLatestMovies));

    // Updates human readable movie list.
    await write(humanCachePath, JSON.stringify(allMovies, null, 2));

    // Updates README.md
    if (newScreenings.length > 0 || newMovies.length > 0) {
        await updateReadme(newMovies, newScreenings);
    }
}
update();

const getTitle = ({presentationSlug}) => presentationSlug;
const isHidden = ({isHidden}) => isHidden;
