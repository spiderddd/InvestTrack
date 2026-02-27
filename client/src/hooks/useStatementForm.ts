
import { useState } from 'react';
import { Asset, MonthlyStatement, MonthlyStatementDetail, AssetCategory, Position, StrategyVersion, StrategyLayer, StrategyTarget } from '@shared/types';
import { generateId, StorageService } from '../services/storageService';

export interface AssetRowInput {
  recordId: string;
  assetId?: string; 
  name: string;
  category: AssetCategory;
  price: string;
  transactionType: 'buy' | 'sell';
  quantityChange: string; 
  costChange: string; 
  prevQuantity: number;
  prevCost: number;
  note: string; // Add note support
}

export const useStatementForm = (
    monthlyStatements: MonthlyStatement[],
    assets: Asset[],
    activeStrategy: StrategyVersion | undefined | null
) => {
    const [date, setDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [note, setNote] = useState('');
    const [rows, setRows] = useState<AssetRowInput[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

    const initEntryForm = async (statementId?: string) => {
        setLoadingDetails(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        let baseDate = `${year}-${month}-${day}`;
        let baseNote = '';
        let initialRows: AssetRowInput[] = [];

        try {
            let existing: MonthlyStatementDetail | null = null;
            let prevDetails: MonthlyStatementDetail | null = null;

            if (statementId) {
                // Editing existing mode
                existing = await StorageService.getMonthlyStatement(statementId);
            }

            const refDate = existing ? existing.date : baseDate;
            
            // Optimization: Fetch previous statement (strictly before current month)
            try {
                const res = await fetch(`/api/statements/previous/${refDate}`);
                if (res.ok) {
                    const prevData = await res.json();
                    if (prevData && prevData.data && prevData.data.id) {
                        prevDetails = prevData.data;
                    }
                }
            } catch (err) {
                console.warn("Failed to fetch previous statement, falling back to defaults", err);
            }

            if (existing) {
                baseDate = existing.date;
                baseNote = existing.note || '';
                if (existing.assets) {
                    initialRows = existing.assets.map((p: Position) => {
                        const realAsset = assets.find(def => def.id === p.assetId);
                        const prevAsset = prevDetails?.assets?.find((pa: Position) => pa.assetId === p.assetId);
                        
                        const isSell = p.addedQuantity < 0 || p.addedPrincipal < 0;

                        return {
                            recordId: p.id,
                            assetId: p.assetId,
                            name: realAsset ? realAsset.name : p.name, 
                            category: realAsset ? realAsset.type : p.category, 
                            price: p.unitPrice.toString(),
                            transactionType: isSell ? 'sell' : 'buy',
                            quantityChange: Math.abs(p.addedQuantity).toString(),
                            costChange: Math.abs(p.addedPrincipal).toString(),
                            prevQuantity: prevAsset ? prevAsset.quantity : (p.quantity - p.addedQuantity),
                            prevCost: prevAsset ? prevAsset.totalCost : (p.totalCost - p.addedPrincipal),
                            note: p.note || ''
                        };
                    });
                }
            } else {
                // New Statement
                if (activeStrategy && activeStrategy.layers) {
                    const allTargets = activeStrategy.layers.flatMap((l: StrategyLayer) => l.items);

                    // Fetch current prices for all strategy assets
                    const strategyAssetIds = allTargets
                        .map((item: StrategyTarget) => item.assetId)
                        .filter((id: string) => id);

                    let priceMap: Record<string, { price: number; date: string }> = {};
                    if (strategyAssetIds.length > 0) {
                        try {
                            const priceRes = await fetch('/api/assets/latest_prices', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ assetIds: strategyAssetIds })
                            });
                            if (priceRes.ok) {
                                const parsed = await priceRes.json();
                                priceMap = parsed.data || {};
                            }
                        } catch (err) {
                            console.warn("Failed to fetch asset prices, using defaults", err);
                        }
                    }

                    allTargets.forEach((item: StrategyTarget) => {
                        const realAsset = assets.find((a: Asset) => a.id === item.assetId);
                        const prevAsset = prevDetails?.assets?.find((a: Position) => a.assetId === item.assetId);

                        // Use current price from API, fall back to prev statement price, then 0.0
                        const currentPrice = priceMap[item.assetId]?.price;
                        const prevPrice = prevAsset ? prevAsset.unitPrice : 0;

                        initialRows.push({
                            recordId: generateId(),
                            assetId: item.assetId,
                            name: realAsset ? realAsset.name : item.targetName,
                            category: realAsset ? realAsset.type : 'security',
                            price: currentPrice !== undefined ? currentPrice.toString() : (prevPrice > 0 ? prevPrice.toString() : '0.0'),
                            transactionType: 'buy',
                            quantityChange: '',
                            costChange: '',
                            prevQuantity: prevAsset ? prevAsset.quantity : 0,
                            prevCost: prevAsset ? prevAsset.totalCost : 0,
                            note: ''
                        });
                    });
                } else {
                    console.log('[StatementForm] No active strategy or no layers');
                }

                // Add assets held in previous month but not in strategy
                if (prevDetails && prevDetails.assets) {
                    prevDetails.assets.forEach((p: Position) => {
                        const alreadyAdded = initialRows.find(r => r.assetId === p.assetId);
                        if (!alreadyAdded) { 
                            const realAsset = assets.find(def => def.id === p.assetId);
                            initialRows.push({
                                recordId: generateId(),
                                assetId: p.assetId,
                                name: realAsset ? realAsset.name : p.name,
                                category: realAsset ? realAsset.type : p.category,
                                price: p.unitPrice.toString(),
                                transactionType: 'buy',
                                quantityChange: '',
                                costChange: '',
                                prevQuantity: p.quantity,
                                prevCost: p.totalCost,
                                note: ''
                            });
                        }
                    });
                }
            }

            setDate(baseDate);
            setNote(baseNote);
            setRows(initialRows);
            setSelectedStatementId(statementId || null);
        } catch (e) {
            console.error("Error loading statement details", e);
            alert("无法加载月度账单详情，请检查网络连接");
        } finally {
            setLoadingDetails(false);
        }
    };

    const updateRow = (index: number, field: 'price' | 'quantityChange' | 'costChange' | 'transactionType' | 'note', value: string) => {
        const newRows = [...rows];
        const row = newRows[index];
        
        if (field === 'transactionType') {
            row.transactionType = value as 'buy' | 'sell';
        } else {
            row[field] = value;
            if ((row.category === 'fixed' || row.category === 'wealth') && field === 'costChange') {
                row.quantityChange = value;
            }
        }
        setRows(newRows);
    };

    const addAssetRow = async (asset: Asset) => {
        if (rows.find(r => r.assetId === asset.id)) {
            alert("该资产已在列表中");
            return;
        }
        const isCashLike = asset.type === 'fixed' || asset.type === 'wealth';
        
        let fetchedPrice = '';
        if (!isCashLike) {
            try {
                const priceRes = await fetch('/api/assets/latest_prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assetIds: [asset.id] })
                });
                if (priceRes.ok) {
                    const parsed = await priceRes.json();
                    const priceData = parsed.data?.[asset.id];
                    if (priceData && priceData.price !== undefined && priceData.price !== null && priceData.price > 0) {
                        fetchedPrice = priceData.price.toString();
                    }
                }
            } catch (err) {
                console.warn("Failed to fetch asset price", err);
            }
        }

        setRows([
            ...rows,
            {
                recordId: generateId(),
                assetId: asset.id,
                name: asset.name,
                category: asset.type,
                price: isCashLike ? '1' : fetchedPrice,
                transactionType: 'buy',
                quantityChange: '',
                costChange: '',
                prevQuantity: 0, 
                prevCost: 0,
                note: ''
            }
        ]);
    };

    const removeRow = (index: number) => {
        if(confirm('移除此资产记录？(若该资产有持仓，移除意味着该月持仓归零)')) {
            const newRows = [...rows];
            newRows.splice(index, 1);
            setRows(newRows);
        }
    };

    const prepareSubmission = (): MonthlyStatementDetail => {
        const finalPositions: Position[] = rows.map(r => {
            const price = (r.category === 'fixed' || r.category === 'wealth') ? 1 : (parseFloat(r.price) || 0);
            const sign = r.transactionType === 'sell' ? -1 : 1;
            
            const qChangeAbs = parseFloat(r.quantityChange) || 0;
            const cChangeAbs = parseFloat(r.costChange) || 0;
            
            const qChange = qChangeAbs * sign;
            const cChange = cChangeAbs * sign;

            const newQuantity = r.prevQuantity + qChange;
            const newCost = r.prevCost + cChange;

            return {
                id: r.recordId,
                assetId: r.assetId || generateId(),
                name: r.name,
                category: r.category,
                unitPrice: price,
                quantity: newQuantity,
                marketValue: newQuantity * price,
                totalCost: newCost,
                addedPrincipal: cChange,
                addedQuantity: qChange,
                note: r.note
            };
        });

        const totalVal = finalPositions.reduce((sum: number, p: Position) => sum + p.marketValue, 0);
        const totalInv = finalPositions.reduce((sum: number, p: Position) => sum + p.totalCost, 0);

        return {
            id: selectedStatementId || generateId(),
            date,
            assets: finalPositions,
            totalValue: totalVal,
            totalInvested: totalInv,
            note: note
        };
    };

    return {
        date, setDate,
        note, setNote,
        rows,
        loadingDetails,
        selectedStatementId,
        initEntryForm,
        updateRow,
        addAssetRow,
        removeRow,
        prepareSubmission
    };
};
