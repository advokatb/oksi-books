document.addEventListener('DOMContentLoaded', async () => {
    try {
        const username = 'oksanaranneva';

        // Function to fetch LiveLib data
        const fetchLiveLibData = async () => {
            const shelves = [
                { pagename: 'read', elementId: 'read-books' },
                { pagename: 'reading', elementId: 'last-read-book' },
                { pagename: 'wish', elementId: 'future-books-tab' }
            ];
            const includeColumns = ['title', 'authors', 'readDate', 'ratingUser', 'isbn', 'genres', 'series', 'bookHref', 'coverHref'];
            const updatedBooks = [];

            for (const shelf of shelves) {
                const url = new URL('https://script.google.com/macros/s/AKfycbxzTdo297yeLns95JN_h8xCKfIKNNvqKg8bk5NXrEOxeRD-gbQAqgxiB18IDDG2WbOO/exec');
                url.searchParams.append('username', username);
                url.searchParams.append('pagename', shelf.pagename);
                url.searchParams.append('includeColumns', includeColumns.join(','));

                const response = await fetch(url);
                if (!response.ok) throw new Error(`Ошибка загрузки ${shelf.pagename}: ${response.status}`);

                const data = await response.json();
                if (!data.bookArray || !Array.isArray(data.bookArray)) {
                    throw new Error(`Некорректный формат данных для ${shelf.pagename}`);
                }

                const booksData = data.bookArray.map(book => ({
                    ...book,
                    'Exclusive Shelf': shelf.pagename === 'reading' ? 'currently-reading' : (shelf.pagename === 'wish' ? 'to-read' : 'read'),
                    'Book Id': book.bookHref.split('/').pop(),
                    'Annotation': bookAnnotations[book.bookHref.split('/').pop()] || book.annotation || 'Нет аннотации',
                    'Authors': Array.isArray(book.authors) ? book.authors.map(a => a.name).join(', ') : 'Неизвестный автор',
                    'Genres': Array.isArray(book.genres) ? book.genres.map(g => g.name) : [],
                    'Series': book.details?.series || null,
                    'My Rating': parseFloat(book.rating?.user) || 0,
                    'Cover URL': book.coverHref || 'https://placehold.co/100x150?text=Нет+обложки',
                    'Title': book.title,
                    'ISBN': book.details?.isbn || 'Не указан',
                    'Date Read': book.readDate ? parseDate(book.readDate) : null,
                    'Number of Pages': customPages[book.title] || book.details?.pages || 0
                }));
                updatedBooks.push(...booksData);
            }
            return updatedBooks;
        };

        // Load static data as fallback
        const customPagesResponse = await fetch('data/custom_pages.json');
        const customPages = await customPagesResponse.json();
        const annotationsResponse = await fetch('data/book_annotations.json');
        const bookAnnotations = await annotationsResponse.json();
        let customDates = {};
        try {
            const customDatesResponse = await fetch('data/custom_dates.json');
            customDates = await customDatesResponse.json();
        } catch (e) {
            console.warn('Failed to load custom_dates.json:', e);
        }

        // Load or fetch initial data with timestamp
        let allBooks;
        let lastUpdated;
        const storedData = localStorage.getItem('livelibBooks');
        if (storedData) {
            const data = JSON.parse(storedData);
            allBooks = data.books;
            lastUpdated = data.timestamp || null;
            console.log('Loaded books from localStorage:', allBooks.length, 'Last updated:', lastUpdated);
        } else {
            allBooks = await fetchLiveLibData();
            lastUpdated = new Date().toISOString();
            localStorage.setItem('livelibBooks', JSON.stringify({ books: allBooks, timestamp: lastUpdated }));
            console.log('Fetched initial books from LiveLib:', allBooks.length);
        }

        // Categorize books
        let readBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'read');
        let readingBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading');
        let wishBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'to-read');

        const books = new BookCollection(readBooks, customDates);
        const currentBooks = new BookCollection(readingBooks, customDates);
        const toReadBooks = new BookCollection(wishBooks, customDates);

        // Populate genre filter
        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter) {
            genreFilter.innerHTML = '<option value="">Все жанры</option>';
            const uniqueGenres = [...new Set(allBooks.flatMap(book => book.Genres || []))].sort();
            console.log('Unique genres:', uniqueGenres);
            uniqueGenres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreFilter.appendChild(option);
            });
        }

        // Render initial UI and remove skeletons
        const currentBookContainer = document.getElementById('current-book');
        currentBookContainer.innerHTML = ''; // Clear skeleton
        if (currentBooks.models.length > 0) {
            const currentBookDiv = await currentBooks.models[0].renderCurrent();
            currentBookContainer.appendChild(currentBookDiv);
        } else {
            currentBookContainer.innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
        }

        const lastReadBook = books.getLastReadBook();
        const lastReadBookContainer = document.getElementById('last-read-book');
        lastReadBookContainer.innerHTML = ''; // Clear skeleton
        if (lastReadBook) {
            const lastReadBookDiv = await lastReadBook.renderCurrent();
            lastReadBookContainer.appendChild(lastReadBookDiv);
        }

        const mostProlificAuthorContainer = document.getElementById('most-prolific-author');
        mostProlificAuthorContainer.innerHTML = ''; // Clear skeleton
        const mostProlificAuthorDiv = await books.renderMostProlificAuthor();
        mostProlificAuthorContainer.appendChild(mostProlificAuthorDiv);

        // Total stats
        const totalContainer = document.querySelector('#total-book')?.nextElementSibling;
        if (totalContainer) {
            totalContainer.innerHTML = ''; // Clear skeleton
            totalContainer.innerHTML = `
                <p class="text-lg font-bold">${getBookDeclension(readBooks.length)}</p>
                <p class="text-lg">${readBooks.reduce((sum, b) => sum + (b['Number of Pages'] || 0), 0).toLocaleString('ru-RU')} страниц</p>
                <p class="text-sm text-gray-500">В этом году: <span>${readBooks.filter(b => b['Date Read']?.startsWith('2025')).length}</span></p>
            `;
        }

        const totalBookImage = document.getElementById('total-book-image');
        const randomReadBook = books.getRandomReadBook();
        if (randomReadBook && totalBookImage) {
            totalBookImage.src = randomReadBook.getCoverUrl();
            totalBookImage.alt = randomReadBook.Title;
            totalBookImage.classList.remove('skeleton');
            totalBookImage.onerror = () => {
                totalBookImage.src = 'https://placehold.co/100x150?text=Нет+обложки';
                totalBookImage.onerror = null;
            };
        } else if (totalBookImage) {
            totalBookImage.src = 'https://placehold.co/100x150?text=Нет+обложки';
            totalBookImage.classList.remove('skeleton');
        }

        // Render book list
        books.currentPage = 0;
        books.booksPerPage = 9;
        books.sortBy('date-desc');
        const bookListContainer = document.getElementById('book-list');
        bookListContainer.innerHTML = ''; // Clear skeleton
        await books.renderPage('book-list');

        // Render future reads
        const futureReadsContainer = document.getElementById('future-reads');
        futureReadsContainer.innerHTML = ''; // Clear skeleton
        if (toReadBooks.models.length > 0) {
            await toReadBooks.renderFutureReads('future-reads');
        } else {
            futureReadsContainer.innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
        }

        // Render series shelf
        const seriesShelfContainer = document.getElementById('series-shelf');
        seriesShelfContainer.innerHTML = ''; // Clear skeleton
        await books.renderSeriesShelf('series-shelf');

        // Reading challenge stats
        const challengeGoal = 50;
        const books2025 = readBooks.filter(b => b['Date Read']?.startsWith('2025')).length;
        const progressPercent = Math.min((books2025 / challengeGoal) * 100, 100).toFixed(0);
        const challengeContainer = document.getElementById('challenge-container');
        if (challengeContainer) {
            challengeContainer.innerHTML = `
                <h2 class="text-2xl font-semibold text-gray-700 mb-4">Чтение 2025: Challenge</h2>
                <div class="flex items-center mb-4">
                    <img src="https://m.media-amazon.com/images/G/01/RC/2025ReadingChallengeBadgeLinkedKindle.png" alt="2025 Reading Challenge Badge" class="w-24 h-auto mr-4">
                    <div>
                        <p id="challenge-progress" class="text-gray-600"><strong>${books2025} из ${challengeGoal} книг прочитано</strong></p>
                        <p id="challenge-days" class="text-gray-500 text-sm">Осталось ${Math.ceil((new Date('2025-12-31') - new Date()) / (1000 * 60 * 60 * 24))} дней</p>
                    </div>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div id="challenge-bar" class="bg-indigo-600 h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                </div>
                <p id="challenge-percent" class="text-center text-gray-500 text-sm mt-2">${progressPercent}%</p>
            `;
        } else {
            console.error('Challenge container not found');
        }

        // Book records
        const longestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || 0) > (a['Number of Pages'] || 0) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
        const shortestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || Infinity) < (a['Number of Pages'] || Infinity) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
        document.getElementById('book-records').innerHTML = `
            <p class="text-gray-600 text-sm mb-2"><strong>Самая длинная книга:</strong> ${longestBook.Title} (${longestBook['Number of Pages']} страниц)</p>
            <p class="text-gray-600 text-sm"><strong>Самая короткая книга:</strong> ${shortestBook.Title} (${shortestBook['Number of Pages']} страниц)</p>
        `;

        // Reading stats
        const seriesCounts = {};
        readBooks.forEach(b => {
            if (b.Series) seriesCounts[b.Series] = (seriesCounts[b.Series] || 0) + 1;
        });
        const months = new Set(readBooks.map(b => b['Date Read']?.slice(0, 7)).filter(Boolean));
        const avgBooksPerMonth = months.size ? (readBooks.length / months.size).toFixed(1) : 0;
        document.getElementById('reading-stats').innerHTML = `
            <p class="text-gray-600 text-sm mb-2"><strong>Циклов прочитано всего:</strong> ${Object.keys(seriesCounts).length}</p>
            <p class="text-gray-600 text-sm"><strong>В среднем прочитано в месяц:</strong> ${avgBooksPerMonth} книг</p>
        `;

        // Render charts
        const chartContainers = {
            timelineChart: document.querySelector('#timelineChart'),
            ratingChart: document.querySelector('#ratingChart'),
            genreChart: document.querySelector('#genreChart')
        };
        Object.values(chartContainers).forEach(container => {
            if (container) container.classList.remove('skeleton');
        });
        await Promise.all([
            books.renderTimelineChart(),
            books.renderRatingChart(),
            books.renderGenreChart()
        ]);

        // Refresh button with timestamp
        const container = document.querySelector('.container') || document.body;
        const refreshContainer = document.createElement('div');
        refreshContainer.className = 'refresh-container mt-6 text-center';
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Обновить данные с LiveLib';
        refreshButton.className = 'btn bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 rounded-lg';
        const timestampDisplay = document.createElement('p');
        timestampDisplay.className = 'text-gray-500 text-sm mt-2';
        timestampDisplay.textContent = lastUpdated
            ? `Последнее обновление: ${new Date(lastUpdated).toLocaleString('ru-RU')}`
            : 'Данные еще не обновлялись';
        refreshContainer.appendChild(refreshButton);
        refreshContainer.appendChild(timestampDisplay);
        container.appendChild(refreshContainer); // Place at bottom by default

        refreshButton.addEventListener('click', async () => {
            try {
                refreshButton.disabled = true;
                refreshButton.textContent = 'Загрузка...';

                // Show skeletons again during refresh
                currentBookContainer.innerHTML = '<div class="skeleton skeleton-image mr-4"></div><div class="flex-1"><div class="skeleton skeleton-text w-3/4"></div><div class="skeleton skeleton-text w-1/2"></div><div class="skeleton skeleton-text w-2/3"></div></div>';
                lastReadBookContainer.innerHTML = '<div class="skeleton skeleton-image mr-4"></div><div class="flex-1"><div class="skeleton skeleton-text w-3/4"></div><div class="skeleton skeleton-text w-1/2"></div><div class="skeleton skeleton-text w-2/3"></div></div>';
                mostProlificAuthorContainer.innerHTML = '<div class="skeleton skeleton-image w-16 h-24 mr-2"></div><div class="flex-1"><div class="skeleton skeleton-text w-3/4"></div><div class="skeleton skeleton-text w-1/2"></div></div>';
                totalContainer.innerHTML = '<div class="skeleton skeleton-text w-3/4"></div><div class="skeleton skeleton-text w-1/2"></div><div class="skeleton skeleton-text w-2/3"></div>';
                totalBookImage.classList.add('skeleton');
                bookListContainer.innerHTML = Array(9).fill('').map(() => '<div class="book-card skeleton-card skeleton"></div>').join('');
                futureReadsContainer.innerHTML = Array(3).fill('').map(() => '<div class="book-card skeleton-card skeleton"></div>').join('');
                seriesShelfContainer.innerHTML = Array(3).fill('').map(() => `
                    <div class="series-box">
                        <div class="skeleton skeleton-text w-3/4 mb-2"></div>
                        <div class="skeleton skeleton-text w-1/2 mb-2"></div>
                        <div class="series-row">${Array(3).fill('').map((_, i) => `<div class="series-book" style="left: ${i * 60}px;"><div class="skeleton" style="width: 80px; height: 120px;"></div></div>`).join('')}</div>
                    </div>
                `).join('');
                if (challengeContainer) {
                    challengeContainer.innerHTML = `
                        <h2 class="text-2xl font-semibold text-gray-700 mb-4">Чтение 2025: Challenge</h2>
                        <div class="flex items-center mb-4"><div class="skeleton w-24 h-12 mr-4"></div><div><div class="skeleton skeleton-text w-3/4"></div><div class="skeleton skeleton-text w-1/2"></div></div></div>
                        <div class="skeleton w-full h-2.5 rounded-full"></div><div class="skeleton skeleton-text w-1/4 mt-2 mx-auto"></div>
                    `;
                }
                document.getElementById('book-records').innerHTML = '<div class="skeleton skeleton-text w-3/4 mb-2"></div><div class="skeleton skeleton-text w-3/4"></div>';
                document.getElementById('reading-stats').innerHTML = '<div class="skeleton skeleton-text w-3/4 mb-2"></div><div class="skeleton skeleton-text w-3/4"></div>';
                Object.values(chartContainers).forEach(container => container.classList.add('skeleton'));

                allBooks = await fetchLiveLibData();
                lastUpdated = new Date().toISOString();
                localStorage.setItem('livelibBooks', JSON.stringify({ books: allBooks, timestamp: lastUpdated }));

                // Update collections
                readBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'read');
                readingBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading');
                wishBooks = allBooks.filter(b => b['Exclusive Shelf'] === 'to-read');

                books.models = new BookCollection(readBooks, customDates).models;
                books.allBooks = books.models;
                currentBooks.models = new BookCollection(readingBooks, customDates).models;
                currentBooks.allBooks = currentBooks.models;
                toReadBooks.models = new BookCollection(wishBooks, customDates).models;
                toReadBooks.allBooks = toReadBooks.models;

                // Refresh UI
                currentBookContainer.innerHTML = '';
                if (currentBooks.models.length > 0) {
                    const currentBookDiv = await currentBooks.models[0].renderCurrent();
                    currentBookContainer.appendChild(currentBookDiv);
                } else {
                    currentBookContainer.innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
                }

                lastReadBookContainer.innerHTML = '';
                const newLastReadBook = books.getLastReadBook();
                if (newLastReadBook) {
                    const lastReadBookDiv = await newLastReadBook.renderCurrent();
                    lastReadBookContainer.appendChild(lastReadBookDiv);
                }

                mostProlificAuthorContainer.innerHTML = '';
                const newMostProlificAuthorDiv = await books.renderMostProlificAuthor();
                mostProlificAuthorContainer.appendChild(newMostProlificAuthorDiv);

                totalContainer.innerHTML = `
                    <p class="text-lg font-bold">${getBookDeclension(readBooks.length)}</p>
                    <p class="text-lg">${readBooks.reduce((sum, b) => sum + (b['Number of Pages'] || 0), 0).toLocaleString('ru-RU')} страниц</p>
                    <p class="text-sm text-gray-500">В этом году: <span>${readBooks.filter(b => b['Date Read']?.startsWith('2025')).length}</span></p>
                `;
                const refreshedRandomBook = books.getRandomReadBook();
                if (refreshedRandomBook && totalBookImage) {
                    totalBookImage.src = refreshedRandomBook.getCoverUrl();
                    totalBookImage.alt = refreshedRandomBook.Title;
                    totalBookImage.classList.remove('skeleton');
                    totalBookImage.onerror = () => {
                        totalBookImage.src = 'https://placehold.co/100x150?text=Нет+обложки';
                        totalBookImage.onerror = null;
                    };
                }

                bookListContainer.innerHTML = '';
                await books.renderPage('book-list');

                futureReadsContainer.innerHTML = '';
                if (toReadBooks.models.length > 0) {
                    await toReadBooks.renderFutureReads('future-reads');
                } else {
                    futureReadsContainer.innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
                }

                seriesShelfContainer.innerHTML = '';
                await books.renderSeriesShelf('series-shelf');

                const refreshedBooks2025 = readBooks.filter(b => b['Date Read']?.startsWith('2025')).length;
                const refreshedProgressPercent = Math.min((refreshedBooks2025 / challengeGoal) * 100, 100).toFixed(0);
                if (challengeContainer) {
                    challengeContainer.innerHTML = `
                        <h2 class="text-2xl font-semibold text-gray-700 mb-4">Чтение 2025: Challenge</h2>
                        <div class="flex items-center mb-4">
                            <img src="https://m.media-amazon.com/images/G/01/RC/2025ReadingChallengeBadgeLinkedKindle.png" alt="2025 Reading Challenge Badge" class="w-24 h-auto mr-4">
                            <div>
                                <p id="challenge-progress" class="text-gray-600"><strong>${refreshedBooks2025} из ${challengeGoal} книг прочитано</strong></p>
                                <p id="challenge-days" class="text-gray-500 text-sm">Осталось ${Math.ceil((new Date('2025-12-31') - new Date()) / (1000 * 60 * 60 * 24))} дней</p>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5">
                            <div id="challenge-bar" class="bg-indigo-600 h-2.5 rounded-full" style="width: ${refreshedProgressPercent}%"></div>
                        </div>
                        <p id="challenge-percent" class="text-center text-gray-500 text-sm mt-2">${refreshedProgressPercent}%</p>
                    `;
                }

                const refreshedLongestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || 0) > (a['Number of Pages'] || 0) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
                const refreshedShortestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || Infinity) < (a['Number of Pages'] || Infinity) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
                document.getElementById('book-records').innerHTML = `
                    <p class="text-gray-600 text-sm mb-2"><strong>Самая длинная книга:</strong> ${refreshedLongestBook.Title} (${refreshedLongestBook['Number of Pages']} страниц)</p>
                    <p class="text-gray-600 text-sm"><strong>Самая короткая книга:</strong> ${refreshedShortestBook.Title} (${refreshedShortestBook['Number of Pages']} страниц)</p>
                `;

                const refreshedMonths = new Set(readBooks.map(b => b['Date Read']?.slice(0, 7)).filter(Boolean));
                const refreshedAvgBooksPerMonth = refreshedMonths.size ? (readBooks.length / refreshedMonths.size).toFixed(1) : 0;
                document.getElementById('reading-stats').innerHTML = `
                    <p class="text-gray-600 text-sm mb-2"><strong>Циклов прочитано всего:</strong> ${Object.keys(seriesCounts).length}</p>
                    <p class="text-gray-600 text-sm"><strong>В среднем прочитано в месяц:</strong> ${refreshedAvgBooksPerMonth} книг</p>
                `;

                Object.values(chartContainers).forEach(container => container.classList.remove('skeleton'));
                await Promise.all([
                    books.renderTimelineChart(),
                    books.renderRatingChart(),
                    books.renderGenreChart()
                ]);

                if (genreFilter) {
                    genreFilter.innerHTML = '<option value="">Все жанры</option>';
                    const refreshedGenres = [...new Set(allBooks.flatMap(book => book.Genres || []))].sort();
                    refreshedGenres.forEach(genre => {
                        const option = document.createElement('option');
                        option.value = genre;
                        option.textContent = genre;
                        genreFilter.appendChild(option);
                    });
                }

                // Update timestamp display
                timestampDisplay.textContent = `Последнее обновление: ${new Date(lastUpdated).toLocaleString('ru-RU')}`;

                alert('Данные успешно обновлены!');
            } catch (error) {
                console.error('Refresh error:', error);
                alert('Не удалось обновить данные: ' + error.message);
            } finally {
                refreshButton.disabled = false;
                refreshButton.textContent = 'Обновить данные с LiveLib';
            }
        });

        // Filter functionality
        const applyFilters = async () => {
            let filteredBooks = books.filterByGenre(genreFilter?.value).sortBy(document.getElementById('sort-by')?.value || 'date-desc');
            filteredBooks.currentPage = 0;
            bookListContainer.innerHTML = ''; // Clear before rendering
            await filteredBooks.renderPage('book-list');
        };
        if (genreFilter) genreFilter.addEventListener('change', applyFilters);
        document.getElementById('sort-by')?.addEventListener('change', applyFilters);

        // Load more
        document.getElementById('load-more')?.addEventListener('click', async () => {
            books.currentPage += 1;
            await books.renderPage('book-list');
        });

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId)?.classList.add('active');
            });
        });

    } catch (error) {
        console.error('Error:', error);
    }
});

// Parse date function
function parseDate(dateStr) {
    if (!dateStr || !dateStr.includes('г.')) return null;
    const [month, year] = dateStr.replace(' г.', '').split(' ');
    const monthMap = {
        'Январь': '01', 'Февраль': '02', 'Март': '03', 'Апрель': '04',
        'Май': '05', 'Июнь': '06', 'Июль': '07', 'Август': '08',
        'Сентябрь': '09', 'Октябрь': '10', 'Ноябрь': '11', 'Декабрь': '12'
    };
    return `${year}-${monthMap[month] || '01'}-01`;
}