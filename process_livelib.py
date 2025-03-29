import json
import os
from datetime import datetime

# Russian month names to English for parsing
MONTHS = {
    'Январь': 'January', 'Февраль': 'February', 'Март': 'March', 'Апрель': 'April',
    'Май': 'May', 'Июнь': 'June', 'Июль': 'July', 'Август': 'August',
    'Сентябрь': 'September', 'Октябрь': 'October', 'Ноябрь': 'November', 'Декабрь': 'December'
}

def parse_date(date_str):
    if not date_str or 'г.' not in date_str:
        return None
    month, year = date_str.replace(' г.', '').split()
    month_eng = MONTHS.get(month, month)  # Translate Russian to English, fallback to original if not found
    try:
        return datetime.strptime(f"{month_eng} {year}", '%B %Y').strftime('%Y-%m-%d')
    except ValueError as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None

def load_json_file(filepath):
    if filepath:
        with open(filepath, 'r', encoding='utf-8') as file:
            return json.load(file)
    return []

def process_livelib_files(username="oksanaranneva"):
    export_dir = 'export'
    os.makedirs(export_dir, exist_ok=True)

    # Find files with configurable username
    read_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-read-')), None)
    reading_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-reading-')), None)
    wish_file = next((f for f in os.listdir(export_dir) if f.startswith(f'livelib-{username}-wish-')), None)

    read_data = load_json_file(os.path.join(export_dir, read_file))
    reading_data = load_json_file(os.path.join(export_dir, reading_file))
    wish_data = load_json_file(os.path.join(export_dir, wish_file))

    all_books = []

    # Process read books
    for book in read_data:
        rating = book['rating'].get('user', '0')
        all_books.append({
            'Title': book['title'],
            'Author': book['authors'][0]['name'] if book['authors'] else 'Unknown',
            'Additional Authors': ', '.join(a['name'] for a in book['authors'][1:]) if len(book['authors']) > 1 else '',
            'Date Read': parse_date(book.get('readDate')),
            'My Rating': float(rating),
            'Cover URL': book.get('coverHref', ''),
            'Genres': [g['name'] for g in book.get('genres', [])],
            'Series': book['details'].get('series'),
            'Exclusive Shelf': 'read',
            'Book Id': book.get('bookHref', '').split('/')[-1] if 'bookHref' in book else book['title'].replace(' ', '-').lower()
        })

    # Process currently reading
    for book in reading_data:
        rating = book['rating'].get('user', '0')
        all_books.append({
            'Title': book['title'],
            'Author': book['authors'][0]['name'] if book['authors'] else 'Unknown',
            'Additional Authors': ', '.join(a['name'] for a in book['authors'][1:]) if len(book['authors']) > 1 else '',
            'Date Read': None,
            'My Rating': float(rating) if rating else 0,
            'Cover URL': book.get('coverHref', ''),
            'Genres': [g['name'] for g in book.get('genres', [])],
            'Series': book['details'].get('series'),
            'Exclusive Shelf': 'currently-reading',
            'Book Id': book.get('bookHref', '').split('/')[-1] if 'bookHref' in book else book['title'].replace(' ', '-').lower()
        })

    # Process wish list
    for book in wish_data:
        rating = book['rating'].get('user', '0')
        all_books.append({
            'Title': book['title'],
            'Author': book['authors'][0]['name'] if book['authors'] else 'Unknown',
            'Additional Authors': ', '.join(a['name'] for a in book['authors'][1:]) if len(book['authors']) > 1 else '',
            'Date Read': None,
            'My Rating': float(rating) if rating else 0.0,
            'Cover URL': book.get('coverHref', ''),
            'Genres': [g['name'] for g in book.get('genres', [])],
            'Series': book['details'].get('series'),
            'Exclusive Shelf': 'to-read',
            'Book Id': book.get('bookHref', '').split('/')[-1] if 'bookHref' in book else book['title'].replace(' ', '-').lower()
        })


    # Generate stats
    read_books = [b for b in all_books if b['Exclusive Shelf'] == 'read']
    total_books = len(read_books)
    books_2025 = len([b for b in read_books if b['Date Read'] and b['Date Read'].startswith('2025')])
    timeline = {}
    for book in read_books:
        if book['Date Read']:
            month = book['Date Read'][:7]
            timeline[month] = timeline.get(month, 0) + 1
    timeline_data = [{'Date': k, 'Books': v} for k, v in sorted(timeline.items())]

    def load_custom_pages(filepath='data/custom_pages.json'):
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as file:
                return json.load(file)
        return {}

    # Inside your process_livelib_files function (at the end)
    custom_pages = load_custom_pages()
    total_pages = sum(custom_pages.get(book['Title'], 0) for book in read_books)

    # Then update stats with total_pages:
    stats = {
        'total_books': total_books,
        'books_2025': books_2025,
        'total_pages': total_pages, # add this line
        'book_list': all_books,
        'timeline': timeline_data,
        'series_counts': {s: sum(1 for b in read_books if b['Series'] == s) for s in set(b['Series'] for b in read_books if b['Series'])}
    }

    with open('reading_stats.json', 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    username = os.getenv('LIVELIB_USERNAME', 'oksanaranneva')
    process_livelib_files(username)