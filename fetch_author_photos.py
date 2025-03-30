import json
import os
import requests
from bs4 import BeautifulSoup

def fetch_livelib_data(username):
    """
    Fetch book data from Google Apps Script for all shelves (read, reading, wish).
    Mimics the behavior of fetchLiveLibData from dataFetcher.js.
    """
    shelves = ['read', 'reading', 'wish']
    include_columns = ['title', 'authors', 'readDate', 'ratingUser', 'isbn', 'genres', 'series', 'bookHref', 'coverHref']
    all_books = []

    headers = {'User-Agent': 'Mozilla/5.0'}  # To mimic a browser request

    for shelf in shelves:
        url = 'https://script.google.com/macros/s/AKfycbxzTdo297yeLns95JN_h8xCKfIKNNvqKg8bk5NXrEOxeRD-gbQAqgxiB18IDDG2WbOO/exec'
        params = {
            'username': username,
            'pagename': shelf,
            'includeColumns': ','.join(include_columns)
        }

        try:
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()  # Raise an error for bad status codes
            data = response.json()

            if not data.get('bookArray') or not isinstance(data['bookArray'], list):
                print(f"Некорректный формат данных для {shelf}")
                continue

            # Append the raw book data as-is (we only need authors for this script)
            all_books.extend(data['bookArray'])

        except requests.RequestException as e:
            print(f"Ошибка загрузки {shelf}: {e}")
        except ValueError as e:
            print(f"Ошибка разбора JSON для {shelf}: {e}")

    return all_books

def extract_authors(data):
    """
    Extract unique authors and their URLs from the book data.
    """
    authors = {}
    for book in data:
        for author in book.get('authors', []):
            name = author.get('name')
            href = author.get('href')
            if name and href:
                authors[name] = href
    return authors

def fetch_author_photo(url):
    """
    Scrape the author's photo from their LiveLib profile page.
    """
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        img_tag = soup.select_one('img#profile-avatar')
        if img_tag and 'src' in img_tag.attrs:
            return img_tag['src']
        else:
            print(f"Image tag not found or missing src at {url}")
    except Exception as e:
        print(f"Ошибка получения фото по адресу {url}: {e}")
    return 'https://placehold.co/140x140?text=No+Photo'

def process_author_photos(username):
    """
    Fetch book data from Google Script, extract authors, and get their photos.
    """
    # Fetch book data from all shelves
    all_books = fetch_livelib_data(username)

    # Extract unique authors
    all_authors = extract_authors(all_books)

    # Fetch photos for each author
    author_photos = {}
    for author_name, author_url in all_authors.items():
        print(f"Fetching photo for {author_name}")
        photo_url = fetch_author_photo(author_url)
        author_photos[author_name.lower()] = photo_url

    # Save to JSON file
    os.makedirs('data', exist_ok=True)  # Ensure data directory exists
    with open('data/author_photos.json', 'w', encoding='utf-8') as f:
        json.dump(author_photos, f, ensure_ascii=False, indent=2)
    print("Author photos saved to data/author_photos.json")

if __name__ == '__main__':
    # Prefer environment variable, fall back to config.json
    username = os.getenv('LIVELIB_USERNAME')
    if not username and os.path.exists('config.json'):
        with open('data', 'config.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
            username = config.get('livelibUsername', 'oksanaranneva')
    if not username:
        username = 'oksanaranneva'  # Final default
    process_author_photos(username)