import json
import os
import requests
from bs4 import BeautifulSoup

def load_json_file(filepath):
    if filepath:
        with open(filepath, 'r', encoding='utf-8') as file:
            return json.load(file)
    return []

def extract_authors(data):
    authors = {}
    for book in data:
        for author in book.get('authors', []):
            name = author['name']
            href = author['href']
            authors[name] = href
    return authors

def fetch_author_photo(url):
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        img_tag = soup.select_one('img#profile-avatar')
        if img_tag and 'src' in img_tag.attrs:
            return img_tag['src']
        else:
            print(f"Image tag not found or missing src at {url}")
    except Exception as e:
        print(f"Ошибка получения фото по адресу {url}: {e}")
    return 'https://placehold.co/140x140?text=No+Photo'


def process_author_photos(username="oksanaranneva"):
    export_dir = 'export'
    read_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-read-')), None)
    reading_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-reading-')), None)
    wish_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-wish-')), None)

    read_data = load_json_file(os.path.join(export_dir, read_file))
    reading_data = load_json_file(os.path.join(export_dir, reading_file))
    wish_data = load_json_file(os.path.join(export_dir, wish_file))

    all_authors = {}
    all_authors.update(extract_authors(read_data))
    all_authors.update(extract_authors(reading_data))
    all_authors.update(extract_authors(wish_data))

    author_photos = {}
    for author_name, author_url in all_authors.items():
        print(f"Fetching photo for {author_name}")
        photo_url = fetch_author_photo(author_url)
        author_photos[author_name.lower()] = photo_url

    with open('data/author_photos.json', 'w', encoding='utf-8') as f:
        json.dump(author_photos, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    username = os.getenv('LIVELIB_USERNAME', 'oksanaranneva')
    process_author_photos(username)
