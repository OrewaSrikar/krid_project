import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { MessageSquare, Building2, User, Bot, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

const API_BASE = 'https://krid-backend-270724954789.us-central1.run.app/api';

function App() {
  const [tenants, setTenants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const [loading, setLoading] = useState(true);

  // Fetch Tenants on mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const res = await axios.get(`${API_BASE}/tenants`);
        setTenants(res.data);
        if (res.data.length > 0) {
          setSelectedTenant(res.data[0]);
        }
      } catch (err) {
        console.error("Failed to fetch tenants", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  // Fetch Sessions when Tenant changes
  useEffect(() => {
    if (!selectedTenant) return;
    const fetchSessions = async () => {
      try {
        const res = await axios.get(`${API_BASE}/sessions?tenant_id=${selectedTenant.id}`);
        setSessions(res.data);
        if (res.data.length > 0) {
          setSelectedSession(res.data[0]);
        } else {
          setSelectedSession(null);
        }
      } catch (err) {
        console.error("Failed to fetch sessions", err);
      }
    };
    
    fetchSessions();
    // In a real app, we'd use websockets. Polling every 5s for the demo.
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [selectedTenant]);

  // Fetch Messages when Session changes
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
          <div className="flex items-center gap-2 mb-4 text-teal-700 font-medium">
            <Building2 className="w-5 h-5" />
            <h2>Active Workspace</h2>
          </div>
          <div className="flex flex-col gap-2">
            {tenants.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTenant(t)}
                className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  selectedTenant?.id === t.id 
                    ? 'bg-teal-50 text-teal-800 border border-teal-100 shadow-sm' 
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'
                }`}
              >
                {t.name}
              </button>
            ))}
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
                                href={msg.media_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className={`text-xs font-semibold underline underline-offset-2 ${
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
    </div>
  );
}

export default App;
