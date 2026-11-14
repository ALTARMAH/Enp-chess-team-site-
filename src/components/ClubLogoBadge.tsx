import React from 'react';

export const EDITED_ENP_CLUB_LOGO_URL =
  '/src/assets/images/enp_club_logo_edited_1794647762806.jpg';
export const EDITED_ENP_SCHOOL_LOGO_URL =
  '/src/assets/images/enp_school_logo_edited_1794647764981.jpg';
export const EDITED_ENP_CREST_BANNER_URL =
  '/src/assets/images/enp_club_crest_banner_edited_1794647765914.jpg';

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

  const isLegacyUneditedLogo = Boolean(
    !customLogoUrl ||
      customLogoUrl.includes('image_86d0bd89') ||
      customLogoUrl.includes('image_0e881c10') ||
      customLogoUrl.includes('image_939bef2c')
  );

  const resolvedSrc = isLegacyUneditedLogo
    ? EDITED_ENP_CLUB_LOGO_URL
    : customLogoUrl!;

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
