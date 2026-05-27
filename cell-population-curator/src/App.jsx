import { useState, useEffect, useMemo } from 'react';
import originalData from './assets/populations.json';

export default function App() {
  const [data, setData] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftGroup, setDraftGroup] = useState('');

  // Novos estados para a criação de grupo
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Load data
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cell_curation_data');
      if (saved) {
        const parsedData = JSON.parse(saved);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          setData(parsedData);
          return;
        }
      }
      if (Array.isArray(originalData)) {
        setData(originalData);
      } else {
        throw new Error("The populations.json file is not a valid array.");
      }
    } catch (err) {
      console.error("Error loading data:", err);
      localStorage.removeItem('cell_curation_data');
      setData(originalData);
    }
  }, []);

  // Save progress (Local & File via Vite API se configurado)
  useEffect(() => {
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem('cell_curation_data', JSON.stringify(data));

      // Tentativa de salvar no arquivo real (falha silenciosamente se o plugin não estiver ativo)
      fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 4)
      }).catch(() => { });
    }
  }, [data]);

  // Lista dinâmica de grupos (inclui originais + novos criados durante a sessão)
  const allGroups = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const groups = new Set();
    data.forEach(item => {
      groups.add(item.grupoOriginal);
      groups.add(item.grupoAtual); // Adiciona os grupos criados na hora
    });
    return Array.from(groups).sort();
  }, [data]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "reviewed_populations.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGroupSelect = (groupName) => {
    setSelectedGroup(groupName);
    setCurrentIndex(0);
    setIsCreatingNewGroup(false);
    setView('review');
  };

  const currentItems = data.filter(d => d.grupoAtual === selectedGroup);
  const currentCard = currentItems[currentIndex];

  useEffect(() => {
    if (currentCard) {
      setDraftGroup(currentCard.grupoAtual);
      setIsCreatingNewGroup(false);
      setNewGroupName('');
    }
  }, [currentIndex, currentCard]);

  const advanceCard = () => {
    if (currentIndex < currentItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const previousCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const saveAndAdvance = () => {
    // Se estiver a criar um novo grupo, valida e usa o nome novo. Senão, usa o da combobox.
    let targetGroup = draftGroup;

    if (isCreatingNewGroup) {
      const cleanedName = newGroupName.trim();
      if (!cleanedName) {
        alert("Please enter a valid group name.");
        return;
      }
      targetGroup = cleanedName;
    }

    const isMovingToAnotherGroup = targetGroup !== selectedGroup;

    setData(prev => prev.map(item => {
      if (item.id === currentCard.id) {
        return {
          ...item,
          grupoAtual: targetGroup,
          status: targetGroup === item.grupoOriginal ? 'confirmed' : 'altered'
        };
      }
      return item;
    }));

    setIsCreatingNewGroup(false);
    setNewGroupName('');

    if (!isMovingToAnotherGroup) {
      advanceCard();
    } else {
      if (currentIndex > 0 && currentIndex >= currentItems.length - 1) {
        setCurrentIndex(prev => prev - 1);
      }
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center border border-red-200 max-w-md w-full">
          <h2 className="text-red-600 text-2xl font-black mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-2xl font-bold text-indigo-400">Loading data...</div>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: DASHBOARD
  // ==========================================
  if (view === 'dashboard') {
    const groupsStats = allGroups.map(group => {
      const items = data.filter(d => d.grupoAtual === group);
      return {
        name: group,
        total: items.length,
        pending: items.filter(d => d.status === 'pendente').length,
        reviewed: items.filter(d => d.status !== 'pendente').length
      };
    }).filter(g => g.total > 0 || data.some(d => d.grupoOriginal === g));

    return (
      <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-gray-300 pb-8 gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
                🧬 Population Curation
              </h1>
              <p className="text-slate-500 mt-3 text-lg">Select a group to start reviewing definitions.</p>
            </div>
            <button onClick={exportData} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl shadow-lg font-bold text-lg transition transform hover:-translate-y-1 focus:ring-4 focus:ring-slate-300">
              ↓ Export JSON
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {groupsStats.map(stat => {
              const isEmpty = stat.total === 0;
              const isComplete = stat.pending === 0 && !isEmpty;
              const percentage = isEmpty ? 100 : Math.round((stat.reviewed / stat.total) * 100);

              return (
                <div
                  key={stat.name}
                  onClick={() => handleGroupSelect(stat.name)}
                  className={`border-2 rounded-3xl p-8 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[200px] ${isEmpty ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-indigo-400'}`}
                >
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 line-clamp-2">{stat.name}</h2>
                  <div className="flex justify-between items-end">
                    <div className="text-base space-y-2">
                      <span className="block font-medium text-slate-500">Total: {stat.total} cards</span>
                      {isEmpty ?
                        <span className="text-slate-400 font-bold text-lg">Empty Group</span> :
                        isComplete ?
                          <span className="text-emerald-600 font-bold flex items-center gap-2 text-lg">✓ Completed</span> :
                          <span className="text-amber-500 font-bold text-lg">{stat.pending} remaining</span>
                      }
                    </div>
                    <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-lg font-bold shadow-sm"
                      style={{
                        borderColor: isEmpty ? '#cbd5e1' : (isComplete ? '#10b981' : '#f59e0b'),
                        backgroundColor: isEmpty ? '#f1f5f9' : (isComplete ? '#ecfdf5' : '#fffbeb'),
                        color: isEmpty ? '#94a3b8' : (isComplete ? '#047857' : '#b45309')
                      }}>
                      {percentage}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: FLASHCARD REVIEW
  // ==========================================
  const renderGroupSelection = () => {
    if (isCreatingNewGroup) {
      return (
        <div className="flex gap-3">
          <input
            type="text"
            autoFocus
            className="flex-grow bg-white border-2 border-indigo-400 text-slate-900 text-xl font-bold rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none block p-5 shadow-inner"
            placeholder="Type new group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <button
            onClick={() => setIsCreatingNewGroup(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-6 rounded-2xl transition"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="flex-grow bg-white border-2 border-slate-300 text-slate-900 text-xl font-medium rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 block p-5 transition-all cursor-pointer shadow-sm"
          value={draftGroup}
          onChange={(e) => setDraftGroup(e.target.value)}
        >
          {allGroups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button
          onClick={() => setIsCreatingNewGroup(true)}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-6 py-4 rounded-2xl transition whitespace-nowrap border-2 border-indigo-200"
        >
          + New Group
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col h-full">
        <header className="mb-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button onClick={() => setView('dashboard')} className="text-indigo-700 hover:text-indigo-900 font-bold text-lg flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 px-6 py-3 rounded-xl transition w-full sm:w-auto justify-center">
            ← Back to Menu
          </button>
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Reviewing Group</p>
            <h1 className="text-2xl font-black text-slate-800 truncate max-w-xs sm:max-w-md">{selectedGroup}</h1>
          </div>
        </header>

        <div className="flex-grow flex flex-col justify-center pb-12">
          {currentCard ? (
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-8 sm:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-2 bg-slate-100 w-full">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                  style={{ width: `${((currentIndex + 1) / currentItems.length) * 100}%` }}>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center mb-8 mt-4 gap-4">
                <span className="bg-slate-100 text-slate-600 px-5 py-2 rounded-full text-sm font-black tracking-wide border border-slate-200">
                  Card {currentIndex + 1} of {currentItems.length}
                </span>

                <div className="flex gap-2">
                  {currentCard.status === 'confirmed' && <span className="text-emerald-700 bg-emerald-50 border-2 border-emerald-700 px-5 py-2 rounded-full text-sm font-black tracking-wide shadow-sm">✓ Confirmed</span>}
                  {currentCard.status === 'altered' && <span className="text-blue-700 bg-blue-50 border-2 border-blue-600 px-5 py-2 rounded-full text-sm font-black tracking-wide shadow-sm">🔄 Changed</span>}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-12 mb-6 shadow-inner">
                <p className="text-slate-800 font-medium text-2xl sm:text-3xl leading-relaxed break-words text-center">
                  {currentCard.definicao}
                </p>
              </div>

              {currentCard.grupoOriginal !== currentCard.grupoAtual && (
                <div className="mb-6 text-center">
                  <span className="text-sm font-medium text-slate-500">Originally from: </span>
                  <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{currentCard.grupoOriginal}</span>
                </div>
              )}

              <div className="mb-12">
                <label className="block text-slate-500 font-bold mb-4 text-sm uppercase tracking-widest">This card belongs to the group:</label>
                {renderGroupSelection()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={previousCard}
                  disabled={currentIndex === 0}
                  className={`py-4 px-6 rounded-2xl font-bold text-lg transition-all border ${currentIndex === 0 ? 'bg-slate-200 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 shadow-sm hover:bg-slate-50 active:scale-95'}`}
                >
                  Previous
                </button>

                <button
                  onClick={advanceCard}
                  disabled={currentIndex === currentItems.length - 1}
                  className={`py-4 px-6 rounded-2xl font-bold text-lg transition-all border ${currentIndex === currentItems.length - 1 ? 'bg-slate-200 text-slate-400 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 shadow-sm hover:bg-slate-50 active:scale-95'}`}
                >
                  Skip
                </button>

                <button
                  onClick={saveAndAdvance}
                  className="py-4 px-6 rounded-2xl font-bold text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95 border border-transparent"
                >
                  {(draftGroup === selectedGroup && !isCreatingNewGroup) ? '✅ Confirm' : '↪️ Move Card'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-[2rem] shadow-2xl border border-slate-200">
              <div className="text-7xl mb-6 animate-bounce">🎉</div>
              <h2 className="text-4xl font-black text-slate-800 mb-4">Group empty or completed!</h2>
              <p className="text-slate-500 text-xl mb-10">There are no more cards to review here.</p>
              <button
                onClick={() => setView('dashboard')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 active:scale-95"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}