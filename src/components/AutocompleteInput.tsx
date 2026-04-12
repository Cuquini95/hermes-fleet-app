import { useState, useRef, useEffect, useCallback } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  id,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim() === ''
    ? []
    : suggestions
        .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8);

  const showDropdown = open && filtered.length > 0;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  const selectSuggestion = useCallback((suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  }, [onChange]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        selectSuggestion(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {showDropdown && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: 2,
          }}
          className="bg-white border border-border rounded-xl shadow-lg overflow-hidden"
          role="listbox"
        >
          {filtered.map((suggestion, i) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                // Use mousedown instead of click so it fires before the input's blur
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-3 py-2 text-sm text-text cursor-pointer select-none ${
                i === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
