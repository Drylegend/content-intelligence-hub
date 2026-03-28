window.ContentCard = function ContentCard({ item, onDelete }) {
  const sourceLabel = item.sourceType === "url" ? item.sourceUrl : item.fileName;

  function openSummary() {
    window.CIH.storeContentId(item._id);
    window.location.href = "/html/summary.html";
  }

  function openAudio() {
    window.CIH.storeContentId(item._id);
    window.sessionStorage.setItem("audioMode", item.audioMode || "summary");
    window.location.href = "/html/audio.html";
  }

  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h3>{item.title || sourceLabel || "Untitled content"}</h3>
          <p className="mono" style={{ marginTop: "0.45rem" }}>{sourceLabel || "No source label available"}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <span className={`badge ${item.sourceType === "url" ? "url" : "file"}`}>{item.sourceType.toUpperCase()}</span>
          <span className={`badge ${item.summary ? "good" : "warn"}`}>{item.summary ? "Summary" : "No Summary"}</span>
          <span className={`badge ${item.audioUrl ? "good" : "warn"}`}>{item.audioUrl ? "Audio" : "No Audio"}</span>
        </div>
      </div>

      <div className="meta-strip" style={{ paddingLeft: 0, paddingRight: 0, marginTop: "0.8rem" }}>
        <span className="meta-pill"><strong>Words:</strong> {Number(item.wordCount || 0).toLocaleString()}</span>
        <span className="meta-pill"><strong>Date:</strong> {window.CIH.formatDate(item.createdAt)}</span>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <button className="btn btn-primary" type="button" onClick={openSummary}>Open Summary</button>
        <button className="btn btn-outline" type="button" onClick={openAudio}>Open Audio</button>
        <button className="btn btn-danger" type="button" onClick={() => onDelete(item._id)}>Delete</button>
      </div>
    </article>
  );
};
