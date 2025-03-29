document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('reading_stats.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const stats = await response.json();

        const allBooks = stats.book_list;

        const books = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'read'), {});
        const currentBooks = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'currently-reading'), {});
        const toReadBooks = new BookCollection(allBooks.filter(b => b['Exclusive Shelf'] === 'to-read'), {});

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

        await books.renderTimelineChart(stats.timeline);
        await books.renderRatingChart();
        await books.renderGenreChart();

        const randomReadBook = books.getRandomReadBook();
        if (randomReadBook) {
            document.getElementById('total-book-image').src = randomReadBook.getCoverUrl();
            document.getElementById('total-book-image').alt = randomReadBook.Title;
        }

        const totalSeries = Object.keys(stats.series_counts).length;
        document.getElementById('total-series').textContent = totalSeries;

        const challengeGoal = 50;
        const progressPercent = Math.min((stats.books_2025 / challengeGoal) * 100, 100).toFixed(0);
        document.getElementById('challenge-progress').innerHTML = `<strong>${stats.books_2025} из ${challengeGoal} книг прочитано</strong>`;
        document.getElementById('challenge-days').textContent = `Осталось ${Math.ceil((new Date('2025-12-31') - new Date()) / (1000 * 60 * 60 * 24))} дней`;
        document.getElementById('challenge-bar').style.width = `${progressPercent}%`;
        document.getElementById('challenge-percent').textContent = `${progressPercent}%`;

        // Update "Всего" block
        const totalBookDiv = document.getElementById('total-book')?.closest('div.w-full');
        if (totalBookDiv) {
            const totalContainer = totalBookDiv.querySelector('.text-left');
            const totalBooksElement = totalContainer.querySelector('p:nth-child(1)');
            const totalPagesElement = totalContainer.querySelector('p:nth-child(2)');
            const books2025Element = totalContainer.querySelector('p:nth-child(3) span');

            if (totalBooksElement && totalPagesElement && books2025Element) {
                totalBooksElement.textContent = getBookDeclension(stats.total_books);
                totalPagesElement.textContent = `${stats.total_pages.toLocaleString('ru-RU')} страниц`;
                books2025Element.textContent = stats.books_2025;
            } else {
                console.error('Missing elements in "Всего" block:', { totalBooksElement, totalPagesElement, books2025Element });
            }
        } else {
            console.error('Total book container not found');
        }

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
                
        books.currentPage = 0;
        books.booksPerPage = 9;
        books.sortBy('date-desc');
        await books.renderPage('book-list');

        document.getElementById('load-more').addEventListener('click', async () => {
            books.currentPage += 1;
            await books.renderPage('book-list');
        });

        // Clearly render future books
        const futureBooksContainer = document.getElementById('future-reads');
        if (toReadBooks.models.length > 0) {
            futureBooksContainer.innerHTML = '';
            await toReadBooks.renderFutureReads('future-reads');
        } else {
            futureBooksContainer.innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
        }

        const applyFilters = async () => {
            let filteredBooks = books;
            const selectedGenre = genreFilter.value;
            filteredBooks = filteredBooks.filterByGenre(selectedGenre);
            const sortValue = document.getElementById('sort-by').value;
            filteredBooks = filteredBooks.sortBy(sortValue);
            filteredBooks.currentPage = 0;
            await filteredBooks.renderPage('book-list');
        };

        genreFilter.addEventListener('change', applyFilters);
        document.getElementById('sort-by').addEventListener('change', applyFilters);

        await books.renderSeriesShelf('series-shelf');

    } catch (error) {
        console.error('Error:', error);
    }
});
