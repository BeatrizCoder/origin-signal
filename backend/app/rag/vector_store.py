from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

COLLECTION_NAME = 'eudr_regulation'
EMBED_MODEL = 'all-MiniLM-L6-v2'


class EUDRVectorStore:
    def __init__(self, persist_directory: str):
        Path(persist_directory).mkdir(parents=True, exist_ok=True)
        self._client = chromadb.PersistentClient(path=persist_directory)
        self._ef = SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
        self._collection = self._client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=self._ef,
            metadata={'hnsw:space': 'cosine'},
        )

    def count(self) -> int:
        return self._collection.count()

    def get_sources(self) -> set[str]:
        if self._collection.count() == 0:
            return set()
        result = self._collection.get(include=['metadatas'])
        return {m.get('source', '') for m in result['metadatas'] if m.get('source')}

    def index_documents(self, chunks: list[dict]) -> None:
        ids, documents, metadatas = [], [], []
        for i, chunk in enumerate(chunks):
            doc_id = f"eudr_{i:05d}"
            ids.append(doc_id)
            documents.append(chunk['text'])
            metadatas.append({
                'source': chunk.get('source', ''),
                'article_number': chunk.get('article_number', ''),
                'chunk_type': chunk.get('chunk_type', ''),
                'sub_index': chunk.get('sub_index', 0),
            })

        # Upsert in batches of 100
        batch = 100
        for start in range(0, len(ids), batch):
            self._collection.upsert(
                ids=ids[start:start + batch],
                documents=documents[start:start + batch],
                metadatas=metadatas[start:start + batch],
            )
            print(f"  indexed {min(start + batch, len(ids))}/{len(ids)} chunks")

    def search(self, query: str, n_results: int = 5) -> list[dict]:
        results = self._collection.query(
            query_texts=[query],
            n_results=n_results,
            include=['documents', 'metadatas', 'distances'],
        )
        output = []
        for doc, meta, dist in zip(
            results['documents'][0],
            results['metadatas'][0],
            results['distances'][0],
        ):
            output.append({
                'text': doc,
                'source': meta.get('source', ''),
                'article_number': meta.get('article_number', ''),
                'chunk_type': meta.get('chunk_type', ''),
                'distance': round(dist, 4),
            })
        return output
