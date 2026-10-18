import React, { useState } from 'react';
import { CollaboratorUser } from '../types/subtitle';
import { User, X, Check, ExternalLink } from 'lucide-react';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { id: string; name: string; color: string; avatar?: string };
  onUpdateUser: (user: { id: string; name: string; color: string; avatar?: string }) => void;
  collaborators: CollaboratorUser[];
}

const COLLABORATOR_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  collaborators,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [color, setColor] = useState(currentUser.color);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onUpdateUser({
      ...currentUser,
      name: name.trim(),
      color,
    });
    onClose();
  };

  const openSimulatedTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
      <div
        className="w-full max-w-sm crystal-glass rounded-2xl shadow-2xl overflow-hidden font-sans text-xs transition-colors duration-200"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 20px var(--accent-glow)',
          borderColor: 'var(--border-glass)',
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-10 px-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-2xs"
              style={{ backgroundColor: color }}
            >
              {name.charAt(0).toUpperCase() || 'U'}
            </span>
            <span className="font-semibold text-[var(--text-main)]">Collaborator Profile & Login</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-main)] p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              Your Name / Handle
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex (Editor)"
              className="w-full px-2 py-1 bg-[var(--bg-app)] border border-[var(--border)] focus:border-blue-500 outline-hidden font-medium text-[var(--text-main)]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
              Presence Cursor Color
            </label>
            <div className="flex items-center gap-1.5">
              {COLLABORATOR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-neutral-400' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Active Collaborators */}
          <div className="pt-2 border-t border-[var(--border-light)]">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1.5 uppercase">
              <span>Online Collaborators ({collaborators.length})</span>
              <span className="text-emerald-500 font-bold">● Active</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1 px-1.5 bg-[var(--bg-app)] text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-medium text-[var(--text-main)]">
                      {c.name} {c.id === currentUser.id ? '(You)' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={openSimulatedTab}
              className="w-full mt-2 py-1 px-2 border border-dashed border-[var(--border)] hover:border-[var(--text-muted)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Test Multi-User (Open 2nd Tab)
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-light)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1 text-[11px] font-medium bg-[var(--text-main)] text-[var(--bg-surface)] hover:opacity-90 transition-opacity"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
