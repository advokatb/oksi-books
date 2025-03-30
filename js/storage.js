// storage.js
export function loadBooksFromStorage() {
    const storedData = localStorage.getItem('livelibBooks');
    if (storedData) {
        const data = JSON.parse(storedData);
        if (Array.isArray(data)) {
            // Old format: just an array of books
            const allBooks = data;
            const lastUpdated = null;
            // Migrate to new format
            localStorage.setItem('livelibBooks', JSON.stringify({ books: allBooks, timestamp: lastUpdated }));
            return { allBooks, lastUpdated };
        } else {
            // New format: object with books and timestamp
            const allBooks = data.books || [];
            const lastUpdated = data.timestamp || null;
            return { allBooks, lastUpdated };
        }
    }
    return null;
}

export function saveBooksToStorage(allBooks, lastUpdated) {
    localStorage.setItem('livelibBooks', JSON.stringify({ books: allBooks, timestamp: lastUpdated }));
}