
import React from 'react';
import { IdeaBlueprint } from '../types';

interface BlueprintViewProps {
  blueprint: IdeaBlueprint;
  imageUrl: string | null;
  isGeneratingImage: boolean;
}

const BlueprintView: React.FC<BlueprintViewProps> = ({ blueprint, imageUrl, isGeneratingImage }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-12 px-4 max-w-7xl mx-auto">
      {/* 左侧：视觉概念与概览 */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass rounded-3xl overflow-hidden aspect-video relative flex items-center justify-center bg-black/40">
          {imageUrl ? (
            <img src={imageUrl} alt="Concept Visual" className="w-full h-full object-cover animate-in fade-in duration-1000" />
          ) : isGeneratingImage ? (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin h-10 w-10 border-4 border-purple-500 border-t-transparent rounded-full" />
              <p className="text-gray-400 text-sm">正在生成概念视觉...</p>
            </div>
          ) : (
            <div className="text-gray-600">视觉概念图生成中</div>
          )}
        </div>

        <div className="glass p-8 rounded-3xl space-y-4">
          <h2 className="text-2xl font-bold gradient-text">{blueprint.title}</h2>
          <p className="text-gray-300 leading-relaxed">{blueprint.summary}</p>
        </div>

        <div className="glass p-8 rounded-3xl">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-400 mb-3">核心受众</h3>
          <p className="text-gray-200">{blueprint.targetAudience}</p>
        </div>

        {blueprint.marketReferences && blueprint.marketReferences.length > 0 && (
          <div className="glass p-8 rounded-3xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400 mb-3">市场参考资料</h3>
            <ul className="space-y-2">
              {blueprint.marketReferences.slice(0, 5).map((ref, i) => (
                <li key={i}>
                  <a href={ref.uri} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2">
                    <span className="text-xs">🔗</span> {ref.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 右侧：详细分析与路径图 */}
      <div className="lg:col-span-7 space-y-6">
        <div className="glass p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="p-2 bg-indigo-500/10 rounded-lg">💎</span> 独特价值主张 (UVP)
          </h3>
          <p className="text-gray-300 italic">"{blueprint.uniqueValueProp}"</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass p-6 rounded-3xl border-green-500/20">
            <h3 className="font-semibold text-green-400 mb-4">市场机会</h3>
            <ul className="space-y-3">
              {blueprint.marketOpportunities.map((op, i) => (
                <li key={i} className="text-sm text-gray-400 flex gap-2">
                  <span className="text-green-500">•</span> {op}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass p-6 rounded-3xl border-red-500/20">
            <h3 className="font-semibold text-red-400 mb-4">核心挑战</h3>
            <ul className="space-y-3">
              {blueprint.challenges.map((ch, i) => (
                <li key={i} className="text-sm text-gray-400 flex gap-2">
                  <span className="text-red-500">•</span> {ch}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span className="p-2 bg-purple-500/10 rounded-lg">🚀</span> 战略实施路径 (Roadmap)
          </h3>
          <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
            {blueprint.roadmap.map((step, i) => (
              <div key={i} className="flex gap-4 relative">
                <div className="w-[23px] h-[23px] rounded-full bg-[#0a0a0f] border-2 border-purple-500 flex-shrink-0 z-10" />
                <div>
                  <h4 className="font-medium text-gray-100 mb-1">阶段 {i + 1}</h4>
                  <p className="text-sm text-gray-400">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlueprintView;
