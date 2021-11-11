import {getMoviesDiff} from './utils.js';

const [nodePath, scriptPath, alamoMarket, isMarkdownOutput] = process.argv;

const checkForNewMovies = async (marketName) => {
    const { newMovies } = await getMoviesDiff(marketName);

    if (!newMovies.length) return '';

    return isMarkdownOutput
        ? console.log(newMovies.map(movie => `    * ${ movie }`).join('\n'))
        : console.log(newMovies.map(movie => `${ movie }`).join(', '));
}

await checkForNewMovies(alamoMarket);

process.exit(0);