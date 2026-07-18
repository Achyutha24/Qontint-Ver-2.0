/**
 * Centralized Graph Cache Manager
 * 
 * Handles cross-page synchronization, cache invalidation, snapshot versioning,
 * and graph refresh notifications.
 * 
 * AnalyzePage, KeywordsPage, etc. should call GraphCacheManager.invalidate(vertical)
 * to notify the GraphPage to refetch data.
 */

type GraphUpdateListener = (vertical: string) => void;

class GraphCacheManager {
  private listeners: Set<GraphUpdateListener> = new Set();
  private versions: Map<string, number> = new Map();

  /**
   * Subscribe to graph update events
   */
  subscribe(listener: GraphUpdateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the current cache version for a vertical
   */
  getVersion(vertical: string): number {
    return this.versions.get(vertical) || 0;
  }

  /**
   * Invalidate the cache for a specific vertical and notify subscribers
   */
  async invalidate(vertical: string): Promise<void> {
    const nextVersion = (this.versions.get(vertical) || 0) + 1;
    this.versions.set(vertical, nextVersion);
    
    try {
        // Also call backend to clear its memory cache
        await fetch(`/api/v1/graph/invalidate/${vertical}`, { method: 'POST' });
    } catch (e) {
        console.warn("Failed to invalidate backend graph cache", e);
    }
    
    // Notify all subscribers (e.g. GraphPage)
    this.listeners.forEach(listener => listener(vertical));
  }
}

export const graphCacheManager = new GraphCacheManager();
