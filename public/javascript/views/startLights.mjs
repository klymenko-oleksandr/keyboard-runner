// Formula 1 style start lights: 5 red lights come on one per second, then all go out = GO.
const LIGHTS_COUNT = 5;

const getLights = () => document.querySelectorAll('#start-lights .light');

export const setLightsOn = count => {
	getLights().forEach((light, index) => light.classList.toggle('on', index < count));
};

/** How many lights are on when `secondsLeft` remain: 5 s -> 1 light ... 1 s -> 5 lights, then they hold */
export const getLightsForSecondsLeft = secondsLeft =>
	Math.max(0, Math.min(LIGHTS_COUNT, LIGHTS_COUNT + 1 - secondsLeft));

export const lightsOut = () => setLightsOn(0);
