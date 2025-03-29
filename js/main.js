document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('reading_stats.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const stats = await response.json();

        const allBooks = stats.book_list;

        const books = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'read'), {});
        const currentBooks = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading'), {});
        const toReadBooks = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'to-read'), {});

        // Populate genre filter
        const genreFilter = document.getElementById('genre-filter');
        const uniqueGenres = [...new Set(books.allBooks.flatMap(book => book.Genres || []))].sort();
        uniqueGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });

        // Render current book
        if (currentBooks.models.length > 0) {
            const currentBookDiv = await currentBooks.models[0].renderCurrent();
            document.getElementById('current-book').appendChild(currentBookDiv);
        } else {
            document.getElementById('current-book').innerHTML = '<p class="text-gray-600">Ничего не читаю сейчас</p>';
        }

        // Render last read book
        const lastReadBook = books.getLastReadBook();
        if (lastReadBook) {
            const lastReadBookDiv = await lastReadBook.renderCurrent();
            document.getElementById('last-read-book').appendChild(lastReadBookDiv);
        }

        // Most prolific author
        const mostProlificAuthorDiv = await books.renderMostProlificAuthor();
        document.getElementById('most-prolific-author').appendChild(mostProlificAuthorDiv);

        // Render charts
        await books.renderTimelineChart(stats.timeline);
        await books.renderRatingChart();
        await books.renderGenreChart();

        // Random book image
        const randomReadBook = books.getRandomReadBook();
        if (randomReadBook) {
            document.getElementById('total-book-image').src = randomReadBook.getCoverUrl();
            document.getElementById('total-book-image').alt = randomReadBook.Title;
        }

        // Total series count
        document.getElementById('total-series').textContent = Object.keys(stats.series_counts).length;

        // Reading challenge stats
        const challengeGoal = 50;
        const progressPercent = Math.min((stats.books_2025 / challengeGoal) * 100, 100).toFixed(0);
        document.getElementById('challenge-progress').innerHTML = `<strong>${stats.books_2025} из ${challengeGoal} книг прочитано</strong>`;
        document.getElementById('challenge-days').textContent = `Осталось ${Math.ceil((new Date('2025-12-31') - new Date()) / (1000 * 60 * 60 * 24))} дней`;
        document.getElementById('challenge-bar').style.width = `${progressPercent}%`;
        document.getElementById('challenge-percent').textContent = `${progressPercent}%`;

        // Update "Всего" block clearly
        const totalContainer = document.querySelector('#total-book').nextElementSibling;
        totalContainer.querySelector('p:nth-child(1)').textContent = getBookDeclension(stats.total_books);
        totalContainer.querySelector('p:nth-child(2)').textContent = `${stats.total_pages.toLocaleString('ru-RU')} страниц`;
        totalContainer.querySelector('p:nth-child(3) span').textContent = stats.books_2025;

        // Книжные рекорды (longest/shortest books)
        const longestBook = allBooks.filter(b => b['Exclusive Shelf'] === 'read').reduce((a, b) => (parseInt(b['Number of Pages'], 10) || 0) > (parseInt(a['Number of Pages'], 10) || 0) ? b : a);
        const shortestBook = allBooks.filter(b => b['Exclusive Shelf'] === 'read').reduce((a, b) => (parseInt(b['Number of Pages'], 10) || Infinity) < (parseInt(a['Number of Pages'], 10) || Infinity) ? b : a);

        document.getElementById('longest-book').textContent = `${longestBook.Title} (${longestBook['Number of Pages']} страниц)`;
        document.getElementById('shortest-book').textContent = `${shortestBook.Title} (${shortestBook['Number of Pages']} страниц)`;

        // В среднем прочитано в месяц
        const months = new Set(books.allBooks.map(b => b['Date Read']?.slice(0, 7)).filter(Boolean));
        const avgBooksPerMonth = (books.allBooks.length / months.size).toFixed(1);
        document.getElementById('average-books-per-month').textContent = `${avgBooksPerMonth} книг`;

        // Tab Switching Logic
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanes.forEach(pane => pane.classList.remove('active'));

                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                document.getElementById(tabId).classList.add('active');
            });
        });


        // Initial pagination for read books
        books.currentPage = 0;
        books.booksPerPage = 9;
        books.sortBy('date-desc');
        await books.renderPage('book-list');

        document.getElementById('load-more').addEventListener('click', async () => {
            books.currentPage += 1;
            await books.renderPage('book-list');
        });

        // Future books
        if (toReadBooks.models.length > 0) {
            await toReadBooks.renderFutureReads('future-reads');
        } else {
            document.getElementById('future-reads').innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
        }

        // Filter functionality
        const applyFilters = async () => {
            let filteredBooks = books.filterByGenre(genreFilter.value).sortBy(document.getElementById('sort-by').value);
            filteredBooks.currentPage = 0;
            await filteredBooks.renderPage('book-list');
        };
        genreFilter.addEventListener('change', applyFilters);
        document.getElementById('sort-by').addEventListener('change', applyFilters);

        // Series shelf rendering
        await books.renderSeriesShelf('series-shelf');

    } catch (error) {
        console.error('Error:', error);
    }
});
