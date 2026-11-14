import React from 'react';
import {
  IMG_ENP_CLUB_LOGO,
  IMG_ENP_CREST_BANNER,
  IMG_ENP_SCHOOL_LOGO,
  resolveAssetUrl,
} from '../utils/assetUrls';

export const EDITED_ENP_CLUB_LOGO_URL = IMG_ENP_CLUB_LOGO;
export const EDITED_ENP_SCHOOL_LOGO_URL = IMG_ENP_SCHOOL_LOGO;
export const EDITED_ENP_CREST_BANNER_URL = IMG_ENP_CREST_BANNER;

interface ClubLogoBadgeProps {
  clubId?: string;
  customLogoUrl?: string;
  accentColor?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Displays the original ENP Chess Club emblem (Knight + flowing ribbons + Crowned 'P' + chessboard base)
 * edited to remove the text writings and graded onto the site's #061020 dark midnight navy theme.
 */
export const ClubLogoBadge: React.FC<ClubLogoBadgeProps> = ({
  customLogoUrl,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
    md: 'w-10 h-10 sm:w-11 sm:h-11 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-20 h-20 rounded-2xl',
  }[size];

  const resolvedSrc = resolveAssetUrl(customLogoUrl, IMG_ENP_CLUB_LOGO);

  return (
    <div
      className={`${sizeClasses} bg-[#061020] border border-[#26E6DE]/35 shadow-[0_4px_16px_rgba(0,0,0,0.65),inset_0_0_12px_rgba(38,230,222,0.12)] flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      title="Official ENP Chess Club Emblem"
    >
      <img
        src={resolvedSrc}
        alt="Official ENP Chess Club Emblem"
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover scale-105"
      />
    </div>
  );
};
