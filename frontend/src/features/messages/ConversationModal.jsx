import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useAuth } from '@features/auth/AuthContext';
import API_BASE_URL from '@shared/api/baseUrl';
import UserAvatar from '@shared/ui/UserAvatar';

const API = `${API_BASE_URL}/api/messages`;

function formatMessageTime(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function ConversationModal({ open, applicationId, initialTitle = '', onClose }) {
  const { token, user } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId || !token) return;

    try {
      const res = await fetch(`${API}/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải tin nhắn');

      setConversation(data.conversation || null);
      setMessages(data.data || []);
      scrollToBottom();
    } catch (err) {
      setError(err.message || 'Không thể tải tin nhắn');
    }
  }, [token]);

  useEffect(() => {
    if (!open || !applicationId || !token) return;

    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      setError('');
      setConversation(null);
      setMessages([]);

      try {
        const res = await fetch(`${API}/applications/${applicationId}/conversation`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể mở hội thoại');
        if (cancelled) return;

        setConversation(data.data || null);
        await loadMessages(data.data?.id);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể mở hội thoại');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [open, applicationId, token, loadMessages]);

  useEffect(() => {
    if (!open || !conversation?.id) return;

    const handleIncomingMessage = (event) => {
      const payload = event.detail;
      if (Number(payload?.conversation?.id) !== Number(conversation.id)) return;

      setConversation(payload.conversation);
      setMessages((prev) => {
        if (prev.some((message) => Number(message.id) === Number(payload.message.id))) return prev;
        return [...prev, payload.message];
      });
      fetch(`${API}/conversations/${conversation.id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      scrollToBottom();
    };

    window.addEventListener('aptertek:new-message', handleIncomingMessage);
    return () => window.removeEventListener('aptertek:new-message', handleIncomingMessage);
  }, [open, conversation?.id, token]);

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversation?.id || sending) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch(`${API}/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể gửi tin nhắn');

      setConversation(data.conversation || conversation);
      setMessages((prev) => [...prev, data.data]);
      setDraft('');
      scrollToBottom();
    } catch (err) {
      setError(err.message || 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const otherUser = conversation?.other_user || {};

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-2xl shadow-slate-900/30">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {conversation ? (
              <UserAvatar
                src={otherUser.avatar_url}
                alt={otherUser.name}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-gray-100"
                fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-navy-500 to-navy-700 ring-2 ring-gray-100"
                iconClassName="h-5 w-5 text-white"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-50 text-navy-600">
                <MessageCircle className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-gray-900">
                {otherUser.name || initialTitle || 'Tin nhắn'}
              </h3>
              <p className="truncate text-xs text-gray-500">
                {conversation?.job_title ? `Vị trí ${conversation.job_title}` : 'Hội thoại tuyển dụng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mx-5 mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex-1 overflow-y-auto bg-gray-50 px-5 py-4">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-navy-600" />
              <p className="mt-3 text-sm font-medium">Đang mở hội thoại...</p>
            </div>
          ) : messages.length ? (
            <div className="space-y-3">
              {messages.map((message) => {
                const mine = Number(message.sender_id) === Number(user?.id) || message.mine;

                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${mine ? 'bg-navy-700 text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
                      <p className="whitespace-pre-line text-sm leading-6">{message.body}</p>
                      <p className={`mt-1 text-[11px] ${mine ? 'text-navy-100' : 'text-gray-400'}`}>
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
              <MessageCircle className="h-12 w-12 text-gray-300" />
              <p className="mt-4 text-sm font-medium">Chưa có tin nhắn nào.</p>
              <p className="mt-1 text-xs">Gửi tin nhắn đầu tiên để trao đổi về hồ sơ ứng tuyển này.</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-gray-100 bg-white p-4">
          <div className="flex items-end gap-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tin nhắn..."
              rows={2}
              maxLength={2000}
              className="min-h-[48px] flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-navy-400 focus:ring-2 focus:ring-navy-100"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || loading}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-700 text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
