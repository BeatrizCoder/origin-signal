"""
Run with:
    cd backend && python -m app.rag.ingest
    cd backend && python -m app.rag.ingest --force
"""
import argparse
import time
from pathlib import Path

from app.rag.document_processor import load_and_chunk_pdf, load_and_chunk_markdown
from app.rag.vector_store import EUDRVectorStore

DATA_DIR = Path(__file__).parents[3] / "backend" / "data"
CHROMA_DIR = str(DATA_DIR / "chroma_db")
DOC_DIRS = ["eudr_docs", "antaq_docs", "market_reports", "import_docs", "tariff_docs"]


def _find_docs() -> list[Path]:
    docs = []
    for folder in DOC_DIRS:
        d = DATA_DIR / folder
        if d.exists():
            docs.extend(sorted(d.glob("*.pdf")))
            docs.extend(sorted(d.glob("*.md")))
    return docs


def _ingest_file(doc: Path, store: EUDRVectorStore, force: bool) -> dict:
    indexed_sources = store.get_sources()

    if not force and doc.name in indexed_sources:
        print(f"  [skip] {doc.name} — já indexado")
        return {"file": doc.name, "status": "skipped"}

    t0 = time.perf_counter()

    print(f"  [1/3] load   {doc.name} ...")
    if doc.suffix == '.md':
        chunks = load_and_chunk_markdown(str(doc))
    else:
        chunks = load_and_chunk_pdf(str(doc))
    t1 = time.perf_counter()
    print(f"  [2/3] chunk  → {len(chunks)} chunks  ({t1 - t0:.1f}s)")

    print(f"  [3/3] index  ...")
    store.index_documents(chunks)
    t2 = time.perf_counter()
    print(f"        done   {len(chunks)} chunks em {t2 - t0:.1f}s")

    return {"file": doc.name, "status": "indexed", "chunks": len(chunks), "elapsed": t2 - t0}


def run(force: bool = False) -> None:
    store = EUDRVectorStore(persist_directory=CHROMA_DIR)
    docs = _find_docs()

    if not docs:
        print("[ingest] nenhum documento encontrado em:", [str(DATA_DIR / d) for d in DOC_DIRS])
        return

    print(f"[ingest] {len(docs)} arquivo(s) encontrado(s)\n")

    results = []
    for doc in docs:
        results.append(_ingest_file(doc, store, force))
        print()

    print("=== ingest summary ===")
    for r in results:
        if r["status"] == "skipped":
            print(f"  {r['file']:<45} skipped  (já indexado)")
        else:
            print(f"  {r['file']:<45} indexed  ({r['chunks']} chunks, {r['elapsed']:.1f}s)")
    print(f"  total no DB: {store.count()} chunks")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="reindexar mesmo se já estiver no DB")
    args = parser.parse_args()
    run(force=args.force)
