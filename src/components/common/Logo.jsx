// src/components/common/Logo.jsx
import React from 'react';

export const Logo = ({ className = "h-24 w-24" }) => (
    <img 
        src={`data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
          <path d="M50 10L15 40V90H85V40L50 10Z" stroke="#0ea5e9" stroke-width="8" stroke-linejoin="round" fill="none"/>
          <circle cx="50" cy="50" r="10" fill="#0c4a6e"/>
          <rect x="46" y="55" width="8" height="25" rx="2" fill="#0c4a6e"/>
          <rect x="54" y="65" width="6" height="4" fill="#0c4a6e"/>
          <rect x="54" y="72" width="4" height="4" fill="#0c4a6e"/>
          <circle cx="50" cy="50" r="3" fill="white"/>
        </svg>
        `)}`} 
        alt="HausKey Logo" 
        className={className} 
    />
);
