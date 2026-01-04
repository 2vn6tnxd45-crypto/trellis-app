// src/features/ratings/components/StarRating.jsx
// ============================================
// STAR RATING COMPONENT
// ============================================
// Reusable interactive star rating input

import React, { useState } from 'react';
import { Star } from 'lucide-react';

export const StarRating = ({ 
    value = 0, 
    onChange, 
    size = 'md',
    readonly = false,
    showValue = false,
    label = null
}) => {
    const [hoverValue, setHoverValue] = useState(0);
    
    const sizes = {
        sm: { star: 16, gap: 'gap-0.5' },
        md: { star: 24, gap: 'gap-1' },
        lg: { star: 32, gap: 'gap-1.5' },
        xl: { star: 40, gap: 'gap-2' }
    };
    
    const { star: starSize, gap } = sizes[size] || sizes.md;
    
    const handleClick = (rating) => {
        if (!readonly && onChange) {
            onChange(rating);
        }
    };
    
    const handleMouseEnter = (rating) => {
        if (!readonly) {
            setHoverValue(rating);
        }
    };
    
    const handleMouseLeave = () => {
        setHoverValue(0);
    };
    
    const displayValue = hoverValue || value;
    
    return (
        <div className="inline-flex flex-col">
            {label && (
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                    {label}
                </span>
            )}
            <div 
                className={`inline-flex items-center ${gap}`}
                onMouseLeave={handleMouseLeave}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => handleClick(star)}
                        onMouseEnter={() => handleMouseEnter(star)}
                        disabled={readonly}
                        className={`transition-transform ${
                            !readonly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'
                        }`}
                    >
                        <Star
                            size={starSize}
                            className={`transition-colors ${
                                star <= displayValue
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-transparent text-slate-300'
                            }`}
                        />
                    </button>
                ))}
                
                {showValue && value > 0 && (
                    <span className="ml-2 text-slate-600 font-bold">
                        {value.toFixed(1)}
                    </span>
                )}
            </div>
        </div>
    );
};

// ============================================
// RATING DISPLAY (Read-only with count)
// ============================================
export const RatingDisplay = ({ 
    rating, 
    reviewCount = 0, 
    size = 'sm',
    showCount = true 
}) => {
    if (!rating && rating !== 0) return null;
    
    const sizes = {
        xs: { star: 12, text: 'text-xs' },
        sm: { star: 14, text: 'text-sm' },
        md: { star: 18, text: 'text-base' },
        lg: { star: 24, text: 'text-lg' }
    };
    
    const { star: starSize, text } = sizes[size] || sizes.sm;
    
    // Calculate full, half, and empty stars
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
        <div className="inline-flex items-center gap-1">
            <div className="flex items-center">
                {/* Full stars */}
                {[...Array(fullStars)].map((_, i) => (
                    <Star 
                        key={`full-${i}`} 
                        size={starSize} 
                        className="fill-amber-400 text-amber-400" 
                    />
                ))}
                
                {/* Half star */}
                {hasHalfStar && (
                    <div className="relative" style={{ width: starSize, height: starSize }}>
                        <Star 
                            size={starSize} 
                            className="absolute fill-transparent text-slate-300" 
                        />
                        <div className="absolute overflow-hidden" style={{ width: starSize / 2 }}>
                            <Star 
                                size={starSize} 
                                className="fill-amber-400 text-amber-400" 
                            />
                        </div>
                    </div>
                )}
                
                {/* Empty stars */}
                {[...Array(emptyStars)].map((_, i) => (
                    <Star 
                        key={`empty-${i}`} 
                        size={starSize} 
                        className="fill-transparent text-slate-300" 
                    />
                ))}
            </div>
            
            <span className={`font-bold text-slate-700 ${text}`}>
                {rating.toFixed(1)}
            </span>
            
            {showCount && reviewCount > 0 && (
                <span className={`text-slate-400 ${text}`}>
                    ({reviewCount})
                </span>
            )}
        </div>
    );
};

// ============================================
// CATEGORY RATING INPUT
// ============================================
export const CategoryRatingInput = ({
    categories,
    values,
    onChange,
    size = 'md'
}) => {
    const handleCategoryChange = (category, rating) => {
        onChange({
            ...values,
            [category]: rating
        });
    };
    
    return (
        <div className="space-y-4">
            {categories.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-700">{label}</p>
                        {description && (
                            <p className="text-xs text-slate-500">{description}</p>
                        )}
                    </div>
                    <StarRating
                        value={values[key] || 0}
                        onChange={(rating) => handleCategoryChange(key, rating)}
                        size={size}
                    />
                </div>
            ))}
        </div>
    );
};

export default StarRating;
