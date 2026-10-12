// One pure function per comment type: payload in, text out.
// The phrasing avoids past-tense verbs about drivers: in Ukrainian they would need the driver's gender.
import { take } from 'lodash';
import { COMMENTATOR_NAME, PHOTO_FINISH_MS, VENUE } from '../config';
import { sentences } from '../helpers/text';
import { getGap, getProgressPercent } from '../helpers/standings';
import {
	characters,
	drivers,
	formatRaceTime,
	joinWithAnd,
	joinWithOr,
	meetings,
	placeWord,
	positionAccusative,
	positionNominative,
	positionWord,
	races,
	seconds,
	wins,
} from '../helpers/ukrainian';
import type { GameResultDto } from '../../socket/types';
import type { CommentPayloads, DriverProfile, Standing, TemplateTools, Templates } from '../types';

/* ---------- Pieces ---------- */

const describeRecord = ({ races: count, wins: winsCount, bestWpm, winStreak }: DriverProfile) => {
	if (count === 0) {
		return 'Це дебютна гонка!';
	}
	const winsPart = winsCount > 0 ? `, із них ${wins(winsCount)}` : '';
	const speedPart = bestWpm > 0 ? `, найкраща швидкість — ${bestWpm} WPM` : '';
	return sentences(
		`На рахунку ${races(count)}${winsPart}${speedPart}.`,
		winStreak >= 2 && `Серія: ${wins(winStreak)} поспіль!`,
	);
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

const describeSpeedNews = (speed: CommentPayloads['finish']['speed'], { pick }: TemplateTools) => {
	if (!speed) {
		return '';
	}
	if (speed.kind === 'debut') {
		return pick([`Для дебюту дуже непогано: ${speed.wpm} WPM.`, `${speed.wpm} WPM у першій же гонці. Запам'ятаймо це ім'я!`]);
	}
	return pick([
		`І це новий особистий рекорд: ${speed.wpm} WPM замість ${speed.previousBest}!`,
		`Особистий рекорд! ${speed.wpm} WPM, попередній найкращий результат — ${speed.previousBest}.`,
	]);
};

const describeFinishLine = ({ username, place, finishTimeMs, isLast, previous }: CommentPayloads['finish'], { pick }: TemplateTools) => {
	const time = formatRaceTime(finishTimeMs);
	if (previous && previous.gapMs < PHOTO_FINISH_MS) {
		return `Фотофініш! ${username} перетинає лінію лише на ${formatRaceTime(previous.gapMs)} пізніше за ${previous.username}: ${placeWord(place)} місце.`;
	}
	if (place === 1) {
		return pick([
			`Фінішну пряму перетинає ${username}, і це перше місце! Час: ${time}.`,
			`Перемога! ${username} перетинає фінішну лінію з часом ${time}.`,
			`І переможець — ${username}! Час на фініші: ${time}.`,
		]);
	}
	if (isLast) {
		return `Круг завершує ${username}: ${placeWord(place)} місце, ${time}. Усі гонщики на фініші!`;
	}
	return pick([
		`Фінішну пряму перетинає ${username}: ${placeWord(place)} місце, ${time}.`,
		`${username} на фініші: ${placeWord(place)} місце, час ${time}.`,
	]);
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

	rivalry: ({ drivers: [first, second], record }, { pick }) => {
		if (record.meetings === 1) {
			return pick([
				`${first} і ${second} уже зустрічалися на цій трасі, і тоді перемога була за ${record.lastWinner}. Чи буде реванш?`,
				`А ось і повторна зустріч: ${first} проти ${second}. Минулого разу перемога за ${record.lastWinner}.`,
			]);
		}
		const firstWins = record.wins[first] ?? 0;
		const secondWins = record.wins[second] ?? 0;
		const score =
			firstWins === secondWins
				? `рахунок рівний, ${firstWins}:${secondWins}`
				: `рахунок ${firstWins}:${secondWins} на користь ${firstWins > secondWins ? first : second}`;
		return sentences(
			`${first} і ${second} — давні суперники: між ними вже ${meetings(record.meetings)}, ${score}.`,
			`Минулого разу перемога за ${record.lastWinner}.`,
		);
	},

	track: ({ book }, { pick }) =>
		sentences(
			pick([
				`Сьогоднішня траса — уривок з книжки «${book.titleUk}», автор ${book.authorUk}.`,
				`Друкуємо сьогодні класику: «${book.titleUk}», ${book.authorUk}.`,
			]),
			book.fact,
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

	overtake: ({ username, overtaken, position }, { pick }) => {
		const rivals = overtaken.length > 1 ? `одразу ${joinWithAnd(overtaken)}` : overtaken[0];
		if (position === 1) {
			return pick([
				`${username} обходить ${rivals} і очолює гонку!`,
				`Зміна лідера! ${username} випереджає ${rivals}, і тепер попереду.`,
				`${username} проривається на першу позицію, позаду лишається ${rivals}!`,
			]);
		}
		return pick([
			`${username} обходить ${rivals} і піднімається на ${positionAccusative(position)} позицію.`,
			`Обгін! ${username} випереджає ${rivals}, тепер на ${positionWord(position)} позиції.`,
		]);
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

	finish: (payload, tools) => sentences(describeFinishLine(payload, tools), describeSpeedNews(payload.speed, tools)),

	retired: ({ username, isRaceRunning }) =>
		isRaceRunning
			? `${username} заїжджає в бокси й сходить з дистанції. Шкода, але гонка триває!`
			: `${username} покидає стартову решітку ще до старту.`,

	results: ({ results, winnerStreak, comeback }) => {
		const podium = take(results, 3).map(result => `${placeWord(result.place)} місце — ${describeResult(result)}`);
		const everyoneFinished = results.every(result => result.finished);
		const winner = results[0].username;

		return sentences(
			everyoneFinished ? 'Гонку завершено!' : 'Фінішний прапор, час вийшов!',
			`Фінальний результат: ${podium.join('; ')}.`,
			comeback &&
				`Камбек дня — ${comeback.username}: посеред гонки лише ${positionNominative(comeback.worstPosition)} позиція, а на фініші ${placeWord(comeback.place)} місце!`,
			winnerStreak >= 2 ? `Вітаємо ${winner}: це вже ${wins(winnerStreak)} поспіль!` : `Вітаємо ${winner}!`,
			`З вами був ${COMMENTATOR_NAME}. До зустрічі на трасі!`,
		);
	},

	filler: ({ line }) => line,
};
