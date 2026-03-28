window.ContentList = function ContentList({ items, loading, onDelete }) {
  if (loading) {
    return <div className="panel">Loading content...</div>;
  }

  if (!items.length) {
    return <div className="panel">No content found for the current filters.</div>;
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {items.map((item) => (
        <window.ContentCard key={item._id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
};
