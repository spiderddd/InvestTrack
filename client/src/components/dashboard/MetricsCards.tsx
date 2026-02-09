
import React from 'react';
import { DollarSign, Activity, TrendingUp, Filter } from 'lucide-react';

interface MetricsCardsProps {
    viewMode: 'strategy' | 'total';
    timeRange: 'all' | 'ytd' | '1y';
    rangeConfig: { label: string };
    loading: boolean;
    endValue: number;
    endInvested: number;
    profit: number;
    returnRate: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
    viewMode, timeRange, rangeConfig, loading, endValue, endInvested, profit, returnRate
}) => {

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-sm font-medium">{viewMode === 'strategy' ? '期末策略市值' : '期末总资产'}</span>
                    <DollarSign className="text-rose-500" size={20} />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                    {loading ? <span className="text-slate-300 animate-pulse">...</span> : `¥${endValue.toLocaleString()}`}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-sm font-medium">期末总本金</span>
                    <Activity className="text-blue-500" size={20} />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                    {loading ? <span className="text-slate-300 animate-pulse">...</span> : `¥${endInvested.toLocaleString()}`}
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                {timeRange !== 'all' && <div className="absolute top-0 right-0 bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg">区间收益</div>}
                <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-sm font-medium">{timeRange === 'all' ? '历史累计盈亏' : `${rangeConfig.label}盈亏`}</span>
                    <TrendingUp className={profit >= 0 ? "text-rose-500" : "text-emerald-500"} size={20} />
                </div>
                {loading ? (
                    <div className="text-2xl font-bold text-slate-300 animate-pulse">...</div>
                ) : (
                    <>
                        <div className={`text-2xl font-bold ${profit >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                            <span>{timeRange === 'all' ? '累计回报率' : '区间回报率'}:</span>
                            <span className={`font-mono ${profit >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{profit >= 0 ? '+' : ''}{returnRate.toFixed(2)}%</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
