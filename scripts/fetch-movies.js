import {fetchJSON, write} from './utils.js'
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url))

const [nodePath, scriptPath, alamoMarket] = process.argv;

const moviesBaseUrl = 'https://drafthouse.com/s/mother/v2/schedule/market';

const fetchMovies = async(marketName) => {
    if (!alamoMarket) {
        console.log(`No market to fetch from.  Example: node fetch-movies.js raleigh`);
        return;
    }

    // Fetch latest movies for the market.
    let rawLatestMovies;
    try {
        rawLatestMovies = await fetchJSON(`${moviesBaseUrl}/${marketName}`);
    } catch(e) {
        console.error('Error fetching latest movies:', e);
        return;
    }

    if (rawLatestMovies.error) {
        console.error(`Error: HTTP ${rawLatestMovies.error?.errorCode?.code}.  Are you sure market '${alamoMarket}' exists?`);
        return;
    }

    // Updates temp cache.
    //const tmpPath = `${__dirname}/../data/${marketName}-raw-temp.json`;
    const tmpPath = new URL(`../data/${marketName}-raw-temp.json`, import.meta.url);
    await write(tmpPath, JSON.stringify(rawLatestMovies));
}

await fetchMovies(alamoMarket);