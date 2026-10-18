import type { KnowledgeDocument, RAGChunk, RAGConfig } from "./types";
import { getAIGatewayData } from "./storage";

const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
    "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
    "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
    "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
    "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should",
    "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them",
    "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where",
    "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
    "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
    // Indonesian common stopwords
    "ada", "adalah", "akan", "antara", "atau", "bisa", "dan", "dari", "dengan", "di", "ini", "itu",
    "jika", "juga", "karena", "ke", "maka", "mereka", "pada", "saya", "sebagai", "sudah", "tidak", "untuk"
]);

/**
 * Tokenize and normalize text into meaningful keywords
 */
export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Chunk a single document into overlapping semantic chunks
 */
export function chunkDocument(
    doc: KnowledgeDocument,
    chunkSize = 450,
    chunkOverlap = 60
): RAGChunk[] {
    const text = doc.content.trim();
    if (!text) return [];

    // Split on paragraph or newline boundaries first
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: RAGChunk[] = [];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (currentChunk.length + trimmed.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
        } else {
            // If currentChunk is already substantial, save it
            if (currentChunk) {
                chunks.push({
                    docId: doc.id,
                    docTitle: doc.title,
                    chunkIndex,
                    text: currentChunk,
                    keywords: tokenize(currentChunk),
                });
                chunkIndex++;

                // Overlap: keep tail end of previous chunk
                const overlapText = currentChunk.slice(-chunkOverlap);
                currentChunk = overlapText + (overlapText ? " " : "") + trimmed;
            } else {
                // If a single paragraph is longer than chunkSize, split by sentence
                const sentences = trimmed.match(/[^.!?]+[.!?]+(\s|$)/g) || [trimmed];
                for (const sentence of sentences) {
                    if (currentChunk.length + sentence.length <= chunkSize) {
                        currentChunk += (currentChunk ? " " : "") + sentence.trim();
                    } else {
                        if (currentChunk) {
                            chunks.push({
                                docId: doc.id,
                                docTitle: doc.title,
                                chunkIndex,
                                text: currentChunk,
                                keywords: tokenize(currentChunk),
                            });
                            chunkIndex++;
                            const overlapText = currentChunk.slice(-chunkOverlap);
                            currentChunk = overlapText + " " + sentence.trim();
                        } else {
                            chunks.push({
                                docId: doc.id,
                                docTitle: doc.title,
                                chunkIndex,
                                text: sentence.trim(),
                                keywords: tokenize(sentence.trim()),
                            });
                            chunkIndex++;
                            currentChunk = "";
                        }
                    }
                }
            }
        }
    }

    if (currentChunk.trim()) {
        chunks.push({
            docId: doc.id,
            docTitle: doc.title,
            chunkIndex,
            text: currentChunk.trim(),
            keywords: tokenize(currentChunk.trim()),
        });
    }

    return chunks;
}

export interface ScoredChunk {
    chunk: RAGChunk;
    score: number;
}

/**
 * Smart BM25 & TF-IDF hybrid retrieval engine:
 * Evaluates semantic term frequency, query term density, exact phrase matches, and document tags.
 */
export function retrieveRelevantChunks(
    query: string,
    chunks: RAGChunk[],
    documents: KnowledgeDocument[],
    topK = 4,
    minScore = 0.15
): ScoredChunk[] {
    if (!query.trim() || chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const lowerQuery = query.toLowerCase();
    const docMap = new Map(documents.map((d) => [d.id, d]));

    // Calculate Document Frequency (DF) for each query token across all chunks
    const df: Record<string, number> = {};
    for (const token of queryTokens) {
        df[token] = 0;
        for (const chunk of chunks) {
            if (chunk.keywords.includes(token)) {
                df[token]++;
            }
        }
    }

    const totalChunks = chunks.length;
    const scoredChunks: ScoredChunk[] = [];

    // Standard BM25 parameters
    const k1 = 1.5;
    const b = 0.75;
    const avgLen = chunks.reduce((acc, c) => acc + c.keywords.length, 0) / (totalChunks || 1);

    for (const chunk of chunks) {
        const chunkLen = chunk.keywords.length;
        let score = 0;

        // BM25 scoring for query tokens
        for (const token of queryTokens) {
            const countInChunk = chunk.keywords.filter((k) => k === token).length;
            if (countInChunk > 0) {
                const docFreq = df[token] || 1;
                // IDF formulation
                const idf = Math.log(1 + (totalChunks - docFreq + 0.5) / (docFreq + 0.5));
                // Term frequency saturation
                const tf = (countInChunk * (k1 + 1)) / (countInChunk + k1 * (1 - b + b * (chunkLen / (avgLen || 1))));
                score += idf * tf;
            }
        }

        // Exact phrase bonus
        const lowerChunk = chunk.text.toLowerCase();
        if (lowerChunk.includes(lowerQuery)) {
            score += 3.5;
        }

        // Document tag and title bonus
        const parentDoc = docMap.get(chunk.docId);
        if (parentDoc) {
            for (const tag of parentDoc.tags || []) {
                if (queryTokens.includes(tag.toLowerCase())) {
                    score += 1.5;
                }
            }
            if (lowerQuery.includes(parentDoc.title.toLowerCase()) || parentDoc.title.toLowerCase().includes(lowerQuery)) {
                score += 2.0;
            }
        }

        if (score >= minScore) {
            scoredChunks.push({ chunk, score });
        }
    }

    // Sort descending by score and pick top K
    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
}

/**
 * Retrieve chunks using the current stored knowledge base
 */
export async function searchKnowledgeBase(query: string): Promise<ScoredChunk[]> {
    const data = await getAIGatewayData();
    const activeDocs = data.documents.filter((d) => d.isActive);
    const allChunks: RAGChunk[] = [];

    for (const doc of activeDocs) {
        const docChunks = chunkDocument(doc, data.ragConfig.chunkSize, data.ragConfig.chunkOverlap);
        allChunks.push(...docChunks);
    }

    return retrieveRelevantChunks(
        query,
        allChunks,
        activeDocs,
        data.ragConfig.topK,
        data.ragConfig.minScore
    );
}

/**
 * Construct RAG context block from retrieved chunks
 */
export function buildRAGContextBlock(scoredChunks: ScoredChunk[]): string {
    if (scoredChunks.length === 0) return "";

    const contextParts = scoredChunks.map((sc, i) => {
        return `[Source ${i + 1}: ${sc.chunk.docTitle} - Section ${sc.chunk.chunkIndex + 1}]\n${sc.chunk.text}`;
    });

    return [
        "--- START KNOWLEDGE BASE CONTEXT ---",
        contextParts.join("\n\n"),
        "--- END KNOWLEDGE BASE CONTEXT ---",
        "",
        "Instructions: Use the above KNOWLEDGE BASE CONTEXT to answer the question accurately. If the context does not contain the answer, say you don't know politely and offer human assistance.",
    ].join("\n");
}
