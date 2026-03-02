
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { createChat } from '../services/geminiService';

interface ChatPanelProps {
  ideaTitle: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ ideaTitle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);

  useEffect(() => {
    chatRef.current = createChat(`你是一位顶尖的创投导师和初创公司联合创始人。你正在讨论关于 "${ideaTitle}" 的创意。
    请以专业、犀利但充满支持性的口吻进行交流。多提问以引发深度思考。使用中文交流。`);
    setMessages([{ role: 'model', content: `关于 ${ideaTitle} 的构思非常棒。如果我们要让它在第一年实现规模化，你觉得最核心的瓶颈会是什么？` }]);
  }, [ideaTitle]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const result = await chatRef.current.sendMessageStream({ message: userMsg });
      let fullContent = '';
      
      setMessages(prev => [...prev, { role: 'model', content: '' }]);
      
      for await (const chunk of result) {
        fullContent += chunk.text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].content = fullContent;
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', content: '抱歉，我的大脑暂时卡壳了，请再试一次。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] glass rounded-3xl shadow-2xl flex flex-col hidden lg:flex border border-white/5 overflow-hidden z-50">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="font-semibold text-sm">AI 联合创始人</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-purple-600 text-white rounded-br-none' 
                : 'bg-white/10 text-gray-200 rounded-bl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white/10 p-3 rounded-2xl rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white/5 border-t border-white/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="向你的联合创始人提问..."
          className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
        />
      </form>
    </div>
  );
};

export default ChatPanel;
