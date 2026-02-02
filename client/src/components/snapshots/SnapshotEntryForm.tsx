
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Save, FileText, Calendar, Plus, TrendingUp, Briefcase, Landmark, Coins, Wallet, Bitcoin, MessageSquare, Trash2, X } from 'lucide-react';
import { Asset, AssetCategory } from '@shared/types';
import { useSnapshotForm } from '../../hooks/useSnapshotForm';

interface SnapshotEntryFormProps {
    assets: Asset[];
    selectedSnapshotId: string | null;
    formHook: ReturnType<typeof useSnapshotForm>;
    onCancel: () => void;
    onSubmit: () => void;
    onCreateAsset: (asset: Partial<Asset>) => Promise<void>;
}

export const SnapshotEntryForm: React.FC<SnapshotEntryFormProps> = ({
    assets,
    selectedSnapshotId,
    formHook,
    onCancel,
    onSubmit,
    onCreateAsset
}) => {
    const { date, setDate, note, setNote, rows, updateRow, addAssetRow, removeRow } = formHook;

    // Local UI State for Modals
    const [isCreatingAsset, setIsCreatingAsset] = useState(false);
    const [newAssetName, setNewAssetName] = useState('');
    const [newAssetType, setNewAssetType] = useState<AssetCategory>('security');
    const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);

    const handleCreateNewAsset = async () => {
        if (newAssetName && onCreateAsset) {
            await onCreateAsset({
                name: newAssetName,
                type: newAssetType
            });
            setNewAssetName('');
            setIsCreatingAsset(false);
        }
    };

    const getCategoryIcon = (c: AssetCategory) => {
        switch (c) {
            case 'security': return <TrendingUp size={16} className="text-blue-600" />;
            case 'fund': return <Briefcase size={16} className="text-indigo-600" />;
            case 'wealth': return <Landmark size={16} className="text-cyan-600" />;
            case 'gold': return <Coins size={16} className="text-amber-600" />;
            case 'fixed': return <Wallet size={16} className="text-slate-600" />;
            case 'crypto': return <Bitcoin size={16} className="text-purple-600" />;
            default: return <Briefcase size={16} className="text-pink-600" />;
        }
    };

    const totalAssetsVal = rows.reduce((sum, r) => {
        const p = parseFloat(r.price) || (r.category === 'fixed' || r.category === 'wealth' ? 1 : 0);
        const sign = r.transactionType === 'sell' ? -1 : 1;
        const qChange = (parseFloat(r.quantityChange) || 0) * sign;
        const q = r.prevQuantity + qChange;
        return sum + (p * q);
    }, 0);

    const availableAssets = assets.filter(a => !rows.find(r => r.assetId === a.id));

    return (
        <div className="pb-20 relative">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-full">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {selectedSnapshotId ? '编辑资产负债表' : '录入月度账本'}
                        </h2>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span>{date}</span>
                            <span>•</span>
                            <span>总资产: ¥{totalAssetsVal.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                        <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                            <Save size={18} /> 保存
                        </button>
                    </div>
                </div>

                {/* Config Area */}
                <div className="p-6 border-b border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="max-w-xs relative">
                            <label className="text-xs font-bold text-slate-400 mb-1 block">账期 (Month)</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="month"
                                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={date} onChange={e => setDate(e.target.value)}
                                    disabled={!!selectedSnapshotId}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 mb-1 block">添加资产 (Add Asset)</label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                    onChange={(e) => {
                                        const asset = assets.find((a: Asset) => a.id === e.target.value);
                                        if (asset) {
                                            addAssetRow(asset);
                                            e.target.value = "";
                                        }
                                    }}
                                >
                                    <option value="">+ 选择已定义的资产...</option>
                                    {availableAssets.map(a => (
                                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setIsCreatingAsset(true)}
                                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                                    title="创建新资产"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
                            <FileText size={14} />
                            本月投资笔记 (Markdown)
                        </label>
                        <textarea
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono min-h-[100px]"
                            placeholder="# 本月大事记..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase font-semibold">
                                <th className="p-4 w-64 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">资产名称</th>
                                <th className="p-4 w-28 text-right">当前单价</th>
                                <th className="p-4 w-56 text-right bg-blue-50/30">
                                    <div className="flex justify-end gap-2 items-center">
                                        本月变动 (份额)
                                    </div>
                                </th>
                                <th className="p-4 w-40 text-right bg-rose-50/30">本月流水 (本金)</th>
                                <th className="p-4 w-32 text-right">持有总量</th>
                                <th className="p-4 w-40 text-right">当前市值</th>
                                <th className="p-4 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => {
                                const isCashLike = row.category === 'fixed' || row.category === 'wealth';
                                const p = parseFloat(row.price) || (isCashLike ? 1 : 0);
                                const sign = row.transactionType === 'sell' ? -1 : 1;
                                const qChangeAbs = parseFloat(row.quantityChange) || 0;
                                const cChangeAbs = parseFloat(row.costChange) || 0;
                                const qChangeSigned = qChangeAbs * sign;
                                const cChangeSigned = cChangeAbs * sign;
                                const currentQ = row.prevQuantity + qChangeSigned;
                                const currentVal = currentQ * p;
                                const impliedProfit = isCashLike ? (qChangeSigned - cChangeSigned) : 0;
                                const quantityStep = row.category === 'security' ? "100" : (row.category === 'fund' ? "0.01" : "1");
                                const hasNote = row.note && row.note.trim().length > 0;

                                return (
                                    <React.Fragment key={row.recordId}>
                                        <tr className="hover:bg-slate-50 group">
                                            <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg bg-slate-100`}>
                                                        {getCategoryIcon(row.category)}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800">{row.name}</div>
                                                        <div className="text-[10px] text-slate-400 uppercase">{row.category}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => setEditingNoteIndex(idx)}
                                                        className={`p-1.5 rounded transition-colors ${hasNote ? 'text-blue-500 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}
                                                        title="点击编辑备注 (Markdown)"
                                                    >
                                                        <MessageSquare size={16} fill={hasNote ? "currentColor" : "none"} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <input
                                                    type="number" step="0.001" placeholder="0.000"
                                                    className={`w-full text-right px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 outline-none ${isCashLike ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'border-slate-200'}`}
                                                    value={isCashLike ? '1.000' : row.price}
                                                    onChange={e => !isCashLike && updateRow(idx, 'price', e.target.value)}
                                                    disabled={isCashLike}
                                                />
                                            </td>
                                            <td className="p-4 bg-blue-50/30 relative">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex bg-white rounded-md border border-blue-200 p-0.5 shrink-0">
                                                        <button
                                                            onClick={() => updateRow(idx, 'transactionType', 'buy')}
                                                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${row.transactionType === 'buy' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            买入
                                                        </button>
                                                        <button
                                                            onClick={() => updateRow(idx, 'transactionType', 'sell')}
                                                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${row.transactionType === 'sell' ? 'bg-rose-100 text-rose-700' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            卖出
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="number" step={quantityStep} placeholder="0"
                                                        className={`w-full text-right px-2 py-1 border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium ${row.transactionType === 'sell' ? 'text-rose-600' : 'text-blue-700'}`}
                                                        value={row.quantityChange}
                                                        onChange={e => updateRow(idx, 'quantityChange', e.target.value)}
                                                    />
                                                </div>

                                                {isCashLike && Math.abs(impliedProfit) > 0.01 && (
                                                    <div className={`text-[10px] text-right mt-1 font-medium ${impliedProfit > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {impliedProfit > 0 ? '利息/收益 +' : '费用 -'}{Math.abs(impliedProfit).toLocaleString()}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 bg-rose-50/30">
                                                <input
                                                    type="number" step="0.01" placeholder="0.00"
                                                    className={`w-full text-right px-2 py-1 border border-rose-200 rounded focus:ring-2 focus:ring-rose-500 outline-none font-medium ${row.transactionType === 'sell' ? 'text-rose-600' : 'text-rose-700'}`}
                                                    value={row.costChange} onChange={e => updateRow(idx, 'costChange', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-4 text-right text-slate-600">
                                                <div className="font-bold">{currentQ.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                                {row.prevQuantity > 0 && <div className="text-[10px] text-slate-400">前: {row.prevQuantity.toLocaleString()}</div>}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-800">
                                                ¥{currentVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => removeRow(idx)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Note Editor Modal */}
            {editingNoteIndex !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 h-[600px]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800">编辑交易备注</h3>
                                <p className="text-xs text-slate-500">{rows[editingNoteIndex].name}</p>
                            </div>
                            <button onClick={() => setEditingNoteIndex(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-hidden">
                            <div className="flex-1 flex flex-col p-4 bg-white">
                                <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex justify-between items-center">
                                    <span>Markdown 编辑</span>
                                    <a href="https://markdown.com.cn/basic-syntax/" target="_blank" className="text-blue-500 hover:underline">语法参考</a>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-4 border border-slate-200 rounded-lg resize-none font-mono text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none shadow-inner bg-slate-50 text-slate-700"
                                    placeholder="# 记录交易理由...\n- 看好后市\n- 止盈离场"
                                    value={rows[editingNoteIndex].note}
                                    onChange={e => updateRow(editingNoteIndex, 'note', e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex-1 flex flex-col p-4 bg-slate-50/50">
                                <div className="text-xs font-bold text-slate-400 mb-2 uppercase">预览效果</div>
                                <div className="flex-1 overflow-y-auto prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 bg-white border border-slate-100 rounded-lg p-4">
                                    {rows[editingNoteIndex].note ? (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{rows[editingNoteIndex].note}</ReactMarkdown>
                                    ) : (
                                        <span className="text-slate-300 italic">暂无内容...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setEditingNoteIndex(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium shadow-lg shadow-slate-200">
                                完成
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Asset Modal */}
            {isCreatingAsset && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold text-lg mb-4">定义新资产</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">资产名称</label>
                                <input
                                    className="w-full border rounded px-3 py-2"
                                    value={newAssetName}
                                    onChange={e => setNewAssetName(e.target.value)}
                                    placeholder="如：贵州茅台"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">资产类型</label>
                                <select
                                    className="w-full border rounded px-3 py-2"
                                    value={newAssetType}
                                    onChange={e => setNewAssetType(e.target.value as AssetCategory)}
                                >
                                    <option value="security">股票/证券</option>
                                    <option value="fund">基金/ETF</option>
                                    <option value="wealth">银行理财</option>
                                    <option value="gold">贵金属/商品</option>
                                    <option value="fixed">现金/存款</option>
                                    <option value="crypto">加密货币</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setIsCreatingAsset(false)} className="px-4 py-2 text-slate-500">取消</button>
                            <button onClick={handleCreateNewAsset} className="px-4 py-2 bg-blue-600 text-white rounded">创建</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
