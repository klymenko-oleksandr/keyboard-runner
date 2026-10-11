export const createElement = ({ tagName, className, attributes = {}, innerElements = [] }) => {
	const element = document.createElement(tagName);

	if (className) {
		addClass(element, className);
	}

	Object.keys(attributes).forEach(key => element.setAttribute(key, attributes[key]));

	// strings are appended as text nodes -> user input can never become HTML (no XSS)
	innerElements.forEach(innerElement => element.append(innerElement));

	return element;
};

export const addClass = (element, className) => {
	const classNames = formatClassNames(className);
	element.classList.add(...classNames);
};

export const removeClass = (element, className) => {
	const classNames = formatClassNames(className);
	element.classList.remove(...classNames);
};

export const formatClassNames = className => className.split(' ').filter(Boolean);

export const show = element => removeClass(element, 'display-none');
export const hide = element => addClass(element, 'display-none');
