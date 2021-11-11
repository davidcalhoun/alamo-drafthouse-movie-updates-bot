import {formatScreeningsMarkdown, getMoviesDiff} from './utils.js';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const checkForNewScreenings = async (marketName) => {
    const { newScreenings } = await getMoviesDiff(marketName);

    return newScreenings.length
        ? console.log(formatScreeningsMarkdown(newScreenings, marketName))
        : '';
}

await checkForNewScreenings(alamoMarket);

process.exit(0);