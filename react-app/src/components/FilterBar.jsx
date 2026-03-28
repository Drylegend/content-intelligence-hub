window.FilterBar = function FilterBar({ filters, onChange }) {
  return (
    <div className="panel">
      <div className="grid-3">
        <div className="field">
          <label htmlFor="reactSearch">Search</label>
          <input
            id="reactSearch"
            type="text"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Search title, filename, or URL"
          />
        </div>
        <div className="field">
          <label htmlFor="reactType">Source Type</label>
          <select
            id="reactType"
            value={filters.type}
            onChange={(event) => onChange({ ...filters, type: event.target.value })}
          >
            <option value="all">All</option>
            <option value="url">URL</option>
            <option value="file">File</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "end" }}>
          <button className="btn btn-outline" type="button" onClick={() => onChange({ query: "", type: "all" })}>
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
};
