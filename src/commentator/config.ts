export const COMMENTATOR_NAME = 'Таб Шифтович';
export const VENUE = 'автодромі «Чайка»';

/** Mandatory status report: who is where, gaps, time left */
export const STATUS_INTERVAL_SECONDS = 30;
/** "N characters before the finish" announcement */
export const APPROACH_CHARS = 30;
/** No status report this close to the flag: the results are a few seconds away anyway */
export const MIN_SECONDS_LEFT_FOR_STATUS = 5;

/** Overtakes: quiet at the very start (everyone moves at once), then not more often than every few seconds */
export const OVERTAKE_GRACE_SECONDS = 5;
export const OVERTAKE_COOLDOWN_SECONDS = 6;
/** The same two drivers swapping places again and again is said once in this period */
export const OVERTAKE_PAIR_COOLDOWN_SECONDS = 15;

/** Two finishers closer than this = photo finish */
export const PHOTO_FINISH_MS = 1000;
/** Comeback = finished at least this many places higher than the worst position during the race */
export const COMEBACK_MIN_PLACES = 2;

/** If nobody has said anything for this long, the commentator fills the silence with a joke or a fact */
export const FILLER_QUIET_SECONDS = 10;
export const FILLER_CHECK_MS = 1000;
