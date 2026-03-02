
import React, { useState } from 'react';

interface HeroProps {
  onStart: (idea: string) => void;
  loading: boolean;
}

const Hero: React.FC<HeroProps> = ({ onStart, loading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onStart(input);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
        伟大的创意，从<span className="gradient-text">这里</span>启航。
      </h1>
      <p className="text-gray-400 text-xl max-w-2xl mb-12 leading-relaxed">
        输入你的原始想法、半成品思考或复杂的愿景。
        IdeaForge 将利用 Gemini 的力量将其打造成一份完美的商业蓝图。
      </p>
      
      <form onSubmit={handleSubmit} className="w-full max-w-3xl relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
        <div className="relative flex flex-col md:flex-row gap-2 bg-[#0a0a0f] p-2 rounded-2xl border border-white/10">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="用几句话描述你的想法，或者直接粘贴你的整个构思..."
            className="flex-grow bg-transparent border-none focus:ring-0 text-lg p-4 resize-none h-32 md:h-auto min-h-[60px] outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`px-8 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              loading || !input.trim() 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-gray-200 active:scale-95'
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-black border-t-transparent rounded-full" />
                <span>正在锻造...</span>
              </div>
            ) : (
              <>锻造创意</>
            )}
          </button>
        </div>
      </form>

      <div className="mt-12 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
        <span>Gemini 3 强力驱动</span>
        <span className="w-1 h-1 bg-gray-700 rounded-full mt-2"></span>
        <span>AI 智能蓝图</span>
        <span className="w-1 h-1 bg-gray-700 rounded-full mt-2"></span>
        <span>实时市场搜索</span>
      </div>
    </div>
  );
};

export default Hero;
