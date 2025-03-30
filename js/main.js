document.addEventListener('DOMContentLoaded', async () => {
    try {
        const username = 'oksanaranneva';

        // Load static data as fallback
        const customPagesResponse = await fetch('data/custom_pages.json');
        const customPages = await customPagesResponse.json();
        const annotationsResponse = await fetch('data/book_annotations.json');
        const bookAnnotations = await annotationsResponse.json();

        let staticStats = {};
        try {
            const statsResponse = await fetch('/reading_stats.json');
            staticStats = await statsResponse.json();
        } catch (e) {
            console.warn('Failed to load reading_stats.json:', e);
            document.getElementById('book-list').innerHTML = '<p class="text-gray-600">Не удалось загрузить данные</p>';
        }

        let readBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'read') || [];
        let readingBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'currently-reading') || [];
        let wishBooks = staticStats.book_list?.filter(b => b['Exclusive Shelf'] === 'to-read') || [];
        let allBooks = [...readBooks, ...readingBooks, ...wishBooks];

        // Enhance with annotations and pages
        allBooks.forEach(book => {
            book['Annotation'] = bookAnnotations[book['Book Id']] || book['Annotation'] || 'Нет аннотации';
            book['Number of Pages'] = customPages[book.Title] || book['Number of Pages'] || 0;
        });

        const books = new BookCollection(readBooks, {});
        const currentBooks = new BookCollection(readingBooks, {});
        const toReadBooks = new BookCollection(wishBooks, {});

        // Initial UI rendering (unchanged)
        const genreFilter = document.getElementById('genre-filter');
        const uniqueGenres = [...new Set(books.allBooks.flatMap(book => book.Genres || []))].sort();
        uniqueGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });

        if (currentBooks.models.length > 0) {
            const currentBookDiv = await currentBooks.models[0].renderCurrent();
            document.getElementById('current-book').appendChild(currentBookDiv);
        } else {
            document.getElementById('current-book').innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
        }

        const lastReadBook = books.getLastReadBook();
        if (lastReadBook) {
            const lastReadBookDiv = await lastReadBook.renderCurrent();
            document.getElementById('last-read-book').appendChild(lastReadBookDiv);
        }

        const mostProlificAuthorDiv = await books.renderMostProlificAuthor();
        document.getElementById('most-prolific-author').appendChild(mostProlificAuthorDiv);

        await books.renderTimelineChart();
        await books.renderRatingChart();
        await books.renderGenreChart();

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

        // Add refresh button
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Обновить данные с LiveLib';
        refreshButton.className = 'btn btn-primary mt-3';
        document.querySelector('.container').prepend(refreshButton); // Adjust placement as needed

        refreshButton.addEventListener('click', async () => {
            try {
                // Show loading state
                refreshButton.disabled = true;
                refreshButton.textContent = 'Загрузка...';

                // Fetch JSON from Livelib Backup for all shelves
                const shelves = ['read', 'reading', 'wish'];
                const includeColumns = {
                    title: true,
                    authors: true,
                    readDate: true,
                    ratingUser: true,
                    genres: true,
                    series: true,
                    bookHref: true,
                    coverHref: true,
                    annotation: true
                };

                const updatedBooks = [];
                for (const pagename of shelves) {
                    const url = new URL('https://script.google.com/a/macros/s/AKfycbz99NP1EXi_2sXT7GoQp1exM_MvpsFtL1YYfaNXVz1q8XPrrR4dnIqfLdkHn9muK35XsA/exec');
                    url.searchParams.append('username', username);
                    url.searchParams.append('pagename', pagename);
                    url.searchParams.append('fileExtention', 'json');
                    Object.keys(includeColumns).forEach(col => {
                        if (includeColumns[col]) url.searchParams.append('includeColumns', col);
                    });

                    const response = await fetch(url, { method: 'GET' });
                    if (!response.ok) throw new Error(`Failed to fetch ${pagename}: ${response.status}`);

                    const bookArray = await response.json();
                    bookArray.forEach(book => {
                        book['Exclusive Shelf'] = pagename === 'read' ? 'read' : pagename === 'reading' ? 'currently-reading' : 'to-read';
                        book['Book Id'] = book.bookHref ? book.bookHref.split('/').pop() : book.title.toLowerCase().replace(/ /g, '-');
                        book['Annotation'] = bookAnnotations[book['Book Id']] || book.annotation || 'Нет аннотации';
                        book['Number of Pages'] = customPages[book.title] || 0;
                        book['Authors'] = book.authors.map(a => a.name).join(', ');
                        book['Genres'] = book.genres?.map(g => g.name) || [];
                        book['Series'] = book.details?.series || null;
                        book['My Rating'] = parseFloat(book.rating?.user) || 0;
                        book['Cover URL'] = book.coverHref || '';
                        book['Title'] = book.title;
                        book['Date Read'] = book.readDate ? parseDate(book.readDate) : null;
                    });
                    updatedBooks.push(...bookArray);
                }

                // Update BookCollections
                readBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'read');
                readingBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading');
                wishBooks = updatedBooks.filter(b => b['Exclusive Shelf'] === 'to-read');

                books.allBooks = readBooks;
                books.models = readBooks;
                currentBooks.allBooks = readingBooks;
                currentBooks.models = readingBooks;
                toReadBooks.allBooks = wishBooks;
                toReadBooks.models = wishBooks;

                // Refresh UI
                document.getElementById('current-book').innerHTML = '';
                if (currentBooks.models.length > 0) {
                    const currentBookDiv = await currentBooks.models[0].renderCurrent();
                    document.getElementById('current-book').appendChild(currentBookDiv);
                } else {
                    document.getElementById('current-book').innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
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

                await books.renderTimelineChart();
                await books.renderRatingChart();
                await books.renderGenreChart();

                books.currentPage = 0;
                await books.renderPage('book-list');

                document.getElementById('future-reads').innerHTML = '';
                if (toReadBooks.models.length > 0) {
                    await toReadBooks.renderFutureReads('future-reads');
                } else {
                    document.getElementById('future-reads').innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
                }

                await books.renderSeriesShelf('series-shelf');

                alert('Данные успешно обновлены!');
            } catch (error) {
                console.error('Refresh error:', error);
                alert('Не удалось обновить данные: ' + error.message);
            } finally {
                refreshButton.disabled = false;
                refreshButton.textContent = 'Обновить данные с LiveLib';
            }
        });

        // Rest of your existing event listeners (filters, load more, etc.) remain unchanged
    } catch (error) {
        console.error('Error:', error);
    }
});

// Reuse parseDate from your original code
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