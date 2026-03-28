window.StatsWidget = function StatsWidget({ stats }) {
  const cards = [
    { label: "Total Scrapes", value: stats.totalScrapes },
    { label: "Total Summaries", value: stats.totalSummaries },
    { label: "Audio Generated", value: stats.totalAudioItems },
    { label: "Storage Used", value: window.CIH.formatBytes(stats.storageUsedBytes) }
  ];

  return (
    <div className="grid-4">
      {cards.map((card) => (
        <div className="stat-card" key={card.label}>
          <strong>{card.value}</strong>
          <span>{card.label}</span>
        </div>
      ))}
    </div>
  );
};
