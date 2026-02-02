import React, { useState, useEffect } from 'react';
import { leaderboardAPI } from '../api';

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const res = await leaderboardAPI.get();
      setEntries(res.data);
    } catch (err) {
      console.error('Leaderboard fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const maxKarma = entries.length > 0 ? Math.max(...entries.map(e => e.karma)) : 1;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-orange-500 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🏆</span>
          <h3 className="text-white font-bold text-sm">Leaderboard</h3>
        </div>
        <span className="text-white/90 text-xs">24h</span>
      </div>

      <div className="p-2.5">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-xs">No karma yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry, index) => {
              const barWidth = (entry.karma / maxKarma) * 100;
              const medals = ['🥇', '🥈', '🥉'];
              const colors = ['bg-yellow-400', 'bg-gray-300', 'bg-orange-400'];

              return (
                <div
                  key={entry.user_id}
                  className="hover:bg-gray-50 rounded-lg p-2 transition-all animate-fadeIn"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full ${colors[index] || 'bg-blue-400'} flex items-center justify-center text-sm flex-shrink-0`}>
                      {medals[index] || <span className="text-white text-xs font-bold">{index + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-gray-900 truncate text-xs">
                          {entry.username}
                        </span>
                        <span className="text-orange-600 font-bold text-xs">
                          {entry.karma}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[index] || 'bg-blue-400'} transition-all duration-700 rounded-full`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Auto-refreshes every 30s
          </p>
        </div>
      </div>
    </div>
  );
}