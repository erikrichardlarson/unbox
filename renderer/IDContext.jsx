import React, { createContext, useState, useEffect } from 'react';

export const IDContext = createContext();

export const IDProvider = ({ children }) => {
    const [ID, setID] = useState({artist: 'ID', title: 'ID', label: 'ID', remix: '', artwork: ''});

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000');
        ws.onmessage = (message) => {
            const data = JSON.parse(message.data);
            setID({
                artist: data.artist || 'ID',
                title: data.track || 'ID',
                label: data.label || 'ID',
                remix: data.remix || '',
                artwork: data.artwork || '',
            });
        };

        return () => {
            ws.close();
        };
    }, []);

    return (
        <IDContext.Provider value={ID}>
            {children}
        </IDContext.Provider>
    );
};

export default IDContext;