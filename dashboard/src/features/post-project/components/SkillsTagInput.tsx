import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { SKILL_SUGGESTIONS } from '../options';

interface SkillsTagInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
  max?: number;
  error?: string;
}

export const SkillsTagInput: React.FC<SkillsTagInputProps> = ({
  skills = [],
  onChange,
  max = 8,
  error,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const addSkill = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    if (trimmed.length < 2 || trimmed.length > 24) {
      setInputError('Skill must be between 2 and 24 characters');
      return;
    }

    const lower = trimmed.toLowerCase();
    if (skills.some((s) => s.toLowerCase() === lower)) {
      setInputError('Skill already added');
      return;
    }

    if (skills.length >= max) {
      setInputError(`Maximum ${max} skills allowed`);
      return;
    }

    setInputError(null);
    onChange([...skills, trimmed]);
    setInputValue('');
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
    setInputError(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(inputValue);
    }
  };

  const remainingSuggestions = SKILL_SUGGESTIONS.filter(
    (s) => !skills.some((existing) => existing.toLowerCase() === s.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="skills-input" className="text-sm font-semibold text-text">
          Specific skills or libraries{' '}
          <span className="text-xs font-normal text-text-muted">
            ({skills.length}/{max})
          </span>
        </label>
        <span className="text-xs text-text-muted">Press Enter or comma to add</span>
      </div>

      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg border border-border bg-surface">
        {skills.map((skill, index) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-raised border border-border text-xs font-medium text-text"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(index)}
              className="text-text-muted hover:text-danger rounded-xs p-0.5"
              aria-label={`Remove ${skill}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {skills.length < max && (
          <input
            id="skills-input"
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addSkill(inputValue);
            }}
            placeholder={skills.length === 0 ? 'Type a skill (e.g. Pytest, Docker, WebSockets)...' : 'Add another...'}
            className="flex-1 min-w-[140px] bg-transparent border-none text-xs text-text placeholder:text-text-muted/60 focus:outline-none"
          />
        )}
      </div>

      {(error || inputError) && (
        <p className="text-xs text-danger font-medium">{error || inputError}</p>
      )}

      {/* Suggestion chips */}
      {skills.length < max && remainingSuggestions.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">
            Suggested:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {remainingSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => addSkill(suggestion)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-raised/60 hover:bg-surface-raised text-text-muted hover:text-text border border-border transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
