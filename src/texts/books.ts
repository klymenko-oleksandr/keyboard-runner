// Public-domain books the race texts are cut from (Project Gutenberg).
// The cleaned texts live in data/books/<id>.txt, one paragraph per line: run `npm run books:prepare` to rebuild them.

export interface BookInfo {
	id: string;
	gutenbergId: number;
	/** repository name on github.com/GITenberg, a mirror of Project Gutenberg */
	mirror: string;
	title: string;
	author: string;
	/** for the commentator */
	titleUk: string;
	authorUk: string;
	fact: string;
}

export const BOOKS: readonly BookInfo[] = [
	{
		id: 'sherlock-holmes',
		gutenbergId: 1661,
		mirror: 'The-Adventures-of-Sherlock-Holmes',
		title: 'The Adventures of Sherlock Holmes',
		author: 'Arthur Conan Doyle',
		titleUk: 'Пригоди Шерлока Холмса',
		authorUk: 'Артур Конан Дойл',
		fact: 'Оповідання збірки спершу виходили в лондонському журналі The Strand у 1891–1892 роках.',
	},
	{
		id: 'three-men-in-a-boat',
		gutenbergId: 308,
		mirror: 'Three-Men-in-a-Boat',
		title: 'Three Men in a Boat',
		author: 'Jerome K. Jerome',
		titleUk: 'Троє в човні, не рахуючи собаки',
		authorUk: 'Джером К. Джером',
		fact: 'Спершу Джером задумував серйозний путівник Темзою, а вийшла одна з найсмішніших книжок вікторіанської Англії.',
	},
	{
		id: 'tom-sawyer',
		gutenbergId: 74,
		mirror: 'The-Adventures-of-Tom-Sawyer',
		title: 'The Adventures of Tom Sawyer',
		author: 'Mark Twain',
		titleUk: 'Пригоди Тома Сойєра',
		authorUk: 'Марк Твен',
		fact: 'Марк Твен — псевдонім Семюела Клеменса, узятий з мови лоцманів на Міссісіпі.',
	},
	{
		id: 'alice-in-wonderland',
		gutenbergId: 11,
		mirror: 'Alice-s-Adventures-in-Wonderland',
		title: "Alice's Adventures in Wonderland",
		author: 'Lewis Carroll',
		titleUk: 'Аліса в Країні Див',
		authorUk: 'Льюїс Керрол',
		fact: 'Льюїс Керрол — псевдонім оксфордського математика Чарльза Доджсона.',
	},
	{
		id: 'around-the-world',
		gutenbergId: 103,
		mirror: 'Around-the-World-in-80-Days',
		title: 'Around the World in Eighty Days',
		author: 'Jules Verne',
		titleUk: 'Навколо світу за вісімдесят днів',
		authorUk: 'Жуль Верн',
		fact: 'Роман спершу друкувався частинами в паризькій газеті Le Temps у 1872 році, а читаємо ми його англійський переклад.',
	},
	{
		id: 'call-of-the-wild',
		gutenbergId: 215,
		mirror: 'The-Call-of-the-Wild',
		title: 'The Call of the Wild',
		author: 'Jack London',
		titleUk: 'Поклик предків',
		authorUk: 'Джек Лондон',
		fact: 'Джек Лондон сам вирушав на Клондайк під час золотої лихоманки 1897 року.',
	},
];
