
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Calendar, Activity, ChevronDown, ChevronUp, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { SnapshotItem } from '@shared/types';
import { useData } from '../../contexts/DataContext';

interface SnapshotListProps {
    snapshots: SnapshotItem[];
    loadingDetails: boolean;
    selectedSnapshotId: string | null;
    onInitEntry: (id?: string) => void;
}

export const SnapshotList: React.FC<SnapshotListProps> = ({ 
    snapshots, 
    loadingDetails, 
    selectedSnapshotId, 
    onInitEntry 
}) => {
    const { snapshotPage, setSnapshotPage, snapshotTotal } = useData();
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

    const sortedSnapshots = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

    // Pagination Calculation
    const totalPages = Math.ceil(snapshotTotal / 20);
    const hasNext = snapshotPage < totalPages;
    const hasPrev = snapshotPage > 1;

    const toggleNote = (id: string) => {
        const newSet = new Set(expandedNotes);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedNotes(newSet);
    };

    return (
        <div className="pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">月度账本</h2>
                    <p className="text-slate-500 text-sm">统一管理所有资产的市值与流水变动。</p>
                </div>
                <button
                    onClick={() => onInitEntry()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
                    disabled={loadingDetails}
                >
                    {loadingDetails ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    记一笔
                </button>
            </div>

            <div className="space-y-4">
                {sortedSnapshots.length === 0 ? (
                    <div className="bg-white p-12 text-center rounded-xl border border-slate-100 text-slate-400">
                        <Activity size={48} className="mx-auto mb-4 opacity-20" />
                        <p>暂无记录。点击右上角开始记账。</p>
                    </div>
                ) : (
                    sortedSnapshots.map(s => {
                        return (
                            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-4 flex items-center justify-between bg-slate-50/50 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm text-center min-w-[3.5rem]">
                                            <div className="text-xs text-slate-500 uppercase">{s.date.split('-')[0]}</div>
                                            <div className="text-lg font-bold text-slate-800">{s.date.split('-')[1]}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-500">总资产</div>
                                            <div className="font-bold text-slate-800 text-lg">¥{(s.totalValue ?? 0).toLocaleString()}</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex gap-2">
                                            <button onClick={() => onInitEntry(s.id)} disabled={loadingDetails} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                {loadingDetails && selectedSnapshotId === s.id ? <Loader2 className="animate-spin" size={18} /> : <Calendar size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {s.note ? (
                                    <div className="px-4 py-2 bg-yellow-50/30">
                                        <button onClick={() => toggleNote(s.id)} className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 w-full">
                                            {expandedNotes.has(s.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            <span>投资笔记</span>
                                            {!expandedNotes.has(s.id) && <span className="text-slate-400 font-normal truncate max-w-[200px] ml-2">{s.note}</span>}
                                        </button>
                                        {expandedNotes.has(s.id) && (
                                            <div className="mt-2 text-sm text-slate-700 prose prose-sm max-w-none prose-p:my-1 prose-table:border-collapse prose-th:border prose-th:border-slate-200 prose-th:p-2 prose-td:border prose-td:border-slate-200 prose-td:p-2 prose-th:bg-slate-50">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.note}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="px-4 py-1"><span className="text-[10px] text-slate-300 italic">本月未留笔记</span></div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                    <button
                        onClick={() => setSnapshotPage(snapshotPage - 1)}
                        disabled={!hasPrev}
                        className={`p-2 rounded-lg flex items-center gap-1 text-sm font-medium ${!hasPrev ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200 bg-white shadow-sm border border-slate-200'}`}
                    >
                        <ChevronLeft size={16} /> 上一页
                    </button>
                    <span className="text-sm text-slate-500 font-medium">
                        第 {snapshotPage} 页 / 共 {totalPages} 页
                    </span>
                    <button
                        onClick={() => setSnapshotPage(snapshotPage + 1)}
                        disabled={!hasNext}
                        className={`p-2 rounded-lg flex items-center gap-1 text-sm font-medium ${!hasNext ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200 bg-white shadow-sm border border-slate-200'}`}
                    >
                        下一页 <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};
