import { applyAnimation, resetAnimation } from './animationHelper';

export const updateTrackDetails = `const updateTrackDetails = (trackDetails, elements) => {
    ${applyAnimation}
    ${resetAnimation}
    elements.forEach((item) => {
        let content;
        switch (item.contentType) {
            case 'NOW PLAYING':
                content = 'NOW PLAYING';
                break;
            case 'Artist':
                content = trackDetails.artist || '';
                break;
            case 'Title':
                content = trackDetails.track || '';
                break;
            case 'Artist - Title':
                content = trackDetails.artist && trackDetails.track ? \`\${trackDetails.artist} - '\${trackDetails.track}'\` : '';
                break;
            case 'Label':
                content = trackDetails.artist && !trackDetails.label ? '' : \`[\${trackDetails.label}]\`;
                break;
           case 'Album Art':
                content = trackDetails.artwork || '';
                break;
            default:
                content = '';
        }

        if (item.element) {
            if (item.contentType === 'Album Art') {
                item.element.style.display = content ? '' : 'none';
                item.element.src = content;
            } 
            else if (item.contentType === 'NOW PLAYING') {
                document.querySelector('.sweep-text-now-playing').textContent = 'NOW PLAYING';
            }
            else {
                item.element.textContent = content;
            }
        }
    });

    elements.forEach((item) => {
        resetAnimation(item.element);
        applyAnimation(item.element, { translateX: ['100%', 0], opacity: [0, 1] }, (1 + item.id * 0.1) * 1000);
    });
}`;
