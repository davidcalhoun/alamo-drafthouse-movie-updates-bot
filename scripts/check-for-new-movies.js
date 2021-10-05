import {getMoviesDiff} from './utils.js';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const checkForNewMovies = async (marketName) => {
    const { newMovies } = await getMoviesDiff(marketName);

    if (newMovies.length) {
        console.log(newMovies.join(', '));
    } else {
        return ''
    }
}

await checkForNewMovies(alamoMarket);

process.exit(0);