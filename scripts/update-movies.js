import {createReadStream, createWriteStream, writeFile} from 'fs';
import {pipeline} from 'stream';
import {promisify} from 'util';
import fetch from 'node-fetch';
import cachedMovies from '../data/movies.json';
import {difference, uniqBy} from 'ramda';
import stream from 'stream';


const moviesUrl = 'https://drafthouse.com/s/mother/v2/schedule/market/raleigh';
const cachePath = new URL('../data/movies.json', import.meta.url);
const readmePath = new URL('../README.md', import.meta.url);


const fetchJSON = async (url) => {
    const response = await fetch(url);
    return await response.json();
}

const write = async (path, data) => {
    const writeFilePromisified = promisify(writeFile);
    await writeFilePromisified(path, JSON.stringify(data));
}


const getDiff = (oldMovies, newMovies) => {
    const oldShowings = oldMovies.data?.sessions;
    const newShowings = newMovies.data?.sessions;

    const oldShowingsUnique = uniqBy(getTitle, oldShowings).map(getTitle);
    const newShowingsUnique = uniqBy(getTitle, newShowings).map(getTitle);
    const newTitles = difference(newShowingsUnique, oldShowingsUnique);

    const hiddenShowings = newShowingsUnique.filter(isHidden);

    if (newTitles.length > 0) {
        console.log('New titles found: ', newTitles);
        // TODO write to README
    } else {
        console.log('No new titles found.');
    }

    console.log(`${ newShowingsUnique.length } movies with ${ newShowings.length } total showings found.
${ hiddenShowings.length } hidden showings found.`);

}

const update = async() => {
    const latestMovies = await fetchJSON(moviesUrl);

    getDiff(cachedMovies, latestMovies);

    await write(cachePath, latestMovies);
}
update();

const getTitle = ({presentationSlug}) => presentationSlug;
const isHidden = ({isHidden}) => isHidden;
