import React, { useState, useEffect } from 'react';
import { KnowledgeEntry } from '@agcs/shared';
import { api } from '../../utils/api';

export function KnowledgePanel() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ entry: KnowledgeEntry; score: number }> | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getKnowledge()
      .then((data) => setEntries(data as KnowledgeEntry[]))
      .catch(() => {/* ignore */});
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsAdding(true);
    setError(null);
    try {
      const entry = await api.addKnowledge({
        type: 'document',
        title: newTitle,
        content: newContent,
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      }) as KnowledgeEntry;
      setEntries((prev) => [entry, ...prev]);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const results = await api.searchKnowledge(searchQuery) as Array<{ entry: KnowledgeEntry; score: number }>;
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteKnowledge(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (searchResults) {
        setSearchResults((prev) => prev?.filter((r) => r.entry.id !== id) ?? null);
      }
    } catch {/* ignore */}
  };

  const displayedEntries = searchResults
    ? searchResults.map((r) => r.entry)
    : entries;

  return (
    <div data-testid="knowledge-panel">
      <h2 style={{ color: '#f8fafc', fontSize: 18, marginBottom: 16 }}>Knowledge Base</h2>

      {/* Add entry form */}
      <form
        onSubmit={handleAdd}
        style={{
          background: '#1e293b',
          borderRadius: 8,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <h4 style={{ color: '#cbd5e1', margin: '0 0 10px', fontSize: 14 }}>
          Add Knowledge Entry
        </h4>
        {error && (
          <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>
        )}
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Title..."
          style={inputStyle}
        />
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Content..."
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <input
          type="text"
          value={newTags}
          onChange={(e) => setNewTags(e.target.value)}
          placeholder="Tags (comma-separated)..."
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={isAdding || !newTitle.trim() || !newContent.trim()}
          style={buttonStyle(isAdding || !newTitle.trim() || !newContent.trim())}
        >
          {isAdding ? 'Adding...' : 'Add Entry'}
        </button>
      </form>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Semantic search..."
          style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
        />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          style={buttonStyle(isSearching || !searchQuery.trim())}
        >
          {isSearching ? '...' : '🔍'}
        </button>
        {searchResults && (
          <button
            type="button"
            onClick={() => setSearchResults(null)}
            style={{
              background: '#334155',
              border: 'none',
              color: '#94a3b8',
              borderRadius: 4,
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✕
          </button>
        )}
      </form>

      {/* Entries list */}
      <div>
        {searchResults && (
          <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
        )}
        {displayedEntries.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>
            {searchResults ? 'No results found.' : 'No knowledge entries yet. Add one above.'}
          </p>
        ) : (
          displayedEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 14 }}>
                    {entry.title}
                  </div>
                  <div
                    style={{
                      color: '#94a3b8',
                      fontSize: 12,
                      marginTop: 2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {entry.content}
                  </div>
                  {entry.tags.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            background: '#0f172a',
                            color: '#6366f1',
                            borderRadius: 4,
                            padding: '1px 6px',
                            fontSize: 11,
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#64748b',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: '#0f172a',
  border: '1px solid #334155',
  color: '#e2e8f0',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 13,
  marginBottom: 8,
  boxSizing: 'border-box',
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: '#6366f1',
    border: 'none',
    color: 'white',
    borderRadius: 4,
    padding: '6px 14px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
  };
}
