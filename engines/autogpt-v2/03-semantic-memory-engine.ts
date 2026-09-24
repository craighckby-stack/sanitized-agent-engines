/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Semantic Memory Engine
 * Isolated clean-room architectural engine
 * Extracted by Engine Harvester
 */

// --- Types and Interfaces ---

/** Represents a single memory entry. */
export interface MemoryEntry {
  text: string;
  embedding: number[]; // Vector representation of the text
}

/** Interface for an embedding model that converts text to a vector. */
export interface IEmbeddingModel {
  /**
   * Generates a numerical vector embedding for a given text.
   * @param text The text to embed.
   * @returns A promise that resolves to an array of numbers representing the embedding.
   */
  embed(text: string): Promise<number[]>;
}

/** Interface for the Memory Engine. */
export interface IMemoryEngine {
  /**
   * Adds a new memory entry to the store.
   * @param text The text to remember.
   * @returns A promise that resolves when the memory has been added.
   */
  addMemory(text: string): Promise<void>;

  /**
   * Retrieves a list of memories semantically similar to the query.
   * @param query The text to search for relevant memories.
   * @param limit The maximum number of relevant memories to return.
   * @returns A promise that resolves to an array of relevant memory strings.
   */
  getRelevantMemories(query: string, limit: number): Promise<string[]>;
}

// --- Mock Embedding Model Implementation ---
// In a real system, this would interact with an actual embedding API (e.g., OpenAI, Cohere).
class MockEmbeddingModel implements IEmbeddingModel {
  /**
   * Generates a simple, deterministic mock embedding for demonstration.
   * In a real scenario, this would be a high-dimensional vector from an AI model.
   * This mock uses ASCII values for a very basic "embedding".
   */
  async embed(text: string): Promise<number[]> {
    console.log(`[MockEmbeddingModel] Embedding text: ${text.substring(0, 50)}...`);
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 50));

    // A very basic, non-semantic mock embedding for demonstration
    // In a real system, this would be a complex process by an ML model.
    return text.split('').map(char => char.charCodeAt(0) / 100); // Normalize to smaller numbers
  }
}

// --- Utility: Cosine Similarity ---
/**
 * Calculates the cosine similarity between two vectors.
 * A value closer to 1 indicates higher similarity.
 * @param vec1 The first vector.
 * @param vec2 The second vector.
 * @returns The cosine similarity.
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must be of the same length to calculate cosine similarity.');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (magnitude1 * magnitude2);
}

export class SemanticMemoryEngine implements IMemoryEngine {
  private memories: MemoryEntry[] = [];
  private embeddingModel: IEmbeddingModel;

  constructor(embeddingModel: IEmbeddingModel) {
    this.embeddingModel = embeddingModel;
    console.log("[SemanticMemoryEngine] Initialized.");
  }

  /**
   * Adds a new memory entry to the store by embedding the text.
   * @param text The text to remember.
   */
  public async addMemory(text: string): Promise<void> {
    const embedding = await this.embeddingModel.embed(text);
    this.memories.push({ text, embedding });
    console.log(`[SemanticMemoryEngine] Added memory: "${text.substring(0, 50)}..."`);
  }

  /**
   * Retrieves a list of memories semantically similar to the query.
   * Uses cosine similarity on the embeddings to find the most relevant memories.
   * @param query The text to search for relevant memories.
   * @param limit The maximum number of relevant memories to return.
   * @returns An array of relevant memory strings, sorted by similarity.
   */
  public async getRelevantMemories(query: string, limit: number = 5): Promise<string[]> {
    if (this.memories.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddingModel.embed(query);

    const scoredMemories = this.memories
      .map(memory => ({
        memory,
        similarity: cosineSimilarity(queryEmbedding, memory.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity); // Sort in descending order of similarity

    console.log(`[SemanticMemoryEngine] Retrieved ${Math.min(limit, scoredMemories.length)} relevant memories for query: "${query.substring(0, 50)}..."`);

    return scoredMemories
      .slice(0, limit)
      .filter(entry => entry.similarity > 0.01) // Filter out very low similarity (tuneable threshold)
      .map(entry => entry.memory.text);
  }

  /**
   * Clears all memories from the engine.
   */
  public clearMemories(): void {
    this.memories = [];
    console.log("[SemanticMemoryEngine] All memories cleared.");
  }
}

// Example Usage
/*
(async () => {
  const embeddingModel = new MockEmbeddingModel();
  const memoryEngine = new SemanticMemoryEngine(embeddingModel);

  console.log('\n--- Adding Memories ---');
  await memoryEngine.addMemory("The capital of France is Paris.");
  await memoryEngine.addMemory("Eiffel Tower is a famous landmark in Paris.");
  await memoryEngine.addMemory("TypeScript is a superset of JavaScript.");
  await memoryEngine.addMemory("Learning new programming languages is challenging but rewarding.");
  await memoryEngine.addMemory("I need to write a new report for the project.");
  await memoryEngine.addMemory("The project requires a lot of documentation.");

  console.log('\n--- Retrieving Relevant Memories ---');

  let relevantToParis = await memoryEngine.getRelevantMemories("What do I know about Paris?", 2);
  console.log("Memories about Paris:", relevantToParis);
  // Expected: ["Eiffel Tower is a famous landmark in Paris.", "The capital of France is Paris."] (order depends on mock embedding and similarity)

  let relevantToTypescript = await memoryEngine.getRelevantMemories("Tell me about TypeScript development.", 3);
  console.log("Memories about TypeScript:", relevantToTypescript);
  // Expected: ["TypeScript is a superset of JavaScript.", "Learning new programming languages is challenging but rewarding."]

  let relevantToProject = await memoryEngine.getRelevantMemories("What's up with the project tasks?", 2);
  console.log("Memories about Project:", relevantToProject);
  // Expected: ["I need to write a new report for the project.", "The project requires a lot of documentation."]

  let noMatch = await memoryEngine.getRelevantMemories("Who invented the telephone?", 1);
  console.log("Memories with no strong match:", noMatch);
  // Expected: [] or very low similarity entries

  console.log('\n--- Clearing Memories ---');
  memoryEngine.clearMemories();
  let afterClear = await memoryEngine.getRelevantMemories("Anything?", 1);
  console.log("Memories after clear:", afterClear);
  // Expected: []
})();
*/
