document.addEventListener('DOMContentLoaded', async () => {
    try {
        const username = 'oksanaranneva';

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

        let staticStats = { total_books: 0, total_pages: 0, books_2025: 0, series_counts: {}, book_list: [] };
        try {
            const statsResponse = await fetch('/reading_stats.json');
            staticStats = await statsResponse.json();
        } catch (e) {
            console.warn('Failed to load reading_stats.json:', e);
            document.getElementById('book-list').innerHTML = '<p class="text-gray-600">Не удалось загрузить данные</p>';
        }

        // Initial book data from static stats
        let readBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'read') || [];
        let readingBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'currently-reading') || [];
        let wishBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'to-read') || [];
        let allBooks = [...readBooks, ...readingBooks, ...wishBooks];

        // Enhance with annotations and pages
        allBooks.forEach(book => {
            book['Annotation'] = bookAnnotations[book['Book Id']] || book['Annotation'] || 'Нет аннотации';
            book['Number of Pages'] = customPages[book.Title] || book['Number of Pages'] || 0;
        });

        const books = new BookCollection(readBooks, customDates);
        const currentBooks = new BookCollection(readingBooks, customDates);
        const toReadBooks = new BookCollection(wishBooks, customDates);

        // Populate genre filter
        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter) {
            const uniqueGenres = [...new Set(allBooks.flatMap(book => book.Genres || []))].sort();
            console.log('Initial unique genres:', uniqueGenres); // Debug
            uniqueGenres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreFilter.appendChild(option);
            });
        }

        // Render initial UI
        const currentBookContainer = document.getElementById('current-book');
        if (currentBooks.models.length > 0) {
            const currentBookDiv = await currentBooks.models[0].renderCurrent();
            currentBookContainer.appendChild(currentBookDiv);
        } else {
            currentBookContainer.innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
        }

        const lastReadBook = books.getLastReadBook();
        if (lastReadBook) {
            const lastReadBookDiv = await lastReadBook.renderCurrent();
            document.getElementById('last-read-book').appendChild(lastReadBookDiv);
        }

        const mostProlificAuthorDiv = await books.renderMostProlificAuthor();
        document.getElementById('most-prolific-author').appendChild(mostProlificAuthorDiv);

        // Render charts asynchronously with Promise.all for performance
        await Promise.all([
            books.renderTimelineChart(),
            books.renderRatingChart(),
            books.renderGenreChart()
        ]);

        books.currentPage = 0;
        books.booksPerPage = 9;
        books.sortBy('date-desc');
        await books.renderPage('book-list');

        if (toReadBooks.models.length > 0) {
            await toReadBooks.renderFutureReads('future-reads');
        } else {
            document.getElementById('future-reads').innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
        }

        await books.renderSeriesShelf('series-shelf');

        // Reading challenge stats
        const challengeGoal = 50;
        const initialBooks2025 = readBooks.filter(b => b['Date Read']?.startsWith('2025')).length || staticStats.books_2025;
        const progressPercent = Math.min((initialBooks2025 / challengeGoal) * 100, 100).toFixed(0);
        document.getElementById('challenge-progress').innerHTML = `<strong>${initialBooks2025} из ${challengeGoal} книг прочитано</strong>`;
        document.getElementById('challenge-days').textContent = `Осталось ${Math.ceil((new Date('2025-12-31') - new Date()) / (1000 * 60 * 60 * 24))} дней`;
        document.getElementById('challenge-bar').style.width = `${progressPercent}%`;
        document.getElementById('challenge-percent').textContent = `${progressPercent}%`;

        // Total stats with fallback
        const totalContainer = document.querySelector('#total-book')?.nextElementSibling;
        if (totalContainer) {
            totalContainer.querySelector('p:nth-child(1)').textContent = getBookDeclension(staticStats.total_books || 0);
            totalContainer.querySelector('p:nth-child(2)').textContent = `${(staticStats.total_pages || 0).toLocaleString('ru-RU')} страниц`;
            totalContainer.querySelector('p:nth-child(3) span').textContent = initialBooks2025;
        }

        // Книжные рекорды
        const longestBook = readBooks.length ? readBooks.reduce((a, b) => (parseInt(b['Number of Pages'], 10) || 0) > (parseInt(a['Number of Pages'], 10) || 0) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
        const shortestBook = readBooks.length ? readBooks.reduce((a, b) => (parseInt(b['Number of Pages'], 10) || Infinity) < (parseInt(a['Number of Pages'], 10) || Infinity) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
        document.getElementById('longest-book').textContent = `${longestBook.Title} (${longestBook['Number of Pages']} страниц)`;
        document.getElementById('shortest-book').textContent = `${shortestBook.Title} (${shortestBook['Number of Pages']} страниц)`;

        // Average books per month
        const months = new Set(readBooks.map(b => b['Date Read']?.slice(0, 7)).filter(Boolean));
        console.log('Initial months with reads:', [...months]); // Debug
        const avgBooksPerMonth = months.size ? (readBooks.length / months.size).toFixed(1) : 0;
        document.getElementById('average-books-per-month').textContent = `${avgBooksPerMonth} книг`;

        // Random book image
        const randomReadBook = books.getRandomReadBook();
        const totalBookImage = document.getElementById('total-book-image');
        if (randomReadBook && totalBookImage) {
            totalBookImage.src = randomReadBook.getCoverUrl();
            totalBookImage.alt = randomReadBook.Title;
            totalBookImage.onerror = () => {
                totalBookImage.src = 'https://placehold.co/100x150?text=Нет+обложки';
                totalBookImage.onerror = null;
            };
        } else if (totalBookImage) {
            totalBookImage.src = 'https://placehold.co/100x150?text=Нет+обложки';
        }

        // Total series count
        document.getElementById('total-series').textContent = Object.keys(staticStats.series_counts || {}).length;

        // Refresh button
        const container = document.querySelector('.container') || document.body;
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Обновить данные с LiveLib';
        refreshButton.className = 'btn btn-primary mt-3';
        container.prepend(refreshButton);

        refreshButton.addEventListener('click', async () => {
            try {
                refreshButton.disabled = true;
                refreshButton.textContent = 'Загрузка...';

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

                // Update collections
                readBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'read');
                readingBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading');
                wishBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'to-read');
                allBooks = [...readBooks, ...readingBooks, ...wishBooks];

                const newBooks = new BookCollection(readBooks, customDates);
                books.models = newBooks.models;
                books.allBooks = newBooks.allBooks;

                const newCurrentBooks = new BookCollection(readingBooks, customDates);
                currentBooks.models = newCurrentBooks.models;
                currentBooks.allBooks = newCurrentBooks.allBooks;

                const newToReadBooks = new BookCollection(wishBooks, customDates);
                toReadBooks.models = newToReadBooks.models;
                toReadBooks.allBooks = newToReadBooks.allBooks;

                // Refresh UI
                currentBookContainer.innerHTML = '';
                if (currentBooks.models.length > 0) {
                    const currentBookDiv = await currentBooks.models[0].renderCurrent();
                    currentBookContainer.appendChild(currentBookDiv);
                } else {
                    currentBookContainer.innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
                }

                const newLastReadBook = books.getLastReadBook();
                document.getElementById('last-read-book').innerHTML = '';
                if (newLastReadBook) {
                    const lastReadBookDiv = await newLastReadBook.renderCurrent();
                    document.getElementById('last-read-book').appendChild(lastReadBookDiv);
                }

                document.getElementById('most-prolific-author').innerHTML = '';
                const newMostProlificAuthorDiv = await books.renderMostProlificAuthor();
                document.getElementById('most-prolific-author').appendChild(newMostProlificAuthorDiv);

                await Promise.all([
                    books.renderTimelineChart(),
                    books.renderRatingChart(),
                    books.renderGenreChart()
                ]);

                books.currentPage = 0;
                await books.renderPage('book-list');

                document.getElementById('future-reads').innerHTML = '';
                if (toReadBooks.models.length > 0) {
                    await toReadBooks.renderFutureReads('future-reads');
                } else {
                    document.getElementById('future-reads').innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
                }

                await books.renderSeriesShelf('series-shelf');

                // Update stats
                const totalBooks = readBooks.length;
                const books2025 = readBooks.filter(b => b['Date Read']?.startsWith('2025')).length;
                const totalPages = readBooks.reduce((sum, b) => sum + (b['Number of Pages'] || 0), 0);
                const seriesCounts = {};
                readBooks.forEach(b => {
                    if (b.Series) seriesCounts[b.Series] = (seriesCounts[b.Series] || 0) + 1;
                });

                document.getElementById('challenge-progress').innerHTML = `<strong>${books2025} из ${challengeGoal} книг прочитано</strong>`;
                document.getElementById('challenge-bar').style.width = `${Math.min((books2025 / challengeGoal) * 100, 100).toFixed(0)}%`;
                document.getElementById('challenge-percent').textContent = `${Math.min((books2025 / challengeGoal) * 100, 100).toFixed(0)}%`;
                document.getElementById('total-series').textContent = Object.keys(seriesCounts).length;
                if (totalContainer) {
                    totalContainer.querySelector('p:nth-child(1)').textContent = getBookDeclension(totalBooks);
                    totalContainer.querySelector('p:nth-child(2)').textContent = `${totalPages.toLocaleString('ru-RU')} страниц`;
                    totalContainer.querySelector('p:nth-child(3) span').textContent = books2025;
                }

                const refreshedLongestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || 0) > (a['Number of Pages'] || 0) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
                const refreshedShortestBook = readBooks.length ? readBooks.reduce((a, b) => (b['Number of Pages'] || Infinity) < (a['Number of Pages'] || Infinity) ? b : a) : { Title: 'N/A', 'Number of Pages': 0 };
                document.getElementById('longest-book').textContent = `${refreshedLongestBook.Title} (${refreshedLongestBook['Number of Pages']} страниц)`;
                document.getElementById('shortest-book').textContent = `${refreshedShortestBook.Title} (${refreshedShortestBook['Number of Pages']} страниц)`;

                const refreshedMonths = new Set(readBooks.map(b => b['Date Read']?.slice(0, 7)).filter(Boolean));
                const refreshedAvgBooksPerMonth = refreshedMonths.size ? (readBooks.length / refreshedMonths.size).toFixed(1) : 0;
                document.getElementById('average-books-per-month').textContent = `${refreshedAvgBooksPerMonth} книг`;

                const refreshedRandomBook = books.getRandomReadBook();
                if (refreshedRandomBook && totalBookImage) {
                    totalBookImage.src = refreshedRandomBook.getCoverUrl();
                    totalBookImage.alt = refreshedRandomBook.Title;
                }

                // Refresh genre filter
                if (genreFilter) {
                    genreFilter.innerHTML = '<option value="">Все жанры</option>';
                    const refreshedGenres = [...new Set(allBooks.flatMap(book => book.Genres || []))].sort();
                    console.log('Refreshed unique genres:', refreshedGenres); // Debug
                    refreshedGenres.forEach(genre => {
                        const option = document.createElement('option');
                        option.value = genre;
                        option.textContent = genre;
                        genreFilter.appendChild(option);
                    });
                }

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