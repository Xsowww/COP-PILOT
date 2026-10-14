// The app used to be called COP-PILOT and its assistant Copilot. Lowercase « cop-pilot » is left
// alone on purpose: it is what links to the site look like.
const OLD_NAME = /COP-PILOT|Cop-Pilot|COPILOT|Copilot/g;

export const toKompa = (text: string) => text.replace(OLD_NAME, 'Kompa');
