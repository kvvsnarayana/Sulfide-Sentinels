import React, { useState } from 'react';
import { Download, Trash2, Search, Filter, ShieldCheck, AlertTriangle, ShieldAlert, PlayCircle, StopCircle, Eye, X } from 'lucide-react';
import { exportHistoryToCSV } from '../utils/exportCsv';

export default function Phase5History({ logs, onClearHistory }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.workerId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.shift?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || log.finalStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalScans = logs.length;
  const criticalCount = logs.filter(l => l.finalStatus === 'CRITICAL' || l.finalStatus === 'INVALID STRIP').length;
  const warningCount = logs.filter(l => l.finalStatus === 'WARNING').length;
  const safeCount = logs.filter(l => l.finalStatus === 'SAFE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-400 px-3 py-0.5 rounded-full text-xs font-semibold border border-amber-500/20">
            <span>WORKER AUDIT TRAIL</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Pre & Post Shift Exposure Logs</h2>
          <p className="text-xs text-slate-400">
            Tracks baseline measurements (T_pre) and calculates net time-integrated exposure dose (ppm·h).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear your local display cache? Cloud database records will remain safely preserved.")) {
                  onClearHistory();
                }
              }}
              title="Clears local UI display cache. Cloud database records remain safe."
              className="bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 hover:border-amber-500/40 transition-all flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Local Cache</span>
            </button>
          )}

          <button
            onClick={() => exportHistoryToCSV(logs)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs shadow-lg shadow-amber-500/20 flex items-center space-x-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT CSV REPORT</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Scans Logged</span>
          <div className="text-2xl font-black text-white mt-1">{totalScans}</div>
        </div>

        <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Safe Shifts
          </span>
          <div className="text-2xl font-black text-emerald-300 mt-1">{safeCount}</div>
        </div>

        <div className="bg-amber-950/40 p-4 rounded-xl border border-amber-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Warnings
          </span>
          <div className="text-2xl font-black text-amber-300 mt-1">{warningCount}</div>
        </div>

        <div className="bg-red-950/40 p-4 rounded-xl border border-red-500/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Critical / Invalid
          </span>
          <div className="text-2xl font-black text-red-400 mt-1">{criticalCount}</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Worker ID, Shift, or Notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-medium">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SAFE">SAFE</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="INVALID STRIP">INVALID STRIP</option>
          </select>
        </div>
      </div>

      {/* RESPONSIVE MOBILE CARDS VIEW & DESKTOP TABLE */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Stage</th>
                <th className="p-3.5">Worker ID</th>
                <th className="p-3.5">H₂S Conc. (ppm)</th>
                <th className="p-3.5 text-right">Dose (ppm·h)</th>
                <th className="p-3.5">Expiry Status</th>
                <th className="p-3.5">Final Status</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-500">
                    No scan records match your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">{log.dateFormatted || log.timestamp}</td>
                    <td className="p-3.5">
                      {log.scanStage === 'PRE_SHIFT' ? (
                        <span className="inline-flex items-center space-x-1 text-blue-400 font-bold text-[10px] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                          <PlayCircle className="w-3 h-3" />
                          <span>PRE-SHIFT</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-amber-400 font-bold text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          <StopCircle className="w-3 h-3" />
                          <span>POST-SHIFT</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-white">{log.workerId}</td>
                    <td className="p-3.5 font-mono text-slate-300">{log.detectorPpm} ppm ({log.detectorPercentage}%)</td>
                    <td className="p-3.5 text-right font-black text-amber-400 font-mono text-sm">
                      {log.scanStage === 'PRE_SHIFT' ? 'Baseline' : `${log.dosePpmH !== null && log.dosePpmH !== undefined ? log.dosePpmH : '0.00'} ppm·h`}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.expiryStatus === 'INVALID' ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}>
                        {log.expiryStatus} ({log.expiryConfidence}%)
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border bg-slate-950 text-amber-400 border-slate-800">
                        {log.finalStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setSelectedRecord(log)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-700 transition-all inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>[ View Details ]</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards (Section 28) */}
        <div className="md:hidden divide-y divide-slate-800">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No scan records found.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{log.workerId}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{log.shift?.split(' ')[0]}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase border bg-slate-950 text-amber-400 border-slate-800">
                    {log.finalStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Stage & Time</span>
                    <div className="text-slate-300 text-[11px] font-mono mt-0.5">{log.scanStage} • {log.dateFormatted}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Dose Result</span>
                    <div className="text-amber-400 font-mono font-black text-sm mt-0.5">
                      {log.scanStage === 'PRE_SHIFT' ? `${log.detectorPpm} ppm` : `${log.dosePpmH || 0} ppm·h`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[10px] font-bold ${log.expiryStatus === 'INVALID' ? 'text-red-400' : 'text-emerald-400'}`}>
                    Expiry: {log.expiryStatus} ({log.expiryConfidence}%)
                  </span>
                  <button
                    onClick={() => setSelectedRecord(log)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>[ View Details ]</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DETAIL MODAL DIALOG */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Full Scan Details & Calculations</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div><span className="text-slate-500">Worker ID:</span> <strong className="text-white">{selectedRecord.workerId}</strong></div>
                <div><span className="text-slate-500">Shift:</span> <strong className="text-slate-300">{selectedRecord.shift}</strong></div>
                <div><span className="text-slate-500">Scan Stage:</span> <strong className="text-amber-400">{selectedRecord.scanStage}</strong></div>
                <div><span className="text-slate-500">Timestamp:</span> <strong className="text-slate-300 font-mono text-[11px]">{selectedRecord.dateFormatted}</strong></div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Detector Analysis:</div>
                <div className="flex justify-between"><span>Detected HEX:</span> <strong className="text-amber-400">{selectedRecord.detectorHex}</strong></div>
                <div className="flex justify-between"><span>Response %:</span> <span>{selectedRecord.detectorPercentage}%</span></div>
                <div className="flex justify-between"><span>Concentration (ppm):</span> <span>{selectedRecord.detectorPpm} ppm</span></div>
                <div className="flex justify-between text-slate-400 text-[11px] pt-1"><span>Reference Match:</span> <span className="text-right">{selectedRecord.referenceMatch}</span></div>
              </div>

              {selectedRecord.scanStage === 'POST_SHIFT' && (
                <div className="bg-slate-950 p-3 rounded-xl border border-amber-500/30 space-y-1.5 font-mono text-amber-300">
                  <div className="text-amber-400 font-bold uppercase text-[10px]">Exposure Dose Math:</div>
                  <div className="flex justify-between"><span>Duration:</span> <span>{selectedRecord.exposureDurationHours || 0} hours</span></div>
                  <div className="flex justify-between"><span>Net H₂S Concentration:</span> <span>{selectedRecord.netPpm || 0} ppm</span></div>
                  <div className="flex justify-between font-bold text-white pt-1"><span>Estimated Dose (ppm·h):</span> <span className="text-amber-400">{selectedRecord.dosePpmH || 0} ppm·h</span></div>
                </div>
              )}

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Expiry & Confidence:</div>
                <div className="flex justify-between"><span>Expiry HEX:</span> <span className="font-mono">{selectedRecord.expiryHex}</span></div>
                <div className="flex justify-between"><span>Expiry Status:</span> <span className={selectedRecord.expiryStatus === 'INVALID' ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{selectedRecord.expiryStatus}</span></div>
                <div className="flex justify-between"><span>Expiry Validity Confidence:</span> <span>{selectedRecord.expiryConfidence}%</span></div>
                <div className="flex justify-between"><span>Analysis Confidence:</span> <span>{selectedRecord.analysisConfidence}%</span></div>
              </div>

              {selectedRecord.notes && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-400 italic">
                  Notes: "{selectedRecord.notes}"
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
