import { applyAnimation, resetAnimation } from './animationHelper';
import { updateTrackDetails } from './trackDetails';

const localIP = await window.electron.invoke("get-local-ip");


export const setupWebSocket = `const setupWebSocket = (elements) => {
    ${applyAnimation}
    ${resetAnimation}
    
    const socket = new WebSocket('ws://${localIP}:3000');

    socket.addEventListener('message', (event) => {
        const trackDetails = JSON.parse(event.data);

        elements.forEach((item) => {
            applyAnimation(item.element, { translateX: [0, '100%'], opacity: [1, 0] }, (1 + item.id * 0.1) * 1000);
        });

        setTimeout(() => {
            ${updateTrackDetails}
            updateTrackDetails(trackDetails, elements);

            elements.forEach((item) => {
                resetAnimation(item.element);
                applyAnimation(item.element, { translateX: ['100%', 0], opacity: [0, 1] }, (1 + item.id * 0.1) * 1000);
            });

        }, 1000);
    });
}`;
