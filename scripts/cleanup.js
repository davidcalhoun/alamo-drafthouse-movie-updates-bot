import { write, readJSON } from './utils.js';
import {rmSync} from 'fs';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const updateCachesAndCleanup = async (marketName) => {
    const tempCachePath = new URL(`../data/${marketName}-raw-temp.json`, import.meta.url);
    const cachePath = new URL(`../data/${marketName}-raw.json`, import.meta.url);

    // Updates cache.
    const rawLatestMovies = await readJSON(tempCachePath);
    await write(cachePath, JSON.stringify(rawLatestMovies));

    console.log(`Cache updated at ${ cachePath }`);

    // Delete old temp cache.
    console.log(`Removing old temp cache at ${ tempCachePath }`);
    rmSync(tempCachePath, {
        force: true,
    });
}

await updateCachesAndCleanup(alamoMarket);