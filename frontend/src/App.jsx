import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { MessageSquare, Building2, User, Bot, FileText, Image as ImageIcon, Loader2, PlusCircle, Trash2, X } from 'lucide-react';

const API_BASE = 'https://krid-backend-270724954789.us-central1.run.app/api';

function App() {
  const [tenants, setTenants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', system_prompt: '', media_keyword: '' });
  const [file, setFile] = useState(null);

  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tenants`);
      setTenants(res.data);
      if (res.data.length > 0 && !selectedTenant) {
        setSelectedTenant(res.data[0]);
      } else if (res.data.length === 0) {
        setSelectedTenant(null);
      }
    } catch (err) {
      console.error("Failed to fetch tenants", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (!selectedTenant) {
      setSessions([]);
      setSelectedSession(null);
      return;
    }
    const fetchSessions = async () => {
      try {
        const res = await axios.get(`${API_BASE}/sessions?tenant_id=${selectedTenant.id}`);
        setSessions(res.data);
        if (res.data.length > 0 && (!selectedSession || res.data.findIndex(s => s._id === selectedSession._id) === -1)) {
          setSelectedSession(res.data[0]);
        } else if (res.data.length === 0) {
          setSelectedSession(null);
        }
      } catch (err) {
        console.error("Failed to fetch sessions", err);
      }
    };
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [selectedTenant]);

  useEffect(() => {
    if (!selectedSession) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE}/sessions/${selectedSession._id}/messages`);
        setMessages(res.data);
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [selectedSession]);

  const handleAddTenant = async (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.system_prompt) return;
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('name', newTenant.name);
      formData.append('system_prompt', newTenant.system_prompt);
      if (newTenant.media_keyword) {
        formData.append('media_keyword', newTenant.media_keyword);
      }
      if (file) {
        formData.append('file', file);
      }

      await axios.post(`${API_BASE}/tenants`, formData);
      
      setShowModal(false);
      setNewTenant({ name: '', system_prompt: '', media_keyword: '' });
      setFile(null);
      await fetchTenants();
    } catch (err) {
      console.error("Failed to add tenant", err);
      const serverMsg = err.response?.data?.message || err.message;
      alert(`Failed to create workspace! Server says:\n\n${serverMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this workspace and all its sessions?")) return;
    try {
      await axios.delete(`${API_BASE}/tenants/${id}`);
      if (selectedTenant?.id === id) {
        setSelectedTenant(null);
      }
      await fetchTenants();
    } catch (err) {
      console.error("Failed to delete tenant", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-teal-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR: Tenants & Sessions */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
        
        {/* Tenant Switcher */}
        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-4 text-teal-700 font-medium">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              <h2>Workspaces</h2>
            </div>
            <button 
              onClick={() => setShowModal(true)}
              className="p-1 hover:bg-teal-50 rounded-full transition-colors group relative"
              title="Add Workspace"
            >
              <PlusCircle className="w-5 h-5 group-hover:text-teal-600 transition-colors" />
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {tenants.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTenant(t)}
                className={`group flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  selectedTenant?.id === t.id 
                    ? 'bg-teal-50 text-teal-800 border border-teal-100 shadow-sm' 
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'
                }`}
              >
                <span className="truncate pr-2">{t.name}</span>
                <button
                  onClick={(e) => handleDeleteTenant(t.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-all"
                  title="Delete Workspace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {tenants.length === 0 && (
              <div className="text-sm text-gray-400 italic py-2 text-center border-2 border-dashed border-gray-100 rounded-lg">
                No workspaces yet
              </div>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Live Conversations</h3>
          <div className="flex flex-col gap-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400 px-2 italic">No active chats.</p>
            ) : (
              sessions.map(s => (
                <button
                  key={s._id}
                  onClick={() => setSelectedSession(s)}
                  className={`flex flex-col gap-1 text-left p-3 rounded-xl transition-all ${
                    selectedSession?._id === s._id
                      ? 'bg-white border border-teal-200 shadow-md ring-1 ring-teal-100'
                      : 'bg-transparent border border-transparent hover:bg-white hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-semibold text-sm text-gray-800">{s.phone_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      s.status === 'PENDING_RESPONSE' ? 'bg-amber-100 text-amber-700' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {s.status === 'PENDING_RESPONSE' ? 'Waiting' : 'Handled'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    Last active: {format(new Date(s.updated_at), 'h:mm a')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Message Thread */}
      <div className="flex-1 flex flex-col bg-white relative">
        {selectedSession ? (
          <>
            {/* Thread Header */}
            <div className="h-20 border-b border-gray-100 flex items-center px-8 bg-white/80 backdrop-blur-sm z-10 sticky top-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-800">{selectedSession.phone_number}</h2>
                  <p className="text-xs text-teal-600 font-medium">Customer</p>
                </div>
              </div>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map(msg => {
                const isBot = msg.sender === 'bot';
                return (
                  <div key={msg._id} className={`flex w-full ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`flex gap-3 max-w-[70%] ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                      
                      {/* Avatar */}
                      <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center mt-1 ${
                        isBot ? 'bg-teal-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>

                      {/* Message Bubble */}
                      <div className="flex flex-col gap-1">
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                          isBot 
                            ? 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm' 
                            : 'bg-teal-600 text-white rounded-tr-sm'
                        }`}>
                          {msg.text && <p>{msg.text}</p>}
                          
                          {/* Media Indicator */}
                          {msg.media_url && (
                            <div className={`mt-3 p-3 rounded-lg flex items-center gap-3 border ${
                              isBot ? 'bg-gray-50 border-gray-100' : 'bg-teal-700/50 border-teal-500'
                            }`}>
                              {msg.media_url.endsWith('.pdf') ? (
                                <FileText className={`w-5 h-5 ${isBot ? 'text-teal-600' : 'text-teal-100'}`} />
                              ) : (
                                <ImageIcon className={`w-5 h-5 ${isBot ? 'text-teal-600' : 'text-teal-100'}`} />
                              )}
                              <a 
                                href={msg.media_url.startsWith('/') ? API_BASE.replace('/api', '') + msg.media_url : msg.media_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className={`text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity ${
                                  isBot ? 'text-teal-700' : 'text-white'
                                }`}
                              >
                                View Attachment
                              </a>
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] text-gray-400 ${isBot ? 'text-left ml-1' : 'text-right mr-1'}`}>
                          {format(new Date(msg.timestamp), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-16 h-16 mb-4 text-gray-200" />
            <p className="text-lg font-medium text-gray-500">Select a conversation</p>
            <p className="text-sm">Monitor live WhatsApp chats here.</p>
          </div>
        )}
      </div>

      {/* Add Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">New Workspace</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTenant} className="p-6 flex flex-col gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Workspace Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Luxury Furniture Store"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
                  value={newTenant.name}
                  onChange={e => setNewTenant({...newTenant, name: e.target.value})}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">System Prompt *</label>
                <textarea 
                  required
                  placeholder="You are a helpful sales agent for..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm resize-none"
                  value={newTenant.system_prompt}
                  onChange={e => setNewTenant({...newTenant, system_prompt: e.target.value})}
                />
              </div>

              <div className="flex flex-col gap-4 p-4 border border-teal-100 bg-teal-50/30 rounded-xl">
                <div className="flex items-center gap-2 text-teal-800">
                  <FileText className="w-4 h-4" />
                  <span className="font-semibold text-sm">Media Library Asset (Optional)</span>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Trigger Keyword</label>
                  <input 
                    type="text" 
                    placeholder="e.g. catalog, invoice, diagram"
                    className="w-full px-4 py-2 rounded-lg border border-teal-200/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm bg-white"
                    value={newTenant.media_keyword}
                    onChange={e => setNewTenant({...newTenant, media_keyword: e.target.value})}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Upload Document</label>
                  <input 
                    type="file" 
                    accept="application/pdf,image/*"
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-all cursor-pointer"
                    onChange={e => setFile(e.target.files[0])}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 transition-all shadow-sm shadow-teal-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Workspace
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
