// Web-optimized image variants live in assets/{cards,wallpapers}/web as
// downscaled progressive JPEGs (~100KB vs the 2-5MB print-resolution PNGs).
// The full-resolution originals stay in the repo for print/export use.

export function cardImg(card) {
  return '/' + card.image.replace('assets/cards/', 'assets/cards/web/').replace(/\.png$/, '.jpg');
}

export function wallpaperUrl(name) {
  return `/assets/wallpapers/web/${name}.jpg`;
}

export const CARD_BACK = '/assets/cards/web/card-back.jpg';
