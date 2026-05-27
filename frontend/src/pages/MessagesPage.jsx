import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Search,
  Send,
} from 'lucide-react';
import { useAuth } from '@components/providers/AuthContext';
import API_BASE_URL from '@services/http/baseUrl';
import { getDefaultRouteByRole, getRouteByRole } from '@services/navigation/roleRedirect';
import UserAvatar from '@components/ui/UserAvatar';

const API = `${API_BASE_URL}/api/messages`;

function formatConversationTime(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const today = new Date();
  const isToday = parsed.toDateString() === today.toDateString();

  return parsed.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    ...(isToday ? {} : { day: '2-digit', month: '2-digit' }),
  });
}

function formatMessageTime(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function sortConversations(items) {
  return [...items].sort((a, b) => {
    const left = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const right = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return right - left;
  });
}

function mergeConversation(items, nextConversation) {
  if (!nextConversation?.id) return items;

  const found = items.some((item) => Number(item.id) === Number(nextConversation.id));
  const merged = found
    ? items.map((item) =>
        Number(item.id) === Number(nextConversation.id)
          ? {
              ...item,
              ...nextConversation,
              other_user: nextConversation.other_user || item.other_user,
              last_message: nextConversation.last_message || item.last_message || null,
              last_message_at: nextConversation.last_message_at || item.last_message_at || null,
              last_sender_id: nextConversation.last_sender_id || item.last_sender_id || null,
            }
          : item
      )
    : [nextConversation, ...items];

  return sortConversations(merged);
}

function getConversationPreview(conversation) {
  if (conversation.last_message) return conversation.last_message;
  return conversation.job_title ? `Hồ sơ ứng tuyển: ${conversation.job_title}` : 'Chưa có tin nhắn';
}

export default function MessagesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const handledTargetRef = useRef('');
  const messagesRoute = getRouteByRole(user?.role_code, 'messages');

  const selectedConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(selectedId)) || null,
    [conversations, selectedId]
  );

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (filter === 'unread' && Number(conversation.unread_count || 0) === 0) return false;

      if (!normalizedQuery) return true;

      const otherUser = conversation.other_user || {};
      const haystack = [
        otherUser.name,
        otherUser.email,
        conversation.company_name,
        conversation.job_title,
        conversation.last_message,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [conversations, filter, query]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations]
  );

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!token) return [];

    setLoadingConversations(true);
    setError('');

    try {
      const res = await fetch(`${API}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải danh sách tin nhắn');

      const nextConversations = sortConversations(data.data || []);
      setConversations(nextConversations);
      return nextConversations;
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tin nhắn');
      return [];
    } finally {
      setLoadingConversations(false);
    }
  }, [token]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams(location.search);
    const applicationId = params.get('applicationId');
    const conversationId = params.get('conversationId');
    const targetKey = `${applicationId || ''}:${conversationId || ''}`;

    if (!applicationId && !conversationId) return;
    if (handledTargetRef.current === targetKey) return;

    handledTargetRef.current = targetKey;
    let cancelled = false;

    const openTargetConversation = async () => {
      setOpeningConversation(true);
      setError('');

      try {
        if (applicationId) {
          const res = await fetch(`${API}/applications/${applicationId}/conversation`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Không thể mở hội thoại');
          if (cancelled) return;

          const conversation = data.data;
          setConversations((prev) => mergeConversation(prev, conversation));
          setSelectedId(conversation?.id || null);
          setMobileThreadOpen(Boolean(conversation?.id));
          if (conversation?.id) {
            navigate(`${messagesRoute}?conversationId=${conversation.id}`, { replace: true });
          }
          return;
        }

        setSelectedId(Number(conversationId));
        setMobileThreadOpen(true);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể mở hội thoại');
      } finally {
        if (!cancelled) setOpeningConversation(false);
      }
    };

    openTargetConversation();

    return () => {
      cancelled = true;
    };
  }, [location.search, messagesRoute, navigate, token]);

  useEffect(() => {
    const hasTarget = new URLSearchParams(location.search).has('conversationId')
      || new URLSearchParams(location.search).has('applicationId');

    if (!hasTarget && !selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, location.search, selectedId]);

  useEffect(() => {
    if (!selectedId || !token) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setError('');

      try {
        const res = await fetch(`${API}/conversations/${selectedId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể tải tin nhắn');
        if (cancelled) return;

        setMessages(data.data || []);
        if (data.conversation) {
          setConversations((prev) => mergeConversation(prev, { ...data.conversation, unread_count: 0 }));
        } else {
          setConversations((prev) =>
            prev.map((item) => Number(item.id) === Number(selectedId) ? { ...item, unread_count: 0 } : item)
          );
        }
        scrollToBottom('auto');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không thể tải tin nhắn');
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [scrollToBottom, selectedId, token]);

  useEffect(() => {
    const handleIncomingMessage = (event) => {
      const payload = event.detail;
      if (!payload?.conversation?.id || !payload?.message) return;

      const incomingConversationId = Number(payload.conversation.id);
      const isSelected = incomingConversationId === Number(selectedId);
      const incomingMessage = payload.message;

      setConversations((prev) => {
        const current = prev.find((item) => Number(item.id) === incomingConversationId);
        return mergeConversation(prev, {
          ...(current || {}),
          ...payload.conversation,
          last_message: incomingMessage.body,
          last_message_at: incomingMessage.created_at,
          last_sender_id: incomingMessage.sender_id,
          unread_count: isSelected ? 0 : Number(current?.unread_count || payload.conversation.unread_count || 0) + 1,
        });
      });

      if (!isSelected) return;

      setMessages((prev) => {
        if (prev.some((message) => Number(message.id) === Number(incomingMessage.id))) return prev;
        return [...prev, incomingMessage];
      });
      fetch(`${API}/conversations/${incomingConversationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      scrollToBottom();
    };

    window.addEventListener('aptertek:new-message', handleIncomingMessage);
    return () => window.removeEventListener('aptertek:new-message', handleIncomingMessage);
  }, [scrollToBottom, selectedId, token]);

  const handleSelectConversation = (conversationId) => {
    setSelectedId(conversationId);
    setMobileThreadOpen(true);
    navigate(`${messagesRoute}?conversationId=${conversationId}`);
  };

  const handleSend = async (event) => {
    event.preventDefault();

    const body = draft.trim();
    if (!body || !selectedId || sending) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch(`${API}/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể gửi tin nhắn');

      const sentMessage = data.data;
      setMessages((prev) => [...prev, sentMessage]);
      setConversations((prev) => mergeConversation(prev, {
        ...(data.conversation || selectedConversation || {}),
        last_message: sentMessage.body,
        last_message_at: sentMessage.created_at,
        last_sender_id: sentMessage.sender_id,
        unread_count: 0,
      }));
      setDraft('');
      scrollToBottom();
    } catch (err) {
      setError(err.message || 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const otherUser = selectedConversation?.other_user || {};
  const backRoute = getDefaultRouteByRole(user?.role_code);
  const listPaneClass = mobileThreadOpen && selectedConversation ? 'hidden md:flex' : 'flex';
  const threadPaneClass = selectedConversation
    ? (mobileThreadOpen ? 'flex' : 'hidden md:flex')
    : 'hidden md:flex';

  return (
    <div className="aw-container py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={backRoute} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-indigo-700">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tin nhắn</h1>
              <p className="text-sm text-gray-500">{conversations.length} hội thoại{unreadTotal ? `, ${unreadTotal} chưa đọc` : ''}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-220px)] overflow-hidden rounded-lg border border-indigo-100/70 bg-white shadow-sm md:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${listPaneClass} min-h-[calc(100vh-220px)] flex-col border-indigo-100 md:border-r`}>
          <div className="border-b border-indigo-100 bg-white p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm hội thoại"
                className="aw-input h-10 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'unread', label: 'Chưa đọc' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    filter === item.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations || openingConversation ? (
              <div className="flex h-full flex-col items-center justify-center text-gray-500">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                <p className="mt-3 text-sm font-semibold">Đang tải tin nhắn...</p>
              </div>
            ) : filteredConversations.length ? (
              <div className="divide-y divide-slate-100">
                {filteredConversations.map((conversation) => {
                  const active = Number(conversation.id) === Number(selectedId);
                  const unread = Number(conversation.unread_count || 0);
                  const participant = conversation.other_user || {};

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition ${
                        active ? 'bg-indigo-50/80' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <UserAvatar
                        src={participant.avatar_url}
                        alt={participant.name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white"
                        fallbackClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-600 ring-2 ring-white"
                        iconClassName="h-5 w-5 text-white"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-bold text-gray-900">{participant.name || 'Người dùng'}</p>
                          <span className="shrink-0 text-[11px] font-medium text-gray-400">
                            {formatConversationTime(conversation.last_message_at || conversation.updated_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold text-indigo-600">{conversation.job_title || conversation.company_name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-bold text-slate-900' : 'text-gray-500'}`}>
                            {getConversationPreview(conversation)}
                          </p>
                          {unread ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1.5 text-[11px] font-bold text-white">
                              {Math.min(unread, 99)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
                <Inbox className="h-11 w-11 text-gray-300" />
                <p className="mt-3 text-sm font-bold text-gray-800">Chưa có hội thoại</p>
                <p className="mt-1 text-sm leading-6">Tin nhắn từ hồ sơ ứng tuyển sẽ xuất hiện tại đây.</p>
              </div>
            )}
          </div>
        </aside>

        <section className={`${threadPaneClass} min-h-[calc(100vh-220px)] flex-col bg-slate-50/70`}>
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-indigo-100 bg-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileThreadOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-gray-600 md:hidden"
                    aria-label="Quay lại danh sách"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <UserAvatar
                    src={otherUser.avatar_url}
                    alt={otherUser.name}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-gray-100"
                    fallbackClassName="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-cyan-600 ring-2 ring-gray-100"
                    iconClassName="h-5 w-5 text-white"
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-gray-900">{otherUser.name || 'Tin nhắn'}</h2>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="truncate">{selectedConversation.job_title || selectedConversation.company_name || 'Hội thoại tuyển dụng'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                  <div className="flex h-full flex-col items-center justify-center text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="mt-3 text-sm font-semibold">Đang mở hội thoại...</p>
                  </div>
                ) : messages.length ? (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const mine = Number(message.sender_id) === Number(user?.id) || message.mine;

                      return (
                        <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-lg px-4 py-3 shadow-sm ${
                            mine
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-200 bg-white text-gray-800'
                          }`}
                          >
                            <p className="whitespace-pre-line break-words text-sm leading-6">{message.body}</p>
                            <p className={`mt-1 text-[11px] ${mine ? 'text-indigo-100' : 'text-gray-400'}`}>
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
                    <p className="mt-4 text-sm font-bold text-gray-800">Chưa có tin nhắn</p>
                    <p className="mt-1 text-sm">Bắt đầu trao đổi về hồ sơ ứng tuyển này.</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-indigo-100 bg-white p-3">
                <div className="flex items-end gap-3">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Nhập tin nhắn..."
                    rows={2}
                    maxLength={2000}
                    className="aw-input min-h-[46px] flex-1 resize-none px-4 py-3 text-sm"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSend(event);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim() || loadingMessages}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Gửi tin nhắn"
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
              <MessageSquareText className="h-14 w-14 text-gray-300" />
              <p className="mt-4 text-base font-bold text-gray-900">Chọn một hội thoại</p>
              <p className="mt-1 max-w-sm text-sm leading-6">Danh sách bên trái giúp bạn quản lý toàn bộ tin nhắn ứng tuyển ở một nơi.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
