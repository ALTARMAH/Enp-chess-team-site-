import blitzArenaAndroidBanner from '../assets/images/blitz_arena_android_banner_1794646312387.jpg';
import chessCampusRadarBg from '../assets/images/chess_campus_radar_bg_1794624760543.jpg';
import chessMembersHallBg from '../assets/images/chess_members_hall_bg_1794624757745.jpg';
import chessStudioEngineBg from '../assets/images/chess_studio_engine_bg_1794624758871.jpg';
import chessTournamentArenaBg from '../assets/images/chess_tournament_arena_bg_1794624760248.jpg';
import enpClubCrestBannerEdited from '../assets/images/enp_club_crest_banner_edited_1794647765914.jpg';
import enpClubLogoEdited from '../assets/images/enp_club_logo_edited_1794647762806.jpg';
import enpCourtyardRadarBanner from '../assets/images/enp_courtyard_radar_banner_1794646305288.jpg';
import enpSchoolLogoEdited from '../assets/images/enp_school_logo_edited_1794647764981.jpg';
import enpTwilightFacadeBanner from '../assets/images/enp_twilight_facade_banner_1794646311361.jpg';
import fischerReykjavikBanner from '../assets/images/fischer_reykjavik_1972_banner_1794646302475.jpg';
import kasparovDeepBlueBanner from '../assets/images/kasparov_deep_blue_banner_1794646309429.jpg';
import kasparovDeepBlueCleanBanner from '../assets/images/kasparov_deep_blue_clean_banner_1794646485182.jpg';
import kasparovKarpovCleanBanner from '../assets/images/kasparov_karpov_clean_banner_1794646486069.jpg';
import kasparovKarpovRivalryBanner from '../assets/images/kasparov_karpov_rivalry_banner_1794646307839.jpg';
import mikhailTalBrilliantHero from '../assets/images/mikhail_tal_brilliant_1794618787096.jpg';

export const IMG_ENP_CLUB_LOGO = enpClubLogoEdited;
export const IMG_ENP_SCHOOL_LOGO = enpSchoolLogoEdited;
export const IMG_ENP_CREST_BANNER = enpClubCrestBannerEdited;
export const IMG_MIKHAIL_TAL_HERO = mikhailTalBrilliantHero;
export const IMG_ENP_TWILIGHT_BANNER = enpTwilightFacadeBanner;
export const IMG_KASPAROV_DEEP_BLUE_BANNER = kasparovDeepBlueCleanBanner;
export const IMG_KASPAROV_KARPOV_BANNER = kasparovKarpovCleanBanner;
export const IMG_FISCHER_REYKJAVIK_BANNER = fischerReykjavikBanner;
export const IMG_BLITZ_ARENA_BANNER = blitzArenaAndroidBanner;
export const IMG_ENP_COURTYARD_BANNER = enpCourtyardRadarBanner;
export const IMG_CHESS_MEMBERS_HALL_BG = chessMembersHallBg;

const BUNDLED_ASSET_MAP: Record<string, string> = {
  'blitz_arena_android_banner_1794646312387.jpg': blitzArenaAndroidBanner,
  'chess_campus_radar_bg_1794624760543.jpg': chessCampusRadarBg,
  'chess_members_hall_bg_1794624757745.jpg': chessMembersHallBg,
  'chess_studio_engine_bg_1794624758871.jpg': chessStudioEngineBg,
  'chess_tournament_arena_bg_1794624760248.jpg': chessTournamentArenaBg,
  'enp_club_crest_banner_edited_1794647765914.jpg': enpClubCrestBannerEdited,
  'enp_club_logo_edited_1794647762806.jpg': enpClubLogoEdited,
  'enp_courtyard_radar_banner_1794646305288.jpg': enpCourtyardRadarBanner,
  'enp_school_logo_edited_1794647764981.jpg': enpSchoolLogoEdited,
  'enp_twilight_facade_banner_1794646311361.jpg': enpTwilightFacadeBanner,
  'fischer_reykjavik_1972_banner_1794646302475.jpg': fischerReykjavikBanner,
  'kasparov_deep_blue_banner_1794646309429.jpg': kasparovDeepBlueBanner,
  'kasparov_deep_blue_clean_banner_1794646485182.jpg': kasparovDeepBlueCleanBanner,
  'kasparov_karpov_clean_banner_1794646486069.jpg': kasparovKarpovCleanBanner,
  'kasparov_karpov_rivalry_banner_1794646307839.jpg': kasparovKarpovRivalryBanner,
  'mikhail_tal_brilliant_1794618787096.jpg': mikhailTalBrilliantHero,
  // Legacy AI Studio deleted screenshot filenames -> bundled equivalents
  'image_86d0bd89.png': enpClubLogoEdited,
  'image_0e881c10.png': enpClubLogoEdited,
  'image_939bef2c.png': enpClubCrestBannerEdited,
  'image_2c67fe86.png': enpSchoolLogoEdited,
  'image_e60d3b76.png': enpClubCrestBannerEdited,
};

/**
 * Resolves any stored or legacy image URL (including `/src/assets/images/...` cached in Firestore or localStorage)
 * to its production Vite-bundled URL so images work identically on dev and Vercel production builds.
 */
export function resolveAssetUrl(url?: string | null, fallback = ''): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Extract filename cleanly (handles `/src/assets/images/foo.jpg`, `/assets/aistudio/image_xxx.png`, etc.)
  const cleanNoQuery = trimmed.split('?')[0].split('#')[0];
  const fileName = cleanNoQuery.split('/').pop() || '';
  if (fileName && BUNDLED_ASSET_MAP[fileName]) {
    return BUNDLED_ASSET_MAP[fileName];
  }

  // Any leftover unbundled `/src/assets/...` or `/assets/aistudio/...` path should use fallback instead of 404ing
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('src/assets/') ||
    trimmed.startsWith('/assets/aistudio/')
  ) {
    return fallback;
  }

  return trimmed;
}
