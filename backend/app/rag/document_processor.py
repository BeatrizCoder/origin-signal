import re
from pathlib import Path

import PyPDF2

SECTION_RE = re.compile(r'^#{1,3}\s+', re.MULTILINE)


def load_and_chunk_markdown(md_path: str) -> list[dict]:
    path = Path(md_path)
    text = path.read_text(encoding='utf-8')
    source = path.name

    # Split on headings (## or ###)
    sections = SECTION_RE.split(text)
    sections = [s.strip() for s in sections if s.strip()]

    chunks: list[dict] = []
    for section in sections:
        sub_chunks = _split_into_sub_chunks(section, CHUNK_SIZE, OVERLAP)
        for i, sub in enumerate(sub_chunks):
            if not sub.strip():
                continue
            chunks.append({
                'text': sub.strip(),
                'source': source,
                'article_number': '',
                'chunk_type': 'guide',
                'sub_index': i,
            })
    return chunks


CHUNK_SIZE = 2000   # ~500 tokens
OVERLAP = 200       # ~50 tokens

_ARTICLE_RE  = re.compile(r'(Article\s+\d+)', re.IGNORECASE)
_RECITAL_RE  = re.compile(r'(\(\d+\)\s)', re.IGNORECASE)
_ANNEX_RE    = re.compile(r'(ANNEX\s+[IVXLCDM\d]+)', re.IGNORECASE)
_WHEREAS_RE  = re.compile(r'(Whereas)', re.IGNORECASE)


def _detect_type(text: str) -> tuple[str, str]:
    """Return (chunk_type, article_number) for a text block."""
    if _ANNEX_RE.search(text):
        m = _ANNEX_RE.search(text)
        return 'annex', m.group(1) if m else ''
    if _WHEREAS_RE.search(text) or _RECITAL_RE.search(text[:80]):
        return 'recital', ''
    m = _ARTICLE_RE.search(text[:120])
    if m:
        return 'article', m.group(1)
    return 'article', ''


def _split_into_sub_chunks(text: str, size: int, overlap: int) -> list[str]:
    if len(text) <= size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def load_and_chunk_pdf(pdf_path: str) -> list[dict]:
    path = Path(pdf_path)
    chunks: list[dict] = []

    with open(path, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        full_text_by_page: list[tuple[int, str]] = []
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ''
            full_text_by_page.append((page_num, text))

    full_text = '\n'.join(t for _, t in full_text_by_page)

    # Split on section boundaries
    boundary = re.compile(
        r'(?=Article\s+\d+|ANNEX\s+[IVXLCDM\d]+|\(\d+\)\s)',
        re.IGNORECASE,
    )
    sections = boundary.split(full_text)
    sections = [s.strip() for s in sections if s.strip()]

    source = path.name
    for section in sections:
        chunk_type, article_number = _detect_type(section)
        sub_chunks = _split_into_sub_chunks(section, CHUNK_SIZE, OVERLAP)
        for i, sub in enumerate(sub_chunks):
            if not sub.strip():
                continue
            chunks.append({
                'text': sub.strip(),
                'source': source,
                'article_number': article_number,
                'chunk_type': chunk_type,
                'sub_index': i,
            })

    return chunks
