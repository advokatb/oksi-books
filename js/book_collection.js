class BookCollection {
    constructor(books, customDates) {
        this.customDates = customDates || { books: {} };
        this.models = books ? books.map(book => new Book(book, this.customDates)) : [];
        this.allBooks = [...this.models];
        this.currentPage = 0;
        this.booksPerPage = 9;
        console.log(`BookCollection initialized with ${this.allBooks.length} books`);
        if (this.allBooks.length === 0) {
            console.error('No books loaded in BookCollection');
        }
    }

    filterByGenre(genre) {
        this.models = genre ?
            this.allBooks.filter(book => book.Genres && book.Genres.includes(genre)) :
            [...this.allBooks];
        return this;
    }

    sortBy(field) {
        const [key, direction] = field.split('-');
        this.models.sort((a, b) => {
            let valA = a[key === 'date' ? 'Date Read' : key === 'rating' ? 'My Rating' : 'Title'];
            let valB = b[key === 'date' ? 'Date Read' : key === 'rating' ? 'My Rating' : 'Title'];
            if (key === 'date') {
                valA = valA || '9999-12-31';
                valB = valB || '9999-12-31';
            }
            if (direction === 'asc') {
                return valA < valB ? -1 : valA > valB ? 1 : 0;
            } else {
                return valA > valB ? -1 : valA < valB ? 1 : 0;
            }
        });
        return this;
    }

    async getSeriesWithAuthors() {
        const seriesAuthors = {};
        for (const book of this.allBooks) {
            if (book.Series && book.Series.trim()) {
                const author = await book.getDisplayAuthor();
                if (!seriesAuthors[book.Series]) {
                    seriesAuthors[book.Series] = new Set();
                }
                seriesAuthors[book.Series].add(author);
            }
        }
        return seriesAuthors;
    }

    getLastReadBook() {
        if (!this.allBooks.length) return null;
        return this.allBooks.reduce((latest, book) => 
            new Date(book['Date Read']) > new Date(latest['Date Read']) ? book : latest, 
            this.allBooks.find(b => b['Date Read']) || this.allBooks[0]);
    }

    getRandomReadBook() {
        const readBooks = this.allBooks.filter(book => book['Exclusive Shelf'] === 'read');
        if (readBooks.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * readBooks.length);
        return readBooks[randomIndex];
    }

    async getMostProlificAuthor() {
        if (!this.allBooks.length) return ['Нет данных', 0];
        const authorCounts = {};
        for (const book of this.allBooks) {
            if (book['Exclusive Shelf'] === 'read') {
                const displayAuthor = await book.getDisplayAuthor();
                authorCounts[displayAuthor] = (authorCounts[displayAuthor] || 0) + 1;
            }
        }
        return Object.entries(authorCounts).reduce((max, [author, count]) => 
            count > max[1] ? [author, count] : max, ['', 0]);
    }

    async getAuthorPhoto(authorName) {
        try {
            const response = await fetch('data/author_photos.json');
            const authorPhotos = await response.json();
    
            // Normalize author names for reliable matching
            const normalizedAuthorName = authorName.toLowerCase().trim();
    
            const matchingKey = Object.keys(authorPhotos).find(key => 
                key.toLowerCase().trim() === normalizedAuthorName
            );
    
            if (matchingKey && authorPhotos[matchingKey].startsWith('http')) {
                return authorPhotos[matchingKey];
            } else {
                console.warn(`Photo not found for ${authorName}`);
                return `https://via.placeholder.com/140?text=${encodeURIComponent(authorName)}`;
            }
        } catch (error) {
            console.error('Ошибка загрузки фотографий автора:', error);
            return `https://via.placeholder.com/140?text=${encodeURIComponent(authorName)}`;
        }
    }
    
    
    

    async renderPage(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        const startIndex = this.currentPage * this.booksPerPage;
        const endIndex = startIndex + this.booksPerPage;
        const booksToRender = this.models.slice(startIndex, endIndex);
        if (this.currentPage === 0) container.innerHTML = '';
        if (booksToRender.length > 0) {
            const renderedBooks = await Promise.all(booksToRender.map(book => book.render()));
            renderedBooks.forEach(div => container.appendChild(div));
        } else if (this.currentPage === 0) {
            container.innerHTML = '<p class="text-gray-600">Нет прочитанных книг</p>';
        }
        const loadMoreContainer = document.getElementById('load-more-container');
        loadMoreContainer.style.display = endIndex < this.models.length ? 'block' : 'none';
    }

    async renderSeriesShelf(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        const readBooks = this.allBooks.filter(book => book['Exclusive Shelf'] === 'read');
        if (readBooks.length === 0) {
            container.innerHTML = '<p class="text-gray-600">Нет прочитанных книг в сериях</p>';
            return;
        }
        const seriesBooks = {};
        for (const book of readBooks) {
            if (book.Series && book.Series.trim()) {
                const author = await book.getDisplayAuthor();
                if (!seriesBooks[book.Series]) seriesBooks[book.Series] = { books: [], author };
                seriesBooks[book.Series].books.push(book);
            }
        }
        if (Object.keys(seriesBooks).length === 0) {
            container.innerHTML = '<p class="text-gray-600">Нет серий для отображения</p>';
            return;
        }
        for (const [series, data] of Object.entries(seriesBooks)) {
            const { books, author } = data;
            const seriesDiv = document.createElement('div');
            seriesDiv.className = 'series-box';
            seriesDiv.innerHTML = `
                <p class="text-lg font-semibold text-gray-700">${series} (${books.length} книг${books.length > 1 ? 'и' : 'а'})</p>
                <p class="text-gray-600 text-sm mb-2">Автор: ${author}</p>
            `;
            const rowDiv = document.createElement('div');
            rowDiv.className = 'series-row';
            books.forEach((book, index) => {
                const bookDiv = document.createElement('div');
                bookDiv.className = 'series-book';
                bookDiv.style.left = `${index * 60}px`;
                bookDiv.style.zIndex = (books.length - index).toString();
                bookDiv.innerHTML = `
                    <a href="${book.getLiveLibBookLink()}" target="_blank">
                        <img src="${book.getCoverUrl()}" alt="${book.Title}" 
                             onerror="this.src='https://placehold.co/80x120?text=Нет+обложки'; this.onerror=null;">
                    </a>
                `;
                rowDiv.appendChild(bookDiv);
            });
            seriesDiv.appendChild(rowDiv);
            container.appendChild(seriesDiv);
        }
    }

    async renderFutureReads(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (!this.models || !Array.isArray(this.models)) {
            container.innerHTML = '<p class="text-gray-600">Нет книг для чтения</p>';
            return;
        }
        const renderedBooks = await Promise.all(this.models.map(book => book.render()));
        renderedBooks.forEach(div => container.appendChild(div));
    }

    async renderMostProlificAuthor() {
        const [mostProlificAuthor, authorBookCount] = await this.getMostProlificAuthor();
        const genreCounts = {};
        for (const book of this.allBooks) {
            if (book['Exclusive Shelf'] === 'read') {
                const displayAuthor = await book.getDisplayAuthor();
                if (displayAuthor === mostProlificAuthor) {
                    const genres = book.Genres || [];
                    genres.forEach(genre => {
                        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                    });
                }
            }
        }
        let mostReadGenre = 'N/A';
        let maxCount = 0;
        for (const [genre, count] of Object.entries(genreCounts)) {
            if (count > maxCount) {
                mostReadGenre = genre;
                maxCount = count;
            }
        }
        const div = document.createElement('div');
        div.className = 'flex items-start space-x-4';
        const photoUrl = await this.getAuthorPhoto(mostProlificAuthor);
        div.innerHTML = `
            <img src="${photoUrl}" alt="${mostProlificAuthor} Photo" class="w-16 h-24 object-cover rounded mr-2">
            <div class="flex-1">
                <p class="text-gray-700 text-base font-bold mb-1">Автор: ${mostProlificAuthor}</p>
                <p class="text-gray-600 text-sm mb-2">${authorBookCount} книг</p>
                <hr class="my-2 border-gray-300">
                <p class="text-gray-700 text-base font-bold mb-1">Жанр: ${mostReadGenre}</p>
            </div>
        `;
        return div;
    }

    async createChartPopup(popupId, chartContainer, titleText, books) {
        // Remove any existing popup with the given ID
        const removePopup = () => {
            const existingPopup = document.getElementById(popupId);
            if (existingPopup) existingPopup.remove();
        };
        removePopup();
    
        // Create popup
        const popup = document.createElement('div');
        popup.id = popupId;
        popup.className = 'absolute bottom-[280px] left-1/2 transform -translate-x-1/2 z-100 bg-white border border-gray-200 rounded-lg p-4 shadow-lg max-h-[250px] w-[90%] sm:w-[400px] overflow-y-auto fade-in';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.className = 'absolute top-2 right-2 text-gray-500 hover:text-gray-800 focus:outline-none transition-colors duration-200';
        closeBtn.onclick = removePopup;
    
        const title = document.createElement('h3');
        title.textContent = titleText;
        title.className = 'text-lg font-semibold text-gray-800 text-center mb-3';
    
        popup.appendChild(closeBtn);
        popup.appendChild(title);
    
        // Fetch display authors for all books
        for (const book of books) {
            let displayAuthor;
            try {
                displayAuthor = await book.getDisplayAuthor();
            } catch (error) {
                console.error(`Failed to get display author for ${book.Title}:`, error);
                displayAuthor = book.Author || 'Неизвестный автор';
            }
    
            const bookDiv = document.createElement('div');
            bookDiv.className = 'flex items-center p-2 rounded-md hover:bg-gray-100 transition-colors duration-200 mb-2 last:mb-0';
    
            const img = document.createElement('img');
            img.src = book.getCoverUrl();
            img.className = 'w-10 h-[60px] object-cover rounded-md mr-3';
            img.onerror = () => {
                img.src = 'https://placehold.co/100x150?text=Нет+обложки';
                img.onerror = null;
            };
    
            const bookInfo = document.createElement('div');
            bookInfo.className = 'flex-1';
            bookInfo.innerHTML = `
                <p class="text-sm font-medium text-gray-800">
                    <a href="${book.getLiveLibBookLink()}" target="_blank" class="text-indigo-600 hover:underline">${book.Title}</a>
                </p>
                <p class="text-xs text-gray-600">${displayAuthor}</p>
            `;
    
            bookDiv.appendChild(img);
            bookDiv.appendChild(bookInfo);
            popup.appendChild(bookDiv);
        }
    
        chartContainer.className = 'relative';
        chartContainer.appendChild(popup);
    
        // Close popup when clicking outside
        const outsideClickListener = (event) => {
            const popup = document.getElementById(popupId);
            if (popup && !popup.contains(event.target) && !chartContainer.contains(event.target)) {
                removePopup();
                document.removeEventListener('click', outsideClickListener);
            }
        };
        document.addEventListener('click', outsideClickListener);
    }

    async renderRatingChart() {
        const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const book of this.allBooks) {
            if (book['Exclusive Shelf'] === 'read' && book['My Rating'] > 0) {
                ratingCounts[book['My Rating']] = (ratingCounts[book['My Rating']] || 0) + 1;
            }
        }
    
        const seriesData = Object.values(ratingCounts);
        const labels = Object.keys(ratingCounts).map(rating => {
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            return `${stars} (${ratingCounts[rating]})`;
        });
    
        const chartContainer = document.querySelector("#ratingChart");
    
        const options = {
            chart: {
                type: 'bar',
                height: 200,
                toolbar: { show: false },
                events: {
                    dataPointSelection: async (event, chartContext, config) => {
                        const rating = parseInt(Object.keys(ratingCounts)[config.dataPointIndex], 10);
                        const filteredBooks = this.allBooks.filter(
                            book => book['Exclusive Shelf'] === 'read' && book['My Rating'] === rating
                        );
    
                        this.createChartPopup(
                            'rating-popup',
                            chartContainer,
                            `Книги с рейтингом: ${rating}`,
                            filteredBooks
                        );
                    }
                }
            },
            series: [{
                name: 'Количество книг',
                data: seriesData
            }],
            xaxis: {
                categories: labels,
                labels: {
                    style: {
                        fontSize: '12px',
                        colors: Array(5).fill('#4B5563') // text-gray-600
                    }
                }
            },
            yaxis: {
                title: {
                    text: 'Количество книг',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#374151' // text-gray-700
                    }
                },
                labels: {
                    style: {
                        fontSize: '12px',
                        colors: '#4B5563' // text-gray-600
                    }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '55%',
                    endingShape: 'rounded'
                }
            },
            dataLabels: {
                enabled: true,
                formatter: val => val > 0 ? val : '',
                style: {
                    fontSize: '12px',
                    colors: ['#fff']
                }
            },
            colors: ['#4F46E5'], // Indigo-600
            tooltip: {
                y: {
                    formatter: val => `${val} книг`
                }
            }
        };
    
        const chart = new ApexCharts(chartContainer, options);
        chart.render();
    }

    async renderTimelineChart() {
        const timelineData = {};
        for (const book of this.allBooks) {
            if (book['Exclusive Shelf'] === 'read' && book['Date Read']) {
                const [year, month] = book['Date Read'].split('-');
                const key = `${year}-${month}`;
                timelineData[key] = (timelineData[key] || 0) + 1;
            }
        }
    
        const sortedKeys = Object.keys(timelineData).sort();
        const seriesData = sortedKeys.map(key => timelineData[key]);
        const labels = sortedKeys.map(key => {
            const [year, month] = key.split('-');
            return `${month}.${year}`;
        });
    
        const chartContainer = document.querySelector("#timelineChart");
    
        const options = {
            chart: {
                type: 'bar',
                height: 200,
                toolbar: { show: false },
                events: {
                    dataPointSelection: async (event, chartContext, config) => {
                        const selectedMonth = sortedKeys[config.dataPointIndex]; // e.g., "2025-03"
                        const filteredBooks = this.allBooks.filter(book => {
                            if (book['Exclusive Shelf'] !== 'read' || !book['Date Read']) return false;
                            const [year, month] = book['Date Read'].split('-');
                            return `${year}-${month}` === selectedMonth;
                        });
    
                        const [year, month] = selectedMonth.split('-');
                        this.createChartPopup(
                            'timeline-popup',
                            chartContainer,
                            `Книги за ${month}.${year}`,
                            filteredBooks
                        );
                    }
                }
            },
            series: [{
                name: 'Книги',
                data: seriesData
            }],
            xaxis: {
                categories: labels,
                title: {
                    text: 'Месяц',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#374151'
                    }
                },
                labels: {
                    style: {
                        fontSize: '12px',
                        colors: Array(labels.length).fill('#4B5563')
                    }
                }
            },
            yaxis: {
                title: {
                    text: 'Книги',
                    style: {
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#374151'
                    }
                },
                labels: {
                    style: {
                        fontSize: '12px',
                        colors: '#4B5563'
                    }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '70%'
                }
            },
            dataLabels: {
                enabled: false
            },
            colors: ['#2563eb'],
            tooltip: {
                y: {
                    formatter: val => `${val} книг${val > 1 ? 'и' : 'а'}`
                }
            }
        };
    
        const chart = new ApexCharts(chartContainer, options);
        chart.render();
    }

    async renderGenreChart() {
        const genreCounts = {};
        for (const book of this.allBooks) {
            if (book['Exclusive Shelf'] === 'read') {
                const genres = book.Genres || [];
                genres.forEach(genre => {
                    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                });
            }
        }
    
        const sortedGenres = Object.entries(genreCounts)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    
        const labels = sortedGenres.map(([genre]) => genre);
        const seriesData = sortedGenres.map(([_, count]) => count);
    
        const chartContainer = document.querySelector("#genreChart");
    
        const options = {
            chart: {
                type: 'pie',
                height: 200,
                toolbar: { show: false },
                events: {
                    dataPointSelection: async (event, chartContext, config) => {
                        const genre = labels[config.dataPointIndex];
                        const filteredBooks = this.allBooks.filter(book => book.Genres && book.Genres.includes(genre));
    
                        this.createChartPopup(
                            'genre-popup',
                            chartContainer,
                            `Книги жанра: ${genre}`,
                            filteredBooks
                        );
                    }
                }
            },
            series: seriesData,
            labels: labels,
            colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
            legend: {
                position: 'bottom',
                fontSize: '12px',
                labels: { colors: '#4B5563' }
            },
            dataLabels: {
                enabled: true,
                formatter: (val, opts) => `${opts.w.config.series[opts.seriesIndex]} книг`,
                style: { fontSize: '12px', colors: ['#fff'] }
            },
            tooltip: { y: { formatter: val => `${val} книг` } }
        };
    
        const chart = new ApexCharts(chartContainer, options);
        chart.render();
    }
    
}