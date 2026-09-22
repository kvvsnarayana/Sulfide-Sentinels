/**
 * CSV Exporter for SULFIDE SENTINELS Worker Safety Audit Logs
 */

export function exportHistoryToCSV(logs) {
  if (!logs || logs.length === 0) {
    alert("No scan logs available to export.");
    return;
  }

  const headers = [
    "Worker ID",
    "Shift",
    "Scan Stage",
    "Timestamp",
    "Detector HEX",
    "Detector %",
    "H₂S ppm",
    "Reference Match",
    "Expiry HEX",
    "Expiry Status",
    "Expiry Confidence %",
    "Analysis Confidence %",
    "Exposure Duration (Hours)",
    "Net H₂S ppm",
    "Dose ppm·h",
    "Final Status",
    "Notes"
  ];

  const rows = logs.map(log => [
    `"${log.workerId || ''}"`,
    `"${log.shift || ''}"`,
    `"${log.scanStage || ''}"`,
    `"${log.dateFormatted || log.timestamp || ''}"`,
    `"${log.detectorHex || ''}"`,
    log.detectorPercentage !== null && log.detectorPercentage !== undefined ? `${log.detectorPercentage}%` : 'N/A',
    log.detectorPpm !== null && log.detectorPpm !== undefined ? log.detectorPpm : 'N/A',
    `"${log.referenceMatch || 'N/A'}"`,
    `"${log.expiryHex || ''}"`,
    `"${log.expiryStatus || ''}"`,
    log.expiryConfidence !== null && log.expiryConfidence !== undefined ? `${log.expiryConfidence}%` : 'N/A',
    log.analysisConfidence !== null && log.analysisConfidence !== undefined ? `${log.analysisConfidence}%` : 'N/A',
    log.exposureDurationHours !== null && log.exposureDurationHours !== undefined ? log.exposureDurationHours : 'N/A',
    log.netPpm !== null && log.netPpm !== undefined ? log.netPpm : 'N/A',
    log.dosePpmH !== null && log.dosePpmH !== undefined ? log.dosePpmH : 'N/A',
    `"${log.finalStatus || ''}"`,
    `"${(log.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Sulfide_Sentinels_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
