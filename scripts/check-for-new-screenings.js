import {formatScreeningsMarkdown, getMoviesDiff} from './utils.js';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const checkForNewScreenings = async (marketName) => {
    const { newScreenings } = await getMoviesDiff(marketName);

    if (newScreenings.length) {
        return formatScreeningsMarkdown(newScreenings, marketName)
    } else {
        return ''
    }
}

checkForNewScreenings(alamoMarket);
