import React, { useState, useCallback } from 'react';
import './SearchBar.css';

export default function SearchBar({ onSearch, initialValue = '' }) {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    onSearch(value.trim());
  }, [value, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <div className="search-bar__inner">
        <span className="search-bar__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="10.25" y1="10.25" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </span>
        <input
          className="search-bar__input"
          type="search"
          name="q"
          placeholder="Search debates…"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoComplete="off"
          spellCheck="false"
        />
        {value && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      <button type="submit" className="search-bar__submit">
        Search
      </button>
    </form>
  );
}
