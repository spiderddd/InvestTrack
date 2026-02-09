import React, { useState } from 'react';
import { LayoutDashboard, PieChart, History, Wallet, Wifi, Briefcase, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import StrategyManager from './components/StrategyManager';
import StatementManager from './components/StatementManager';
import { AssetManager } from './components/AssetManager';
import { ProjectGuide } from './components/ProjectGuide';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StorageService } from './services/storageService';
import { StrategyVersion, MonthlyStatementDetail, Asset } from '@shared/types';
import { DataProvider, useData } from './contexts/DataContext';

type View = 'dashboard' | 'strategy' | 'statements' | 'assets';

const AppContent: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [showGuide, setShowGuide] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Consume data from Context
  const {
    assets,
    strategies,
    monthlyStatements,
    isLoading,
    error,
    refreshAll,
    refreshAssets,
    refreshStrategies,
    refreshMonthlyStatements
  } = useData();

  // 错误处理辅助函数
  const handleError = (err: unknown, context: string) => {
    const message = err instanceof Error ? err.message : '操作失败，请重试';
    setActionError(`${context}: ${message}`);
    // 3秒后自动清除错误
    setTimeout(() => setActionError(null), 3000);
  };

  // Wrappers to refresh specific data after updates
  const handleUpdateStrategies = async (newVersions: StrategyVersion[]) => {
      try {
          setActionError(null);
          // Logic moved to Service to keep UI Component clean
          await StorageService.syncStrategies(strategies, newVersions);
          // Only refresh strategies, assets and monthlyStatements remain cached
          await refreshStrategies();
      } catch (err) {
          handleError(err, '保存策略失败');
          throw err;
      }
  };

  const handleUpdateMonthlyStatements = async (_newMonthlyStatements: MonthlyStatementDetail[]) => {
     try {
         setActionError(null);
         // This callback is usually triggered by bulk updates, currently we mostly use handleSaveMonthlyStatement
         await refreshMonthlyStatements();
     } catch (err) {
         handleError(err, '更新月度账单列表失败');
     }
  };

  const handleSaveMonthlyStatement = async (s: MonthlyStatementDetail) => {
    try {
        setActionError(null);
        await StorageService.saveMonthlyStatement(s);
        await refreshMonthlyStatements();
    } catch (err) {
        handleError(err, '保存月度账单失败');
        throw err;
    }
  };

  const handleCreateAsset = async (a: Partial<Asset>) => {
    try {
        setActionError(null);
        await StorageService.createAsset(a);
        await refreshAssets();
    } catch (err) {
        handleError(err, '创建资产失败');
        throw err;
    }
  };

  const handleEditAsset = async (id: string, a: Partial<Asset>) => {
    try {
        setActionError(null);
        const success = await StorageService.updateAsset(id, a);
        if (success) {
            await refreshAssets();
            // MonthlyStatements might contain asset names, so we refresh them too to ensure consistency
            await refreshMonthlyStatements();
        } else {
            throw new Error('更新资产失败');
        }
        return success;
    } catch (err) {
        handleError(err, '更新资产失败');
        throw err;
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
        setActionError(null);
        const success = await StorageService.deleteAsset(id);
        if (success) {
            await refreshAssets();
        } else {
            throw new Error('删除资产失败');
        }
        return success;
    } catch (err) {
        handleError(err, '删除资产失败');
        throw err;
    }
  };

  const getNavLabel = (view: View) => {
    switch (view) {
      case 'dashboard': return '仪表盘';
      case 'assets': return '资产库';
      case 'strategy': return '策略';
      case 'statements': return '记账';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <div className="text-sm">正在同步 后端 数据...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-4 p-6 text-center">
        <Wifi size={48} className="text-red-300" />
        <h2 className="text-lg font-bold text-slate-700">连接失败</h2>
        <p>{error}</p>
        <button onClick={refreshAll} className="px-4 py-2 bg-blue-600 text-white rounded-lg">重试</button>
      </div>
    );
  }

  // 操作错误提示组件
  const ActionErrorToast = () => {
    if (!actionError) return null;
    return (
      <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg max-w-md">
        <div className="flex items-center gap-2">
          <span className="font-medium">{actionError}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <ActionErrorToast />
      {/* Header (Desktop) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 hidden md:block">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Wallet className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              InvestTrack <span className="text-xs text-slate-300 font-normal ml-1">Personnel Edition</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex gap-1">
              {(['dashboard', 'assets', 'strategy', 'statements'] as View[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === view
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {getNavLabel(view)}
                </button>
              ))}
            </nav>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <BookOpen size={18} />
              <span>手册</span>
            </button>
          </div>
        </div>
      </header>

      {/* Header (Mobile) */}
      <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-10 px-4 h-14 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Wallet className="text-white" size={18} />
            </div>
            <span className="font-bold text-slate-800">InvestTrack</span>
          </div>
          <button onClick={() => setShowGuide(true)} className="text-slate-500">
            <BookOpen size={20} />
          </button>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-10">
        {activeView === 'dashboard' && (
          <Dashboard strategies={strategies} monthlyStatements={monthlyStatements} />
        )}
        {activeView === 'assets' && (
          <AssetManager 
            assets={assets}
            monthlyStatements={monthlyStatements}
            strategies={strategies}
            onUpdate={refreshAssets}
            onCreate={handleCreateAsset}
            onEdit={handleEditAsset}
            onDelete={handleDeleteAsset}
          />
        )}
        {activeView === 'strategy' && (
          <StrategyManager 
            strategies={strategies} 
            assets={assets}
            onUpdate={handleUpdateStrategies} 
          />
        )}
        {activeView === 'statements' && (
          <StatementManager 
            monthlyStatements={monthlyStatements} 
            strategies={strategies} 
            assets={assets}
            onUpdate={handleUpdateMonthlyStatements as any} 
            onSave={handleSaveMonthlyStatement as any}
            onCreateAsset={handleCreateAsset}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around pb-safe z-20">
        <button onClick={() => setActiveView('dashboard')} className={`p-4 ${activeView === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}><LayoutDashboard/></button>
        <button onClick={() => setActiveView('assets')} className={`p-4 ${activeView === 'assets' ? 'text-blue-600' : 'text-slate-400'}`}><Briefcase/></button>
        <button onClick={() => setActiveView('strategy')} className={`p-4 ${activeView === 'strategy' ? 'text-blue-600' : 'text-slate-400'}`}><PieChart/></button>
        <button onClick={() => setActiveView('statements')} className={`p-4 ${activeView === 'statements' ? 'text-blue-600' : 'text-slate-400'}`}><History/></button>
      </nav>
      
      <div className="h-20 md:hidden"></div>

      {/* Guide Modal */}
      {showGuide && <ProjectGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
};

// Main Entry Point wrapped in Provider and Error Boundary
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ErrorBoundary>
  );
};

export default App;
