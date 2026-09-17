import React, { useState, useEffect } from 'react';
import {
  CheckCircle, Clock, AlertTriangle, Play, Pause, XCircle, UserCheck,
  Key, MessageSquare, ShieldAlert, Users, LayoutDashboard, Settings, Activity, Plus,
  QrCode, RefreshCw, Upload, LogOut, Lock, Mail
} from 'lucide-react';
import { api, setAuthToken, removeAuthToken } from './services/api.js';
import { io } from 'socket.io-client';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('zaptaria_jwt_token'));
  });
  const [loginEmail, setLoginEmail] = useState('admin@zaptaria.com');
  const [loginPassword, setLoginPassword] = useState('admin123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await api.login({ email: loginEmail, password: loginPassword });
      setAuthToken(res.token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setLoginError(err?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-slate-100 font-sans p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-2xl">
              Z
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-2">ZapTaria Assistant</h1>
            <p className="text-xs text-slate-400">Autonomous WhatsApp Task Monitoring Engine</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Mail size={14} className="text-slate-500" /> Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                placeholder="admin@zaptaria.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-500" /> Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 text-slate-100"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? <RefreshCw className="animate-spin" size={16} /> : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AuthenticatedApp onLogout={handleLogout} />;
}

function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [page, setPage] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [waStatus, setWaStatus] = useState<any>(null);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);

  // Task creation form state
  const [taskContactId, setTaskContactId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskObjective, setTaskObjective] = useState('');
  const [taskAutonomy, setTaskAutonomy] = useState('FULL_AUTO');
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskCreating, setTaskCreating] = useState(false);

  // Gemini keys input state
  const [singleKey, setSingleKey] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [keyResult, setKeyResult] = useState<any>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const data = await api.getDashboard();
      setStats(data);
      setEmergencyStop(data.globalEmergencyStop);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const data = await api.getWhatsAppStatus();
      setWaStatus(data);
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardData(),
      fetchWhatsAppStatus(),
      api.getTasks().then(setTasks).catch(() => {}),
      api.getContacts().then(setContacts).catch(() => {}),
      api.getConversations().then(setConversations).catch(() => {}),
      api.getGeminiKeys().then(setKeys).catch(() => {}),
      api.getActivityLogs().then(setActivityLogs).catch(() => {})
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('task:created', () => { fetchDashboardData(); api.getTasks().then(setTasks); });
    socket.on('task:updated', () => { fetchDashboardData(); api.getTasks().then(setTasks); });
    socket.on('message:new', (msg) => {
      fetchDashboardData();
      if (selectedConvId && msg.conversationId === selectedConvId) {
        api.getConversationMessages(selectedConvId).then(setMessages);
      }
    });
    socket.on('activity:logged', () => { api.getActivityLogs().then(setActivityLogs); });
    socket.on('whatsapp:status', (data) => {
      setWaStatus(data);
      fetchDashboardData();
    });
    socket.on('settings:emergency_stop', (data) => {
      setEmergencyStop(data.enabled);
      fetchDashboardData();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      api.getConversationMessages(selectedConvId).then(setMessages).catch(() => setMessages([]));
    }
  }, [selectedConvId]);

  const toggleEmergencyStop = async () => {
    const nextState = !emergencyStop;
    setEmergencyStop(nextState);
    try {
      await api.setEmergencyStop(nextState);
      await fetchDashboardData();
    } catch (err) {
      setEmergencyStop(!nextState);
      console.error('Emergency stop toggle failed:', err);
    }
  };

  const handleConnectWhatsApp = async () => {
    try {
      await api.connectWhatsApp();
      await fetchWhatsAppStatus();
    } catch (err) {
      console.error('Failed to trigger WhatsApp connect:', err);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      await api.disconnectWhatsApp();
      await fetchWhatsAppStatus();
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskError(null);
    if (!taskContactId) {
      setTaskError('Please select a contact');
      return;
    }
    setTaskCreating(true);
    try {
      await api.createTask({
        contactId: taskContactId,
        title: taskTitle || 'Autonomous Request Task',
        objective: taskObjective,
        autonomyLevel: taskAutonomy
      });
      setTaskTitle('');
      setTaskObjective('');
      await fetchDashboardData();
      const updatedTasks = await api.getTasks();
      setTasks(updatedTasks);
      setPage('tasks');
    } catch (err: any) {
      setTaskError(err?.message || 'Failed to create task');
    } finally {
      setTaskCreating(false);
    }
  };

  const handleTakeover = async (taskId: string) => {
    try {
      await api.takeoverTask(taskId);
      await fetchDashboardData();
      const updatedTasks = await api.getTasks();
      setTasks(updatedTasks);
    } catch (err) {
      console.error('Takeover failed:', err);
    }
  };

  const handleAddSingleKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleKey.trim()) return;
    setKeyError(null);
    try {
      await api.addGeminiKey(singleKey);
      setSingleKey('');
      const updated = await api.getGeminiKeys();
      setKeys(updated);
      await fetchDashboardData();
    } catch (err: any) {
      setKeyError(err?.message || 'Failed to add key');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    setKeyError(null);
    try {
      const res = await api.addBulkGeminiKeys(bulkText);
      setKeyResult(res);
      setBulkText('');
      const updated = await api.getGeminiKeys();
      setKeys(updated);
      await fetchDashboardData();
    } catch (err: any) {
      setKeyError(err?.message || 'Failed to import bulk keys');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setKeyError(null);
    try {
      const res = await api.uploadGeminiKeysFile(file);
      setKeyResult(res);
      const updated = await api.getGeminiKeys();
      setKeys(updated);
      await fetchDashboardData();
    } catch (err: any) {
      setKeyError(err?.message || 'Failed to upload keys file');
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950 text-xl">
                Z
              </div>
              <span className="text-xl font-bold tracking-wide">ZapTaria</span>
            </div>
            <button onClick={onLogout} title="Logout" className="text-slate-500 hover:text-rose-400 p-1 transition">
              <LogOut size={16} />
            </button>
          </div>

          <nav className="space-y-1">
            <button onClick={() => setPage('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'dashboard' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button onClick={() => setPage('whatsapp')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${page === 'whatsapp' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
              <QrCode size={18} /> WhatsApp Connection
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
              onClick={toggleEmergencyStop}
              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${emergencyStop ? 'bg-rose-600' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${emergencyStop ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Instantly stops all autonomous outbound messages.</p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 bg-slate-900">
        {page === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">Operational Dashboard</h1>
                <p className="text-sm text-slate-400">Autonomous WhatsApp Task Monitoring Engine</p>
              </div>
              <button onClick={() => setPage('tasks')} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium text-sm transition text-slate-950 font-semibold">
                <Plus size={16} /> Create Task
              </button>
            </div>

            {/* Real Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Active Tasks</span>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{stats ? stats.activeTasks : '-'}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Waiting Tasks</span>
                <p className="text-3xl font-bold text-amber-400 mt-2">{stats ? stats.waitingTasks : '-'}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Completed Today</span>
                <p className="text-3xl font-bold text-blue-400 mt-2">{stats ? stats.completedToday : '-'}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-400">Human Attention</span>
                <p className="text-3xl font-bold text-rose-400 mt-2">{stats ? stats.humanAttention : '-'}</p>
              </div>
            </div>

            {/* Active Tasks Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4">
              <h2 className="text-lg font-semibold">Real Active Tasks</h2>
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No active autonomous tasks found.</p>
              ) : (
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
                      {tasks.map(t => (
                        <tr key={t.id}>
                          <td className="py-3 font-medium text-slate-100">{t.title}</td>
                          <td className="py-3">{t.contact?.name || t.contact?.phoneNumber}</td>
                          <td className="py-3"><span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">{t.autonomyLevel}</span></td>
                          <td className="py-3"><span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400">{t.status}</span></td>
                          <td className="py-3">{t.messageCount} / {t.maxMessages}</td>
                          <td className="py-3">
                            <button onClick={() => handleTakeover(t.id)} className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">Take Over</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'whatsapp' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Session Control</h1>
              <p className="text-sm text-slate-400">Manage WPPConnect session and view pairing QR code</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-6 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Status</span>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{waStatus?.status || 'UNKNOWN'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleConnectWhatsApp} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-sm transition">
                    Connect
                  </button>
                  <button onClick={handleDisconnectWhatsApp} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition">
                    Disconnect
                  </button>
                </div>
              </div>

              {waStatus?.qrCode ? (
                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl">
                  <img src={waStatus.qrCode.startsWith('data:') ? waStatus.qrCode : `data:image/png;base64,${waStatus.qrCode}`} alt="WhatsApp QR Code" className="w-64 h-64" />
                  <p className="text-xs text-slate-700 font-medium mt-4">Scan this QR code with WhatsApp on your phone</p>
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-sm">
                  {waStatus?.status === 'CONNECTED' ? 'WhatsApp session is CONNECTED and ready.' : 'No QR code active. Click Connect to initiate pairing.'}
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'tasks' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Autonomous Task Engine</h1>
              <p className="text-sm text-slate-400">Create, monitor, and configure objective-driven tasks</p>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 max-w-xl">
              <h2 className="text-lg font-semibold">Create New Task</h2>
              {taskError && <div className="p-3 rounded bg-rose-500/10 text-xs text-rose-400 border border-rose-500/20">{taskError}</div>}
              <form onSubmit={handleCreateTask} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Select Contact</label>
                  <select
                    value={taskContactId}
                    onChange={e => setTaskContactId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-sm"
                  >
                    <option value="">-- Choose Contact --</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.phoneNumber}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Task Title</label>
                  <input
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="Task Title (e.g. Request ANVISA Documents)"
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Natural Language Objective</label>
                  <textarea
                    value={taskObjective}
                    onChange={e => setTaskObjective(e.target.value)}
                    required
                    placeholder="Objective details..."
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-800 p-2.5 rounded text-sm"
                  />
                </div>
                <button type="submit" disabled={taskCreating} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold px-4 py-2 rounded text-sm transition">
                  {taskCreating ? 'Activating...' : 'Activate Task'}
                </button>
              </form>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">All Tasks</h2>
              <div className="space-y-2">
                {tasks.map(t => (
                  <div key={t.id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-sm">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.objective}</p>
                      <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded mt-2 inline-block">{t.status}</span>
                    </div>
                    <button onClick={() => handleTakeover(t.id)} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700">
                      Take Over
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === 'conversations' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Live Conversation Monitor</h1>
            <div className="grid grid-cols-3 gap-6 h-[500px]">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-y-auto space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase mb-3">Chats</h2>
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`w-full text-left p-3 rounded-lg text-sm border transition ${selectedConvId === c.id ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-300'}`}
                  >
                    <p className="font-semibold">{c.contact?.name || c.contact?.phoneNumber}</p>
                    <p className="text-xs text-slate-500 truncate">{c.whatsappChatId}</p>
                  </button>
                ))}
              </div>

              <div className="col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-3 overflow-y-auto pr-2">
                  {messages.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">Select a conversation to view real messages</p>
                  ) : (
                    messages.map(m => (
                      <div key={m.id} className={`p-3 rounded-lg text-sm max-w-md ${m.senderType === 'CONTACT' ? 'bg-slate-800 border border-slate-700 ml-auto' : 'bg-slate-900 border border-slate-800 text-emerald-300'}`}>
                        <span className="text-[10px] text-slate-400 block mb-1 font-semibold">{m.senderType}</span>
                        {m.body}
                      </div>
                    ))
                  )}
                </div>
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

            {keyError && <div className="p-3 rounded bg-rose-500/10 text-xs text-rose-400 border border-rose-500/20">{keyError}</div>}

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 max-w-xl">
              <h2 className="text-lg font-semibold">Add Single Key</h2>
              <form onSubmit={handleAddSingleKey} className="flex gap-2">
                <input
                  type="password"
                  value={singleKey}
                  onChange={e => setSingleKey(e.target.value)}
                  placeholder="Paste AIza... Gemini Key"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-sm font-mono"
                />
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm text-slate-950 font-semibold">
                  Add Key
                </button>
              </form>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">Bulk Import / TXT Upload</h2>
              <form onSubmit={handleBulkSubmit} className="space-y-3">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="Paste multiple Gemini API keys (one key per line)..."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-between items-center">
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm text-slate-950 font-semibold transition">
                    Import Keys
                  </button>
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <Upload size={16} /> Upload TXT File
                    <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </form>

              {keyResult && (
                <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex gap-4">
                  <span>Submitted: {keyResult.submitted}</span>
                  <span>Added: {keyResult.added}</span>
                  <span>Duplicates: {keyResult.duplicates}</span>
                </div>
              )}
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h2 className="text-lg font-semibold">Active Pool Keys (Masked)</h2>
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

        {page === 'activity' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">AI Audit Trail</h1>
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
              {activityLogs.map(l => (
                <div key={l.id} className="p-3 rounded bg-slate-900 border border-slate-800 text-xs flex justify-between">
                  <div>
                    <span className="font-semibold text-emerald-400">{l.decision}</span>
                    <span className="text-slate-400 ml-2">{l.reason}</span>
                  </div>
                  <span className="text-slate-500">{new Date(l.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
