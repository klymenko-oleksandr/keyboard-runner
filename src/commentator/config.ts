export const COMMENTATOR_NAME = 'Таб Шифтович';
export const VENUE = 'автодромі «Чайка»';

/** Mandatory status report: who is where, gaps, time left */
export const STATUS_INTERVAL_SECONDS = 30;
/** "N characters before the finish" announcement */
export const APPROACH_CHARS = 30;
/** No status report this close to the flag: the results are a few seconds away anyway */
export const MIN_SECONDS_LEFT_FOR_STATUS = 5;

/** If nobody has said anything for this long, the commentator fills the silence with a joke or a fact */
export const FILLER_QUIET_SECONDS = 10;
export const FILLER_CHECK_MS = 1000;
