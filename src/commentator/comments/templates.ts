// One pure function per comment type: payload in, text out.
// The phrasing avoids past-tense verbs about drivers: in Ukrainian they would need the driver's gender.
import { take } from 'lodash';
import { COMMENTATOR_NAME, VENUE } from '../config';
import { sentences } from '../helpers/text';
import { getGap, getProgressPercent } from '../helpers/standings';
import {
	characters,
	drivers,
	formatRaceTime,
	joinWithOr,
	placeWord,
	positionWord,
	races,
	seconds,
	wins,
} from '../helpers/ukrainian';
import type { GameResultDto } from '../../socket/types';
import type { DriverProfile, Standing, Templates } from '../types';

/* ---------- Pieces ---------- */

const describeRecord = ({ races: count, wins: winsCount, bestWpm }: DriverProfile) => {
	if (count === 0) {
		return 'Це дебютна гонка!';
	}
	const winsPart = winsCount > 0 ? `, із них ${wins(winsCount)}` : '';
	const speedPart = bestWpm > 0 ? `, найкраща швидкість — ${bestWpm} WPM` : '';
	return `На рахунку ${races(count)}${winsPart}${speedPart}.`;
};

const describeDriver = (driver: DriverProfile, gridNumber: number) =>
	sentences(
		`Під номером ${gridNumber} — ${driver.username} на ${driver.car.color} ${driver.car.brand} з номером ${driver.car.number} на борту.`,
		describeRecord(driver),
	);

const describeChaser = (leader: Standing, textLength: number) => (standing: Standing, index: number) => {
	const position = positionWord(index + 2);
	if (standing.finished) {
		return `на ${position} позиції ${standing.username}, вже на фініші`;
	}
	const gap = getGap(leader, standing);
	return gap === 0
		? `на ${position} позиції ${standing.username}, пліч-о-пліч із лідером`
		: `на ${position} позиції ${standing.username} (${getProgressPercent(standing, textLength)}%), відставання ${characters(gap)}`;
};

const describeResult = (result: GameResultDto) =>
	result.finished && result.finishTimeMs !== null
		? `${result.username} (${formatRaceTime(result.finishTimeMs)}, ${result.wpm} WPM)`
		: `${result.username} (${result.progress}% дистанції)`;

/* ---------- Templates ---------- */

export const templates: Templates = {
	greeting: ({ roomName, weather }, { pick }) =>
		sentences(
			pick([
				`Добрий день, шановні глядачі! На ${VENUE} сьогодні ${weather}, двигуни гарчать, а гонщики нервово розминають пальці.`,
				`Вітаю всіх, хто з нами в ефірі! На ${VENUE} ${weather}, трибуни повні, клавіатури прогріті.`,
				`Доброго вам дня, панове! Погода на ${VENUE} така: ${weather}. А атмосфера на трасі просто чудова!`,
			]),
			`Коментувати заїзд у кімнаті «${roomName}» для вас буду я, ${COMMENTATOR_NAME}.`,
		),

	lineup: ({ driver, gridNumber, driversCount }) =>
		sentences(
			driversCount === 1 && 'Сьогодні на трасі лише один гонщик. Змагання з самим собою — найчесніше!',
			driversCount > 1 && gridNumber === 1 && `А тепер стартова решітка: сьогодні на трасі ${drivers(driversCount)}.`,
			describeDriver(driver, gridNumber),
		),

	start: ({ seconds: raceSeconds, driversCount }, { pick }) =>
		sentences(
			pick(['Вогні згасли, і гонку розпочато!', 'Старт! Поїхали!', 'Вогні згасли! Гонщики рвуть зі старту!']),
			driversCount > 1
				? `На все про все ${seconds(raceSeconds)}.`
				: `${seconds(raceSeconds)} наодинці з текстом. Головне — не поспішати з помилками.`,
		),

	status: ({ standings, textLength, secondsLeft }) => {
		const [leader, ...chasers] = standings;
		const timeLeft = `До кінця гонки ${seconds(secondsLeft)}.`;

		if (chasers.length === 0) {
			return sentences(
				timeLeft,
				`${leader.username} має позаду ${getProgressPercent(leader, textLength)}% дистанції. Тримаємо темп!`,
			);
		}

		const leaderState = leader.finished ? 'вже на фініші' : `${getProgressPercent(leader, textLength)}%`;
		return sentences(
			timeLeft,
			`Попереду ${leader.username} (${leaderState});`,
			chasers.map(describeChaser(leader, textLength)).join('; ') + '.',
		);
	},

	approaching: ({ standings, username, charsLeft, isFirst }) => {
		if (!isFirst) {
			return `${username} теж виходить на фінішну пряму: лишилось ${characters(charsLeft)}.`;
		}

		const others = standings.filter(standing => standing.username !== username && !standing.finished);
		const contenders = take(others, 2).map(standing => standing.username);

		return sentences(
			`До фінішу зовсім небагато, і на фінішну пряму виходить ${username}: лишилось ${characters(charsLeft)}!`,
			contenders.length === 0 && 'Залишилось лише дотиснути!',
			contenders.length === 1 && `Друге місце поки за ${contenders[0]}.`,
			contenders.length > 1 && `Друге місце може дістатися ${joinWithOr(contenders)}. Але давайте дочекаємось фінішу.`,
		);
	},

	finish: ({ username, place, finishTimeMs, isLast }) => {
		const time = formatRaceTime(finishTimeMs);
		if (place === 1) {
			return `Фінішну пряму перетинає ${username}, і це перше місце! Час: ${time}.`;
		}
		if (isLast) {
			return `Круг завершує ${username}: ${placeWord(place)} місце, ${time}. Усі гонщики на фініші!`;
		}
		return `Фінішну пряму перетинає ${username}: ${placeWord(place)} місце, ${time}.`;
	},

	retired: ({ username, isRaceRunning }) =>
		isRaceRunning
			? `${username} заїжджає в бокси й сходить з дистанції. Шкода, але гонка триває!`
			: `${username} покидає стартову решітку ще до старту.`,

	results: ({ results }) => {
		const podium = take(results, 3).map(result => `${placeWord(result.place)} місце — ${describeResult(result)}`);
		const everyoneFinished = results.every(result => result.finished);

		return sentences(
			everyoneFinished ? 'Гонку завершено!' : 'Фінішний прапор, час вийшов!',
			`Фінальний результат: ${podium.join('; ')}.`,
			`Вітаємо ${results[0].username}!`,
			`З вами був ${COMMENTATOR_NAME}. До зустрічі на трасі!`,
		);
	},

	filler: ({ line }) => line,
};
