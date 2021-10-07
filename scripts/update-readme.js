import {getMoviesDiff, write, read, formatDate, formatTime, getTimeZone, kebabToPrettyPrint, formatScreeningsMarkdown} from './utils.js';

const [nodePath, scriptPath, alamoMarket] = process.argv;

const updateReadme = async (marketName) => {
    const timeZone = getTimeZone(marketName);

    const { newMovies, newScreenings } = await getMoviesDiff(marketName);

    const readmePath = new URL(`../markets/${marketName}.md`, import.meta.url);
    let oldReadme;
    try {
        oldReadme = await read(readmePath);
    } catch(e) {
        // init
        oldReadme = `# ${marketName}\n## Movie updates`;
    }
    const movieUpdatesTitle = '## Movie updates';
    const [prefix, suffix] = oldReadme.split(movieUpdatesTitle)

    const now = new Date().getTime();

    const moviesFormatted = newMovies.join(', ');
    const screeningsFormatted = formatScreeningsMarkdown(newScreenings, marketName);

    const newText = `${ newMovies.length > 0 ? `* New movies: ${ moviesFormatted }\n` : `` }
${ newScreenings.length > 0 ? `* New screenings: ${ screeningsFormatted }` : `` }`

    const newReadme = `${ prefix }${ movieUpdatesTitle }
### ${ formatDate(now, timeZone) } ${ formatTime(now, timeZone) }
${ newText }
${ suffix }`;

    // Write to readme history (to check into github).
    await write(readmePath, newReadme);

    // Write temp file for notification email.
    const tmpEmailBodyPath = new URL(`../${marketName}.md`, import.meta.url);
    await write(tmpEmailBodyPath, `${newText}

Check out the [archive of new screenings](https://github.com/davidcalhoun/alamo-drafthouse-movie-updates-bot/blob/main/markets/${ marketName }.md)
`);
}

updateReadme(alamoMarket);