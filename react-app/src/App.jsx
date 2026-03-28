const { useEffect, useMemo, useState } = React;

function App() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalScrapes: 0,
    totalSummaries: 0,
    totalAudioItems: 0,
    storageUsedBytes: 0
  });
  const [filters, setFilters] = useState({
    query: "",
    type: "all"
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!window.CIH.requireAuth()) {
      return;
    }

    async function loadData() {
      try {
        window.CIH.showLoader("Loading advanced dashboard");
        const [statsPayload, listPayload] = await Promise.all([
          window.CIH.apiFetch("/api/content/stats"),
          window.CIH.apiFetch("/api/content?limit=50")
        ]);
        setStats(statsPayload);
        setItems(listPayload.items || []);
      } catch (error) {
        window.CIH.showToast(error.message);
      } finally {
        setLoading(false);
        window.CIH.hideLoader();
      }
    }

    loadData();
  }, []);

  async function handleDelete(contentId) {
    try {
      await window.CIH.apiFetch(`/api/content/${contentId}`, {
        method: "DELETE"
      });
      setItems((currentItems) => currentItems.filter((item) => item._id !== contentId));
      window.CIH.showToast("Content deleted.");
    } catch (error) {
      window.CIH.showToast(error.message);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const queryMatch =
        !filters.query ||
        [item.title, item.fileName, item.sourceUrl]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(filters.query.toLowerCase()));

      const typeMatch = filters.type === "all" || item.sourceType === filters.type;
      return queryMatch && typeMatch;
    });
  }, [items, filters]);

  return (
    <div className="container" style={{ display: "grid", gap: "1.5rem" }}>
      <div className="section-head">
        <span className="eyebrow">Advanced Dashboard</span>
        <h1>React-powered saved content control center</h1>
        <p>Filter content, inspect activity, and jump back into summary or audio generation with a more dynamic interface.</p>
      </div>

      <window.StatsWidget stats={stats} />
      <window.FilterBar filters={filters} onChange={setFilters} />
      <window.ContentList
        items={filteredItems}
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
