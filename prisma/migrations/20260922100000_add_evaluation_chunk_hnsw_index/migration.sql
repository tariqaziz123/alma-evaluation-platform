CREATE INDEX IF NOT EXISTS evaluation_chunk_embedding_hnsw_idx
ON "EvaluationChunk"
USING hnsw (embedding vector_cosine_ops);