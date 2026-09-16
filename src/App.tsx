import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Play, Pause, XCircle, UserCheck,
  Key, MessageSquare, ShieldAlert, Users, LayoutDashboard, Settings, Activity, Plus
} from 'lucide-react';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [stats, setStats] = useState({
    activeTasks: 3,
    waitingTasks: 1,
    completedToday: 5,
    humanAttention: 0,
    keyPoolActiveCount: 2
  });

  const [keys, setKeys] = useState([
    { id: '1', maskedKey: '••••••••••••A91K', status: 'ACTIVE', requestCount: 142, last4: 'A91K' },
    { id: '2', maskedKey: '••••••••••••X92L', status: 'ACTIVE', requestCount: 89, last4: 'X92L' }
  ]);

  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<any>(null);

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n').filter(l => l.trim().length > 0);
    const newAdded = lines.map((line, idx) => ({
      id: String(Date.now() + idx),
      maskedKey: '••••••••••••' + (line.trim().slice(-4) || '9999'),
      status: 'ACTIVE',
      requestCount: 0,
      last4: line.trim().slice(-4) || '9999'
    }));
    setKeys([...keys, ...newAdded]);
    setBulkResult({ submitted: lines.length, added: lines.length, duplicates: 0 });
    setBulkText('');
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xl">
              Z
            </div>
            <span className="text-xl font-bold tracking-wide">ZapTaria</span>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setPage('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button onClick={() => setPage('tasks')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'tasks' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <CheckCircle size={18} /> Autonomous Tasks
            </button>
            <button onClick={() => setPage('conversations')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'conversations' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <MessageSquare size={18} /> Conversations
            </button>
            <button onClick={() => setPage('keys')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'keys' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <Key size={18} /> Gemini Key Pool
            </button>
            <button onClick={() => setPage('activity')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'activity' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <Activity size={18} /> AI Audit Logs
            </button>
          </nav>
        </div>

        {/* Emergency Stop Switch */}
        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-400" /> Emergency Stop
            </span>
            <button
              onClick={() => setEmergencyStop(!emergencyStop)}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${emergencyStop ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${emergencyStop ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Instantly pauses all autonomous message output across active tasks.</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 bg-slate-900">
        {page === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Operational Dashboard</h1>
                <p className="text-sm text-slate-400">Autonomous WhatsApp Task Monitoring & Execution Engine</p>
              </div>
              <button onClick={() => setPage('tasks')} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium text-sm transition">
                <Plus size={16} /> Create Task
              </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Active Tasks</span>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{stats.activeTasks}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Waiting for Contact</span>
                <p className="text-3xl font-bold text-amber-400 mt-2">{stats.waitingTasks}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Completed Today</span>
                <p className="text-3xl font-bold text-blue-400 mt-2">{stats.completedToday}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Human Attention Required</span>
                <p className="text-3xl font-bold text-rose-400 mt-2">{stats.humanAttention}</p>
              </div>
            </div>

            {/* Recent Active Tasks Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4">
              <h2 className="text-lg font-semibold">Active Autonomous Tasks</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2">Title</th>
                      <th className="py-2">Contact</th>
                      <th className="py-2">Autonomy</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Messages</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    <tr>
                      <td className="py-3 font-medium text-slate-100">Bravus ANVISA Docs Request</td>
                      <td className="py-3">Supplier Tech</td>
                      <td className="py-3"><span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">FULL_AUTO</span></td>
                      <td className="py-3"><span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400">WAITING_FOR_CONTACT</span></td>
                      <td className="py-3">3 / 10</td>
                      <td className="py-3 flex gap-2">
                        <button className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Take Over</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {page === 'keys' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Gemini Key Pool Management</h1>
              <p className="text-sm text-slate-400">Encrypted server-side storage, fingerprint duplicate detection, and fair key rotation</p>
            </div>

            {/* Bulk Add Card */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">Bulk Key Input / Upload</h2>
              <form onSubmit={handleBulkSubmit} className="space-y-3">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Paste multiple Gemini API keys (one key per line)..."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm font-medium transition">
                  Import Keys into Secure Pool
                </button>
              </form>

              {bulkResult && (
                <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex gap-4">
                  <span>Submitted: {bulkResult.submitted}</span>
                  <span>Added: {bulkResult.added}</span>
                  <span>Duplicates Rejected: {bulkResult.duplicates}</span>
                </div>
              )}
            </div>

            {/* Active Keys Table */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">Pool Key Status (Masked)</h2>
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <Key size={18} className="text-emerald-400" />
                      <div>
                        <p className="font-mono text-sm font-semibold">{k.maskedKey}</p>
                        <p className="text-xs text-slate-500">Requests handled: {k.requestCount}</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                      {k.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === 'tasks' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Autonomous Task Engine</h1>
              <p className="text-sm text-slate-400">Create, monitor, and configure objective-driven tasks</p>
            </div>
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
              <h2 className="text-lg font-semibold mb-3">Create New Task</h2>
              <div className="space-y-3 max-w-xl">
                <input placeholder="Task Title (e.g. Request ANVISA Docs)" className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded text-sm" />
                <textarea placeholder="Natural Language Objective (e.g. Ask supplier if they have the ANVISA documents for Bravus. If yes, request them to send...)" rows={3} className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded text-sm" />
                <button className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-medium text-sm">Activate Task</button>
              </div>
            </div>
          </div>
        )}

        {page === 'conversations' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Live Conversation Monitor</h1>
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 h-96 flex flex-col justify-between">
              <div className="space-y-3 overflow-y-auto">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-sm max-w-md">
                  <span className="text-xs text-emerald-400 font-semibold block mb-1">AI Assistant</span>
                  Hello! Could you please confirm if you have the ANVISA documents for the Bravus product?
                </div>
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm max-w-md ml-auto">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Supplier Tech</span>
                  Yes, we have them ready. Let me fetch and send them over.
                </div>
              </div>
            </div>
          </div>
        )}

        {page === 'activity' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">AI Audit Trail</h1>
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-xs flex justify-between">
                <span>AI decided: WAITING_FOR_CONTACT</span>
                <span className="text-slate-500">Contact stated they will send documents shortly</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
