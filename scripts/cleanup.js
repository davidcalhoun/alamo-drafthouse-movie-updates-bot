import { write, readJSON } from './utils.js';
import {rmSync} from 'fs';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const updateCachesAndCleanup = async (marketName) => {
    const tempCachePath = new URL(`../data/${marketName}-raw-temp.json`, import.meta.url);
    const cachePath = new URL(`../data/${marketName}-raw.json`, import.meta.url);

    // Updates cache.
    const rawLatestMovies = await readJSON(tempCachePath);
    await write(cachePath, JSON.stringify(rawLatestMovies));

    // Delete old temp cache.
    rmSync(tempCachePath, {
        force: true,
    });
}

await updateCachesAndCleanup(alamoMarket);