export const applyAnimation = `const applyAnimation = (element, properties, duration = 1000) => {
    if (!element) return;
    anime({
        targets: element,
        ...properties,
        duration: duration,
        easing: 'easeInOutQuad'
    });
}`;

export const resetAnimation = `const resetAnimation = (element) => {
    if (!element) return;
    anime.remove(element);
}`;
