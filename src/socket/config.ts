export const MAXIMUM_USERS_FOR_ONE_ROOM = 5;
export const SECONDS_TIMER_BEFORE_START_GAME = 5;
export const SECONDS_FOR_GAME = 60;

// "Lights out" like in Formula 1: after the countdown all 5 start lights stay on for a random moment,
// so nobody can predict the exact start. Added on top of SECONDS_TIMER_BEFORE_START_GAME.
export const START_LIGHTS_HOLD_MS = { MIN: 300, MAX: 2000 };
